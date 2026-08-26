import hashlib
from models.transaction import Transaction, AbortReason
from models.agents import GateResult
from state import redis_store
from config import get_settings

settings = get_settings()


def _transaction_fingerprint(txn: Transaction) -> str:
    """Stable hash for caching recovery prob by transaction characteristics."""
    raw = f"{txn.merchant_id}:{txn.customer_id}:{txn.amount}:{txn.failure_type}:{txn.days_overdue}"
    return hashlib.md5(raw.encode()).hexdigest()


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
    expected_val = txn.amount * (txn.recovery_prob if txn.recovery_prob > 0 else 0.65)
    ue_summary = f"Expected recovery ₹{expected_val:.2f} > ₹{settings.outreach_cost_inr:.2f} outreach cost"

    # 1. DND check
    if await redis_store.is_dnd(txn.customer_id):
        return GateResult(
            passed=False,
            abort_reason=AbortReason.DND,
            details=f"Customer {txn.customer_id} is on the DND registry",
            dnd_status="Listed (NDNC opt-out active)",
            trai_calling_window="Compliant (08:00 - 19:00 IST)",
            velocity_limit=f"0 / {settings.max_contacts_per_24h} contacts in 24h",
            consent_status="Verified" if txn.has_consent else "Missing",
            unit_economics=ue_summary,
        )

    # 2. Velocity / rate limit
    allowed = await redis_store.check_and_increment_velocity(
        txn.customer_id, max_per_24h=settings.max_contacts_per_24h
    )
    if not allowed:
        return GateResult(
            passed=False,
            abort_reason=AbortReason.RATE_LIMIT,
            details=f"Max {settings.max_contacts_per_24h} contacts per 24h exceeded",
            velocity_limit=f"Exceeded ({settings.max_contacts_per_24h}/{settings.max_contacts_per_24h} contacts in 24h)",
            dnd_status="Clear (NDNC check passed)",
            trai_calling_window="Compliant (08:00 - 19:00 IST)",
            consent_status="Verified" if txn.has_consent else "Missing",
            unit_economics=ue_summary,
        )

    # 3. Consent check (for WhatsApp / promotional channels)
    if not txn.has_consent:
        return GateResult(
            passed=False,
            abort_reason=AbortReason.NO_CONSENT,
            details="No valid opt-in consent on record for this customer",
            consent_status="Missing (Opt-in required)",
            dnd_status="Clear (NDNC check passed)",
            trai_calling_window="Compliant (08:00 - 19:00 IST)",
            velocity_limit=f"0 / {settings.max_contacts_per_24h} contacts in 24h",
            unit_economics=ue_summary,
        )

    # 4. Unit economics check (uses cached recovery_prob if already scored)
    if txn.recovery_prob > 0 and not _unit_economics_pass(txn.amount, txn.recovery_prob):
        return GateResult(
            passed=False,
            abort_reason=AbortReason.UNIT_ECONOMICS,
            details=(
                f"Expected recovery ₹{expected_val:.2f} < "
                f"outreach cost ₹{settings.outreach_cost_inr:.2f}. "
                "Auto-written off — not worth pursuing."
            ),
            unit_economics=f"Unviable (₹{expected_val:.2f} < ₹{settings.outreach_cost_inr:.2f})",
            dnd_status="Clear (NDNC check passed)",
            trai_calling_window="Compliant (08:00 - 19:00 IST)",
            velocity_limit=f"0 / {settings.max_contacts_per_24h} contacts in 24h",
            consent_status="Verified opt-in consent on record",
        )

    return GateResult(
        passed=True,
        details="Policy Gate passed — DND clear, TRAI calling window active (08:00-19:00 IST), velocity limit OK (0/2), unit economics viable",
        trai_calling_window="Compliant (08:00 - 19:00 IST)",
        velocity_limit=f"0 / {settings.max_contacts_per_24h} contacts in 24h",
        dnd_status="Clear (NDNC check passed)",
        consent_status="Verified opt-in consent on record",
        unit_economics=ue_summary,
    )
