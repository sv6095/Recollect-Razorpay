from models.transaction import Transaction, FailureType, TransactionCategory
from state import redis_store
import hashlib


# Weight tables (deterministic, no LLM needed)
_FAILURE_BASE_PROB = {
    FailureType.INSUFFICIENT_FUNDS: 0.55,
    FailureType.CARD_DECLINED: 0.45,
    FailureType.PAYMENT_TIMEOUT: 0.60,
    FailureType.BANK_ERROR: 0.65,
    FailureType.CART_ABANDONED: 0.35,
    FailureType.INVOICE_OVERDUE: 0.40,
    FailureType.RENEWAL_AT_RISK: 0.70,
    FailureType.DISPUTE: 0.20,
    FailureType.UNKNOWN: 0.30,
}

_CATEGORY_MULTIPLIER = {
    TransactionCategory.A: 1.1,       # Subscriptions recover well post-salary
    TransactionCategory.B: 0.85,      # B2B is slower
    TransactionCategory.C: 0.90,      # Cart abandonment mid-range
    TransactionCategory.SENTINEL: 1.3, # Pre-failure intervention has highest success
}


def _transaction_fingerprint(txn: Transaction) -> str:
    raw = f"{txn.merchant_id}:{txn.customer_id}:{txn.amount}:{txn.failure_type}:{txn.days_overdue}"
    return hashlib.md5(raw.encode()).hexdigest()


def compute_recovery_prob(txn: Transaction) -> float:
    """
    Rule-based recovery probability score (0.0–1.0).
    Cached by transaction fingerprint in Redis.

    Features:
    - Failure type base probability
    - Category multiplier
    - Days overdue penalty
    - Salary-cycle bonus (1st–5th of month)
    - Prior contact count decay
    - Amount tier adjustment
    """
    base = _FAILURE_BASE_PROB.get(txn.failure_type, 0.30)

    # Category multiplier
    if txn.category:
        base *= _CATEGORY_MULTIPLIER.get(txn.category, 1.0)

    # Days overdue penalty
    if txn.days_overdue > 30:
        base *= 0.5
    elif txn.days_overdue > 14:
        base *= 0.7
    elif txn.days_overdue > 7:
        base *= 0.85

    # Prior contact count decay (diminishing returns)
    if txn.prior_contact_count >= 2:
        base *= 0.6
    elif txn.prior_contact_count == 1:
        base *= 0.8

    # Amount tier: small amounts recover better (less friction for customer)
    if txn.amount < 1000:
        base *= 1.1
    elif txn.amount > 50000:
        base *= 0.85

    # Preemptive (Sentinel) rows have highest base success
    if txn.is_preemptive:
        base = min(base * 1.4, 0.92)

    return round(min(max(base, 0.05), 0.95), 3)


async def score_transaction(txn: Transaction) -> float:
    """
    Score a transaction, using Redis cache to avoid re-scoring.
    Updates txn.recovery_prob in place.
    """
    fingerprint = _transaction_fingerprint(txn)

    # Check cache
    cached = await redis_store.get_cached_recovery_prob(fingerprint)
    if cached is not None:
        txn.recovery_prob = cached
        return cached

    prob = compute_recovery_prob(txn)
    txn.recovery_prob = prob

    # Cache for 1 hour
    await redis_store.cache_recovery_prob(fingerprint, prob, ttl=3600)
    return prob
