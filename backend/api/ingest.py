import csv
import io
import uuid
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from models.transaction import (
    Transaction, TransactionState, FailureType,
    TransactionCategory, Channel
)
from gate.policy_gate import run_policy_gate
from scoring.recovery_scorer import score_transaction
from db import database as db
from event_queue import event_bus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ingest", tags=["ingestion"])

MERCHANT_ID = "merchant_001"


def _parse_row(row: dict, is_live: bool = False) -> Transaction:
    """Parse a CSV row dict into a Transaction dataclass."""
    failure_map = {
        "INSUFFICIENT_FUNDS": FailureType.INSUFFICIENT_FUNDS,
        "CARD_DECLINED": FailureType.CARD_DECLINED,
        "PAYMENT_TIMEOUT": FailureType.PAYMENT_TIMEOUT,
        "BANK_ERROR": FailureType.BANK_ERROR,
        "CART_ABANDONED": FailureType.CART_ABANDONED,
        "INVOICE_OVERDUE": FailureType.INVOICE_OVERDUE,
        "RENEWAL_AT_RISK": FailureType.RENEWAL_AT_RISK,
        "DISPUTE": FailureType.DISPUTE,
    }

    failure_type = failure_map.get(
        row.get("failure_type", "UNKNOWN").strip().upper(),
        FailureType.UNKNOWN
    )

    # Parse extra metadata as JSON-like dict from CSV
    extra = {}
    for key in ["product_name", "cart_items", "hours_since_abandon", "risk_signals", "dispute_reason"]:
        if row.get(key):
            extra[key] = row[key].strip()

    return Transaction(
        transaction_id=row.get("transaction_id", str(uuid.uuid4())).strip(),
        merchant_id=MERCHANT_ID,
        customer_id=row.get("customer_id", str(uuid.uuid4())).strip(),
        customer_name=row.get("customer_name", "Unknown").strip(),
        customer_phone=row.get("customer_phone", "+919999999999").strip(),
        customer_email=row.get("customer_email", "customer@example.com").strip(),
        amount=float(row.get("amount", 0)),
        failure_type=failure_type,
        state=TransactionState.DETECTED,
        state_version=0,
        days_overdue=int(row.get("days_overdue", 0)),
        prior_contact_count=int(row.get("prior_contact_count", 0)),
        has_consent=row.get("has_consent", "true").strip().lower() == "true",
        is_preemptive=row.get("is_preemptive", "false").strip().lower() == "true",
        is_live_demo_row=is_live or row.get("is_live_demo_row", "false").strip().lower() == "true",
        extra=extra,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@router.post("/csv")
async def ingest_csv(file: UploadFile = File(...)):
    """Upload a CSV of failed transactions for batch processing."""
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    queued = 0
    skipped = 0
    errors = []

    for row in reader:
        try:
            txn = _parse_row(row)
            if txn.amount <= 0:
                skipped += 1
                continue
            await db.upsert_transaction(txn)
            await event_bus.enqueue(txn)
            queued += 1
        except Exception as e:
            errors.append(str(e))
            skipped += 1

    return {
        "status": "accepted",
        "queued": queued,
        "skipped": skipped,
        "errors": errors[:5],
    }


class WebhookPayload(BaseModel):
    transaction_id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_email: str
    amount: float
    failure_type: str
    merchant_id: str = MERCHANT_ID
    days_overdue: int = 0
    prior_contact_count: int = 0
    has_consent: bool = True
    extra: dict = {}


@router.post("/webhook")
async def ingest_webhook(payload: WebhookPayload):
    """Single-transaction webhook endpoint (Razorpay payment failure signal)."""
    failure_map = {
        "INSUFFICIENT_FUNDS": FailureType.INSUFFICIENT_FUNDS,
        "CARD_DECLINED": FailureType.CARD_DECLINED,
        "PAYMENT_TIMEOUT": FailureType.PAYMENT_TIMEOUT,
        "BANK_ERROR": FailureType.BANK_ERROR,
        "CART_ABANDONED": FailureType.CART_ABANDONED,
        "INVOICE_OVERDUE": FailureType.INVOICE_OVERDUE,
        "RENEWAL_AT_RISK": FailureType.RENEWAL_AT_RISK,
        "DISPUTE": FailureType.DISPUTE,
    }

    txn = Transaction(
        transaction_id=payload.transaction_id,
        merchant_id=payload.merchant_id,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        amount=payload.amount,
        failure_type=failure_map.get(payload.failure_type.upper(), FailureType.UNKNOWN),
        days_overdue=payload.days_overdue,
        prior_contact_count=payload.prior_contact_count,
        has_consent=payload.has_consent,
        extra=payload.extra,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    await db.upsert_transaction(txn)
    await event_bus.enqueue(txn)
    return {"status": "accepted", "transaction_id": txn.transaction_id}
