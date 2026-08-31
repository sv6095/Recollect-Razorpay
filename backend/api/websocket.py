import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from event_queue import event_bus
from state import redis_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# Active WebSocket connections
_connections: set[WebSocket] = set()


async def _broadcast_to_all(message: dict) -> None:
    """Send an event to all connected dashboard clients."""
    dead = set()
    for ws in _connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


@router.websocket("/ws/events")
async def websocket_events(ws: WebSocket):
    """WebSocket endpoint for real-time dashboard updates."""
    await ws.accept()
    _connections.add(ws)
    logger.info(f"[WS] Client connected. Total: {len(_connections)}")

    try:
        # Start a fan-out task that listens to the broadcast queue
        fan_out_task = asyncio.create_task(_fan_out_loop(ws))

        # Keep alive — listen for pings
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if data == "ping":
                    await ws.send_text("pong")
            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await ws.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        fan_out_task.cancel()
        _connections.discard(ws)
        logger.info(f"[WS] Client disconnected. Total: {len(_connections)}")


async def _fan_out_loop(ws: WebSocket) -> None:
    """Pull events from the in-memory broadcast queue and push to this client."""
    # Subscribe to Redis pub/sub as well
    redis_task = asyncio.create_task(_redis_fan_out(ws))
    try:
        while True:
            try:
                event = await asyncio.wait_for(event_bus.get_broadcast_event(), timeout=1.0)
                await ws.send_json(event)
            except asyncio.TimeoutError:
                continue
            except Exception:
                break
    finally:
        redis_task.cancel()


async def _redis_fan_out(ws: WebSocket) -> None:
    """Subscribe to Redis pub/sub and push events to this WebSocket client."""
    try:
        async for event in redis_store.subscribe_events():
            await ws.send_json(event)
    except Exception:
        pass


# Module-level broadcaster for use by orchestrator
async def broadcast(event: dict) -> None:
    await _broadcast_to_all(event)
