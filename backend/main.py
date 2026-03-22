from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import uuid
import sqlite3
import json
import time
import random
import asyncio
import httpx
import hashlib
import hmac
import bcrypt
import secrets
import base64
import os
import re
import ipaddress
import socket
import logging
import logging.config
from collections import defaultdict
from datetime import datetime, timezone

# ── Structured JSON logging ───────────────────────────────────────────────────

class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log = {
            "ts":      self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":   record.levelname,
            "msg":     record.getMessage(),
        }
        for key in ("agent_id", "pipeline_id", "job_id", "latency_ms",
                    "error", "status_code", "wallet_id", "step"):
            if hasattr(record, key):
                log[key] = getattr(record, key)
        if record.exc_info:
            log["exc"] = self.formatException(record.exc_info)
        return json.dumps(log)

_handler = logging.StreamHandler()
_handler.setFormatter(_JsonFormatter())
logger = logging.getLogger("agentverse")
logger.addHandler(_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

app = FastAPI(title="AgentVerse", version="2.0.0")

_CORS_ORIGINS_RAW = os.environ.get("CORS_ORIGINS", "*")
_CORS_ORIGINS = (
    ["*"] if _CORS_ORIGINS_RAW.strip() == "*"
    else [o.strip() for o in _CORS_ORIGINS_RAW.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=_CORS_ORIGINS_RAW.strip() != "*",
)

# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────

DB_PATH         = os.environ.get("DB_PATH", "../database/agents.db")
PLATFORM_WALLET = "platform"
DEMO_WALLET     = "demo"
PLATFORM_FEE    = 0.10   # 10 % to platform, 90 % to agent creator

# ── x402 payment protocol ─────────────────────────────────────────────────────
# Docs: https://x402.org  |  Spec: https://github.com/coinbase/x402
X402_ENABLED      = os.environ.get("X402_ENABLED", "true").lower() == "true"
X402_NETWORK      = os.environ.get("X402_NETWORK", "base-mainnet")
X402_FACILITATOR  = os.environ.get("X402_FACILITATOR", "https://x402.org/facilitator")
X402_API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000")

# ── Stripe payments ────────────────────────────────────────────────────────────
import stripe as _stripe_lib
STRIPE_SECRET_KEY      = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET  = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL           = os.environ.get("FRONTEND_URL", "https://agentverse-puce.vercel.app")
if STRIPE_SECRET_KEY:
    _stripe_lib.api_key = STRIPE_SECRET_KEY

# USDC contract addresses (6 decimals)
_USDC = {
    "base-mainnet":  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "base-sepolia":  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
}

def _usd_to_usdc_atomic(usd: float) -> int:
    """Convert USD price to USDC atomic units (6 decimals). e.g. $0.01 → 10000."""
    return max(1, int(round(usd * 1_000_000)))

def _x402_payment_requirements(agent_id: str, agent_name: str, price_usd: float, pay_to: str) -> dict:
    """Build the x402 payment requirements object for a 402 response."""
    return {
        "x402Version": 1,
        "accepts": [{
            "scheme":             "exact",
            "network":            X402_NETWORK,
            "maxAmountRequired":  str(_usd_to_usdc_atomic(price_usd)),
            "resource":           f"{X402_API_BASE_URL}/call-agent/{agent_id}",
            "description":        f"Call {agent_name} agent — ${price_usd:.4f} per request",
            "mimeType":           "application/json",
            "payTo":              pay_to,
            "maxTimeoutSeconds":  60,
            "asset":              _USDC.get(X402_NETWORK, _USDC["base-sepolia"]),
            "extra":              {"name": "USDC", "version": "2"},
        }],
        "error": "X-PAYMENT header required. Include payment proof to call this agent.",
    }

async def _verify_x402_payment(payment_header: str, agent_id: str, price_usd: float, pay_to: str):
    """Verify a payment proof with the x402 facilitator.

    Returns:
      True             — valid, first-time payment (stored to prevent replay)
      "replay"         — payment hash already seen (replay attack)
      "invalid"        — facilitator says payment is not valid
      "facilitator_down" — could not reach facilitator within timeout
    """
    # ── Step 1: replay-attack check ───────────────────────────────────────────
    payment_hash = hashlib.sha256(payment_header.encode()).hexdigest()
    conn = get_db()
    existing = conn.execute(
        "SELECT 1 FROM used_payments WHERE hash = ?", (payment_hash,)
    ).fetchone()
    if existing:
        conn.close()
        logger.warning("x402 replay attack blocked", extra={"agent_id": agent_id, "hash": payment_hash[:16]})
        return "replay"

    # ── Step 2: verify with facilitator ──────────────────────────────────────
    try:
        verify_payload = {
            "x402Version": 1,
            "scheme":      "exact",
            "network":     X402_NETWORK,
            "payload":     payment_header,
            "resource": {
                "url":    f"{X402_API_BASE_URL}/call-agent/{agent_id}",
                "method": "POST",
            },
            "amount":  str(_usd_to_usdc_atomic(price_usd)),
            "payTo":   pay_to,
            "asset":   _USDC.get(X402_NETWORK, _USDC["base-sepolia"]),
        }
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(f"{X402_FACILITATOR}/verify", json=verify_payload)
            if resp.status_code != 200 or not resp.json().get("isValid", False):
                conn.close()
                return "invalid"
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        conn.close()
        logger.warning("x402 facilitator unreachable", extra={"error": str(e), "agent_id": agent_id})
        return "facilitator_down"
    except Exception as e:
        conn.close()
        logger.warning("x402 verification error", extra={"error": str(e), "agent_id": agent_id})
        return "facilitator_down"

    # ── Step 3: mark payment as used (prevent replay) ─────────────────────────
    conn.execute(
        "INSERT INTO used_payments (hash, agent_id, ts) VALUES (?, ?, ?)",
        (payment_hash, agent_id, _now())
    )
    conn.commit()
    conn.close()
    logger.info("x402 payment verified", extra={"agent_id": agent_id, "amount_usd": price_usd})
    return True

# ── Auth / Safety constants ───────────────────────────────────────────────────
_jwt_secret_raw = os.environ.get("JWT_SECRET")
if not _jwt_secret_raw:
    import warnings
    warnings.warn(
        "JWT_SECRET env var not set — using insecure default. Set JWT_SECRET in production!",
        RuntimeWarning, stacklevel=1,
    )
    _jwt_secret_raw = "agentverse-dev-secret-CHANGE-IN-PROD"
JWT_SECRET = _jwt_secret_raw
API_KEY_PREFIX      = "av_"
TOKEN_TTL_SECONDS   = 86400          # 24 h
MAX_PIPELINE_STEPS      = 10
MAX_CONCURRENT_PIPELINES = 50        # simultaneous pipeline runs
MAX_RUNTIME_S           = 15.0       # seconds per pipeline execution
MAX_AGENT_RETRIES       = 1          # retry a failing agent call once
RATE_LIMIT_WINDOW       = 60         # seconds
RATE_LIMIT_MAX          = 100        # requests per window per key/IP
MAX_PRICE_PER_REQUEST   = 10.0       # hard cap per agent call (USD)
MAX_AGENTS_PER_USER     = 20         # max agents a single developer can register

# ── World Chain / USDC deposit constants ──────────────────────────────────────
WORLD_CHAIN_RPC_URL     = os.environ.get("WORLD_CHAIN_RPC_URL", "https://worldchain-mainnet.g.alchemy.com/public")
PLATFORM_ETH_ADDRESS    = os.environ.get("PLATFORM_ETH_ADDRESS", "").lower()
# USDC on World Chain (same as Base/Optimism)
USDC_CONTRACT_ADDRESS   = os.environ.get("USDC_CONTRACT_ADDRESS", "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1").lower()
# ERC-20 Transfer topic: keccak256("Transfer(address,address,uint256)")
ERC20_TRANSFER_TOPIC    = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
USDC_DECIMALS           = 6
MAX_USDC_DEPOSIT        = 10_000.0   # USD cap per single deposit
_rate_store: dict[str, list[float]] = defaultdict(list)
_pipeline_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PIPELINES)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def _verify_token(token: str) -> str | None:
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        parts = decoded.rsplit(":", 2)
        user_id, ts, sig = parts[0], parts[1], parts[2]
        expected_sig = hmac.new(
            JWT_SECRET.encode(), f"{user_id}:{ts}".encode(), hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(sig, expected_sig):
            if int(time.time()) - int(ts) < TOKEN_TTL_SECONDS:
                return user_id
    except Exception:
        pass
    return None

def _generate_api_key() -> tuple[str, str]:
    """Returns (plaintext, hash). Store only the hash."""
    key = API_KEY_PREFIX + secrets.token_urlsafe(32)
    return key, hashlib.sha256(key.encode()).hexdigest()

async def _get_current_user(request: Request) -> dict | None:
    auth = request.headers.get("Authorization", "")
    conn = get_db()
    user = None
    if auth.startswith("Bearer "):
        uid = _verify_token(auth[7:])
        if uid:
            row = conn.execute("SELECT * FROM users WHERE id = ? AND is_active = 1", (uid,)).fetchone()
            user = dict(row) if row else None
    elif auth.startswith("ApiKey "):
        key_hash = hashlib.sha256(auth[7:].encode()).hexdigest()
        row = conn.execute(
            "SELECT u.* FROM api_keys ak JOIN users u ON ak.user_id = u.id "
            "WHERE ak.key_hash = ? AND ak.is_active = 1 AND u.is_active = 1",
            (key_hash,),
        ).fetchone()
        if row:
            conn.execute("UPDATE api_keys SET last_used = ? WHERE key_hash = ?", (_now(), key_hash))
            conn.commit()
            user = dict(row)
    # Enrich user with wallet_id from developer_profiles so ownership checks work
    if user:
        profile = conn.execute(
            "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()
        user["wallet_id"] = profile["wallet_id"] if profile else None
    conn.close()
    return user

async def _require_auth(request: Request):
    """Async dependency — use as Depends() in endpoints that MUST have auth."""
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Authentication required. Provide Bearer token or ApiKey header.")
    return user

def _check_rate_limit(identifier: str) -> None:
    now = time.time()
    window = _rate_store[identifier]
    _rate_store[identifier] = [t for t in window if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_store[identifier]) >= RATE_LIMIT_MAX:
        raise HTTPException(429, f"Rate limit exceeded: max {RATE_LIMIT_MAX} requests per {RATE_LIMIT_WINDOW}s")
    _rate_store[identifier].append(now)

def _validate_public_url(url: str, field: str = "endpoint") -> None:
    """Raise HTTPException if the URL resolves to a private/internal address (SSRF prevention)."""
    import urllib.parse
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(400, f"{field} must use http or https")
        hostname = parsed.hostname
        if not hostname:
            raise HTTPException(400, f"Invalid {field} URL")
        lower = hostname.lower()
        # Block obviously internal hostnames
        if lower in ("localhost", "metadata.google.internal") or lower.endswith(".local"):
            raise HTTPException(400, f"{field} must be a public URL")
        # Try to parse as IP first
        try:
            ip = ipaddress.ip_address(lower)
        except ValueError:
            # It's a hostname — resolve it
            try:
                ip_str = socket.gethostbyname(hostname)
                ip = ipaddress.ip_address(ip_str)
            except socket.gaierror:
                return  # Cannot resolve — allow (might be a valid domain that's just down)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(400, f"{field} must be a public URL, not a private/internal address")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, f"Invalid {field} URL")


def _migrate(conn):
    """Safe migration: add columns/tables that may not exist yet."""
    # ── WorldChain deposit idempotency table ──────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS used_tx_hashes (
            tx_hash    TEXT PRIMARY KEY,
            wallet_id  TEXT NOT NULL,
            amount_usd REAL NOT NULL,
            ts         TEXT NOT NULL
        )
    """)

    # ── Payout requests ───────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS payout_requests (
            id          TEXT PRIMARY KEY,
            wallet_id   TEXT NOT NULL,
            amount_usd  REAL NOT NULL,
            eth_address TEXT NOT NULL,
            status      TEXT DEFAULT 'pending',
            created_at  TEXT NOT NULL,
            paid_at     TEXT
        )
    """)

    new_agent_cols = [
        ("schema_endpoint",   "TEXT"),
        ("health_endpoint",   "TEXT"),
        ("owner_wallet",      "TEXT"),
        ("created_at",        "TEXT"),
        ("status",            "TEXT DEFAULT 'active'"),
        ("reputation",        "REAL DEFAULT 5.0"),
        ("developer_name",    "TEXT"),
        ("developer_color",   "TEXT"),
        ("agent_balance",     "REAL DEFAULT 0.0"),
        ("total_calls",       "INTEGER DEFAULT 0"),
        ("total_earned",      "REAL DEFAULT 0.0"),
    ]
    for col, typedef in new_agent_cols:
        try:
            conn.execute(f"ALTER TABLE agents ADD COLUMN {col} {typedef}")
        except Exception:
            pass  # already exists

    # ── Agent jobs table (ERC-8183 inspired job marketplace) ─────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agent_jobs (
            id                TEXT PRIMARY KEY,
            title             TEXT NOT NULL,
            description       TEXT,
            required_category TEXT,
            required_min_rep  REAL DEFAULT 0.0,
            bounty_credits    REAL NOT NULL,
            input_data        TEXT DEFAULT '{}',
            output_data       TEXT,
            status            TEXT DEFAULT 'open',
            poster_wallet_id  TEXT NOT NULL,
            poster_name       TEXT,
            claimer_agent_id  TEXT,
            claimer_wallet_id TEXT,
            created_at        TEXT NOT NULL,
            deadline_at       TEXT,
            claimed_at        TEXT,
            completed_at      TEXT
        )
    """)

    new_metric_cols = [
        ("last_called", "TEXT"),
        ("success_rate", "REAL DEFAULT 1.0"),
    ]
    for col, typedef in new_metric_cols:
        try:
            conn.execute(f"ALTER TABLE metrics ADD COLUMN {col} {typedef}")
        except Exception:
            pass

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def init_db():
    conn = get_db()

    # ── Core tables (unchanged schema kept backward-compat) ──────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            endpoint TEXT NOT NULL,
            category TEXT,
            price_per_request REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            agent_id TEXT PRIMARY KEY,
            requests INTEGER DEFAULT 0,
            total_latency_ms REAL DEFAULT 0,
            errors INTEGER DEFAULT 0,
            earnings REAL DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pipelines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            agent_ids TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS challenges (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            reward REAL DEFAULT 0,
            scoring_field TEXT NOT NULL,
            status TEXT DEFAULT 'open'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS challenge_entries (
            id TEXT PRIMARY KEY,
            challenge_id TEXT NOT NULL,
            pipeline_id TEXT NOT NULL,
            pipeline_name TEXT NOT NULL,
            score REAL DEFAULT 0,
            latency_ms REAL DEFAULT 0,
            result TEXT,
            submitted_at TEXT
        )
    """)

    # ── New v2 tables ────────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS wallets (
            id TEXT PRIMARY KEY,
            owner_name TEXT NOT NULL,
            balance REAL DEFAULT 0,
            total_spent REAL DEFAULT 0,
            total_earned REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            user_wallet TEXT NOT NULL,
            agent_id TEXT,
            pipeline_id TEXT,
            amount REAL NOT NULL,
            platform_fee REAL NOT NULL,
            agent_earnings REAL NOT NULL,
            timestamp TEXT NOT NULL,
            idempotency_key TEXT UNIQUE
        )
    """)
    # Migration: add idempotency_key to existing transactions
    try:
        conn.execute("ALTER TABLE transactions ADD COLUMN idempotency_key TEXT UNIQUE")
    except Exception:
        pass  # Column already exists

    # ── Auth tables ──────────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id           TEXT PRIMARY KEY,
            email        TEXT UNIQUE NOT NULL,
            username     TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at   TEXT NOT NULL,
            is_active    INTEGER DEFAULT 1,
            world_nullifier TEXT UNIQUE
        )
    """)
    # Migration: add world_nullifier to existing users tables
    try:
        conn.execute("ALTER TABLE users ADD COLUMN world_nullifier TEXT UNIQUE")
    except Exception:
        pass  # Column already exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            key_hash   TEXT UNIQUE NOT NULL,
            name       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_used  TEXT,
            is_active  INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS developer_profiles (
            user_id       TEXT PRIMARY KEY,
            display_name  TEXT,
            website       TEXT,
            wallet_id     TEXT,
            joined_at     TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # ── Pipeline jobs (async queue) ──────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_jobs (
            id            TEXT PRIMARY KEY,
            pipeline_id   TEXT NOT NULL,
            pipeline_name TEXT,
            status        TEXT NOT NULL DEFAULT 'queued',
            input_data    TEXT,
            result        TEXT,
            error         TEXT,
            wallet_id     TEXT,
            created_at    TEXT NOT NULL,
            started_at    TEXT,
            completed_at  TEXT
        )
    """)

    # ── Password reset tokens ─────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token      TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used       INTEGER DEFAULT 0
        )
    """)

    # ── x402 replay-attack prevention ────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS used_payments (
            hash       TEXT PRIMARY KEY,
            agent_id   TEXT NOT NULL,
            ts         TEXT NOT NULL
        )
    """)

    # ── Agent call logs ───────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS call_logs (
            id         TEXT PRIMARY KEY,
            agent_id   TEXT NOT NULL,
            timestamp  TEXT NOT NULL,
            status     TEXT NOT NULL,
            latency_ms REAL,
            cost       REAL,
            error_msg  TEXT
        )
    """)

    # ── Pipeline schedules ────────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id            TEXT PRIMARY KEY,
            pipeline_id   TEXT NOT NULL,
            pipeline_name TEXT,
            label         TEXT,
            interval      TEXT NOT NULL,
            webhook_url   TEXT,
            is_active     INTEGER DEFAULT 1,
            last_run_at   TEXT,
            next_run_at   TEXT,
            created_at    TEXT NOT NULL
        )
    """)

    # ── Migrations first (adds columns before indexes reference them) ─────────
    _migrate(conn)

    # ── Indexes ──────────────────────────────────────────────────────────────
    conn.execute("CREATE INDEX IF NOT EXISTS idx_agents_category       ON agents(category)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_agents_owner_wallet   ON agents(owner_wallet)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_agents_developer_name ON agents(developer_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_pipeline_id ON pipeline_jobs(pipeline_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_created_at  ON pipeline_jobs(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id    ON transactions(user_wallet)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_schedules_next_run_at     ON schedules(next_run_at)")
    conn.commit()

    # ── Seed wallets if they don't exist ─────────────────────────────────────
    now = _now()
    if not conn.execute("SELECT id FROM wallets WHERE id = ?", (PLATFORM_WALLET,)).fetchone():
        conn.execute(
            "INSERT INTO wallets VALUES (?, ?, ?, ?, ?, ?)",
            (PLATFORM_WALLET, "AgentVerse Platform", 0.0, 0.0, 0.0, now)
        )
    if not conn.execute("SELECT id FROM wallets WHERE id = ?", (DEMO_WALLET,)).fetchone():
        conn.execute(
            "INSERT INTO wallets VALUES (?, ?, ?, ?, ?, ?)",
            (DEMO_WALLET, "Demo User", 100.0, 0.0, 0.0, now)
        )
    conn.commit()
    conn.close()

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_wallet(conn, wallet_id: str) -> dict | None:
    row = conn.execute("SELECT * FROM wallets WHERE id = ?", (wallet_id,)).fetchone()
    return dict(row) if row else None

def _ensure_wallet(conn, wallet_id: str) -> dict:
    w = _get_wallet(conn, wallet_id)
    if not w:
        raise HTTPException(status_code=404, detail=f"Wallet '{wallet_id}' not found")
    return w

def _mock_response(agent_name: str, category: str, payload: dict) -> dict:
    """Realistic mock response when agent endpoint is unreachable (dev mode)."""
    market = payload.get("market", "BTC")
    PRICES = {"BTC": 62000, "ETH": 3200, "SOL": 145, "AVAX": 38, "BNB": 580}
    p = PRICES.get(market, 1000) * random.uniform(0.99, 1.01)
    n = agent_name.lower()

    if "momentum" in n:
        s = random.uniform(-10, 10)
        return {"market": market, "signal": "BUY" if s > 2 else "SELL" if s < -2 else "HOLD",
                "confidence": round(abs(s) / 10 * 0.4 + 0.5, 2), "momentum_score": round(s, 2), "price_usd": round(p, 2)}
    if "sentiment" in n:
        sc = random.randint(10, 95)
        label = "EXTREME_FEAR" if sc < 25 else "FEAR" if sc < 45 else "NEUTRAL" if sc < 55 else "GREED" if sc < 75 else "EXTREME_GREED"
        return {"market": market, "score": sc, "sentiment": label, "social_volume": random.randint(1200, 48000)}
    if "price" in n:
        return {"market": market, "price_usd": round(p, 2), "change_24h_pct": round(random.uniform(-6.5, 6.5), 2),
                "high_24h": round(p * 1.02, 2), "low_24h": round(p * 0.98, 2), "volume_24h_usd": f"{round(random.uniform(8, 42), 1)}B"}
    if "risk" in n:
        s = round(random.uniform(2.5, 9.5), 1)
        return {"market": market, "risk_score": s, "max_drawdown_pct": round(random.uniform(5, 28), 1),
                "recommendation": "ADD" if s < 4 else "HOLD" if s < 7 else "REDUCE_POSITION"}
    if "trend" in n:
        r = random.random()
        return {"market": market, "trend": "UPTREND" if r > 0.55 else "DOWNTREND" if r < 0.3 else "SIDEWAYS",
                "strength": random.choice(["WEAK", "MODERATE", "STRONG"]), "adx": round(random.uniform(12, 55), 1)}
    if "pattern" in n:
        return {"market": market, "confidence": round(random.uniform(0.52, 0.93), 2),
                "pattern": random.choice(["BULL_FLAG", "HEAD_SHOULDERS", "DOUBLE_TOP", "CUP_HANDLE", "ASCENDING_TRIANGLE"])}
    if "volatility" in n:
        v = round(random.uniform(14, 55), 1)
        return {"market": market, "vix_equiv": v, "regime": "LOW" if v < 20 else "MEDIUM" if v < 35 else "HIGH",
                "recommendation": "HOLD" if v < 20 else "HEDGE" if v < 35 else "REDUCE"}
    if "arbitrage" in n:
        sp = round(random.uniform(0.01, 0.35), 3)
        return {"market": market, "opportunity": "HIGH" if sp > 0.2 else "MEDIUM" if sp > 0.1 else "LOW",
                "spread_pct": sp, "net_profit_est": round(sp * 0.7, 3)}
    if "news" in n:
        return {"market": market, "sentiment_score": round(random.uniform(-0.3, 0.9), 2),
                "headline": f"{market} market shows {random.choice(['strong', 'moderate', 'mixed'])} signals",
                "source_count": random.randint(3, 28)}
    if "depth" in n:
        liq = round(random.uniform(4, 9.8), 1)
        return {"market": market, "liquidity_score": liq, "depth": "HIGH" if liq > 7.5 else "MEDIUM" if liq > 5 else "LOW",
                "bid_ask_spread": round(random.uniform(0.004, 0.08), 4)}
    if "correlation" in n:
        return {"market": market, "regime": random.choice(["RISK_ON", "RISK_OFF", "NEUTRAL"]),
                "corr_eth": round(random.uniform(0.72, 0.96), 2), "beta": round(random.uniform(0.8, 2.1), 2)}
    if "portfolio" in n:
        sh = round(random.uniform(0.8, 2.8), 2)
        return {"market": market, "optimal_allocation_pct": round(random.uniform(5, 25), 1),
                "sharpe_ratio": sh, "rebalance": random.choice(["BUY", "HOLD", "TRIM"])}
    # Name-based fallback for new template agents
    if "search" in n:
        return {"status": "ok", "query": payload.get("input", "test"), "results": [{"title": f"Result {i+1}", "url": f"https://example.com/{i+1}", "snippet": "Relevant content found."} for i in range(random.randint(3, 6))], "_mock": True}
    if "summar" in n:
        return {"status": "ok", "summary": "Key points: (1) Main finding. (2) Supporting evidence. (3) Conclusion.", "word_count": random.randint(80, 200), "_mock": True}
    if "writer" in n or "copy" in n:
        return {"status": "ok", "output": "Your content has been generated with engaging tone and clear structure.", "tokens_used": random.randint(150, 600), "_mock": True}
    if "reader" in n:
        return {"status": "ok", "title": "Page Title", "content": "Extracted text content from the URL.", "word_count": random.randint(400, 2000), "_mock": True}
    if "scraper" in n:
        return {"status": "ok", "items": [{"text": f"Item {i+1}", "href": f"#item{i+1}"} for i in range(random.randint(4, 12))], "changed": random.choice([True, False]), "_mock": True}
    if "diff" in n:
        changed = random.choice([True, False])
        return {"status": "ok", "changed": changed, "changes": random.randint(1, 8) if changed else 0, "summary": "3 new items, 1 removed." if changed else "No changes detected.", "_mock": True}
    if "alert" in n:
        return {"status": "ok", "triggered": True, "message": "Alert condition met. Notification sent.", "_mock": True}
    # Category-aware fallback for non-finance agents
    if category in ("productivity", "analysis"):
        return {"status": "ok", "result": "Task processed successfully.", "summary": "Agent completed the request.", "confidence": round(random.uniform(0.7, 0.95), 2), "_mock": True}
    if category == "research":
        return {"status": "ok", "result": "Research complete.", "findings": ["Finding A", "Finding B", "Finding C"], "sources": random.randint(3, 12), "_mock": True}
    if category == "creative":
        return {"status": "ok", "result": "Content generated.", "output": "Here is your generated content…", "tokens_used": random.randint(120, 800), "_mock": True}
    if category == "automation":
        return {"status": "ok", "result": "Workflow triggered.", "steps_completed": random.randint(1, 5), "next_action": "none", "_mock": True}
    if category == "web":
        return {"status": "ok", "result": "Scrape complete.", "items_found": random.randint(5, 40), "changed": random.choice([True, False]), "_mock": True}
    # Generic fallback
    return {"status": "ok", "result": "Agent responded.", "confidence": round(random.uniform(0.6, 0.9), 2), "_mock": True}


def _seed_if_empty():
    """Auto-seed demo agents and pipelines on first run (no external server needed)."""
    conn = get_db()
    if conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0] > 0:
        conn.close()
        return

    # In Docker the agents service is at http://agents:8001; locally it's 127.0.0.1:8001
    AGENT_SERVER = os.environ.get("AGENT_SERVER_URL", "http://127.0.0.1:8001")
    now = _now()
    SEED = [
        ("MomentumAgent",      "trading",  f"{AGENT_SERVER}/momentum/run",    0.004, "Momentum signal generator. Returns BUY/SELL/HOLD with confidence score based on price action.",           "AgentVerse", "#58D68D"),
        ("ArbitrageAgent",     "trading",  f"{AGENT_SERVER}/arbitrage/run",   0.006, "Detects cross-exchange arbitrage opportunities and estimates net profit after fees.",                     "AgentVerse", "#58D68D"),
        ("SentimentAgent",     "trading",  f"{AGENT_SERVER}/sentiment/run",   0.003, "Aggregates social and on-chain signals into a Fear & Greed score (0–100).",                             "AgentVerse", "#58D68D"),
        ("VolatilityScanner",  "trading",  f"{AGENT_SERVER}/volatility/run",  0.005, "Computes implied and realized volatility. Returns regime classification and hedging recommendation.",    "AgentVerse", "#58D68D"),
        ("PriceFeedAgent",     "data",     f"{AGENT_SERVER}/price-feed/run",  0.001, "Real-time price feed with 24h stats. Covers BTC, ETH, SOL, AVAX, BNB.",                                "AgentVerse", "#5DADE2"),
        ("NewsFeedAgent",      "data",     f"{AGENT_SERVER}/news-feed/run",   0.002, "Aggregates crypto headlines and scores their sentiment impact on price.",                                "AgentVerse", "#5DADE2"),
        ("MarketDepthAgent",   "data",     f"{AGENT_SERVER}/market-depth/run",0.003, "Measures order book depth, bid-ask spread, and liquidity score across venues.",                         "AgentVerse", "#5DADE2"),
        ("TrendAnalyzer",      "analysis", f"{AGENT_SERVER}/trend/run",       0.004, "Multi-timeframe trend detection using EMA crossovers and ADX strength.",                                "AgentVerse", "#BB8FCE"),
        ("PatternDetector",    "analysis", f"{AGENT_SERVER}/pattern/run",     0.005, "Identifies chart patterns (flags, triangles, head & shoulders) with confidence scores.",                "AgentVerse", "#BB8FCE"),
        ("CorrelationAgent",   "analysis", f"{AGENT_SERVER}/correlation/run", 0.003, "Measures cross-asset correlations and identifies risk-on / risk-off market regimes.",                   "AgentVerse", "#BB8FCE"),
        ("RiskAgent",          "risk",     f"{AGENT_SERVER}/risk/run",        0.005, "Portfolio risk scoring with VaR, max drawdown estimation, and position sizing recommendation.",          "AgentVerse", "#EC7063"),
        ("PortfolioOptimizer", "risk",     f"{AGENT_SERVER}/portfolio/run",   0.008, "Runs mean-variance optimization to compute optimal allocation and Sharpe ratio.",                        "AgentVerse", "#EC7063"),
    ]

    name_to_id = {}
    for name, cat, ep, price, desc, dev_name, dev_color in SEED:
        aid = str(uuid.uuid4())
        name_to_id[name] = aid
        conn.execute(
            """INSERT INTO agents (id, name, description, endpoint, schema_endpoint, health_endpoint,
               category, price_per_request, owner_wallet, created_at, status, reputation,
               developer_name, developer_color)
               VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?, 'active', 5.0, ?, ?)""",
            (aid, name, desc, ep, cat, price, now, dev_name, dev_color)
        )

    PIPELINES = [
        ("MarketPulse",   ["PriceFeedAgent", "SentimentAgent", "MomentumAgent"]),
        ("RiskCheck",     ["PriceFeedAgent", "VolatilityScanner", "RiskAgent"]),
        ("TrendAnalysis", ["PriceFeedAgent", "TrendAnalyzer", "PatternDetector", "MomentumAgent"]),
        ("AlphaSignal",   ["NewsFeedAgent", "SentimentAgent", "CorrelationAgent", "MomentumAgent"]),
    ]
    for pname, agents in PIPELINES:
        ids = [name_to_id[a] for a in agents if a in name_to_id]
        conn.execute("INSERT INTO pipelines VALUES (?, ?, ?)",
                     (str(uuid.uuid4()), pname, json.dumps(ids)))

    # Seed starter challenges
    CHALLENGES = [
        ("Beat the Market",    "Build a pipeline that returns the highest confidence BUY signal on BTC. Chain sentiment + momentum agents for the best score.", 100, "confidence",     "open"),
        ("Volatility Hunter",  "Detect the most extreme volatility regime using live market data. Highest volatility score wins.", 50,  "volatility",     "open"),
        ("Bull Detector",      "Build a pipeline with the highest bullish score on BTC. Combine trend, pattern, and momentum agents.", 75,  "bullish_score",  "open"),
    ]
    for title, desc, reward, field, status in CHALLENGES:
        conn.execute(
            "INSERT INTO challenges (id, title, description, reward, scoring_field, status) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), title, desc, reward, field, status)
        )

    conn.commit()
    conn.close()
    print("✓ AgentVerse: seeded 12 demo agents, 4 pipelines, 3 challenges")


def _seed_new_agents():
    """Add new category agents if they don't exist yet (safe to run on every startup)."""
    AGENT_SERVER = os.environ.get("AGENT_SERVER_URL", "http://127.0.0.1:8001")
    conn = get_db()
    now = _now()

    NEW_AGENTS = [
        ("SearchAgent",      "research",     f"{AGENT_SERVER}/search/run",      0.002, "Searches the web and returns ranked results with summaries for any query.",           "AgentVerse", "#38bdf8"),
        ("SummarizerAgent",  "productivity", f"{AGENT_SERVER}/summarize/run",   0.003, "Condenses long documents, articles, or text into clear bullet-point summaries.",      "AgentVerse", "#a78bfa"),
        ("WriterAgent",      "productivity", f"{AGENT_SERVER}/writer/run",      0.004, "Generates structured written content — reports, briefs, emails — from input context.", "AgentVerse", "#a78bfa"),
        ("ReaderAgent",      "data",         f"{AGENT_SERVER}/reader/run",      0.002, "Fetches and parses content from any URL, returning clean text for downstream agents.", "AgentVerse", "#5DADE2"),
        ("CopywriterAgent",  "creative",     f"{AGENT_SERVER}/copywriter/run",  0.005, "Creates engaging marketing copy, tweets, captions, and ad text from a brief.",        "AgentVerse", "#fb923c"),
        ("ScraperAgent",     "web",          f"{AGENT_SERVER}/scraper/run",     0.003, "Scrapes structured data from any public webpage. Returns JSON-formatted items.",       "AgentVerse", "#4ade80"),
        ("DiffAgent",        "automation",   f"{AGENT_SERVER}/diff/run",        0.002, "Compares two versions of content and highlights what changed. Used in monitoring.",    "AgentVerse", "#f472b6"),
        ("AlertAgent",       "automation",   f"{AGENT_SERVER}/alert/run",       0.001, "Sends structured alerts when triggered conditions are met. Outputs alert payload.",    "AgentVerse", "#f472b6"),
    ]

    name_to_id = {}
    for name, cat, ep, price, desc, dev_name, dev_color in NEW_AGENTS:
        existing = conn.execute("SELECT id FROM agents WHERE name = ?", (name,)).fetchone()
        if existing:
            name_to_id[name] = existing["id"]
            continue
        aid = str(uuid.uuid4())
        name_to_id[name] = aid
        conn.execute(
            """INSERT INTO agents (id, name, description, endpoint, schema_endpoint, health_endpoint,
               category, price_per_request, owner_wallet, created_at, status, reputation,
               developer_name, developer_color)
               VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL, ?, 'active', 4.8, ?, ?)""",
            (aid, name, desc, ep, cat, price, now, dev_name, dev_color)
        )
        print(f"  + seeded {name}")

    # Seed new pipelines if they don't exist
    NEW_PIPELINES = [
        ("ResearchSummary",  ["SearchAgent", "SummarizerAgent", "WriterAgent"]),
        ("ContentCreator",   ["ReaderAgent", "SummarizerAgent", "CopywriterAgent"]),
        ("SiteMonitor",      ["ScraperAgent", "DiffAgent", "AlertAgent"]),
    ]
    for pname, agents in NEW_PIPELINES:
        if conn.execute("SELECT 1 FROM pipelines WHERE name = ?", (pname,)).fetchone():
            continue
        ids = [name_to_id[a] for a in agents if a in name_to_id]
        if ids:
            conn.execute("INSERT INTO pipelines VALUES (?, ?, ?)",
                         (str(uuid.uuid4()), pname, json.dumps(ids)))
            print(f"  + seeded pipeline {pname}")

    conn.commit()
    conn.close()


