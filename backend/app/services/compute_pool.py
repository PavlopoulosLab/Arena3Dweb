"""Process-pool isolation for igraph-backed computations.

igraph's C core can hit an internal invariant and abort() the whole process —
observed on 3D Kamada-Kawai for certain weighted graphs (igraph 1.0.0,
src/layout/align.c, "Assertion failed: correction_saved"), reachable from
ordinary group-layout requests. A Python try/except can never catch an
abort(); running the computation in a worker process means it only takes
that worker down, so the request gets a clean error instead of the whole
server dying mid-response. A job that runs past config.COMPUTE_SECONDS is
stopped the same way (terminated, not just cancelled — asyncio cancellation
doesn't interrupt a synchronous call already running in another process).

Each of the LAYOUT_WORKERS concurrency slots is its own single-worker
ProcessPoolExecutor, not one shared N-worker pool. This matters: killing any
one worker in a ProcessPoolExecutor marks the *whole* pool BrokenProcessPool,
failing every other future on it too — confirmed directly (a healthy sibling
job submitted to a 2-worker pool failed with BrokenProcessPool when the
other worker was killed, even though it never touched that worker). With one
worker per slot, a kill or crash only ever replaces that slot's own pool —
concurrent jobs in other slots are untouched.

Workers use the "spawn" start method, not the POSIX default "fork": a forked
worker inherits duplicates of the parent's open file descriptors (uvicorn's
listening socket, in-flight connections, …), and when that worker aborts,
those duplicates appear to confuse ProcessPoolExecutor's crash detection —
confirmed directly: under "fork", a crashed worker left both the triggering
request and the whole server hung forever (not just that one request); under
"spawn" (a genuinely fresh process, no inherited fds), the crash is detected
immediately and the server keeps serving. "spawn" pays a slower worker
startup/restart cost, acceptable here since workers are long-lived and only
restarted after an actual crash or timeout.
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

_slots: list[ProcessPoolExecutor] = []
_free: asyncio.Queue[int] | None = None
_start_lock = asyncio.Lock()


class ComputeCrashed(RuntimeError):
    """A worker process died while running this request."""


class ComputeTimeout(ComputeCrashed):
    """The request ran past config.COMPUTE_SECONDS and was stopped."""


def _new_slot() -> ProcessPoolExecutor:
    return ProcessPoolExecutor(max_workers=1, mp_context=multiprocessing.get_context("spawn"))


def start() -> None:
    global _slots, _free
    _slots = [_new_slot() for _ in range(config.LAYOUT_WORKERS)]
    _free = asyncio.Queue()
    for i in range(len(_slots)):
        _free.put_nowait(i)


def stop() -> None:
    global _slots, _free
    for pool in _slots:
        pool.shutdown(cancel_futures=True)
    _slots = []
    _free = None


async def _ensure_started() -> asyncio.Queue[int]:
    if _free is None:
        async with _start_lock:
            if _free is None:  # another request may have started it meanwhile
                start()
    assert _free is not None
    return _free


async def run_isolated(fn: Callable[..., T], *args: object) -> T:
    """Run `fn(*args)` in one of the worker slots; survives that slot's worker
    crashing or running past config.COMPUTE_SECONDS, without affecting any
    other slot's concurrently-running job."""
    free = await _ensure_started()
    i = await free.get()
    pool = _slots[i]
    loop = asyncio.get_running_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(pool, fn, *args), timeout=config.COMPUTE_SECONDS
        )
    except TimeoutError as e:
        for proc in list(getattr(pool, "_processes", {}).values()):
            proc.terminate()  # a running job cannot be cancelled: end its process
        pool.shutdown(wait=False, cancel_futures=True)
        _slots[i] = _new_slot()
        logger.error("Compute job stopped after %.0f s", config.COMPUTE_SECONDS)
        raise ComputeTimeout(
            f"The computation took longer than {config.COMPUTE_SECONDS:.0f} s and was "
            "stopped; try fewer layers, a smaller network or a faster algorithm."
        ) from e
    except BrokenProcessPool as e:
        pool.shutdown(wait=False, cancel_futures=True)
        _slots[i] = _new_slot()
        logger.error("Compute worker crashed: %s", e)
        raise ComputeCrashed(
            "The server's layout engine crashed on this request (likely an "
            "internal igraph error) — try a different algorithm, grouping or "
            "clustering option."
        ) from e
    finally:
        free.put_nowait(i)
