"""
AgentVerse pipeline worker — powered by arq (async Redis task queue).

Start in development:
  arq backend.worker.WorkerSettings

Start via Docker (see docker-compose.yml worker service):
  python -m arq backend.worker.WorkerSettings

Environment variables:
  REDIS_URL     redis://localhost:6379  (default)
  DATABASE_URL  Async DB URL (see backend/database.py)
  DB_PATH       SQLite path fallback
"""

import json
import os
import random
import time
import uuid
from datetime import datetime, timezone

import httpx
from arq.connections import RedisSettings

from backend.database import database, init_schema

# ── Config ────────────────────────────────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
MAX_PIPELINE_STEPS = 10
MAX_RUNTIME_S = 15.0

# Parse redis://host:port[/db] into RedisSettings
def _parse_redis_settings(url: str) -> RedisSettings:
    url = url.replace("redis://", "").replace("rediss://", "")
    host_part, _, db_part = url.partition("/")
    host, _, port_str = host_part.partition(":")
    return RedisSettings(
        host=host or "localhost",
        port=int(port_str) if port_str else 6379,
        database=int(db_part) if db_part else 0,
    )


REDIS_SETTINGS = _parse_redis_settings(REDIS_URL)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Mock responses (mirrors main.py _mock_response) ──────────────────────────
def _mock_response(agent_name: str, category: str, payload: dict) -> dict:
    market = payload.get("market", "BTC")
    PRICES = {"BTC": 62000, "ETH": 3200, "SOL": 145, "AVAX": 38, "BNB": 580}
    p = PRICES.get(market, 1000) * random.uniform(0.99, 1.01)
    n = agent_name.lower()

    if "momentum" in n:
        s = random.uniform(-10, 10)
        return {"market": market, "signal": "BUY" if s > 2 else "SELL" if s < -2 else "HOLD",
                "confidence": round(abs(s) / 10 * 0.4 + 0.5, 2), "momentum_score": round(s, 2)}
    if "sentiment" in n:
        sc = random.randint(10, 95)
        label = ("EXTREME_FEAR" if sc < 25 else "FEAR" if sc < 45 else
                 "NEUTRAL" if sc < 55 else "GREED" if sc < 75 else "EXTREME_GREED")
        return {"market": market, "score": sc, "sentiment": label,
                "social_volume": random.randint(1200, 48000)}
    if "price" in n:
        return {"market": market, "price_usd": round(p, 2),
                "change_24h_pct": round(random.uniform(-6.5, 6.5), 2),
                "high_24h": round(p * 1.02, 2), "low_24h": round(p * 0.98, 2)}
    if "risk" in n:
        s = round(random.uniform(2.5, 9.5), 1)
        return {"market": market, "risk_score": s,
                "max_drawdown_pct": round(random.uniform(5, 28), 1),
                "recommendation": "ADD" if s < 4 else "HOLD" if s < 7 else "REDUCE_POSITION"}
    if "trend" in n:
        r = random.random()
        return {"market": market,
                "trend": "UPTREND" if r > 0.55 else "DOWNTREND" if r < 0.3 else "SIDEWAYS",
                "strength": random.choice(["WEAK", "MODERATE", "STRONG"]),
                "adx": round(random.uniform(12, 55), 1)}
    if "pattern" in n:
        return {"market": market, "confidence": round(random.uniform(0.52, 0.93), 2),
                "pattern": random.choice(["BULL_FLAG", "HEAD_SHOULDERS", "DOUBLE_TOP",
                                          "CUP_HANDLE", "ASCENDING_TRIANGLE"])}
    if "volatility" in n:
        v = round(random.uniform(14, 55), 1)
        return {"market": market, "vix_equiv": v,
                "regime": "LOW" if v < 20 else "MEDIUM" if v < 35 else "HIGH",
                "recommendation": "HOLD" if v < 20 else "HEDGE" if v < 35 else "REDUCE"}
    if "arbitrage" in n:
        sp = round(random.uniform(0.01, 0.35), 3)
        return {"market": market,
                "opportunity": "HIGH" if sp > 0.2 else "MEDIUM" if sp > 0.1 else "LOW",
                "spread_pct": sp, "net_profit_est": round(sp * 0.7, 3)}
    return {"market": market, "status": "ok",
            "confidence": round(random.uniform(0.6, 0.9), 2),
            "signal": random.choice(["BUY", "SELL", "HOLD"]), "_mock": True}