# ── Startup handled by @app.on_event("startup") at bottom of file ─────────────


def _compute_reputation(requests: int, errors: int, avg_latency_ms: float) -> float:
    if requests == 0:
        return 5.0
    success_rate   = max(0.0, (requests - errors) / requests)
    latency_score  = max(0.0, 1.0 - avg_latency_ms / 800.0)   # 800 ms = baseline
    usage_score    = min(1.0, requests / 200.0)                 # 200 calls = full star
    raw = success_rate * 0.45 + latency_score * 0.35 + usage_score * 0.20
    return round(raw * 5.0, 1)   # 0 – 5 stars

# ─────────────────────────────────────────────────────────────────────────────
# WebSocket manager
# ─────────────────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)

    async def broadcast(self, event: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active.remove(ws)

manager = ConnectionManager()


class LobbyChatManager:
    """Per-lobby chat rooms with message history."""
    MAX_HISTORY = 50

    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}
        self.history: dict[str, list[dict]] = {}

    async def connect(self, ws: WebSocket, lobby_id: str):
        await ws.accept()
        self.rooms.setdefault(lobby_id, []).append(ws)
        self.history.setdefault(lobby_id, [])
        # Send history to new joiner
        for msg in self.history[lobby_id]:
            try:
                await ws.send_text(json.dumps(msg))
            except Exception:
                pass

    def disconnect(self, ws: WebSocket, lobby_id: str):
        room = self.rooms.get(lobby_id, [])
        if ws in room:
            room.remove(ws)

    async def broadcast(self, lobby_id: str, message: dict):
        self.history.setdefault(lobby_id, []).append(message)
        if len(self.history[lobby_id]) > self.MAX_HISTORY:
            self.history[lobby_id] = self.history[lobby_id][-self.MAX_HISTORY:]
        dead = []
        for ws in self.rooms.get(lobby_id, []):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, lobby_id)


