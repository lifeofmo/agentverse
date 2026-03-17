"""
Async database layer — supports SQLite (dev) and PostgreSQL (prod).

Environment variables:
  DATABASE_URL  Full connection URL. Examples:
                  postgresql+asyncpg://user:pass@localhost/agentverse
                  sqlite+aiosqlite:///./database/agents.db
  DB_PATH       SQLite file path, used only when DATABASE_URL is not set.
                Default: ../database/agents.db

All queries use named :param style (databases library normalises across backends).
"""

import os
from databases import Database

_DB_PATH: str = os.environ.get("DB_PATH", "../database/agents.db")
_DEFAULT_URL: str = f"sqlite+aiosqlite:///{_DB_PATH}"

DATABASE_URL: str = os.environ.get("DATABASE_URL", _DEFAULT_URL)
IS_POSTGRES: bool = DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")

database = Database(DATABASE_URL)

# ── Schema DDL ────────────────────────────────────────────────────────────────
# Written once here so both the sync init_db (legacy path) and the async layer
# share a single source of truth for table definitions.

SCHEMA_STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS agents (
        id               TEXT PRIMARY KEY,
        name             TEXT NOT NULL,
        description      TEXT,
        endpoint         TEXT NOT NULL,
        schema_endpoint  TEXT,
        health_endpoint  TEXT,
        category         TEXT,
        price_per_request REAL,
        owner_wallet     TEXT,
        created_at       TEXT,
        status           TEXT DEFAULT 'active',
        reputation       REAL DEFAULT 5.0,
        developer_name   TEXT,
        developer_color  TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS metrics (
        agent_id         TEXT PRIMARY KEY,
        requests         INTEGER DEFAULT 0,
        total_latency_ms REAL    DEFAULT 0,
        errors           INTEGER DEFAULT 0,
        earnings         REAL    DEFAULT 0,
        last_called      TEXT,
        success_rate     REAL    DEFAULT 1.0
    )""",
    """CREATE TABLE IF NOT EXISTS pipelines (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        agent_ids TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS challenges (
        id            TEXT PRIMARY KEY,
        title         TEXT NOT NULL,
        description   TEXT,
        reward        REAL DEFAULT 0,
        scoring_field TEXT NOT NULL,
        status        TEXT DEFAULT 'open'
    )""",
    """CREATE TABLE IF NOT EXISTS challenge_entries (
        id            TEXT PRIMARY KEY,
        challenge_id  TEXT NOT NULL,
        pipeline_id   TEXT NOT NULL,
        pipeline_name TEXT NOT NULL,
        score         REAL DEFAULT 0,
        latency_ms    REAL DEFAULT 0,
        result        TEXT,
        submitted_at  TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS wallets (
        id           TEXT PRIMARY KEY,
        owner_name   TEXT NOT NULL,
        balance      REAL DEFAULT 0,
        total_spent  REAL DEFAULT 0,
        total_earned REAL DEFAULT 0,
        created_at   TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY,
        user_wallet     TEXT NOT NULL,
        agent_id        TEXT,
        pipeline_id     TEXT,
        amount          REAL NOT NULL,
        platform_fee    REAL NOT NULL,
        agent_earnings  REAL NOT NULL,
        timestamp       TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        username      TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        is_active     INTEGER DEFAULT 1
    )""",
    """CREATE TABLE IF NOT EXISTS api_keys (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        key_hash   TEXT UNIQUE NOT NULL,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used  TEXT,
        is_active  INTEGER DEFAULT 1
    )""",
    """CREATE TABLE IF NOT EXISTS developer_profiles (
        user_id      TEXT PRIMARY KEY,
        display_name TEXT,
        website      TEXT,
        wallet_id    TEXT,
        joined_at    TEXT NOT NULL
    )""",
    # ── New: async pipeline jobs table ──────────────────────────────────────
    """CREATE TABLE IF NOT EXISTS pipeline_jobs (
        id           TEXT PRIMARY KEY,
        pipeline_id  TEXT NOT NULL,
        pipeline_name TEXT,
        status       TEXT NOT NULL DEFAULT 'queued',
        input_data   TEXT,
        result       TEXT,
        error        TEXT,
        wallet_id    TEXT,
        created_at   TEXT NOT NULL,
        started_at   TEXT,
        completed_at TEXT
    )""",
]


async def connect():
    await database.connect()


async def disconnect():
    await database.disconnect()


async def init_schema():
    """Create all tables idempotently. Safe to call on every startup."""
    for stmt in SCHEMA_STATEMENTS:
        await database.execute(query=stmt)
