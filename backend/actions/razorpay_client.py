import logging
import razorpay
from models.transaction import Transaction
from models.agents import RecoveryProposal
from state.redis_store import check_idempotency
from config import get_settings
import hashlib

settings = get_settings()
logger = logging.getLogger(__name__)

# Module-level Razorpay client
_rzp_client: razorpay.Client | None = None


def get_razorpay_client() -> razorpay.Client:
    global _rzp_client
    if _rzp_client is None:
        if settings.razorpay_key_id and settings.razorpay_key_secret:
            _rzp_client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
        else:
            _rzp_client = None  # Will use simulation
    return _rzp_client


def _idem_key(txn_id: str, action: str, version: int) -> str:
    raw = f"{txn_id}:{action}:{version}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def create_payment_link(txn: Transaction, proposal: RecoveryProposal) -> dict | None:
    """
    Create a Razorpay Partial Payment Link.
    Idempotency-checked — second call with same txn+version returns no-op.
    """
    idem_key = _idem_key(txn.transaction_id, "create_link", txn.state_version)
    can_proceed = await check_idempotency(idem_key)

    if not can_proceed:
        logger.info(f"[Razorpay] Duplicate link creation skipped for {txn.transaction_id}")
        return None

    # Convert INR to paise (Razorpay uses paise)
    amount_paise = int(txn.amount * 100)
    ptp_paise = int(proposal.ptp_amount * 100) if proposal.ptp_amount > 0 else None

    link_data = {
        "amount": amount_paise,
        "currency": "INR",
        "accept_partial": True if ptp_paise and ptp_paise < amount_paise else False,
        "first_min_amount": ptp_paise if ptp_paise and ptp_paise < amount_paise else amount_paise,
        "expire_by": _expire_timestamp(),
        "reference_id": txn.transaction_id,
        "description": f"Re-Collect: {txn.merchant_id} — {txn.customer_name}",
        "customer": {
            "name": txn.customer_name,
            "email": txn.customer_email,
            "contact": txn.customer_phone,
        },
        "notify": {
            "sms": True,
            "email": True,
        },
        "reminder_enable": True,
    }

    client = get_razorpay_client()

    if client:
        try:
            response = client.payment_link.create(link_data)
            logger.info(f"[Razorpay] Created payment link {response.get('id')} for {txn.transaction_id}")
            return response
        except Exception as e:
            logger.error(f"[Razorpay] Failed to create link: {e}")
            return _simulated_link(txn)
    else:
        # Demo simulation
        return _simulated_link(txn)


def _expire_timestamp() -> int:
    """Unix timestamp 7 days from now."""
    import time
    return int(time.time()) + (7 * 24 * 60 * 60)


def _simulated_link(txn: Transaction) -> dict:
    """Realistic simulated Razorpay payment link for demo mode."""
    link_id = f"plink_sim_{txn.transaction_id[:12]}"
    return {
        "id": link_id,
        "short_url": f"https://rzp.io/i/{link_id}",
        "status": "created",
        "amount": int(txn.amount * 100),
        "currency": "INR",
        "accept_partial": True,
        "description": f"Re-Collect Recovery — {txn.customer_name}",
    }