chat_manager = LobbyChatManager()

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class AgentRegister(BaseModel):
    name: str
    description: str = ""
    endpoint: str
    schema_endpoint: Optional[str] = None
    health_endpoint: Optional[str] = None
    category: str = "default"
    price_per_request: float = 0.0
    owner_wallet: Optional[str] = None
    developer_name: Optional[str] = None
    developer_color: Optional[str] = None

class AgentRecord(BaseModel):
    id: str
    name: str
    description: str = ""
    endpoint: str
    schema_endpoint: Optional[str] = None
    health_endpoint: Optional[str] = None
    category: str
    price_per_request: float
    owner_wallet: Optional[str] = None
    status: str = "active"
    reputation: float = 5.0
    created_at: Optional[str] = None
    developer_name: Optional[str] = None
    developer_color: Optional[str] = None

class Pipeline(BaseModel):
    name: str
    agent_ids: list[str]

class PipelineRecord(Pipeline):
    id: str

class Challenge(BaseModel):
    title: str
    description: str
    reward: float
    scoring_field: str

class ChallengeRecord(Challenge):
    id: str
    status: str = "open"

class WalletCreate(BaseModel):
    owner_name: str
    initial_balance: float = 0.0

class WalletDeposit(BaseModel):
    amount: float

class WalletWorldChainDeposit(BaseModel):
    tx_hash:    str
    amount_usd: float   # claimed amount — verified on-chain

# ─────────────────────────────────────────────────────────────────────────────
# Metrics helpers
# ─────────────────────────────────────────────────────────────────────────────

def _row_to_metrics(agent_id: str, row) -> dict:
    """Convert a metrics DB row (or None) to a metrics dict."""
    if not row:
        return {"agent_id": agent_id, "requests": 0, "avg_latency_ms": 0,
                "errors": 0, "earnings": 0.0, "success_rate": 1.0, "last_called": None}
    reqs    = row["requests"] or 0
    errors  = row["errors"]   or 0
    avg_lat = round(row["total_latency_ms"] / reqs, 1) if reqs > 0 else 0
    sr      = max(0.0, (reqs - errors) / reqs) if reqs > 0 else 1.0
    return {
        "agent_id":       agent_id,
        "requests":       reqs,
        "avg_latency_ms": avg_lat,
        "errors":         errors,
        "earnings":       round(row["earnings"], 4),
        "success_rate":   round(sr, 3),
        "last_called":    row["last_called"] if "last_called" in row.keys() else None,
    }

def get_metrics(agent_id: str) -> dict:
    conn = get_db()
    row = conn.execute("SELECT * FROM metrics WHERE agent_id = ?", (agent_id,)).fetchone()
    conn.close()
    return _row_to_metrics(agent_id, row)

def get_metrics_bulk(conn, agent_ids: list) -> dict:
    """Fetch metrics for multiple agents in a single query. Returns {agent_id: metrics_dict}."""
    if not agent_ids:
        return {}
    placeholders = ",".join("?" * len(agent_ids))
    rows = conn.execute(
        f"SELECT * FROM metrics WHERE agent_id IN ({placeholders})", agent_ids
    ).fetchall()
    by_id = {r["agent_id"]: r for r in rows}
    return {aid: _row_to_metrics(aid, by_id.get(aid)) for aid in agent_ids}

def record_metrics(agent_id: str, latency_ms: float, price: float,
                   earnings: float = 0.0, error: bool = False):
    conn = get_db()
    conn.execute("""
        INSERT INTO metrics (agent_id, requests, total_latency_ms, errors, earnings, last_called)
        VALUES (?, 1, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
            requests       = requests + 1,
            total_latency_ms = total_latency_ms + excluded.total_latency_ms,
            errors         = errors + excluded.errors,
            earnings       = earnings + excluded.earnings,
            last_called    = excluded.last_called
    """, (agent_id, latency_ms, 1 if error else 0, earnings, _now()))
    conn.commit()
    conn.close()

    # EMA reputation update
    score = 0.0 if error else min(5.0, 4.5 + max(0, (2000 - latency_ms) / 2000) * 0.5)
    conn2 = get_db()
    conn2.execute("""
        UPDATE agents SET
            reputation    = MAX(0.5, MIN(5.0, reputation * 0.92 + ? * 0.08)),
            agent_balance = agent_balance + ?,
            total_calls   = total_calls + 1,
            total_earned  = total_earned + ?
        WHERE id = ?
    """, (score, earnings, earnings, agent_id))
    conn2.commit()
    conn2.close()

# ─────────────────────────────────────────────────────────────────────────────
# Billing engine
# ─────────────────────────────────────────────────────────────────────────────

async def bill_transaction(
    user_wallet_id: str,
    agent_id: str,
    price: float,
    pipeline_id: str | None = None,
    owner_wallet_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """Deduct from user, split earnings 80/20, log transaction, broadcast event.

    Uses BEGIN IMMEDIATE to atomically check balance + debit in a single write lock,
    preventing double-charge race conditions. Supports idempotency keys to safely
    handle retried requests.
    """
    if price <= 0:
        return {"amount": 0.0, "platform_fee": 0.0, "agent_earnings": 0.0}

    fee      = round(price * PLATFORM_FEE, 6)
    earnings = round(price * (1 - PLATFORM_FEE), 6)
    now      = _now()
    tx_id    = str(uuid.uuid4())

    conn = get_db()
    conn.isolation_level = None  # Manual transaction control

    try:
        # ── Idempotency check (before acquiring write lock) ────────────────────
        if idempotency_key:
            existing = conn.execute(
                "SELECT * FROM transactions WHERE idempotency_key = ?", (idempotency_key,)
            ).fetchone()
            if existing:
                conn.close()
                logger.info("billing idempotency hit — not double-charging",
                            extra={"agent_id": agent_id, "key": idempotency_key[:16]})
                return {
                    "transaction_id": existing["id"],
                    "amount":          existing["amount"],
                    "platform_fee":    existing["platform_fee"],
                    "agent_earnings":  existing["agent_earnings"],
                    "user_balance":    0,  # balance already reflected
                    "idempotent":      True,
                }

        # ── BEGIN IMMEDIATE: acquires write lock before any reads ──────────────
        # This prevents two concurrent requests both passing the balance check.
        conn.execute("BEGIN IMMEDIATE")

        MIN_BALANCE = -1.0  # allow $1 overdraft for demo/grace period
        wallet_row = conn.execute(
            "SELECT balance FROM wallets WHERE id = ?", (user_wallet_id,)
        ).fetchone()
        if wallet_row and wallet_row["balance"] - price < MIN_BALANCE:
            conn.execute("ROLLBACK")
            conn.close()
            raise HTTPException(402, "Insufficient credits. Top up your wallet to continue.")

        conn.execute("""
            UPDATE wallets SET
                balance     = balance - ?,
                total_spent = total_spent + ?
            WHERE id = ?
        """, (price, price, user_wallet_id))

        # Credit platform
        conn.execute("""
            UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ?
            WHERE id = ?
        """, (fee, fee, PLATFORM_WALLET))

        # Credit agent owner (if set and wallet exists)
        if owner_wallet_id:
            owner_exists = conn.execute(
                "SELECT id FROM wallets WHERE id = ?", (owner_wallet_id,)
            ).fetchone()
            if owner_exists:
                conn.execute("""
                    UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ?
                    WHERE id = ?
                """, (earnings, earnings, owner_wallet_id))

        # Log transaction
        conn.execute(
            "INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (tx_id, user_wallet_id, agent_id, pipeline_id, price, fee, earnings, now, idempotency_key)
        )

        user_balance = conn.execute(
            "SELECT balance FROM wallets WHERE id = ?", (user_wallet_id,)
        ).fetchone()

        conn.execute("COMMIT")

    except HTTPException:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        conn.close()
        raise
    except Exception as e:
        try:
            conn.execute("ROLLBACK")
        except Exception:
            pass
        conn.close()
        logger.error("bill_transaction failed", extra={"error": str(e), "agent_id": agent_id})
        raise HTTPException(500, "Billing error — please try again")

    conn.close()

    result = {
        "transaction_id": tx_id,
        "amount":          price,
        "platform_fee":    fee,
        "agent_earnings":  earnings,
        "user_balance":    round(user_balance["balance"], 4) if user_balance else 0,
    }

    await manager.broadcast({
        "type":        "payment_processed",
        "agent_id":    agent_id,
        "pipeline_id": pipeline_id,
        **result,
    })

    return result

# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
def home():
    return {"message": "AgentVerse v2 running", "version": "2.0.0"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/chat/{lobby_id}")
async def lobby_chat_endpoint(websocket: WebSocket, lobby_id: str):
    await chat_manager.connect(websocket, lobby_id)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            message = {
                "type":    "chat",
                "lobby":   lobby_id,
                "user":    data.get("user", "anon"),
                "text":    str(data.get("text", ""))[:300],
                "ts":      _now(),
            }
            await chat_manager.broadcast(lobby_id, message)
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket, lobby_id)

# ── Agents ────────────────────────────────────────────────────────────────────

@app.post("/agents", response_model=AgentRecord, status_code=201)
async def register_agent(agent: AgentRegister):
    """Register a new agent. Validates the run endpoint with a probe call."""
    # ── Input validation ──────────────────────────────────────────────────────
    if agent.price_per_request < 0:
        raise HTTPException(status_code=400, detail="price_per_request cannot be negative")
    if agent.price_per_request > MAX_PRICE_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=f"price_per_request cannot exceed ${MAX_PRICE_PER_REQUEST:.2f}"
        )
    if agent.owner_wallet and not re.match(r"^0x[0-9a-fA-F]{40}$", agent.owner_wallet):
        raise HTTPException(
            status_code=400,
            detail="owner_wallet must be a valid Ethereum address (0x followed by 40 hex characters)"
        )
    # SSRF prevention — block private/internal endpoint URLs
    _validate_public_url(agent.endpoint, "endpoint")
    if agent.health_endpoint:
        _validate_public_url(agent.health_endpoint, "health_endpoint")
    if agent.schema_endpoint:
        _validate_public_url(agent.schema_endpoint, "schema_endpoint")

    status = "active"

    async with httpx.AsyncClient(timeout=8) as client:
        # ── Probe the run endpoint ────────────────────────────────────────────
        probe_payload = {"market": "BTC", "_probe": True}
        try:
            r = await client.post(agent.endpoint, json=probe_payload)
            if r.status_code >= 500:
                status = "degraded"
            elif r.status_code >= 400:
                # Endpoint exists but rejects our probe — still register as active
                # (agent may require specific payload; registration is still valid)
                status = "active"
            else:
                # Validate response is JSON-serializable
                try:
                    r.json()
                except Exception:
                    status = "degraded"
        except httpx.ConnectError:
            status = "unreachable"
            logger.warning("Agent endpoint unreachable at registration",
                           extra={"error": f"ConnectError on {agent.endpoint}"})
        except Exception as exc:
            status = "degraded"
            logger.warning("Agent probe failed",
                           extra={"error": str(exc)})

        # ── Optional health endpoint check ────────────────────────────────────
        if agent.health_endpoint and status == "active":
            try:
                r = await client.get(agent.health_endpoint)
                if r.status_code != 200:
                    status = "degraded"
            except Exception:
                pass

        # ── Schema fetch (non-blocking) ───────────────────────────────────────
        if agent.schema_endpoint:
            try:
                await client.get(agent.schema_endpoint)
            except Exception:
                pass

    agent_id = str(uuid.uuid4())
    now      = _now()
    conn = get_db()
    conn.execute(
        """INSERT INTO agents
           (id, name, description, endpoint, schema_endpoint, health_endpoint,
            category, price_per_request, owner_wallet, created_at, status, reputation,
            developer_name, developer_color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, ?, ?)""",
        (agent_id, agent.name, agent.description, agent.endpoint,
         agent.schema_endpoint, agent.health_endpoint,
         agent.category, agent.price_per_request,
         agent.owner_wallet, now, status,
         agent.developer_name, agent.developer_color)
    )
    conn.commit()
    conn.close()

    await manager.broadcast({
        "type":       "agent_registered",
        "agent_id":   agent_id,
        "agent_name": agent.name,
        "category":   agent.category,
    })

    return AgentRecord(
        id=agent_id, name=agent.name, description=agent.description,
        endpoint=agent.endpoint, schema_endpoint=agent.schema_endpoint,
        health_endpoint=agent.health_endpoint, category=agent.category,
        price_per_request=agent.price_per_request, owner_wallet=agent.owner_wallet,
        status=status, reputation=5.0, created_at=now,
    )

