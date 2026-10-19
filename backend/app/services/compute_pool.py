"""Process-pool isolation for igraph-backed computations.

igraph's C core can hit an internal invariant and abort() the whole process —
observed on 3D Kamada-Kawai for certain weighted graphs (igraph 1.0.0,
src/layout/align.c, "Assertion failed: correction_saved"), reachable from
ordinary group-layout requests. A Python try/except can never catch an
abort(); running the computation in a worker process means it only takes
that worker down, so the request gets a clean error instead of the whole
server dying mid-response.

Workers use the "spawn" start method, not the POSIX default "fork": a forked
worker inherits duplicates of the parent's open file descriptors (uvicorn's
listening socket, in-flight connections, …), and when that worker aborts,
those duplicates appear to confuse ProcessPoolExecutor's crash detection —
confirmed directly: under "fork", a crashed worker left both the triggering
request and the whole server hung forever (not just that one request); under
"spawn" (a genuinely fresh process, no inherited fds), the crash is detected
immediately and the server keeps serving. "spawn" pays a slower worker
startup/restart cost, acceptable here since workers are long-lived and only
restarted after an actual crash.
"""

import asyncio
import logging
import multiprocessing
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from typing import TypeVar

from app import config

logger = logging.getLogger(__name__)

T = TypeVar("T")

_pool: ProcessPoolExecutor | None = None
_lock = asyncio.Lock()


class ComputeCrashed(RuntimeError):
    """A worker process died while running this request."""


class ComputeTimeout(ComputeCrashed):
    """The request ran past config.COMPUTE_SECONDS and was stopped."""


def start() -> None:
    global _pool
    _pool = ProcessPoolExecutor(
        max_workers=config.LAYOUT_WORKERS,
        mp_context=multiprocessing.get_context("spawn"),
    )


def stop() -> None:
    global _pool
    if _pool is not None:
        _pool.shutdown(cancel_futures=True)
        _pool = None


async def _ensure_pool() -> ProcessPoolExecutor:
    if _pool is None:
        async with _lock:
            if _pool is None:  # another request may have created it meanwhile
                start()
    assert _pool is not None
    return _pool


async def _replace(pool: ProcessPoolExecutor, kill: bool = False) -> None:
    async with _lock:
        if _pool is pool:  # nobody else already replaced it
            if kill:  # a running job cannot be cancelled: end its process
                for proc in list(getattr(pool, "_processes", {}).values()):
                    proc.terminate()
            pool.shutdown(wait=False, cancel_futures=True)
            start()


async def run_isolated(fn: Callable[..., T], *args: object) -> T:
    """Run `fn(*args)` in the worker pool; survives a worker crash, and stops
    a job that runs past config.COMPUTE_SECONDS."""
    pool = await _ensure_pool()
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(pool, fn, *args), timeout=config.COMPUTE_SECONDS
        )
    except TimeoutError as e:
        await _replace(pool, kill=True)
        logger.error("Compute job stopped after %.0f s", config.COMPUTE_SECONDS)
        raise ComputeTimeout(
            f"The computation took longer than {config.COMPUTE_SECONDS:.0f} s and was "
            "stopped; try fewer layers, a smaller network or a faster algorithm."
        ) from e
    except BrokenProcessPool as e:
        await _replace(pool)
        logger.error("Compute worker crashed: %s", e)
        raise ComputeCrashed(
            "The server's layout engine crashed on this request (likely an "
            "internal igraph error) — try a different algorithm, grouping or "
            "clustering option."
        ) from e
