import asyncio
from typing import Callable, Awaitable
from models.transaction import Transaction, TransactionCategory

# Per-category asyncio queues
queue_a: asyncio.Queue = asyncio.Queue(maxsize=1000)
queue_b: asyncio.Queue = asyncio.Queue(maxsize=1000)
queue_c: asyncio.Queue = asyncio.Queue(maxsize=1000)
queue_sentinel: asyncio.Queue = asyncio.Queue(maxsize=1000)

# In-memory broadcast queue for WebSocket push (when Redis pub/sub not available)
_ws_broadcast_queue: asyncio.Queue = asyncio.Queue(maxsize=5000)
_broadcast_handlers: list[Callable[[dict], Awaitable[None]]] = []

# Active worker tasks
_workers: list[asyncio.Task] = []


def register_broadcast_handler(handler: Callable[[dict], Awaitable[None]]) -> None:
    """Register a callback (e.g. WebSocket fan-out) to receive all broadcast events immediately."""
    if handler not in _broadcast_handlers:
        _broadcast_handlers.append(handler)


def route_to_queue(txn: Transaction) -> asyncio.Queue:
    """Route a triaged transaction to the appropriate category queue."""
    if txn.category == TransactionCategory.SENTINEL:
        return queue_sentinel
    elif txn.category == TransactionCategory.A:
        return queue_a
    elif txn.category == TransactionCategory.B:
        return queue_b
    elif txn.category == TransactionCategory.C:
        return queue_c
    else:
        return queue_a  # default


async def enqueue(txn: Transaction) -> None:
    q = route_to_queue(txn)
    await q.put(txn)


async def broadcast_event(event: dict) -> None:
    """Push an event to registered broadcast handlers and the in-memory queue."""
    try:
        _ws_broadcast_queue.put_nowait(event)
    except asyncio.QueueFull:
        pass  # Drop if full — dashboard is best-effort

    for handler in list(_broadcast_handlers):
        try:
            await handler(event)
        except Exception:
            pass


async def get_broadcast_event() -> dict:
    """Block until an event is available for WebSocket broadcast."""
    return await _ws_broadcast_queue.get()


async def start_workers(process_fn: Callable[[Transaction], Awaitable[None]],
                         workers_per_queue: int = 2) -> None:
    """Start worker coroutines consuming from each category queue."""
    global _workers
    for queue, name in [
        (queue_a, "Cat-A"), (queue_b, "Cat-B"),
        (queue_c, "Cat-C"), (queue_sentinel, "Sentinel")
    ]:
        for i in range(workers_per_queue):
            task = asyncio.create_task(
                _worker_loop(queue, process_fn, f"{name}-Worker-{i+1}"),
                name=f"worker-{name}-{i+1}"
            )
            _workers.append(task)


async def _worker_loop(queue: asyncio.Queue,
                        process_fn: Callable[[Transaction], Awaitable[None]],
                        name: str) -> None:
    while True:
        try:
            txn: Transaction = await queue.get()
            await process_fn(txn)
            queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            # Don't crash the worker on individual transaction failure
            import logging
            logging.getLogger(name).error(f"Worker error processing txn: {e}", exc_info=True)
            queue.task_done()


async def stop_workers() -> None:
    for task in _workers:
        task.cancel()
    await asyncio.gather(*_workers, return_exceptions=True)
    _workers.clear()