@app.post("/agents/register", response_model=AgentRecord, status_code=201)
async def register_agent_alias(agent: AgentRegister):
    """Alias for POST /agents — used by the SDK CLI."""
    return await register_agent(agent)

@app.get("/agents")
def list_agents(search: Optional[str] = None, category: Optional[str] = None, limit: int = 100, offset: int = 0):
    conn = get_db()
    query  = "SELECT * FROM agents WHERE 1=1"
    params: list = []
    if category:
        query += " AND category = ?"
        params.append(category)
    if search:
        query += " AND (name LIKE ? OR description LIKE ?)"
        params += [f"%{search}%", f"%{search}%"]
    query += f" LIMIT ? OFFSET ?"
    params += [min(limit, 500), max(offset, 0)]
    rows = conn.execute(query, params).fetchall()
    agent_ids = [r["id"] for r in rows]
    metrics_map = get_metrics_bulk(conn, agent_ids)
    conn.close()
    result = []
    for row in rows:
        m   = metrics_map[row["id"]]
        rep = _compute_reputation(m["requests"], m["errors"], m["avg_latency_ms"])
        rec = dict(row)
        rec["requests"]       = m["requests"]
        rec["avg_latency_ms"] = m["avg_latency_ms"]
        rec["earnings"]       = m["earnings"]
        rec["reputation"]     = rep
        result.append(rec)
    return result

@app.get("/developers")
def list_developers():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM agents WHERE developer_name IS NOT NULL AND developer_name != ''"
    ).fetchall()
    agent_ids = [r["id"] for r in rows]
    metrics_map = get_metrics_bulk(conn, agent_ids)
    conn.close()
    devs = {}
    for row in rows:
        name  = row["developer_name"]
        color = row["developer_color"] or "#4a9fd4"
        m     = metrics_map[row["id"]]
        if name not in devs:
            devs[name] = {"name": name, "color": color, "agents": [], "total_calls": 0, "total_earnings": 0.0}
        devs[name]["agents"].append({
            "id": row["id"], "name": row["name"], "category": row["category"],
            "calls": m["requests"], "earnings": m["earnings"],
        })
        devs[name]["total_calls"]    += m["requests"]
        devs[name]["total_earnings"] += m["earnings"]
    return list(devs.values())

@app.get("/agents/{agent_id}")
def get_agent(agent_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    m   = get_metrics(agent_id)
    rec = dict(row)
    rec.update(requests=m["requests"], avg_latency_ms=m["avg_latency_ms"],
               earnings=m["earnings"],
               reputation=_compute_reputation(m["requests"], m["errors"], m["avg_latency_ms"]))
    # Attach x402 payment info if this agent accepts on-chain payments
    ow = rec.get("owner_wallet") or ""
    if X402_ENABLED and ow.startswith("0x") and len(ow) == 42 and rec.get("price_per_request", 0) > 0:
        rec["x402"] = {
            "network":   X402_NETWORK,
            "asset":     "USDC",
            "amount":    _usd_to_usdc_atomic(rec["price_per_request"]),
            "payTo":     ow,
            "resource":  f"{X402_API_BASE_URL}/call-agent/{agent_id}",
        }
    return rec

@app.get("/agents/{agent_id}/pipelines")
def agent_pipelines(agent_id: str):
    """Return all pipelines that include this agent."""
    conn = get_db()
    rows = conn.execute("""
        SELECT DISTINCT p.*
        FROM pipelines p, json_each(p.agent_ids) je
        WHERE je.value = ?
    """, (agent_id,)).fetchall()
    conn.close()
    return [
        PipelineRecord(id=r["id"], name=r["name"], agent_ids=json.loads(r["agent_ids"]))
        for r in rows
    ]

@app.get("/agents/{agent_id}/logs")
def get_agent_logs(agent_id: str, limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM call_logs WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?",
        (agent_id, min(limit, 200))
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

class AgentUpdate(BaseModel):
    name:               Optional[str]   = None
    description:        Optional[str]   = None
    price_per_request:  Optional[float] = None
    health_endpoint:    Optional[str]   = None

@app.patch("/agents/{agent_id}", tags=["agents"])
async def update_agent(agent_id: str, body: AgentUpdate, request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Authentication required.")
    conn = get_db()
    agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        raise HTTPException(404, "Agent not found.")
    a = dict(agent)
    owns = (
        a.get("developer_name") == user.get("username") or
        a.get("owner_wallet") == user.get("wallet_id")
    )
    if not owns and not user.get("is_admin"):
        conn.close()
        raise HTTPException(403, "You can only update your own agents.")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        conn.close()
        return dict(a)
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE agents SET {set_clause} WHERE id = ?", (*updates.values(), agent_id))
    conn.commit()
    updated = dict(conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone())
    conn.close()
    logger.info("agent_updated", extra={"agent_id": agent_id})
    return updated

@app.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Authentication required to undeploy an agent.")
    conn = get_db()
    agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        raise HTTPException(404, "Agent not found.")
    # Allow deletion if the user registered the agent (by username or wallet) or is admin.
    a = dict(agent)
    owns = (
        a.get("developer_name") == user.get("username") or
        a.get("owner_wallet") == user.get("wallet_id")
    )
    if not owns and not user.get("is_admin"):
        conn.close()
        raise HTTPException(403, "You can only undeploy your own agents.")
    conn.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
    conn.commit()
    conn.close()
    logger.info("agent_deleted", extra={"agent_id": agent_id})

# ── Metrics ───────────────────────────────────────────────────────────────────

@app.get("/metrics")
def all_metrics():
    conn = get_db()
    agent_ids = [r["id"] for r in conn.execute("SELECT id FROM agents").fetchall()]
    bulk = get_metrics_bulk(conn, agent_ids)
    conn.close()
    return list(bulk.values())

@app.get("/metrics/{agent_id}")
def agent_metrics(agent_id: str):
    return get_metrics(agent_id)

@app.get("/agents/{agent_id}/earnings", tags=["agents"])
def agent_earnings_detail(agent_id: str):
    """Earnings summary for a single agent (used by Developer Hub)."""
    conn = get_db()
    row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Agent not found")
    m = get_metrics(agent_id)
    error_rate = round(m["errors"] / max(m["requests"], 1), 4)
    conn.close()
    return {
        "agent_id":         agent_id,
        "total_earnings":   round(m["earnings"], 4),
        "call_count":       m["requests"],
        "error_rate":       error_rate,
        "avg_latency_ms":   m["avg_latency_ms"],
        "success_rate":     m.get("success_rate", 1.0 - error_rate),
    }

# ── Earnings ──────────────────────────────────────────────────────────────────

@app.get("/earnings/{agent_id}")
def agent_earnings(agent_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    m = get_metrics(agent_id)
    gross    = round(m["requests"] * row["price_per_request"], 4)
    platform = round(gross * PLATFORM_FEE, 4)
    creator  = round(gross * (1 - PLATFORM_FEE), 4)
    return {
        "agent_id":       agent_id,
        "agent_name":     row["name"],
        "requests":       m["requests"],
        "gross_revenue":  gross,
        "platform_fee":   platform,
        "creator_earnings": creator,
        "price_per_request": row["price_per_request"],
        "owner_wallet":   row["owner_wallet"],
        "reputation":     _compute_reputation(m["requests"], m["errors"], m["avg_latency_ms"]),
    }

# ── Call agent ────────────────────────────────────────────────────────────────

_ALLOWED_MARKETS = {"BTC", "ETH", "SOL", "AVAX", "ARB", "OP", "MATIC", "LINK", "UNI", "AAVE"}

@app.post("/call-agent/{agent_id}")
async def call_agent(agent_id: str, payload: dict, request: Request):
    # Sanitise market param to prevent injection into downstream agent calls
    if "market" in payload:
        payload["market"] = str(payload["market"]).upper()[:10]
        if payload["market"] not in _ALLOWED_MARKETS:
            payload["market"] = "BTC"

    conn = get_db()
    row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = dict(row)
    owner_wallet = agent.get("owner_wallet") or ""
    price        = agent["price_per_request"]

    # ── Resolve which wallet to bill ──────────────────────────────────────────
    # Prefer the authenticated user's own wallet; fall back to demo for public access.
    # Never trust a wallet_id supplied in the payload (would allow charging any wallet).
    auth_user = await _get_current_user(request)
    if auth_user:
        _wconn = get_db()
        _prof = _wconn.execute(
            "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (auth_user["id"],)
        ).fetchone()
        _wconn.close()
        billing_wallet = _prof["wallet_id"] if _prof else DEMO_WALLET
    else:
        billing_wallet = DEMO_WALLET

    # ── x402 payment gate ─────────────────────────────────────────────────────
    # Activated when: x402 is globally enabled AND the agent has an on-chain
    # wallet address (0x…) AND the request is not an internal probe.
    is_onchain_wallet = owner_wallet.startswith("0x") and len(owner_wallet) == 42
    if X402_ENABLED and is_onchain_wallet and price > 0 and not payload.get("_probe"):
        payment_header = request.headers.get("X-Payment")
        if not payment_header:
            # No payment — respond 402 with requirements
            reqs = _x402_payment_requirements(agent_id, agent["name"], price, owner_wallet)
            return JSONResponse(status_code=402, content=reqs, headers={
                "X-Payment": json.dumps(reqs),
                "Access-Control-Expose-Headers": "X-Payment",
            })
        # Payment header present — verify with facilitator
        result = await _verify_x402_payment(payment_header, agent_id, price, owner_wallet)
        if result == "replay":
            return JSONResponse(status_code=402, content={
                "error": "Payment already used. This payment proof cannot be resubmitted.",
            })
        if result == "facilitator_down":
            return JSONResponse(status_code=503, content={
                "error": "Payment facilitator is temporarily unavailable. Please retry in a moment.",
            })
        if result != True:  # "invalid"
            return JSONResponse(status_code=402, content={
                "error": "Payment verification failed. Invalid or expired payment proof.",
                **_x402_payment_requirements(agent_id, agent["name"], price, owner_wallet),
            })
    # ─────────────────────────────────────────────────────────────────────────

    user_wallet_id = billing_wallet

    await manager.broadcast({
        "type":       "agent_call_start",
        "agent_id":   agent_id,
        "agent_name": row["name"],
    })

    start = time.monotonic()
    result = None
    call_error = False
    last_exc = None

    for attempt in range(MAX_AGENT_RETRIES + 1):
        try:
            async with httpx.AsyncClient() as client:
                endpoint = row["endpoint"]
                try:
                    response = await client.post(endpoint, json=payload, timeout=10)
                    response.raise_for_status()
                except Exception:
                    alt = endpoint.rstrip("/") + "/signal"
                    response = await client.post(alt, json=payload, timeout=10)
                    response.raise_for_status()
            result = response.json()
            last_exc = None
            break
        except Exception as exc:
            last_exc = exc
            if attempt < MAX_AGENT_RETRIES:
                await asyncio.sleep(0.25)

    if last_exc is not None:
        await asyncio.sleep(random.uniform(0.04, 0.12))
        result = _mock_response(row["name"], row["category"], payload)
        call_error = True
        logger.warning("Agent call failed", extra={"agent_id": agent_id, "error": str(last_exc)})

    latency_ms = round((time.monotonic() - start) * 1000, 1)
    logger.info("Agent called", extra={"agent_id": agent_id, "latency_ms": latency_ms})
    price      = row["price_per_request"]

    # Billing
    tx = await bill_transaction(
        user_wallet_id, agent_id, price,
        owner_wallet_id=row["owner_wallet"] if "owner_wallet" in row.keys() else None,
    )
    agent_earn = round(price * (1 - PLATFORM_FEE), 6)
    record_metrics(agent_id, latency_ms, price, earnings=agent_earn, error=False)
    metrics = get_metrics(agent_id)

    # ── Write call log ────────────────────────────────────────────────────────
    try:
        log_conn = get_db()
        log_conn.execute(
            "INSERT INTO call_logs (id, agent_id, timestamp, status, latency_ms, cost, error_msg) VALUES (?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), agent_id, _now(),
             "error" if call_error else "success",
             latency_ms, price,
             str(last_exc) if call_error else None)
        )
        log_conn.commit()
        log_conn.close()
    except Exception:
        pass

    await manager.broadcast({
        "type":        "agent_call_done",
        "agent_id":    agent_id,
        "agent_name":  row["name"],
        "result":      result,
        "metrics":     metrics,
        "transaction": tx,
    })

    return {**result, "_tx": tx}

# ── Pipeline helpers + routes ─────────────────────────────────────────────────

@app.post("/pipelines", response_model=PipelineRecord, status_code=201)
def create_pipeline(pipeline: Pipeline):
    pipeline_id = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO pipelines VALUES (?, ?, ?)",
        (pipeline_id, pipeline.name, json.dumps(pipeline.agent_ids))
    )
    conn.commit()
    conn.close()
    return PipelineRecord(id=pipeline_id, **pipeline.model_dump())

@app.get("/pipelines", response_model=list[PipelineRecord])
def list_pipelines():
    conn = get_db()
    rows = conn.execute("SELECT * FROM pipelines").fetchall()
    conn.close()
    return [PipelineRecord(id=r["id"], name=r["name"], agent_ids=json.loads(r["agent_ids"])) for r in rows]

async def execute_pipeline(
    pipeline_id: str, pipeline_name: str,
    agent_ids: list, initial_state: dict,
    user_wallet_id: str = DEMO_WALLET,
) -> dict:
    # ── Execution safety guards ───────────────────────────────────────────────
    if len(agent_ids) > MAX_PIPELINE_STEPS:
        raise HTTPException(400, f"Pipeline exceeds max steps ({MAX_PIPELINE_STEPS}). Got {len(agent_ids)}.")

    if _pipeline_semaphore.locked() and _pipeline_semaphore._value == 0:  # type: ignore[attr-defined]
        logger.warning("Pipeline rejected: concurrency cap reached",
                       extra={"pipeline_id": pipeline_id})
        raise HTTPException(503, f"Server busy — max {MAX_CONCURRENT_PIPELINES} concurrent pipelines.")

    async with _pipeline_semaphore:
        logger.info("Pipeline started", extra={"pipeline_id": pipeline_id})
        try:
            result = await asyncio.wait_for(
                _execute_pipeline_inner(pipeline_id, pipeline_name, agent_ids, initial_state, user_wallet_id),
                timeout=MAX_RUNTIME_S,
            )
            logger.info("Pipeline completed", extra={"pipeline_id": pipeline_id})
            return result
        except asyncio.TimeoutError:
            logger.warning("Pipeline timeout", extra={"pipeline_id": pipeline_id})
            await manager.broadcast({"type": "pipeline_timeout", "pipeline_id": pipeline_id})
            raise HTTPException(408, f"Pipeline exceeded max runtime of {MAX_RUNTIME_S}s")

async def _execute_pipeline_inner(
    pipeline_id: str, pipeline_name: str,
    agent_ids: list, initial_state: dict,
    user_wallet_id: str = DEMO_WALLET,
) -> dict:
    await manager.broadcast({
        "type":          "pipeline_start",
        "pipeline_id":   pipeline_id,
        "pipeline_name": pipeline_name,
        "agent_ids":     agent_ids,
    })

    state  = dict(initial_state)
    steps  = []
    total_cost = 0.0

    conn = get_db()
    agents_map = {
        r["id"]: dict(r)
        for r in conn.execute(
            f"SELECT * FROM agents WHERE id IN ({','.join('?' * len(agent_ids))})",
            agent_ids
        ).fetchall()
    }
    conn.close()

    for agent_id in agent_ids:
        agent = agents_map.get(agent_id)
        if not agent:
            continue

        await manager.broadcast({
            "type":          "pipeline_step_start",
            "pipeline_id":   pipeline_id,
            "agent_id":      agent_id,
            "agent_name":    agent["name"],
        })

        start  = time.monotonic()
        result = {}
        error  = False

        # ── Call agent with retry ─────────────────────────────────────────────
        last_exc = None
        for attempt in range(MAX_AGENT_RETRIES + 1):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(agent["endpoint"], json=state, timeout=10)
                    response.raise_for_status()
                result = response.json()
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                if attempt < MAX_AGENT_RETRIES:
                    await asyncio.sleep(0.25)  # brief back-off before retry

        if last_exc is not None:
            # All attempts failed — fall back to mock so the pipeline continues
            await asyncio.sleep(random.uniform(0.04, 0.12))
            result = _mock_response(agent["name"], agent.get("category", ""), state)
            error  = True
            logger.warning("Agent call failed, using mock",
                           extra={"agent_id": agent_id, "error": str(last_exc),
                                  "pipeline_id": pipeline_id})

        latency_ms = round((time.monotonic() - start) * 1000, 1)
        logger.info("Agent step", extra={"agent_id": agent_id, "pipeline_id": pipeline_id,
                                         "latency_ms": latency_ms, "step": len(steps) + 1})

        price      = agent["price_per_request"]
        agent_earn = round(price * (1 - PLATFORM_FEE), 6)
        # Only charge for successful steps — don't bill users for mock fallbacks
        if not error and price > 0:
            total_cost += price
            # Credit the agent owner immediately per step
            await bill_transaction(
                user_wallet_id, agent_id, price,
                pipeline_id=pipeline_id,
                owner_wallet_id=agent.get("owner_wallet") or None,
                idempotency_key=f"{pipeline_id}:{agent_id}:{len(steps)}",
            )

        record_metrics(agent_id, latency_ms, price, earnings=0.0 if error else agent_earn, error=error)

        state.update(result)
        steps.append({"agent": agent["name"], "output": result, "latency_ms": latency_ms, "error": error})

        await manager.broadcast({
            "type":        "pipeline_step_done",
            "pipeline_id": pipeline_id,
            "agent_id":    agent_id,
            "agent_name":  agent["name"],
            "output":      result,
            "metrics":     get_metrics(agent_id),
        })

    # Summarise the total cost for the caller (billing already happened per step above)
    tx = {"amount": round(total_cost, 6), "pipeline_id": pipeline_id, "steps": len(steps)}

    await manager.broadcast({
        "type":          "pipeline_done",
        "pipeline_id":   pipeline_id,
        "pipeline_name": pipeline_name,
        "final_state":   state,
        "total_cost":    round(total_cost, 6),
        "transaction":   tx,
    })

    return {"pipeline": pipeline_name, "steps": steps, "final": state, "total_cost": round(total_cost, 6), "transaction": tx}

@app.post("/run-pipeline/{pipeline_id}")
async def run_pipeline(pipeline_id: str, payload: dict, request: Request):
    # Auth: if user is authenticated, use their wallet; otherwise fall back to demo
    user = await _get_current_user(request)
    conn = get_db()
    row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if user:
        # Use the authenticated user's wallet
        user_conn = get_db()
        profile = user_conn.execute(
            "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
        ).fetchone()
        user_conn.close()
        user_wallet_id = profile["wallet_id"] if profile else payload.get("wallet_id", DEMO_WALLET)
    else:
        user_wallet_id = payload.get("wallet_id", DEMO_WALLET)
    agent_ids      = json.loads(row["agent_ids"])

    # ── Try async queue path first ────────────────────────────────────────
    try:
        from backend.queue import enqueue_pipeline
        job_id = str(uuid.uuid4())

        # Persist job record before enqueueing so the caller can poll /jobs/{job_id}
        conn2 = get_db()
        conn2.execute(
            """INSERT INTO pipeline_jobs
               (id, pipeline_id, pipeline_name, status, input_data, wallet_id, created_at)
               VALUES (?, ?, ?, 'queued', ?, ?, ?)""",
            (job_id, pipeline_id, row["name"], json.dumps(payload), user_wallet_id, _now()),
        )
        conn2.commit()
        conn2.close()

        job = await enqueue_pipeline(
            job_id, pipeline_id, row["name"], agent_ids, payload, user_wallet_id
        )
        if job is not None:
            await manager.broadcast({
                "type":        "pipeline_queued",
                "job_id":      job_id,
                "pipeline_id": pipeline_id,
                "pipeline_name": row["name"],
            })
            return {
                "job_id":      job_id,
                "status":      "queued",
                "pipeline_id": pipeline_id,
                "pipeline_name": row["name"],
                "poll_url":    f"/jobs/{job_id}",
            }
    except Exception:
        pass  # Fall through to sync execution

    # ── Sync fallback (no Redis) ──────────────────────────────────────────
    return await execute_pipeline(
        pipeline_id, row["name"], agent_ids, payload, user_wallet_id
    )

@app.get("/jobs")
@app.get("/jobs/recent")
async def list_recent_jobs(limit: int = 20):
    """Return the most recent pipeline jobs with full result data."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM pipeline_jobs ORDER BY created_at DESC LIMIT ?", (min(limit, 100),)
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        entry = {
            "job_id":        r["id"],
            "pipeline_id":   r["pipeline_id"],
            "pipeline_name": r["pipeline_name"],
            "status":        r["status"],
            "created_at":    r["created_at"],
            "completed_at":  r["completed_at"],
            "error":         r["error"],
        }
        if r["status"] == "completed" and r["result"]:
            try:
                parsed = json.loads(r["result"])
                entry["result"] = parsed
                entry["signal"] = parsed.get("final", {}).get("signal") or parsed.get("signal")
            except Exception:
                pass
        out.append(entry)
    return out


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll the status of a queued pipeline execution."""
    if job_id == "recent":
        return await list_recent_jobs()
    conn = get_db()
    row = conn.execute("SELECT * FROM pipeline_jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    out: dict = {
        "job_id":        row["id"],
        "pipeline_id":   row["pipeline_id"],
        "pipeline_name": row["pipeline_name"],
        "status":        row["status"],
        "wallet_id":     row["wallet_id"],
        "created_at":    row["created_at"],
        "started_at":    row["started_at"],
        "completed_at":  row["completed_at"],
    }
    if row["status"] == "completed" and row["result"]:
        out["result"] = json.loads(row["result"])
    if row["status"] == "failed":
        out["error"] = row["error"]
    return out


@app.post("/composite/{pipeline_id}")
async def composite_agent(pipeline_id: str, payload: dict):
    conn = get_db()
    row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    result = await execute_pipeline(
        pipeline_id, row["name"], json.loads(row["agent_ids"]), payload
    )
    return result["final"]

class RegisterAsAgentRequest(BaseModel):
    category: Optional[str] = "composite"
    description: Optional[str] = None

@app.post("/pipelines/{pipeline_id}/register-as-agent", response_model=AgentRecord, status_code=201)
def register_pipeline_as_agent(pipeline_id: str, body: RegisterAsAgentRequest = RegisterAsAgentRequest()):
    conn = get_db()
    row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    agent_id = str(uuid.uuid4())
    _self_base = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000")
    endpoint = f"{_self_base}/composite/{pipeline_id}"
    now      = _now()
    category = body.category or "composite"
    desc     = body.description or f"Composite pipeline: {row['name']}"
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO agents (id, name, description, endpoint, category, price_per_request, status, created_at, reputation) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 5.0)",
        (agent_id, row["name"], desc, endpoint, category, 0.0, now)
    )
    conn.commit()
    conn.close()
    return AgentRecord(
        id=agent_id, name=row["name"], description=desc,
        endpoint=endpoint, category=category, price_per_request=0.0,
        status="active", reputation=5.0, created_at=now,
    )

