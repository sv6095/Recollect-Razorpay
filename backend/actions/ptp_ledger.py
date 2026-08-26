import logging
from models.transaction import Transaction
from db import database as db

logger = logging.getLogger(__name__)


async def record_ptp(txn: Transaction, amount: float, due_date: str,
                      link_id: str = "", link_url: str = "") -> str:
    """Log a Promise-to-Pay entry in the durable store."""
    ptp_id = await db.log_ptp(
        txn_id=txn.transaction_id,
        merchant_id=txn.merchant_id,
        customer_id=txn.customer_id,
        amount=amount,
        due_date=due_date,
        link_id=link_id,
        link_url=link_url,
    )
    logger.info(f"[PTP] Logged ₹{amount:,.0f} due {due_date} for {txn.transaction_id}")
    return ptp_id


async def mark_paid(txn_id: str, amount_recovered: float) -> None:
    """Mark a PTP as paid (called by Razorpay webhook or demo button)."""
    await db.mark_recovered(txn_id, amount_recovered)
    logger.info(f"[PTP] ₹{amount_recovered:,.0f} recovered for {txn_id}")
