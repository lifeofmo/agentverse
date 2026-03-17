"""
SQLite → PostgreSQL migration script.

Usage:
    DB_PATH=../database/agents.db \
    DATABASE_URL=postgresql+asyncpg://agentverse:pass@localhost/agentverse \
    python -m backend.migrate

What it does:
  1. Reads all rows from each SQLite table
  2. Creates tables in PostgreSQL (via init_schema)
  3. Bulk-inserts rows into PostgreSQL

Safe to run multiple times — uses INSERT OR IGNORE semantics where supported.
"""

import asyncio
import json
import os
import sqlite3
import sys
from pathlib import Path

# Ensure we run from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database import DATABASE_URL, IS_POSTGRES, database, init_schema

SQLITE_PATH = os.environ.get("DB_PATH", "../database/agents.db")

TABLES = [
    "agents",
    "metrics",
    "pipelines",
    "challenges",
    "challenge_entries",
    "wallets",
    "transactions",
    "users",
    "api_keys",
    "developer_profiles",
    "pipeline_jobs",
]


def _read_sqlite(path: str) -> dict[str, list[dict]]:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    data: dict[str, list[dict]] = {}
    cursor = conn.cursor()
    for table in TABLES:
        try:
            rows = cursor.execute(f"SELECT * FROM {table}").fetchall()
            data[table] = [dict(r) for r in rows]
        except sqlite3.OperationalError:
            data[table] = []  # table doesn't exist yet
    conn.close()
    return data


def _build_insert(table: str, row: dict) -> tuple[str, dict]:
    """Build a named-param INSERT statement for a given row dict."""
    cols = list(row.keys())
    placeholders = ", ".join(f":{c}" for c in cols)
    col_list = ", ".join(cols)
    # PostgreSQL uses ON CONFLICT DO NOTHING; databases lib normalises
    stmt = (
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        "ON CONFLICT DO NOTHING"
    )
    return stmt, row


async def migrate():
    if not IS_POSTGRES:
        print("ERROR: DATABASE_URL is not a PostgreSQL URL.")
        print(f"  DATABASE_URL = {DATABASE_URL}")
        sys.exit(1)

    if not Path(SQLITE_PATH).exists():
        print(f"ERROR: SQLite DB not found at {SQLITE_PATH}")
        sys.exit(1)

    print(f"Reading SQLite: {SQLITE_PATH}")
    data = _read_sqlite(SQLITE_PATH)

    total = sum(len(v) for v in data.values())
    print(f"  Found {total} rows across {len(TABLES)} tables")
    for t, rows in data.items():
        print(f"    {t}: {len(rows)} rows")

    print(f"\nConnecting to PostgreSQL: {DATABASE_URL[:40]}…")
    await database.connect()
    await init_schema()
    print("  Schema created / verified.")

    migrated = 0
    for table, rows in data.items():
        if not rows:
            continue
        print(f"  Migrating {table} ({len(rows)} rows)…", end=" ", flush=True)
        for row in rows:
            stmt, values = _build_insert(table, row)
            try:
                await database.execute(query=stmt, values=values)
                migrated += 1
            except Exception as e:
                print(f"\n    WARN skipping row in {table}: {e}")
        print("done")

    await database.disconnect()
    print(f"\nMigration complete. {migrated}/{total} rows inserted.")


if __name__ == "__main__":
    asyncio.run(migrate())