# ── Wallet routes ─────────────────────────────────────────────────────────────

@app.post("/wallets", status_code=201)
def create_wallet(body: WalletCreate):
    # Always create with zero balance — deposits go through /wallets/{id}/deposit (requires auth)
    wid = str(uuid.uuid4())
    now = _now()
    conn = get_db()
    conn.execute(
        "INSERT INTO wallets VALUES (?, ?, ?, ?, ?, ?)",
        (wid, body.owner_name, 0.0, 0.0, 0.0, now)
    )
    conn.commit()
    conn.close()
    return {"wallet_id": wid, "owner_name": body.owner_name, "balance": 0.0, "created_at": now}

@app.get("/wallets/{wallet_id}")
def get_wallet_route(wallet_id: str):
    conn = get_db()
    row = _get_wallet(conn, wallet_id)
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Wallet not found")
    # Recent transactions
    conn = get_db()
    txs = conn.execute(
        "SELECT * FROM transactions WHERE user_wallet = ? ORDER BY timestamp DESC LIMIT 20",
        (wallet_id,)
    ).fetchall()
    conn.close()
    return {**row, "recent_transactions": [dict(t) for t in txs]}

@app.post("/wallets/{wallet_id}/deposit")
def deposit_wallet(wallet_id: str, body: WalletDeposit, user: dict = Depends(_require_auth)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if body.amount > 10_000:
        raise HTTPException(status_code=400, detail="Single deposit cannot exceed $10,000")
    # Verify the user owns this wallet
    conn = get_db()
    profile = conn.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
    ).fetchone()
    user_wallet = profile["wallet_id"] if profile else None
    if user_wallet != wallet_id:
        conn.close()
        raise HTTPException(403, "You can only deposit to your own wallet")
    row = _get_wallet(conn, wallet_id)
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Wallet not found")
    conn.execute(
        "UPDATE wallets SET balance = balance + ? WHERE id = ?",
        (body.amount, wallet_id)
    )
    conn.commit()
    new_bal = conn.execute("SELECT balance FROM wallets WHERE id = ?", (wallet_id,)).fetchone()["balance"]
    conn.close()
    return {"wallet_id": wallet_id, "deposited": body.amount, "balance": round(new_bal, 4)}

@app.post("/wallets/{wallet_id}/deposit/worldchain")
async def deposit_worldchain(wallet_id: str, body: WalletWorldChainDeposit, user: dict = Depends(_require_auth)):
    """Verify a World Chain USDC transfer on-chain, then credit the user's wallet."""
    if not PLATFORM_ETH_ADDRESS:
        raise HTTPException(503, "World Chain deposits not configured on this server")
    if body.amount_usd <= 0 or body.amount_usd > MAX_USDC_DEPOSIT:
        raise HTTPException(400, f"Deposit amount must be between 0 and ${MAX_USDC_DEPOSIT}")

    # Normalise tx_hash
    tx_hash = body.tx_hash.strip().lower()
    if not re.match(r'^0x[0-9a-f]{64}$', tx_hash):
        raise HTTPException(400, "Invalid tx_hash format")

    conn = get_db()

    # Check wallet ownership
    profile = conn.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
    ).fetchone()
    if not profile or profile["wallet_id"] != wallet_id:
        conn.close()
        raise HTTPException(403, "You can only deposit to your own wallet")

    # Idempotency — reject already-used tx hashes
    existing = conn.execute(
        "SELECT wallet_id FROM used_tx_hashes WHERE tx_hash = ?", (tx_hash,)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(409, "This transaction has already been used for a deposit")

    # ── On-chain verification via World Chain RPC ─────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            rpc_resp = await client.post(WORLD_CHAIN_RPC_URL, json={
                "jsonrpc": "2.0", "id": 1,
                "method": "eth_getTransactionReceipt",
                "params": [tx_hash]
            })
        rpc_data = rpc_resp.json()
    except Exception as e:
        conn.close()
        logger.warning("World Chain RPC error", extra={"error": str(e)})
        raise HTTPException(502, "Could not reach World Chain RPC — try again")

    receipt = rpc_data.get("result")
    if receipt is None:
        conn.close()
        raise HTTPException(404, "Transaction not found on World Chain — it may still be pending")
    if receipt.get("status") != "0x1":
        conn.close()
        raise HTTPException(400, "Transaction failed or was reverted on-chain")

    # ── Decode ERC-20 Transfer logs ────────────────────────────────────────────
    verified_amount_usd = None
    for log_entry in receipt.get("logs", []):
        # Must be the USDC contract
        if log_entry.get("address", "").lower() != USDC_CONTRACT_ADDRESS:
            continue
        topics = log_entry.get("topics", [])
        # Transfer(address,address,uint256): 3 topics
        if len(topics) < 3 or topics[0].lower() != ERC20_TRANSFER_TOPIC:
            continue
        # topics[2] = to address (zero-padded 32 bytes)
        to_addr = "0x" + topics[2][-40:]
        if to_addr.lower() != PLATFORM_ETH_ADDRESS:
            continue
        # data = uint256 amount
        raw_amount = int(log_entry.get("data", "0x0"), 16)
        usdc_amount = raw_amount / (10 ** USDC_DECIMALS)
        if usdc_amount >= body.amount_usd * 0.999:  # 0.1% tolerance for rounding
            verified_amount_usd = usdc_amount
            break

    if verified_amount_usd is None:
        conn.close()
        raise HTTPException(400, "No matching USDC transfer to platform wallet found in this transaction")

    # ── Credit the wallet ──────────────────────────────────────────────────────
    # Record tx as used first (prevents race via UNIQUE constraint)
    try:
        conn.execute(
            "INSERT INTO used_tx_hashes (tx_hash, wallet_id, amount_usd, ts) VALUES (?, ?, ?, ?)",
            (tx_hash, wallet_id, verified_amount_usd, _now())
        )
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(409, "This transaction was just processed by another request")

    conn.execute(
        "UPDATE wallets SET balance = balance + ? WHERE id = ?",
        (verified_amount_usd, wallet_id)
    )
    conn.commit()
    new_bal = conn.execute("SELECT balance FROM wallets WHERE id = ?", (wallet_id,)).fetchone()["balance"]
    conn.close()

    logger.info("WorldChain deposit verified", extra={
        "wallet_id": wallet_id, "tx_hash": tx_hash, "amount_usd": verified_amount_usd
    })
    return {
        "wallet_id": wallet_id,
        "deposited_usd": round(verified_amount_usd, 6),
        "credits_added": round(verified_amount_usd * 100),
        "balance": round(new_bal, 4),
        "tx_hash": tx_hash,
    }


# ── Stripe deposit ─────────────────────────────────────────────────────────────

class StripeSessionCreate(BaseModel):
    amount_usd: float

