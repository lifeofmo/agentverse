"""
Queue client helpers — used by main.py to enqueue pipeline jobs.

If Redis is not configured or unavailable, enqueue() returns None and
main.py falls back to synchronous in-process execution.
"""

import os
from typing import Optional

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from arq.jobs import Job

REDIS_URL: str = os.environ.get("REDIS_URL", "")


def _parse_redis_settings(url: str) -> RedisSettings:
    url = url.replace("redis://", "").replace("rediss://", "")
    host_part, _, db_part = url.partition("/")
    host, _, port_str = host_part.partition(":")
    return RedisSettings(
        host=host or "localhost",
        port=int(port_str) if port_str else 6379,
        database=int(db_part) if db_part else 0,
    )


_pool: Optional[ArqRedis] = None


async def get_pool() -> Optional[ArqRedis]:
    """
    Returns a shared arq Redis pool.
    Returns None if REDIS_URL is not set (dev / no-Redis mode).
    """
    global _pool
    if not REDIS_URL:
        return None
    if _pool is None:
        settings = _parse_redis_settings(REDIS_URL)
        _pool = await create_pool(settings, default_queue_name="agentverse")
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def enqueue_pipeline(
    job_id: str,
    pipeline_id: str,
    pipeline_name: str,
    agent_ids: list[str],
    input_data: dict,
    wallet_id: str,
) -> Optional[Job]:
    """
    Enqueues a pipeline execution job.
    Returns the arq Job object, or None if queue is unavailable.
    """
    pool = await get_pool()
    if pool is None:
        return None

    job = await pool.enqueue_job(
        "execute_pipeline_job",
        job_id,
        pipeline_id,
        pipeline_name,
        agent_ids,
        input_data,
        wallet_id,
        _job_id=job_id,
    )
    return job
