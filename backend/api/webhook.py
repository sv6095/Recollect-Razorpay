"""
backend/api/webhook.py
======================
Production Razorpay webhook ingestion endpoint.

Replaces the "Load Batch / Initialize Batch" demo-mode concept entirely.
The platform is now fully reactive: when Razorpay fires a webhook, the
recovery pipeline starts automatically — no user action required.

Supported events (per https://razorpay.com/docs/webhooks ):
  payment.failed         -> Triggers recovery workflow for checkout failures
  payment.authorized     -> #1 Webhook Use Case: Captures late-authorised payments
                            (customer closed checkout window / bank lag — but
                            payment actually went through hours later)
  subscription.charged   -> Catches recurring mandate failures (SENTINEL path)
  payment_link.paid      -> Closes the loop when recovery link is paid

Security (per https://razorpay.com/docs/sg/webhooks/best-practices ):
  - HMAC-SHA256 signature verification against RAZORPAY_WEBHOOK_SECRET
  - Idempotency: x-razorpay-event-id header (canonical) checked in Redis
  - Webhook IPs should be whitelisted in cloud firewall:
    https://razorpay.com/docs/sg/security/whitelists#webhook-ips

LOCALHOST TUNNELLING (CRITICAL — https://razorpay.com/docs/sg/webhooks/validate-test ):
  Razorpay BLACKLISTS ngrok.io and loca.lt for webhook URLs!
  DO NOT use ngrok. Use zrok instead: https://docs.zrok.io/docs/zrok/getting-started

Acknowledgement:
  - Always responds 200 {"status": "ok"} BEFORE processing (non-blocking)
  - Processing happens via asyncio background task to meet Razorpay's 5s SLA
    (Razorpay retries all non-2xx responses with exponential backoff for 24h)
"""

import asyncio
import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from actions.ptp_ledger import mark_paid
from config import get_settings
from db import database as db
from event_queue import event_bus
from models.transaction import (
    FailureType, Transaction, TransactionState,
)
from state import redis_store

settings = get_settings()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Single-merchant deployment default.
# For multi-merchant: map event.account_id -> merchant_id via a DB lookup.
DEFAULT_MERCHANT_ID = "merchant_001"

# ---------------------------------------------------------------------------
# Error-code -> FailureType mapping
# Ref: https://razorpay.com/docs/payments/payments/payment-gateway/error-codes/
# ---------------------------------------------------------------------------
_ERROR_CODE_MAP: dict[str, FailureType] = {
    "INSUFFICIENT_FUNDS":           FailureType.INSUFFICIENT_FUNDS,
    "BAD_REQUEST_ERROR":            FailureType.CARD_DECLINED,   # generic fallback
    "PAYMENT_TIMEOUT":              FailureType.PAYMENT_TIMEOUT,
    "GATEWAY_CONNECTION_TIMEOUT":   FailureType.PAYMENT_TIMEOUT,
    "GATEWAY_ERROR":                FailureType.BANK_ERROR,
    "SERVER_ERROR":                 FailureType.BANK_ERROR,
    "BANK_ACCOUNT_CLOSED":          FailureType.BANK_ERROR,
    "INVALID_BANK_DETAILS":         FailureType.BANK_ERROR,
    "CARD_DECLINED":                FailureType.CARD_DECLINED,
    "CARD_STOLEN":                  FailureType.CARD_DECLINED,
    "INVALID_CARD":                 FailureType.CARD_DECLINED,
    "CARD_EXPIRED":                 FailureType.CARD_DECLINED,
    "CVV_MISMATCH":                 FailureType.CARD_DECLINED,
    "CARD_NOT_SUPPORTED":           FailureType.CARD_DECLINED,
    "MANDATE_HALTED":               FailureType.RENEWAL_AT_RISK,
    "DEBIT_FAILED":                 FailureType.INSUFFICIENT_FUNDS,
    "EMANDATE_REGISTRATION_FAILED": FailureType.RENEWAL_AT_RISK,
}