@app.post("/wallets/{wallet_id}/deposit/stripe/session")
async def create_stripe_session(
    wallet_id: str, body: StripeSessionCreate, user: dict = Depends(_require_auth)
):
    """Create a Stripe Checkout session. Returns {url, session_id}."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Card payments not configured on this server")
    if body.amount_usd < 1 or body.amount_usd > 10_000:
        raise HTTPException(400, "Amount must be between $1 and $10,000")

    conn = get_db()
    profile = conn.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
    ).fetchone()
    conn.close()
    if not profile or profile["wallet_id"] != wallet_id:
        raise HTTPException(403, "You can only deposit to your own wallet")

    try:
        session = _stripe_lib.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"AgentVerse Credits — ${body.amount_usd:.2f}",
                        "description": f"{int(body.amount_usd * 100)} credits · 1 credit = $0.01",
                    },
                    "unit_amount": int(body.amount_usd * 100),  # Stripe uses cents
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/?stripe_success=1",
            cancel_url=f"{FRONTEND_URL}/?stripe_cancel=1",
            metadata={
                "wallet_id":  wallet_id,
                "user_id":    user["id"],
                "amount_usd": str(body.amount_usd),
            },
        )
        return {"url": session.url, "session_id": session.id}
    except _stripe_lib.StripeError as e:
        logger.warning("Stripe session creation failed", extra={"error": str(e)})
        raise HTTPException(502, f"Stripe error: {e.user_message or str(e)}")


@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe sends checkout.session.completed here → credit the wallet."""
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Stripe webhook not configured")

    payload   = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = _stripe_lib.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except _stripe_lib.SignatureVerificationError:
        logger.warning("Stripe webhook signature invalid")
        raise HTTPException(400, "Invalid Stripe signature")
    except Exception as e:
        raise HTTPException(400, f"Webhook parse error: {e}")

    if event["type"] == "checkout.session.completed":
        session    = event["data"]["object"]
        meta       = session.get("metadata", {})
        wallet_id  = meta.get("wallet_id")
        amount_usd = float(meta.get("amount_usd", 0))
        session_id = session["id"]

        if not wallet_id or amount_usd <= 0:
            return {"received": True}  # malformed metadata — ignore
        if session.get("payment_status") != "paid":
            return {"received": True}  # not actually paid yet

        conn = get_db()
        # Idempotency key: reuse the used_tx_hashes table
        idempotency_key = f"stripe_{session_id}"
        existing = conn.execute(
            "SELECT 1 FROM used_tx_hashes WHERE tx_hash = ?", (idempotency_key,)
        ).fetchone()
        if existing:
            conn.close()
            return {"received": True}  # already processed

        try:
            conn.execute(
                "INSERT INTO used_tx_hashes (tx_hash, wallet_id, amount_usd, ts) VALUES (?, ?, ?, ?)",
                (idempotency_key, wallet_id, amount_usd, _now())
            )
            conn.execute(
                "UPDATE wallets SET balance = balance + ? WHERE id = ?",
                (amount_usd, wallet_id)
            )
            conn.commit()
            logger.info("Stripe deposit credited", extra={"wallet_id": wallet_id, "amount_usd": amount_usd})
        except Exception as e:
            conn.rollback()
            conn.close()
            logger.warning("Stripe webhook DB error", extra={"error": str(e)})
            raise HTTPException(500, "Failed to credit wallet — Stripe will retry")
        conn.close()

    return {"received": True}


class WalletWithdraw(BaseModel):
    amount:      float
    eth_address: str        # World Chain ETH address for USDC payout

@app.post("/wallets/{wallet_id}/withdraw")
def withdraw_wallet(wallet_id: str, body: WalletWithdraw, user: dict = Depends(_require_auth)):
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    if body.amount > 10_000:
        raise HTTPException(400, "Single withdrawal cannot exceed $10,000")
    if not re.match(r'^0x[0-9a-fA-F]{40}$', body.eth_address.strip()):
        raise HTTPException(400, "Invalid ETH address — must be 0x followed by 40 hex characters")

    conn = get_db()
    profile = conn.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
    ).fetchone()
    user_wallet = profile["wallet_id"] if profile else None
    if user_wallet != wallet_id:
        conn.close()
        raise HTTPException(403, "You can only withdraw from your own wallet")
    row = _get_wallet(conn, wallet_id)
    if not row:
        conn.close()
        raise HTTPException(404, "Wallet not found")
    if row["balance"] < body.amount:
        conn.close()
        raise HTTPException(400, f"Insufficient balance. Available: ${row['balance']:.4f}")

    # Debit balance immediately so it can't be double-spent
    conn.execute("UPDATE wallets SET balance = balance - ? WHERE id = ?", (body.amount, wallet_id))

    # Record payout request
    req_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO payout_requests (id, wallet_id, amount_usd, eth_address, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
        (req_id, wallet_id, body.amount, body.eth_address.strip().lower(), _now())
    )
    conn.commit()
    new_bal = conn.execute("SELECT balance FROM wallets WHERE id = ?", (wallet_id,)).fetchone()["balance"]
    conn.close()
    logger.info("payout_requested", extra={"wallet_id": wallet_id, "amount": body.amount, "eth_address": body.eth_address})
    return {
        "request_id": req_id,
        "wallet_id": wallet_id,
        "amount_usd": body.amount,
        "eth_address": body.eth_address.strip().lower(),
        "status": "pending",
        "balance": round(new_bal, 4),
        "message": "Payout request submitted. USDC will be sent to your address within 24 hours.",
    }

@app.get("/wallets/{wallet_id}/payouts")
def list_payouts(wallet_id: str, user: dict = Depends(_require_auth)):
    conn = get_db()
    profile = conn.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
    ).fetchone()
    if not profile or profile["wallet_id"] != wallet_id:
        conn.close()
        raise HTTPException(403, "Access denied")
    rows = conn.execute(
        "SELECT * FROM payout_requests WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 20",
        (wallet_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/wallets")
def list_wallets(user: dict = Depends(_require_auth)):
    """Return only the authenticated user's own wallet (not everyone's)."""
    conn = get_db()
    profile = conn.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)
    ).fetchone()
    wallet_id = profile["wallet_id"] if profile else None
    if not wallet_id:
        conn.close()
        return []
    rows = conn.execute(
        "SELECT id, owner_name, balance, total_spent, total_earned FROM wallets WHERE id = ?",
        (wallet_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Transactions ──────────────────────────────────────────────────────────────

@app.get("/transactions")
def list_transactions(limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ── Platform stats ────────────────────────────────────────────────────────────

@app.get("/platform/stats")
def platform_stats():
    conn = get_db()
    agents_count = conn.execute("SELECT COUNT(*) as n FROM agents").fetchone()["n"]
    tx_row = conn.execute(
        "SELECT COUNT(*) as n, SUM(amount) as vol, SUM(platform_fee) as fees FROM transactions"
    ).fetchone()
    plat_wallet = _get_wallet(conn, PLATFORM_WALLET)
    conn.close()
    return {
        "agents":            agents_count,
        "total_transactions": tx_row["n"] or 0,
        "total_volume":      round(tx_row["vol"] or 0, 4),
        "platform_revenue":  round(tx_row["fees"] or 0, 4),
        "platform_balance":  round(plat_wallet["balance"] if plat_wallet else 0, 4),
    }

# ── Challenge routes ──────────────────────────────────────────────────────────

@app.post("/challenges", response_model=ChallengeRecord, status_code=201)
def create_challenge(challenge: Challenge, user: dict = Depends(_require_auth)):
    cid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO challenges VALUES (?, ?, ?, ?, ?, 'open')",
        (cid, challenge.title, challenge.description, challenge.reward, challenge.scoring_field)
    )
    conn.commit()
    conn.close()
    return ChallengeRecord(id=cid, **challenge.model_dump())

@app.get("/challenges", response_model=list[ChallengeRecord])
def list_challenges():
    conn = get_db()
    rows = conn.execute("SELECT * FROM challenges").fetchall()
    conn.close()
    return [ChallengeRecord(**dict(r)) for r in rows]

@app.get("/challenges/{challenge_id}/leaderboard")
def challenge_leaderboard(challenge_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM challenge_entries WHERE challenge_id = ? ORDER BY score DESC",
        (challenge_id,)
    ).fetchall()
    conn.close()
    return [{**dict(r), "result": json.loads(r["result"]) if r["result"] else {}} for r in rows]

@app.post("/challenges/{challenge_id}/submit/{pipeline_id}")
async def submit_to_challenge(challenge_id: str, pipeline_id: str, user: dict = Depends(_require_auth)):
    conn = get_db()
    challenge = conn.execute("SELECT * FROM challenges WHERE id = ?", (challenge_id,)).fetchone()
    pipeline  = conn.execute("SELECT * FROM pipelines  WHERE id = ?", (pipeline_id,)).fetchone()
    conn.close()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if challenge["status"] != "open":
        raise HTTPException(status_code=400, detail="Challenge is closed")

    agent_ids = json.loads(pipeline["agent_ids"])
    conn = get_db()
    agents_map = {
        r["id"]: dict(r)
        for r in conn.execute(
            f"SELECT * FROM agents WHERE id IN ({','.join('?' * len(agent_ids))})",
            agent_ids
        ).fetchall()
    }
    conn.close()

    state = {"market": "BTC"}
    total_latency = 0.0

    for agent_id in agent_ids:
        agent = agents_map.get(agent_id)
        if not agent:
            continue
        start = time.monotonic()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(agent["endpoint"], json=state, timeout=10)
                response.raise_for_status()
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            state.update(response.json())
            record_metrics(agent_id, latency_ms, agent["price_per_request"])
        except Exception:
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            record_metrics(agent_id, latency_ms, agent["price_per_request"], error=True)
        total_latency += latency_ms

    raw = state.get(challenge["scoring_field"], 0)
    try:
        raw_float = float(raw)
    except (TypeError, ValueError):
        raw_float = 0.0
    score = round(max(0.0, raw_float - total_latency / 10000), 4)

    entry_id = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO challenge_entries VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        (entry_id, challenge_id, pipeline_id, pipeline["name"], score, total_latency, json.dumps(state))
    )
    conn.commit()
    conn.close()

    await manager.broadcast({
        "type":          "challenge_entry",
        "challenge_id":  challenge_id,
        "pipeline_name": pipeline["name"],
        "score":         score,
        "result":        state,
    })

    return {"entry_id": entry_id, "score": score, "latency_ms": total_latency, "result": state}


# ── Agent Wars ─────────────────────────────────────────────────────────────────


BATTLE_COLORS = {"a": "#FF4D6D", "b": "#4DA6FF"}


def _extract_score(state: dict) -> float:
    """Pull a 0-1 confidence/score from a pipeline's final state."""
    candidates = []
    for v in state.values():
        if isinstance(v, (int, float)) and 0.0 <= float(v) <= 1.0:
            candidates.append(float(v))
    if candidates:
        return round(sum(candidates) / len(candidates), 4)
    # Fallback: normalize any positive number to 0-1 range
    nums = [float(v) for v in state.values() if isinstance(v, (int, float)) and float(v) >= 0]
    if nums:
        mx = max(nums)
        return round(min(mx / 100.0, 1.0), 4) if mx > 1 else round(sum(nums) / len(nums), 4)
    return 0.5


async def _run_battle_side(
    team: str,
    pipeline_id: str, pipeline_name: str,
    agent_ids: list[str], payload: dict,
    battle_id: str,
) -> tuple[float, dict]:
    """Run one pipeline side of a battle, broadcasting per-step events."""
    conn = get_db()
    agents_map = {
        r["id"]: dict(r)
        for r in conn.execute(
            f"SELECT * FROM agents WHERE id IN ({','.join('?' * len(agent_ids))})",
            agent_ids
        ).fetchall()
    }
    conn.close()

    state = dict(payload)
    step_scores = []

    for agent_id in agent_ids:
        agent = agents_map.get(agent_id)
        if not agent:
            continue

        start = time.monotonic()
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(agent["endpoint"], json=state, timeout=10)
                response.raise_for_status()
            result = response.json()
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            error = False
        except Exception as e:
            result = {"error": str(e)}
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            error = True

        price = agent["price_per_request"]
        agent_earn = round(price * (1 - PLATFORM_FEE), 6)
        record_metrics(agent_id, latency_ms, price, earnings=0.0 if error else agent_earn, error=error)

        state.update(result)
        step_score = _extract_score(state)
        step_scores.append(step_score)

        await manager.broadcast({
            "type":          "battle_step",
            "battle_id":     battle_id,
            "team":          team,
            "agent_id":      agent_id,
            "agent_name":    agent["name"],
            "step_score":    step_score,
            "color":         BATTLE_COLORS[team],
        })

    final_score = round(sum(step_scores) / len(step_scores), 4) if step_scores else 0.5
    return final_score, state


@app.post("/battles")
async def start_battle(body: dict):
    """
    Start an Agent War between two pipelines.
    Body: { pipeline_a_id, pipeline_b_id, payload? }
    """
    pipeline_a_id = body.get("pipeline_a_id")
    pipeline_b_id = body.get("pipeline_b_id")
    payload = body.get("payload", {"symbol": "BTC", "timeframe": "1h"})

    if not pipeline_a_id or not pipeline_b_id:
        raise HTTPException(status_code=400, detail="pipeline_a_id and pipeline_b_id required")

    conn = get_db()
    row_a = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_a_id,)).fetchone()
    row_b = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_b_id,)).fetchone()
    conn.close()

    if not row_a or not row_b:
        raise HTTPException(status_code=404, detail="One or both pipelines not found")

    ids_a = json.loads(row_a["agent_ids"])
    ids_b = json.loads(row_b["agent_ids"])
    battle_id = str(uuid.uuid4())

    await manager.broadcast({
        "type":            "battle_start",
        "battle_id":       battle_id,
        "pipeline_a":      {"id": pipeline_a_id, "name": row_a["name"], "agent_ids": ids_a, "color": BATTLE_COLORS["a"]},
        "pipeline_b":      {"id": pipeline_b_id, "name": row_b["name"], "agent_ids": ids_b, "color": BATTLE_COLORS["b"]},
    })

    results = await asyncio.gather(
        _run_battle_side("a", pipeline_a_id, row_a["name"], ids_a, payload, battle_id),
        _run_battle_side("b", pipeline_b_id, row_b["name"], ids_b, payload, battle_id),
    )
    score_a, state_a = results[0]
    score_b, state_b = results[1]

    if score_a > score_b:
        winner = "a"
    elif score_b > score_a:
        winner = "b"
    else:
        winner = "tie"

    await manager.broadcast({
        "type":              "battle_end",
        "battle_id":         battle_id,
        "winner":            winner,
        "score_a":           score_a,
        "score_b":           score_b,
        "pipeline_a_name":   row_a["name"],
        "pipeline_b_name":   row_b["name"],
        "pipeline_a_agents": ids_a,
        "pipeline_b_agents": ids_b,
        "color_a":           BATTLE_COLORS["a"],
        "color_b":           BATTLE_COLORS["b"],
    })

    return {
        "battle_id":  battle_id,
        "winner":     winner,
        "score_a":    score_a,
        "score_b":    score_b,
        "pipeline_a": row_a["name"],
        "pipeline_b": row_b["name"],
    }


# =============================================================================
# AUTH SYSTEM
# =============================================================================

# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

def _verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False

def _create_token(user_id: str) -> str:
    payload = f"{user_id}:{int(time.time())}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{sig}".encode()).decode()

# ── Pydantic models ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str
    world_nullifier: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class CreateApiKeyRequest(BaseModel):
    name: str

class AgentRegisterRequest(BaseModel):
    name: str
    description: str
    endpoint: str
    category: str
    price_per_request: float = 0.01
    schema_endpoint: Optional[str] = None
    health_endpoint: Optional[str] = None

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/auth/register", tags=["auth"])
async def auth_register(req: RegisterRequest):
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    conn = get_db()
    if conn.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),)).fetchone():
        conn.close()
        raise HTTPException(409, "Email already registered")
    if req.world_nullifier:
        if conn.execute("SELECT id FROM users WHERE world_nullifier = ?", (req.world_nullifier,)).fetchone():
            conn.close()
            raise HTTPException(409, "A World ID account already exists. Each human can only register once.")
    user_id = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO users VALUES (?, ?, ?, ?, ?, 1, ?)",
        (user_id, req.email.lower(), req.username, _hash_password(req.password), now, req.world_nullifier),
    )
    # Create linked wallet with welcome credits ($1 = 100 credits free to start)
    wallet_id = f"w_{user_id[:8]}"
    WELCOME_CREDITS = 1.0  # $1.00 free
    conn.execute(
        "INSERT INTO wallets VALUES (?, ?, ?, ?, ?, ?)",
        (wallet_id, req.username, WELCOME_CREDITS, 0.0, 0.0, now),
    )
    # Developer profile
    conn.execute(
        "INSERT INTO developer_profiles VALUES (?, ?, ?, ?, ?)",
        (user_id, req.username, None, wallet_id, now),
    )
    conn.commit()
    conn.close()
    token = _create_token(user_id)
    return {"token": token, "user_id": user_id, "username": req.username, "wallet_id": wallet_id}