# ── Core task ─────────────────────────────────────────────────────────────────

async def execute_pipeline_job(
    ctx: dict,
    job_id: str,
    pipeline_id: str,
    pipeline_name: str,
    agent_ids: list[str],
    input_data: dict,
    wallet_id: str,
):
    """
    Runs a multi-step pipeline. Called by arq worker process.

    Each step:
      1. Fetches agent record from DB
      2. POSTs to agent endpoint (falls back to mock if unreachable)
      3. Merges output into next step's payload
      4. Records metrics

    Updates pipeline_jobs.status → running → completed/failed.
    """
    await database.execute(
        "UPDATE pipeline_jobs SET status = 'running', started_at = :now WHERE id = :id",
        {"now": _now(), "id": job_id},
    )

    steps: list[dict] = []
    payload = {**input_data, "market": input_data.get("market", "BTC")}
    t_start = time.time()
    total_cost = 0.0

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for agent_id in agent_ids[:MAX_PIPELINE_STEPS]:
                # Abort if we've already exceeded the wall-clock limit
                if time.time() - t_start > MAX_RUNTIME_S:
                    break

                row = await database.fetch_one(
                    "SELECT * FROM agents WHERE id = :id", {"id": agent_id}
                )
                if not row:
                    continue

                agent = dict(row)
                step_start = time.time()
                error_flag = False

                try:
                    resp = await client.post(agent["endpoint"], json=payload)
                    resp.raise_for_status()
                    output = resp.json()
                except Exception:
                    output = _mock_response(agent["name"], agent.get("category", ""), payload)
                    error_flag = True

                step_ms = round((time.time() - step_start) * 1000, 2)
                price = agent.get("price_per_request") or 0.0
                total_cost += price

                steps.append({
                    "agent_id":   agent_id,
                    "agent_name": agent["name"],
                    "output":     output,
                    "latency_ms": step_ms,
                    "mock":       error_flag,
                })

                # Record metrics (fire-and-forget on the DB)
                earnings = round(price * 0.9, 6)
                await database.execute(
                    """INSERT INTO metrics (agent_id, requests, total_latency_ms, errors, earnings, last_called)
                       VALUES (:aid, 1, :lat, :err, :earn, :now)
                       ON CONFLICT(agent_id) DO UPDATE SET
                           requests         = requests + 1,
                           total_latency_ms = total_latency_ms + excluded.total_latency_ms,
                           errors           = errors + excluded.errors,
                           earnings         = earnings + excluded.earnings,
                           last_called      = excluded.last_called""",
                    {"aid": agent_id, "lat": step_ms,
                     "err": 1 if error_flag else 0,
                     "earn": earnings, "now": _now()},
                )

                # Merge output into next step's payload
                payload = {**payload, **output}

        total_ms = round((time.time() - t_start) * 1000, 2)
        final_output = payload  # accumulated result of all steps
        result_blob = json.dumps({
            "steps":        steps,
            "total_ms":     total_ms,
            "total_cost":   round(total_cost, 6),
            "final":        final_output,
        })

        await database.execute(
            """UPDATE pipeline_jobs
               SET status = 'completed', result = :result, completed_at = :now
               WHERE id = :id""",
            {"result": result_blob, "now": _now(), "id": job_id},
        )
        return {"status": "completed", "steps": len(steps), "total_ms": total_ms}

    except Exception as exc:
        await database.execute(
            """UPDATE pipeline_jobs
               SET status = 'failed', error = :err, completed_at = :now
               WHERE id = :id""",
            {"err": str(exc), "now": _now(), "id": job_id},
        )
        raise


# ── arq WorkerSettings ────────────────────────────────────────────────────────

async def startup(ctx: dict):
    await database.connect()
    await init_schema()


async def shutdown(ctx: dict):
    await database.disconnect()


class WorkerSettings:
    functions = [execute_pipeline_job]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = REDIS_SETTINGS
    max_jobs = 20
    job_timeout = 60          # hard cap per job (arq-level)
    keep_result = 3600        # keep job results in Redis for 1 hour
    queue_name = "agentverse"