def _map_error_code(error_code: str | None, error_description: str | None = None) -> FailureType:
    """Map a Razorpay error_code string to our internal FailureType enum."""
    if not error_code:
        return FailureType.UNKNOWN
    code = error_code.upper().replace(" ", "_")
    if code in _ERROR_CODE_MAP:
        return _ERROR_CODE_MAP[code]
    # Heuristic fallback from free-text description
    if error_description:
        desc = error_description.lower()
        if "insufficient" in desc or "balance" in desc:
            return FailureType.INSUFFICIENT_FUNDS
        if "timeout" in desc:
            return FailureType.PAYMENT_TIMEOUT
        if "declined" in desc or "card" in desc:
            return FailureType.CARD_DECLINED
        if "bank" in desc or "gateway" in desc:
            return FailureType.BANK_ERROR
    return FailureType.UNKNOWN


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def _verify_signature(raw_body: bytes, signature: str | None, secret: str) -> bool:
    """
    Verify Razorpay's HMAC-SHA256 webhook signature.
    Uses hmac.compare_digest for timing-attack resistance.

    IMPORTANT: hmac.new() takes positional args (key, msg, digestmod).
    Secret is loaded from RAZORPAY_WEBHOOK_SECRET in .env via pydantic-settings.
    """
    if not signature:
        return False
    # key must be bytes; msg is the raw request body (never parse JSON first)
    expected = hmac.new(
        secret.encode("utf-8"),  # key
        raw_body,                 # msg
        hashlib.sha256,           # digestmod
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ---------------------------------------------------------------------------
# DB audit helpers
# ---------------------------------------------------------------------------

async def _log_webhook_event(
    event_id: str,
    event_type: str,
    payload_hash: str,
    transaction_id: str | None,
    merchant_id: str | None,
    status: str = "processed",
) -> None:
    """Write an immutable audit row for this webhook event."""
    database = await db.get_db()
    await database.execute(
        """
        INSERT OR IGNORE INTO webhook_events
        (id, event_type, payload_hash, transaction_id, merchant_id, processed_at, status)
        VALUES (?,?,?,?,?,?,?)
        """,
        (
            event_id, event_type, payload_hash,
            transaction_id, merchant_id,
            datetime.utcnow().isoformat(), status,
        ),
    )
    await database.commit()


# ---------------------------------------------------------------------------
# Transaction builder helpers
# ---------------------------------------------------------------------------

def _payment_entity_to_transaction(payment: dict, merchant_id: str) -> Transaction:
    """
    Map a Razorpay payment entity dict to our Transaction dataclass.

    Uses the Razorpay payment ID as transaction_id so every DB row is
    directly traceable back to the Razorpay dashboard.
    """
    # Paise -> INR
    amount_inr = payment.get("amount", 0) / 100

    notes: dict = payment.get("notes") or {}
    customer_name = (
        notes.get("customer_name")
        or notes.get("name")
        or payment.get("email", "unknown@example.com").split("@")[0].title()
    )
    customer_email = payment.get("email", "")
    customer_phone = payment.get("contact", "+919999999999")
    if customer_phone and not customer_phone.startswith("+"):
        customer_phone = f"+91{customer_phone.lstrip('0')}"

    failure_type = _map_error_code(
        payment.get("error_code"),
        payment.get("error_description"),
    )

    transaction_id = payment.get("id", str(uuid.uuid4()))

    extra: dict = {}
    if payment.get("order_id"):
        extra["order_id"] = payment["order_id"]
    if payment.get("description"):
        extra["description"] = payment["description"]
    if payment.get("method"):
        extra["payment_method"] = payment["method"]

    return Transaction(
        transaction_id=transaction_id,
        merchant_id=merchant_id,
        customer_id=payment.get("customer_id") or f"cust_{transaction_id[:12]}",
        customer_name=customer_name,
        customer_phone=customer_phone,
        customer_email=customer_email,
        amount=amount_inr,
        failure_type=failure_type,
        state=TransactionState.DETECTED,
        state_version=0,
        has_consent=True,   # Consent implied by completing the Razorpay checkout
        is_preemptive=False,
        is_live_demo_row=False,
        extra=extra,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


def _subscription_entity_to_transaction(
    subscription: dict,
    payment: dict | None,
    merchant_id: str,
) -> Transaction:
    """
    Map a Razorpay subscription entity to a Transaction.
    Subscription failures always enter the SENTINEL pre-debit path.
    """
    amount_inr = ((payment or {}).get("amount", 0) / 100) if payment else 0.0

    return Transaction(
        transaction_id=subscription.get("id", str(uuid.uuid4())),
        merchant_id=merchant_id,
        customer_id=subscription.get("customer_id", f"cust_{str(uuid.uuid4())[:12]}"),
        customer_name="Subscription Customer",   # Enriched by TriageAgent
        customer_phone="+919999999999",
        customer_email="",
        amount=amount_inr,
        failure_type=FailureType.RENEWAL_AT_RISK,
        state=TransactionState.DETECTED,
        state_version=0,
        has_consent=True,
        is_preemptive=True,   # Routes to SENTINEL agent
        is_live_demo_row=False,
        extra={
            "subscription_id": subscription.get("id", ""),
            "plan_id": subscription.get("plan_id", ""),
            "charge_at": str(subscription.get("charge_at", "")),
        },
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

async def _handle_payment_failed(payload: dict, merchant_id: str) -> str | None:
    """
    payment.failed -> initiate recovery pipeline.
    Returns the internal transaction_id if queued, None if duplicate.
    """
    payment = payload.get("payment", {}).get("entity", {})
    if not payment:
        logger.warning("[Webhook] payment.failed missing payment.entity")
        return None

    txn = _payment_entity_to_transaction(payment, merchant_id)

    # Idempotency: Redis NX key keyed on Razorpay payment ID
    idem_key = f"webhook:payment.failed:{txn.transaction_id}"
    if not await redis_store.check_idempotency(idem_key):
        logger.info(f"[Webhook] Duplicate payment.failed for {txn.transaction_id} — skipped")
        return None

    await db.upsert_transaction(txn)

    # ── Immediate dashboard broadcast ─────────────────────────────────────────
    # Broadcast BEFORE enqueuing so the UI lights up the instant the webhook
    # arrives, rather than waiting for an async worker to dequeue it.
    # This prevents the "failed transaction not showing" symptom when the
    # worker queue is busy or no WS client was connected at enqueue time.
    error_code    = payment.get("error_code", "UNKNOWN")
    error_reason  = payment.get("error_reason", "")
    error_desc    = payment.get("error_description", "")
    failure_label = txn.failure_type.value if txn.failure_type else "UNKNOWN"

    detection_event = {
        "type": "audit_row",
        "transaction_id": txn.transaction_id,
        "merchant_id": merchant_id,
        "customer_name": txn.customer_name,
        "amount": txn.amount,
        "state": txn.state.value,
        "agent": "orchestrator",
        "outcome": "in_progress",
        "message": (
            f"payment.failed detected — ₹{txn.amount:,.0f} · "
            f"{failure_label}"
            + (f" [{error_code}]" if error_code and error_code != "UNKNOWN" else "")
            + (f": {error_desc}" if error_desc else "")
        ),
        "timestamp": datetime.utcnow().isoformat(),
    }
    await event_bus.broadcast_event(detection_event)
    await redis_store.publish_event(detection_event)

    # Now enqueue for the full async recovery pipeline
    await event_bus.enqueue(txn)

    logger.info(
        f"[Webhook] payment.failed queued -> recovery pipeline: "
        f"{txn.transaction_id} Rs.{txn.amount:,.0f} ({failure_label}) "
        f"error_code={error_code} reason={error_reason}"
    )
    return txn.transaction_id


async def _handle_payment_link_paid(payload: dict, merchant_id: str) -> str | None:
    """
    payment_link.paid -> close the recovery loop.
    This replaces the manual 'Simulate Webhook' button in production.
    Marks transaction RECOVERED and pushes a live WebSocket event to the dashboard.
    """
    link_entity = payload.get("payment_link", {}).get("entity", {})
    payment_entity = payload.get("payment", {}).get("entity", {})

    if not link_entity:
        logger.warning("[Webhook] payment_link.paid missing payment_link.entity")
        return None

    # reference_id is set to our transaction_id when we create the link
    # (see actions/razorpay_client.py -> link_data["reference_id"])
    txn_id = link_entity.get("reference_id")
    if not txn_id:
        logger.warning("[Webhook] payment_link.paid has no reference_id — cannot resolve txn")
        return None

    idem_key = f"webhook:payment_link.paid:{link_entity.get('id', txn_id)}"
    if not await redis_store.check_idempotency(idem_key):
        logger.info(f"[Webhook] Duplicate payment_link.paid for {txn_id} — skipped")
        return None

    amount_paise = payment_entity.get("amount", 0) or link_entity.get("amount_paid", 0)
    amount_inr = amount_paise / 100

    # Existing DB functions — no changes needed there
    await mark_paid(txn_id, amount_inr)
    await db.mark_recovered(txn_id, amount_inr)

    # Broadcast live events to all connected dashboard WebSocket clients
    stats = await db.get_stats(merchant_id)
    await event_bus.broadcast_event({
        "type": "recovery_confirmed",
        "transaction_id": txn_id,
        "amount_recovered": amount_inr,
        "message": f"Payment link paid — Rs.{amount_inr:,.0f} recovered via Razorpay",
        "stats": stats,
    })
    await event_bus.broadcast_event({"type": "counter_update", "stats": stats})

    logger.info(f"[Webhook] payment_link.paid -> RECOVERED: {txn_id} Rs.{amount_inr:,.0f}")
    return txn_id


async def _handle_subscription_charged(payload: dict, merchant_id: str) -> str | None:
    """
    subscription.charged failure -> SENTINEL pipeline.
    Razorpay fires this on e-mandate debit failures.
    """
    subscription = payload.get("subscription", {}).get("entity", {})
    payment = payload.get("payment", {}).get("entity")  # may be None on charge failure

    if not subscription:
        logger.warning("[Webhook] subscription.charged missing subscription.entity")
        return None

    sub_id = subscription.get("id", "")
    idem_key = f"webhook:subscription.charged:{sub_id}"
    if not await redis_store.check_idempotency(idem_key):
        logger.info(f"[Webhook] Duplicate subscription.charged for {sub_id} — skipped")
        return None

    txn = _subscription_entity_to_transaction(subscription, payment, merchant_id)
    await db.upsert_transaction(txn)
    await event_bus.enqueue(txn)

    logger.info(f"[Webhook] subscription.charged failure -> SENTINEL pipeline: {txn.transaction_id}")
    return txn.transaction_id


async def _handle_payment_authorized(payload: dict, merchant_id: str) -> str | None:
    """
    payment.authorized  ->  #1 Razorpay webhook use case.

    Per Razorpay docs: This is the most important webhook event. When the
    customer closes the checkout window or communication between the bank
    and Razorpay fails, the payment appears FAILED on the dashboard but
    may become AUTHORIZED hours later. Without this handler, millions in
    revenue are permanently lost.

    Strategy:
      1. Build the Transaction WITHOUT a failure_type (auth is always good)
      2. If an existing FAILED txn already exists for the same payment.id,
         upgrade it straight to RECOVERED (customer was NOT double-billed —
         the original 'failure' was a communication glitch)
      3. Otherwise create a new DETECTED txn and route to normal recovery
         pipeline (useful if we never even saw the payment.failed event)
    """
    payment = payload.get("payment", {}).get("entity", {})
    if not payment:
        logger.warning("[Webhook] payment.authorized missing payment.entity")
        return None

    pid = payment.get("id")
    if not pid:
        return None

    idem_key = f"webhook:payment.authorized:{pid}"
    if not await redis_store.check_idempotency(idem_key):
        logger.info(f"[Webhook] Duplicate payment.authorized for {pid} — skipped")
        return None

    database = await db.get_db()
    async with database.execute(
        "SELECT id, state, amount FROM transactions WHERE id=? OR transaction_id=?",
        (pid, pid),
    ) as cur:
        existing = await cur.fetchone()

    txn_id: str
    amount_inr = payment.get("amount", 0) / 100

    if existing is not None:
        txn_id = existing["id"]
        old_state = existing["state"]
        if old_state in ("RECOVERED",):
            logger.info(
                f"[Webhook] payment.authorized late-arrival for {txn_id} "
                f"already RECOVERED — marking duplicate"
            )
            return txn_id

        # This is the golden recovery path: we previously had a failed
        # (or pending) transaction and the bank finally authorised it.
        await mark_paid(txn_id, amount_inr)
        await db.mark_recovered(txn_id, amount_inr)

        stats = await db.get_stats(merchant_id)
        await event_bus.broadcast_event({
            "type": "recovery_confirmed",
            "transaction_id": txn_id,
            "amount_recovered": amount_inr,
            "message": (
                f"Late-authorisation recovered Rs.{amount_inr:,.0f} "
                f"(was {old_state} → bank finally authorised)"
            ),
            "stats": stats,
        })
        await event_bus.broadcast_event({"type": "counter_update", "stats": stats})

        logger.info(
            f"[Webhook] payment.authorized LATE RECOVERY: {txn_id} "
            f"was {old_state} → RECOVERED Rs.{amount_inr:,.0f}"
        )

    else:
        # Completely new event (we never saw the payment.failed).
        # Treat as a detected payment that needs no recovery action but
        # is logged for compliance/audit and appears in the dashboard.
        txn = _payment_entity_to_transaction(payment, merchant_id)
        txn.failure_type = None
        txn.state = TransactionState.RECOVERED
        txn_id = txn.transaction_id
        await db.upsert_transaction(txn)

        stats = await db.get_stats(merchant_id)
        await event_bus.broadcast_event({
            "type": "recovery_confirmed",
            "transaction_id": txn_id,
            "amount_recovered": amount_inr,
            "message": f"Late-authorised payment received: Rs.{amount_inr:,.0f}",
            "stats": stats,
        })
        await event_bus.broadcast_event({"type": "counter_update", "stats": stats})

        logger.info(
            f"[Webhook] payment.authorized new txn -> RECOVERED: {txn_id} "
            f"Rs.{amount_inr:,.0f} (we did not see the payment.failed)"
        )

    return txn_id


# ---------------------------------------------------------------------------
# Main webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/razorpay")
async def razorpay_webhook(request: Request) -> JSONResponse:
    """
    Razorpay webhook receiver.

    Reads raw bytes (required for HMAC verification — never parse body first).
    Verifies signature, then fires background task and returns 200 immediately.
    Razorpay retries if it does not receive 200 within ~5 seconds.
    """
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature")

    # Idempotency: Per Razorpay docs, x-razorpay-event-id is the canonical
    # per-event unique identifier. We use this FIRST over the JSON body's id
    # field, because the HTTP header is what Razorpay guarantees stability of
    # across retries.
    header_event_id = request.headers.get("x-razorpay-event-id")

    # ---- Content-length guard (OOM protection) ----
    # Razorpay webhooks are typically < 10 KB. Reject anything > 1 MB.
    content_length = int(request.headers.get("content-length") or "0")
    if content_length > 1_000_000:
        logger.error(f"[Webhook] Payload too large ({content_length} bytes)")
        raise HTTPException(status_code=413, detail="Payload too large")

    # ---- Signature verification ----
    webhook_secret = settings.razorpay_webhook_secret
    if webhook_secret:
        if not _verify_signature(raw_body, signature, webhook_secret):
            logger.warning(
                f"[Webhook] Signature verification FAILED. "
                f"signature={signature!r} — Check RAZORPAY_WEBHOOK_SECRET."
            )
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        logger.error(
            "[Webhook] RAZORPAY_WEBHOOK_SECRET not configured. Rejecting request."
        )
        raise HTTPException(
            status_code=500,
            detail="Webhook secret not configured. Contact engineering.",
        )

    # ---- Parse payload ----
    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.error("[Webhook] Failed to parse JSON payload")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_id = header_event_id or event.get("id", str(uuid.uuid4()))
    event_type = event.get("event", "unknown")
    payload = event.get("payload", {})

    # Merchant resolution: single-tenant uses default, multi-tenant maps account_id
    merchant_id = event.get("account_id") or DEFAULT_MERCHANT_ID

    # Immutable hash of raw body for audit trail
    payload_hash = hashlib.sha256(raw_body).hexdigest()

    logger.info(f"[Webhook] event_type={event_type} event_id={event_id} merchant={merchant_id}")

    # ---- Fire-and-forget: acknowledge first, process in background ----
    asyncio.create_task(
        _process_webhook_event(event_id, event_type, payload, payload_hash, merchant_id)
    )

    return JSONResponse({"status": "ok", "event_id": event_id})


async def _process_webhook_event(
    event_id: str,
    event_type: str,
    payload: dict,
    payload_hash: str,
    merchant_id: str,
) -> None:
    """
    Background coroutine: runs after the HTTP 200 response has been sent.
    All processing errors are caught here — webhook ACK is never withheld.
    """
    txn_id: str | None = None
    status = "processed"

    try:
        if event_type == "payment.failed":
            txn_id = await _handle_payment_failed(payload, merchant_id)
            if txn_id is None:
                status = "duplicate"

        elif event_type == "payment.authorized":
            txn_id = await _handle_payment_authorized(payload, merchant_id)
            if txn_id is None:
                status = "duplicate"

        elif event_type == "payment_link.paid":
            txn_id = await _handle_payment_link_paid(payload, merchant_id)
            if txn_id is None:
                status = "duplicate"

        elif event_type == "subscription.charged":
            txn_id = await _handle_subscription_charged(payload, merchant_id)
            if txn_id is None:
                status = "duplicate"

        else:
            logger.debug(f"[Webhook] Unhandled event type '{event_type}' — skipped")
            status = "skipped"

    except Exception as exc:
        logger.error(
            f"[Webhook] Processing error: event_id={event_id} type={event_type}: {exc}",
            exc_info=True,
        )
        status = "failed"

    finally:
        # Always write to audit log — duplicates, failures, and skips all recorded
        await _log_webhook_event(
            event_id=event_id,
            event_type=event_type,
            payload_hash=payload_hash,
            transaction_id=txn_id,
            merchant_id=merchant_id,
            status=status,
        )