@app.post("/auth/login", tags=["auth"])
async def auth_login(req: LoginRequest):
    conn = get_db()
    identifier = req.email.lower().strip()
    # Accept email or username
    row = conn.execute(
        "SELECT * FROM users WHERE (email = ? OR LOWER(username) = ?) AND is_active = 1",
        (identifier, identifier)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "No account found with that email or username")
    if not _verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "Incorrect password")
    token = _create_token(row["id"])
    conn2 = get_db()
    profile = conn2.execute(
        "SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (row["id"],)
    ).fetchone()
    conn2.close()
    wallet_id = profile["wallet_id"] if profile else None
    return {"token": token, "user_id": row["id"], "username": row["username"], "wallet_id": wallet_id}

@app.post("/auth/forgot-password", tags=["auth"])
async def auth_forgot_password(req: ForgotPasswordRequest):
    _check_rate_limit(req.email.lower())
    conn = get_db()
    row = conn.execute("SELECT id FROM users WHERE email = ? AND is_active = 1", (req.email.lower(),)).fetchone()
    if not row:
        conn.close()
        # Don't reveal whether the email exists
        return {"message": "If that email is registered, a reset token has been generated."}
    user_id = row["id"]
    # Invalidate any existing unused tokens for this user
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0", (user_id,))
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc).replace(microsecond=0)
    # Token valid for 1 hour
    from datetime import timedelta
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    conn.execute(
        "INSERT INTO password_reset_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)",
        (reset_token, user_id, expires_at),
    )
    conn.commit()
    conn.close()
    # In production this token would be emailed. For now we return it directly.
    return {
        "message": "If that email is registered, a reset token has been generated.",
        "reset_token": reset_token,
        "expires_in": "1 hour",
        "note": "In production, this token would be sent by email. Copy it and use /auth/reset-password.",
    }

@app.post("/auth/reset-password", tags=["auth"])
async def auth_reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0", (req.token,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(400, "Invalid or already-used reset token")
    token_data = dict(row)
    # Check expiry
    if datetime.fromisoformat(token_data["expires_at"]) < datetime.now(timezone.utc):
        conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (req.token,))
        conn.commit()
        conn.close()
        raise HTTPException(400, "Reset token has expired. Please request a new one.")
    # Update password and mark token used
    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (_hash_password(req.new_password), token_data["user_id"]),
    )
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (req.token,))
    conn.commit()
    conn.close()
    return {"message": "Password updated successfully. You can now sign in with your new password."}

