import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from event_queue import event_bus
from state import redis_store
from db import database as db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# Active WebSocket connections
_connections: set[WebSocket] = set()


async def _broadcast_to_all(message: dict) -> None:
    """Send an event to all connected dashboard clients."""
    dead = set()
    for ws in list(_connections):
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


# Register broadcaster directly into event_bus so every broadcast_event() pushes to all clients
event_bus.register_broadcast_handler(_broadcast_to_all)


@router.websocket("/ws/events")
async def websocket_events(ws: WebSocket):
    """WebSocket endpoint for real-time dashboard updates."""
    await ws.accept()
    _connections.add(ws)
    logger.info(f"[WS] Client connected. Active clients: {len(_connections)}")

    try:
        # 1. Send immediate confirmation
        await ws.send_json({
            "type": "connected",
            "message": "Live WebSocket connected to Re-Collect",
            "service": "Project Re-Collect",
        })

        # 2. Push current real stats from database
        try:
            stats = await db.get_stats()
            await ws.send_json({"type": "counter_update", "stats": stats})
        except Exception as e:
            logger.warning(f"[WS] Could not push initial stats: {e}")

        # 3. Stream recent real database transactions as live audit rows
        try:
            txns = await db.get_all_transactions()
            for t in reversed(txns[:50]):
                agent = (
                    "SalaryDaySequencer" if t.get("category") == "A" else
                    "B2BDebtChaser" if t.get("category") == "B" else
                    "CartRescuer" if t.get("category") == "C" else
                    "SentinelAgent" if t.get("category") == "SENTINEL" else
                    ("PolicyGate" if t.get("state") == "ABORTED" else "orchestrator")
                )
                fail_reason = (t.get("failure_type") or "Payment").replace("_", " ")
                abort_text = f" [Blocked: {t.get('abort_reason')}]" if t.get("abort_reason") else ""
                amount = float(t.get("amount") or 0.0)
                await ws.send_json({
                    "type": "audit_row",
                    "transaction_id": t.get("id"),
                    "merchant_id": t.get("merchant_id"),
                    "customer_name": t.get("customer_name") or "Customer",
                    "amount": amount,
                    "state": t.get("state"),
                    "agent": agent,
                    "outcome": (t.get("state") or "").lower(),
                    "message": f"{fail_reason} · ₹{int(amount):,}{abort_text}",
                    "timestamp": t.get("updated_at") or t.get("created_at"),
                })
        except Exception as e:
            logger.warning(f"[WS] Could not stream initial transactions: {e}")

        # Keep alive — listen for pings / client messages
        while True:
            try:
                data = await asyncio.wait_for(ws.receive_text(), timeout=35.0)
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
    except Exception as e:
        logger.debug(f"[WS] Connection closed: {e}")
    finally:
        _connections.discard(ws)
        logger.info(f"[WS] Client disconnected. Active clients: {len(_connections)}")


# Module-level broadcaster for use by orchestrator or external callers
async def broadcast(event: dict) -> None:
    await _broadcast_to_all(event)
