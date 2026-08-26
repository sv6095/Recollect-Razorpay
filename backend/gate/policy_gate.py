import hashlib
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from models.transaction import Transaction, AbortReason
from models.agents import GateResult
from state import redis_store
from config import get_settings

settings = get_settings()
IST = ZoneInfo("Asia/Kolkata")


def _transaction_fingerprint(txn: Transaction) -> str:
    """Stable hash for caching recovery prob by transaction characteristics."""
    raw = f"{txn.merchant_id}:{txn.customer_id}:{txn.amount}:{txn.failure_type}:{txn.days_overdue}"
    return hashlib.md5(raw.encode()).hexdigest()


def _is_within_calling_hours() -> bool:
    """Check if current IST time is within allowed contact window (8AM-7PM)."""
    now_ist = datetime.now(IST)
    return settings.calling_hour_start <= now_ist.hour < settings.calling_hour_end


def _unit_economics_pass(amount: float, recovery_prob: float) -> bool:
    """Expected value must exceed cost of outreach."""
    expected_recovery = amount * recovery_prob
    return expected_recovery > settings.outreach_cost_inr


async def run_policy_gate(txn: Transaction) -> GateResult:
    """
    Run all deterministic checks before any LLM call.
    Returns GateResult(passed=True) only if all checks pass.
    Every check result (pass or fail) is logged by the caller.
    """

    # 1. DND check
    if await redis_store.is_dnd(txn.customer_id):
        return GateResult(
            passed=False,
            abort_reason=AbortReason.DND,
            details=f"Customer {txn.customer_id} is on the DND list"
        )

    # 2. Velocity / rate limit
    allowed = await redis_store.check_and_increment_velocity(
        txn.customer_id, max_per_24h=settings.max_contacts_per_24h
    )
    if not allowed:
        return GateResult(
            passed=False,
            abort_reason=AbortReason.RATE_LIMIT,
            details=f"Max {settings.max_contacts_per_24h} contacts per 24h exceeded"
        )

    # 3. Calling-hour window
    if not _is_within_calling_hours():
        return GateResult(
            passed=False,
            abort_reason=AbortReason.CALLING_HOURS,
            details=f"Outside allowed contact window (8AM–7PM IST). Current time is {datetime.now(IST).strftime('%H:%M IST')}"
        )

    # 4. Consent check (for WhatsApp / promotional channels)
    if not txn.has_consent:
        return GateResult(
            passed=False,
            abort_reason=AbortReason.NO_CONSENT,
            details="No valid opt-in consent on record for this customer"
        )

    # 5. Unit economics check (uses cached recovery_prob if already scored)
    if txn.recovery_prob > 0 and not _unit_economics_pass(txn.amount, txn.recovery_prob):
        return GateResult(
            passed=False,
            abort_reason=AbortReason.UNIT_ECONOMICS,
            details=(
                f"Expected recovery ₹{txn.amount * txn.recovery_prob:.2f} < "
                f"outreach cost ₹{settings.outreach_cost_inr:.2f}. "
                "Auto-written off — not worth pursuing."
            )
        )

    return GateResult(passed=True, details="All deterministic checks passed")