@app.get("/auth/me", tags=["auth"])
async def auth_me(request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    conn = get_db()
    profile = conn.execute("SELECT * FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    wallet_id = dict(profile)["wallet_id"] if profile else None
    wallet_balance = None
    if wallet_id:
        w = conn.execute("SELECT balance FROM wallets WHERE id = ?", (wallet_id,)).fetchone()
        wallet_balance = round(w["balance"], 4) if w else None
    keys = conn.execute(
        "SELECT id, name, created_at, last_used FROM api_keys WHERE user_id = ? AND is_active = 1",
        (user["id"],),
    ).fetchall()
    conn.close()
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "created_at": user["created_at"],
        "wallet_id": wallet_id,
        "wallet_balance": wallet_balance,
        "api_keys": [dict(k) for k in keys],
        "world_verified": bool(user.get("world_nullifier")),
    }

@app.post("/auth/create-api-key", tags=["auth"])
async def auth_create_api_key(req: CreateApiKeyRequest, request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    conn = get_db()
    existing = conn.execute(
        "SELECT COUNT(*) FROM api_keys WHERE user_id = ? AND is_active = 1", (user["id"],)
    ).fetchone()[0]
    if existing >= 10:
        conn.close()
        raise HTTPException(400, "Max 10 active API keys per account")
    plaintext, key_hash = _generate_api_key()
    key_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO api_keys VALUES (?, ?, ?, ?, ?, NULL, 1)",
        (key_id, user["id"], key_hash, req.name, _now()),
    )
    conn.commit()
    conn.close()
    # Return plaintext ONCE — never stored
    return {"id": key_id, "key": plaintext, "name": req.name,
            "warning": "Save this key — it won't be shown again."}

@app.get("/auth/api-keys", tags=["auth"])
async def auth_list_api_keys(request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, created_at, last_used FROM api_keys WHERE user_id = ? AND is_active = 1",
        (user["id"],),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.delete("/auth/api-keys/{key_id}", tags=["auth"])
async def auth_revoke_api_key(key_id: str, request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    conn = get_db()
    result = conn.execute(
        "UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?",
        (key_id, user["id"]),
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(404, "API key not found")
    return {"revoked": key_id}


# =============================================================================
# DEVELOPER DASHBOARD
# =============================================================================

@app.get("/developer/dashboard", tags=["developer"])
async def developer_dashboard(request: Request):
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    conn = get_db()
    profile = conn.execute("SELECT * FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    wallet_id = dict(profile)["wallet_id"] if profile else None
    agents = conn.execute(
        "SELECT * FROM agents WHERE owner_wallet = ? OR developer_name = ?",
        (wallet_id or "", user["username"]),
    ).fetchall()
    agent_ids = [a["id"] for a in agents]
    metrics_map = get_metrics_bulk(conn, agent_ids)
    agent_list = [
        {**dict(a), "metrics": metrics_map[a["id"]], "health": a["status"]}
        for a in agents
    ]
    wallet = None
    if wallet_id:
        w = conn.execute("SELECT * FROM wallets WHERE id = ?", (wallet_id,)).fetchone()
        wallet = dict(w) if w else None
    conn.close()
    return {
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
        "wallet": wallet,
        "agents": agent_list,
        "total_agents": len(agent_list),
        "total_requests": sum(a["metrics"]["requests"] for a in agent_list),
        "total_earnings": round(sum(a["metrics"]["earnings"] for a in agent_list), 4),
    }

@app.post("/developer/agents", tags=["developer"])
async def developer_register_agent(req: AgentRegisterRequest, request: Request):
    """Register a new agent as an authenticated developer."""
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if req.price_per_request < 0:
        raise HTTPException(400, "price_per_request cannot be negative")
    if req.price_per_request > MAX_PRICE_PER_REQUEST:
        raise HTTPException(400, f"price_per_request cannot exceed ${MAX_PRICE_PER_REQUEST:.2f}")
    # SSRF prevention — block private/internal endpoint URLs
    _validate_public_url(req.endpoint, "endpoint")
    if req.health_endpoint:
        _validate_public_url(req.health_endpoint, "health_endpoint")
    if req.schema_endpoint:
        _validate_public_url(req.schema_endpoint, "schema_endpoint")

    conn = get_db()
    profile = conn.execute("SELECT * FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    wallet_id = dict(profile)["wallet_id"] if profile else None

    # Per-user agent limit
    agent_count = conn.execute(
        "SELECT COUNT(*) FROM agents WHERE developer_name = ?", (user["username"],)
    ).fetchone()[0]
    if agent_count >= MAX_AGENTS_PER_USER:
        conn.close()
        raise HTTPException(400, f"Agent limit reached ({MAX_AGENTS_PER_USER} max per developer)")

    # Validate endpoint reachability (non-blocking — mark as pending if unreachable)
    status = "pending"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(req.health_endpoint or req.endpoint)
            status = "active" if r.status_code == 200 else "degraded"
        except Exception:
            status = "pending"

    agent_id = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO agents (id, name, description, endpoint, category, price_per_request, "
        "schema_endpoint, health_endpoint, owner_wallet, created_at, status, developer_name) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (agent_id, req.name, req.description, req.endpoint, req.category,
         req.price_per_request, req.schema_endpoint, req.health_endpoint,
         wallet_id, now, status, user["username"]),
    )
    conn.execute(
        "INSERT INTO metrics (agent_id, requests, total_latency_ms, errors, earnings) VALUES (?, 0, 0, 0, 0)",
        (agent_id,),
    )
    conn.commit()
    conn.close()
    return {"id": agent_id, "status": status, "message": f"Agent registered. Status: {status}"}

@app.post("/developer/agents/{agent_id}/validate", tags=["developer"])
async def developer_validate_agent(agent_id: str, request: Request):
    """Ping an agent's endpoint and update its health status."""
    user = await _get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    conn = get_db()
    agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    conn.close()
    if not agent:
        raise HTTPException(404, "Agent not found")
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        status = await _probe_endpoint(client, agent["health_endpoint"], agent["endpoint"])
    latency_ms = round((time.monotonic() - start) * 1000, 1)
    conn = get_db()
    conn.execute("UPDATE agents SET status = ? WHERE id = ?", (status, agent_id))
    conn.commit()
    conn.close()
    return {"agent_id": agent_id, "status": status, "latency_ms": latency_ms, "endpoint": agent["health_endpoint"] or agent["endpoint"]}


@app.post("/developer/test-endpoint", tags=["developer"])
async def test_external_endpoint(body: dict, user: dict = Depends(_require_auth)):
    """Proxy-test an external agent endpoint server-side (avoids CORS in the browser)."""
    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(400, "url is required")
    _validate_public_url(url, "url")  # SSRF prevention
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            start = time.monotonic()
            r = await client.post(url, json={"_probe": True, "input": "test"})
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            try:
                resp_body = r.json()
            except Exception:
                resp_body = {"raw": r.text[:500]}
            return {"ok": r.status_code < 400, "status": r.status_code, "latency_ms": latency_ms, "body": resp_body}
    except httpx.TimeoutException:
        return {"ok": False, "status": 0, "latency_ms": 8000, "error": "Timeout — endpoint did not respond within 8s"}
    except httpx.ConnectError as e:
        return {"ok": False, "status": 0, "latency_ms": 0, "error": f"Could not connect: {str(e)[:100]}"}
    except Exception as e:
        return {"ok": False, "status": 0, "latency_ms": 0, "error": str(e)[:200]}


# =============================================================================
# AGENT HEALTH MONITORING
# =============================================================================

async def _probe_endpoint(client: httpx.AsyncClient, health_endpoint: str | None, run_endpoint: str) -> str:
    """Returns 'active', 'degraded', or 'offline'."""
    if health_endpoint:
        try:
            r = await client.get(health_endpoint, timeout=5.0)
            return "active" if r.status_code == 200 else "degraded"
        except Exception:
            return "offline"
    # No health endpoint — do a lightweight POST probe to the run endpoint
    try:
        r = await client.post(run_endpoint, json={"_probe": True}, timeout=5.0)
        return "active" if r.status_code < 500 else "degraded"
    except Exception:
        return "offline"

async def _health_check_all():
    conn = get_db()
    agents = conn.execute(
        "SELECT id, endpoint, health_endpoint FROM agents WHERE status != 'deleted'"
    ).fetchall()
    conn.close()
    async with httpx.AsyncClient() as client:
        for agent in agents:
            status = await _probe_endpoint(client, agent["health_endpoint"], agent["endpoint"])
            conn = get_db()
            conn.execute("UPDATE agents SET status = ? WHERE id = ?", (status, agent["id"]))
            conn.commit()
            conn.close()

async def _health_loop():
    await asyncio.sleep(30)  # wait for startup
    while True:
        try:
            await _health_check_all()
        except Exception:
            pass
        await asyncio.sleep(120)  # check every 2 minutes

async def _schedule_loop():
    """Auto-execute due schedules every 60 seconds."""
    await asyncio.sleep(60)  # wait for full startup
    while True:
        try:
            now = _now()
            conn = get_db()
            due = conn.execute(
                "SELECT * FROM schedules WHERE is_active = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?",
                (now,)
            ).fetchall()
            conn.close()
            for row in due:
                sched = dict(row)
                try:
                    # Look up the pipeline to get its name and agent list
                    _conn = get_db()
                    _pipe = _conn.execute("SELECT * FROM pipelines WHERE id = ?", (sched["pipeline_id"],)).fetchone()
                    _conn.close()
                    if not _pipe:
                        logger.warning("Schedule references missing pipeline", extra={"step": sched["id"], "pipeline_id": sched["pipeline_id"]})
                        continue
                    _pipe = dict(_pipe)
                    result = await execute_pipeline(
                        _pipe["id"], _pipe["name"],
                        json.loads(_pipe["agent_ids"]),
                        {"market": "BTC"},
                        user_wallet_id=DEMO_WALLET,
                    )
                    run_result = result if isinstance(result, dict) else {}
                except Exception as e:
                    run_result = {"error": str(e)}
                ts   = _now()
                secs = _INTERVAL_SECONDS.get(sched["interval"], 0)
                from datetime import timedelta
                next_run = (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat() if secs else None
                conn2 = get_db()
                try:
                    conn2.execute("UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
                                  (ts, next_run, sched["id"]))
                    conn2.commit()
                finally:
                    conn2.close()
                if sched.get("webhook_url"):
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            await client.post(sched["webhook_url"], json={"schedule_id": sched["id"], "result": run_result, "triggered_at": ts})
                    except Exception as webhook_err:
                        logger.warning("Schedule webhook failed", extra={"step": sched["id"], "error": str(webhook_err)})
                logger.info("Schedule auto-triggered", extra={"step": sched["id"], "pipeline_id": sched["pipeline_id"]})
        except Exception as e:
            logger.warning(f"Schedule loop error: {e}")

        # Purge old completed/failed jobs (keep last 7 days)
        try:
            from datetime import timedelta
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            _c = get_db()
            _c.execute(
                "DELETE FROM pipeline_jobs WHERE status IN ('completed','failed') AND created_at < ?",
                (cutoff,)
            )
            _c.commit()
            _c.close()
        except Exception:
            pass

        await asyncio.sleep(60)

@app.on_event("startup")
async def _startup():
    init_db()
    _seed_if_empty()
    _seed_new_agents()
    asyncio.create_task(_health_loop())
    asyncio.create_task(_schedule_loop())
    logger.info("AgentVerse API started", extra={"status": "ok"})
    # Warm up the Redis queue pool (no-op if REDIS_URL not set)
    try:
        from backend.queue import get_pool
        await get_pool()
        logger.info("Redis queue connected")
    except Exception as e:
        logger.warning(f"Redis queue unavailable, using sync fallback", extra={"error": str(e)})


@app.on_event("shutdown")
async def _shutdown():
    try:
        from backend.queue import close_pool
        await close_pool()
    except Exception:
        pass

@app.get("/health", tags=["platform"])
async def platform_health():
    conn = get_db()
    agent_count = conn.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
    active_count = conn.execute("SELECT COUNT(*) FROM agents WHERE status = 'active'").fetchone()[0]
    offline_count = conn.execute("SELECT COUNT(*) FROM agents WHERE status = 'offline'").fetchone()[0]
    user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return {
        "status": "healthy",
        "version": "2.0.0",
        "agents": {"total": agent_count, "active": active_count, "offline": offline_count},
        "users": user_count,
        "timestamp": _now(),
        "x402": {
            "enabled":     X402_ENABLED,
            "network":     X402_NETWORK if X402_ENABLED else None,
            "facilitator": X402_FACILITATOR if X402_ENABLED else None,
        },
    }

@app.get("/agents/{agent_id}/health", tags=["agents"])
async def agent_health(agent_id: str):
    conn = get_db()
    agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    conn.close()
    if not agent:
        raise HTTPException(404, "Agent not found")
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        status = await _probe_endpoint(client, agent["health_endpoint"], agent["endpoint"])
    latency_ms = round((time.monotonic() - start) * 1000, 1)
    conn = get_db()
    conn.execute("UPDATE agents SET status = ? WHERE id = ?", (status, agent_id))
    conn.commit()
    conn.close()
    return {"agent_id": agent_id, "name": agent["name"], "status": status, "latency_ms": latency_ms, "endpoint": agent["health_endpoint"] or agent["endpoint"]}


# =============================================================================
# PIPELINE SCHEDULES  —  store recurring run configs + manual trigger
# =============================================================================

# Supported interval labels (user-friendly, maps to seconds for next_run_at calc)
_INTERVAL_SECONDS = {
    "5m":     5 * 60,
    "15m":   15 * 60,
    "30m":   30 * 60,
    "1h":    60 * 60,
    "4h":   4 * 60 * 60,
    "12h": 12 * 60 * 60,
    "24h": 24 * 60 * 60,
    "manual": 0,
}

class ScheduleCreate(BaseModel):
    pipeline_id: str
    label:       Optional[str] = None
    interval:    str            # e.g. "1h", "24h", "manual"
    webhook_url: Optional[str] = None

@app.post("/schedules", status_code=201, tags=["schedules"])
async def create_schedule(body: ScheduleCreate):
    if body.interval not in _INTERVAL_SECONDS:
        raise HTTPException(400, f"interval must be one of: {', '.join(_INTERVAL_SECONDS)}")
    conn = get_db()
    pipeline = conn.execute("SELECT * FROM pipelines WHERE id = ?", (body.pipeline_id,)).fetchone()
    if not pipeline:
        conn.close()
        raise HTTPException(404, "Pipeline not found")
    sched_id  = str(uuid.uuid4())
    now       = _now()
    secs      = _INTERVAL_SECONDS[body.interval]
    from datetime import timedelta
    next_run  = (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat() if secs else None
    conn.execute(
        "INSERT INTO schedules (id, pipeline_id, pipeline_name, label, interval, webhook_url, is_active, last_run_at, next_run_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (sched_id, body.pipeline_id, pipeline["name"], body.label or pipeline["name"],
         body.interval, body.webhook_url, 1, None, next_run, now)
    )
    conn.commit()
    conn.close()
    return {
        "id": sched_id, "pipeline_id": body.pipeline_id, "pipeline_name": pipeline["name"],
        "label": body.label or pipeline["name"], "interval": body.interval,
        "webhook_url": body.webhook_url, "is_active": True,
        "next_run_at": next_run, "created_at": now,
    }

@app.get("/schedules", tags=["schedules"])
def list_schedules(user: dict = Depends(_require_auth)):
    conn = get_db()
    profile = conn.execute("SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    wallet_id = profile["wallet_id"] if profile else None
    # Return schedules created by this user (matched via pipeline ownership)
    rows = conn.execute(
        """SELECT s.* FROM schedules s
           JOIN pipelines p ON s.pipeline_id = p.id
           WHERE p.wallet_id = ? OR p.wallet_id IS NULL
           ORDER BY s.created_at DESC""",
        (wallet_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.delete("/schedules/{schedule_id}", status_code=204, tags=["schedules"])
def delete_schedule(schedule_id: str):
    conn = get_db()
    conn.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
    conn.commit()
    conn.close()

@app.patch("/schedules/{schedule_id}/toggle", tags=["schedules"])
def toggle_schedule(schedule_id: str):
    conn = get_db()
    row = conn.execute("SELECT is_active FROM schedules WHERE id = ?", (schedule_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Schedule not found")
    new_state = 0 if row["is_active"] else 1
    conn.execute("UPDATE schedules SET is_active = ? WHERE id = ?", (new_state, schedule_id))
    conn.commit()
    conn.close()
    return {"id": schedule_id, "is_active": bool(new_state)}

@app.post("/schedules/{schedule_id}/trigger", tags=["schedules"])
async def trigger_schedule(schedule_id: str):
    """Manually trigger a scheduled pipeline run. Sends result to webhook_url if set."""
    conn = get_db()
    sched = conn.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,)).fetchone()
    conn.close()
    if not sched:
        raise HTTPException(404, "Schedule not found")

    pipeline_id = sched["pipeline_id"]
    # Run the pipeline inline (sync fallback path, same as /run-pipeline)
    conn3 = get_db()
    pipeline_row = conn3.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
    conn3.close()
    if not pipeline_row:
        raise HTTPException(404, "Pipeline no longer exists")
    agent_ids = json.loads(pipeline_row["agent_ids"])
    run_res = await asyncio.wait_for(
        execute_pipeline(pipeline_id, pipeline_row["name"], agent_ids, {"market": "BTC"}, DEMO_WALLET),
        timeout=MAX_RUNTIME_S
    )

    # Update last_run_at + next_run_at
    now  = _now()
    secs = _INTERVAL_SECONDS.get(sched["interval"], 0)
    from datetime import timedelta
    next_run = (datetime.now(timezone.utc) + timedelta(seconds=secs)).isoformat() if secs else None
    conn2 = get_db()
    conn2.execute("UPDATE schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?",
                  (now, next_run, schedule_id))
    conn2.commit()
    conn2.close()

    # Webhook POST if configured
    webhook_url = sched["webhook_url"]
    webhook_ok  = None
    if webhook_url:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                wr = await client.post(webhook_url, json={
                    "schedule_id":   schedule_id,
                    "pipeline_id":   pipeline_id,
                    "pipeline_name": sched["pipeline_name"],
                    "result":        run_res,
                    "triggered_at":  now,
                })
                webhook_ok = wr.status_code
        except Exception as e:
            webhook_ok = f"error: {e}"

    return {"schedule_id": schedule_id, "result": run_res, "triggered_at": now,
            "next_run_at": next_run, "webhook_status": webhook_ok}


# =============================================================================
# AGENT JOB MARKETPLACE  (ERC-8183 inspired)
# =============================================================================

class AgentJobCreate(BaseModel):
    title:             str
    description:       str = ""
    required_category: str = ""
    required_min_rep:  float = 0.0
    bounty_credits:    float          # in USD
    input_data:        dict = {}
    deadline_hours:    int = 24

@app.post("/agent-jobs", status_code=201)
async def post_agent_job(body: AgentJobCreate, user: dict = Depends(_require_auth)):
    if body.bounty_credits <= 0:
        raise HTTPException(400, "Bounty must be positive")
    if body.bounty_credits > 1000:
        raise HTTPException(400, "Bounty cannot exceed $1,000")

    conn = get_db()
    profile = conn.execute("SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    if not profile:
        conn.close()
        raise HTTPException(400, "Create a wallet first")
    wallet_id = profile["wallet_id"]

    # Check balance (BEGIN IMMEDIATE for atomic read-debit)
    conn.isolation_level = None
    conn.execute("BEGIN IMMEDIATE")
    row = conn.execute("SELECT balance FROM wallets WHERE id = ?", (wallet_id,)).fetchone()
    if not row or row["balance"] < body.bounty_credits:
        conn.execute("ROLLBACK")
        conn.close()
        raise HTTPException(402, f"Insufficient credits. Need ${body.bounty_credits}, have ${row['balance'] if row else 0:.4f}")

    # Debit bounty into escrow (platform wallet holds it)
    conn.execute("UPDATE wallets SET balance = balance - ? WHERE id = ?", (body.bounty_credits, wallet_id))
    conn.execute("UPDATE wallets SET balance = balance + ? WHERE id = ?", (body.bounty_credits, PLATFORM_WALLET))

    from datetime import timedelta
    job_id = str(uuid.uuid4())
    now = _now()
    deadline = (datetime.now(timezone.utc) + timedelta(hours=body.deadline_hours)).isoformat()

    user_row = conn.execute("SELECT username FROM users WHERE id = ?", (user["id"],)).fetchone()
    poster_name = user_row["username"] if user_row else user["id"][:8]

    conn.execute("""
        INSERT INTO agent_jobs (id, title, description, required_category, required_min_rep,
            bounty_credits, input_data, status, poster_wallet_id, poster_name,
            created_at, deadline_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
    """, (job_id, body.title, body.description, body.required_category,
          body.required_min_rep, body.bounty_credits, json.dumps(body.input_data),
          wallet_id, poster_name, now, deadline))

    conn.execute("COMMIT")
    conn.close()

    await manager.broadcast({"type": "job_posted", "job_id": job_id, "title": body.title, "bounty": body.bounty_credits})

    return {"id": job_id, "title": body.title, "bounty_credits": body.bounty_credits,
            "status": "open", "deadline_at": deadline, "created_at": now}


@app.get("/agent-jobs")
def list_agent_jobs(status: str = "open", category: str = "", limit: int = 50):
    conn = get_db()
    q = "SELECT * FROM agent_jobs WHERE 1=1"
    params = []
    if status != "all":
        q += " AND status = ?"
        params.append(status)
    if category:
        q += " AND (required_category = '' OR required_category = ?)"
        params.append(category)
    q += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [{**dict(r), "input_data": json.loads(r["input_data"] or "{}")} for r in rows]


@app.post("/agent-jobs/{job_id}/claim")
async def claim_agent_job(job_id: str, agent_id: str, user: dict = Depends(_require_auth)):
    conn = get_db()
    job = conn.execute("SELECT * FROM agent_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        raise HTTPException(404, "Job not found")
    if job["status"] != "open":
        conn.close()
        raise HTTPException(400, f"Job is {job['status']}, not open")

    agent = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        raise HTTPException(404, "Agent not found")
    if job["required_category"] and agent["category"] != job["required_category"]:
        conn.close()
        raise HTTPException(400, f"Job requires category '{job['required_category']}', agent is '{agent['category']}'")
    if agent["reputation"] < job["required_min_rep"]:
        conn.close()
        raise HTTPException(400, f"Agent reputation {agent['reputation']:.1f} below minimum {job['required_min_rep']:.1f}")

    profile = conn.execute("SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    claimer_wallet = profile["wallet_id"] if profile else None

    conn.execute("""
        UPDATE agent_jobs SET status='claimed', claimer_agent_id=?, claimer_wallet_id=?, claimed_at=?
        WHERE id = ? AND status='open'
    """, (agent_id, claimer_wallet, _now(), job_id))
    conn.commit()
    conn.close()

    await manager.broadcast({"type": "job_claimed", "job_id": job_id, "agent_id": agent_id})
    return {"job_id": job_id, "agent_id": agent_id, "status": "claimed"}


class JobComplete(BaseModel):
    output_data: dict = {}
    result_summary: str = ""

@app.post("/agent-jobs/{job_id}/complete")
async def complete_agent_job(job_id: str, body: JobComplete, user: dict = Depends(_require_auth)):
    conn = get_db()
    job = conn.execute("SELECT * FROM agent_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        raise HTTPException(404, "Job not found")
    if job["status"] != "claimed":
        conn.close()
        raise HTTPException(400, "Job must be claimed before completing")

    # Verify the claimer is calling this
    profile = conn.execute("SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    if not profile or profile["wallet_id"] != job["claimer_wallet_id"]:
        conn.close()
        raise HTTPException(403, "Only the claimer can complete this job")

    bounty = job["bounty_credits"]
    platform_cut = round(bounty * PLATFORM_FEE, 6)
    claimer_payout = round(bounty - platform_cut, 6)

    # Atomic payment: escrow (platform) → claimer wallet
    conn.isolation_level = None
    conn.execute("BEGIN IMMEDIATE")
    conn.execute("UPDATE wallets SET balance = balance - ? WHERE id = ?", (bounty, PLATFORM_WALLET))
    conn.execute("UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE id = ?",
                 (claimer_payout, claimer_payout, job["claimer_wallet_id"]))

    # Update agent balance too
    if job["claimer_agent_id"]:
        conn.execute("UPDATE agents SET agent_balance = agent_balance + ?, total_earned = total_earned + ? WHERE id = ?",
                     (claimer_payout, claimer_payout, job["claimer_agent_id"]))

    conn.execute("""
        UPDATE agent_jobs SET status='completed', output_data=?, completed_at=?
        WHERE id = ?
    """, (json.dumps(body.output_data), _now(), job_id))

    conn.execute("COMMIT")
    conn.close()

    await manager.broadcast({
        "type": "job_completed", "job_id": job_id, "bounty": bounty,
        "payout": claimer_payout, "summary": body.result_summary,
    })

    logger.info("job_completed", extra={"job_id": job_id, "bounty": bounty, "payout": claimer_payout})
    return {"job_id": job_id, "status": "completed", "payout": claimer_payout, "platform_fee": platform_cut}


@app.delete("/agent-jobs/{job_id}", status_code=200)
async def cancel_agent_job(job_id: str, user: dict = Depends(_require_auth)):
    conn = get_db()
    job = conn.execute("SELECT * FROM agent_jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        raise HTTPException(404, "Job not found")
    if job["status"] not in ("open", "claimed"):
        conn.close()
        raise HTTPException(400, "Cannot cancel a completed or already-cancelled job")

    profile = conn.execute("SELECT wallet_id FROM developer_profiles WHERE user_id = ?", (user["id"],)).fetchone()
    if not profile or profile["wallet_id"] != job["poster_wallet_id"]:
        conn.close()
        raise HTTPException(403, "Only the poster can cancel this job")

    # Refund bounty from escrow
    conn.isolation_level = None
    conn.execute("BEGIN IMMEDIATE")
    conn.execute("UPDATE wallets SET balance = balance - ? WHERE id = ?", (job["bounty_credits"], PLATFORM_WALLET))
    conn.execute("UPDATE wallets SET balance = balance + ? WHERE id = ?", (job["bounty_credits"], job["poster_wallet_id"]))
    conn.execute("UPDATE agent_jobs SET status='cancelled' WHERE id = ?", (job_id,))
    conn.execute("COMMIT")
    conn.close()

    return {"job_id": job_id, "status": "cancelled", "refunded": job["bounty_credits"]}


@app.get("/agents/{agent_id}/economy")
def agent_economy(agent_id: str):
    conn = get_db()
    agent = conn.execute("SELECT id, name, reputation, agent_balance, total_calls, total_earned FROM agents WHERE id = ?", (agent_id,)).fetchone()
    if not agent:
        conn.close()
        raise HTTPException(404, "Agent not found")
    jobs_completed = conn.execute("SELECT COUNT(*) as c FROM agent_jobs WHERE claimer_agent_id = ? AND status = 'completed'", (agent_id,)).fetchone()["c"]
    jobs_posted = conn.execute("SELECT COUNT(*) as c FROM agent_jobs WHERE poster_wallet_id = (SELECT owner_wallet FROM agents WHERE id = ?) AND status != 'cancelled'", (agent_id,)).fetchone()["c"]
    conn.close()
    return {
        **dict(agent),
        "jobs_completed": jobs_completed,
        "jobs_posted": jobs_posted,
        "rep_tier": "Elite" if agent["reputation"] >= 4.5 else "Pro" if agent["reputation"] >= 3.5 else "Active" if agent["reputation"] >= 2.5 else "New",
    }


@app.get("/economy/stats")
def economy_stats():
    conn = get_db()
    total_jobs     = conn.execute("SELECT COUNT(*) FROM agent_jobs").fetchone()[0]
    open_jobs      = conn.execute("SELECT COUNT(*) FROM agent_jobs WHERE status='open'").fetchone()[0]
    completed_jobs = conn.execute("SELECT COUNT(*) FROM agent_jobs WHERE status='completed'").fetchone()[0]
    total_bounties = conn.execute("SELECT COALESCE(SUM(bounty_credits),0) FROM agent_jobs WHERE status='completed'").fetchone()[0]
    top_agents     = conn.execute("""
        SELECT id, name, reputation, total_earned, total_calls, category
        FROM agents WHERE total_calls > 0
        ORDER BY total_earned DESC LIMIT 10
    """).fetchall()
    conn.close()
    return {
        "total_jobs": total_jobs,
        "open_jobs": open_jobs,
        "completed_jobs": completed_jobs,
        "total_bounties_paid": round(total_bounties, 4),
        "top_agents": [dict(a) for a in top_agents],
    }


# =============================================================================
# RATE LIMITING MIDDLEWARE
# =============================================================================

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Identify by API key if present, else by IP
    auth = request.headers.get("Authorization", "")
    if auth.startswith("ApiKey "):
        identifier = "key:" + hashlib.sha256(auth[7:].encode()).hexdigest()[:16]
    else:
        identifier = "ip:" + (request.client.host if request.client else "unknown")
    # Skip rate limiting for health and auth endpoints
    if request.url.path in ("/health", "/auth/register", "/auth/login", "/auth/forgot-password", "/auth/reset-password"):
        return await call_next(request)
    now = time.time()
    window = _rate_store[identifier]
    _rate_store[identifier] = [t for t in window if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_store[identifier]) >= RATE_LIMIT_MAX:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={"detail": f"Rate limit: max {RATE_LIMIT_MAX} req/{RATE_LIMIT_WINDOW}s"},
        )
    _rate_store[identifier].append(now)
    return await call_next(request)
