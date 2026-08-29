from agents.base import BaseAgent
from models.transaction import Transaction, TransactionCategory, Channel
from models.agents import TriageResult
from config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are the Triage Agent for Project Re-Collect, an AI revenue recovery system for Razorpay merchants.

Your job is to analyze a failed payment or at-risk transaction and classify it into exactly one of these categories:
- A: B2C subscription payment failure (insufficient funds, card declined, bank error)
- B: B2B invoice overdue (business-to-business, 15+ days overdue)
- C: E-commerce cart abandonment (high-value cart, opted-in customer)
- SENTINEL: Pre-failure alert (upcoming renewal in 48h with risk signals)

You MUST return valid JSON only, with this exact structure:
{
  "category": "A" | "B" | "C" | "SENTINEL",
  "confidence": 0.0-1.0,
  "failure_reason": "one-line human-readable reason",
  "recovery_prob": 0.0-1.0,
  "recommended_channel": "WHATSAPP" | "EMAIL" | "RETRY" | "VOICE" | "NONE",
  "reasoning": "2-3 sentence explanation of your classification"
}

Guidelines:
- Subscriptions (SaaS, streaming, utilities) with card failures → Category A
- Invoice payments from businesses → Category B  
- Shopping cart abandonments or e-commerce payment drops → Category C
- Upcoming renewals with spend-pattern risk → SENTINEL
- Recovery prob for SENTINEL should be 0.7-0.9 (preemptive intervention is most effective)
- B2B disputes get lower recovery_prob (0.2-0.4)
- Salary-cycle timing (1st-5th of month) increases recovery_prob for Cat A by 0.15
"""


class TriageAgent(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.triage_model, agent_name="TriageAgent")

    async def triage(self, txn: Transaction) -> TriageResult:
        user_message = f"""Transaction to classify:

Transaction ID: {txn.transaction_id}
Customer: {txn.customer_name} ({txn.customer_email})
Amount: ₹{txn.amount:,.2f}
Failure Type: {txn.failure_type.value if hasattr(txn.failure_type, 'value') else txn.failure_type}
Days Overdue: {txn.days_overdue}
Prior Contact Count: {txn.prior_contact_count}
Is Preemptive (Sentinel): {txn.is_preemptive}
Extra Context: {txn.extra}

Classify this transaction and provide your recovery recommendation."""

        result = await self.chat_json(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=2048,
            temperature=0.1,
        )

        # Map string category to enum
        cat_map = {
            "A": TransactionCategory.A,
            "B": TransactionCategory.B,
            "C": TransactionCategory.C,
            "SENTINEL": TransactionCategory.SENTINEL,
        }
        channel_map = {
            "WHATSAPP": Channel.WHATSAPP,
            "EMAIL": Channel.EMAIL,
            "RETRY": Channel.RETRY,
            "VOICE": Channel.VOICE,
            "NONE": Channel.NONE,
        }

        # Determine category with robust fallback
        raw_cat = result.get("category")
        if raw_cat and raw_cat in cat_map:
            category = cat_map[raw_cat]
        elif txn.is_preemptive or txn.failure_type == "RENEWAL_AT_RISK":
            category = TransactionCategory.SENTINEL
        elif txn.days_overdue > 14 or txn.amount > 30000 or txn.failure_type in ("INVOICE_OVERDUE", "DISPUTE"):
            category = TransactionCategory.B
        elif txn.extra.get("product_name") or txn.extra.get("cart_items") or txn.failure_type == "CART_ABANDONED":
            category = TransactionCategory.C
        else:
            category = TransactionCategory.A

        channel = channel_map.get(result.get("recommended_channel", "NONE"), Channel.NONE)
        if channel == Channel.NONE:
            channel = Channel.EMAIL if category == TransactionCategory.B else Channel.WHATSAPP

        failure_reason = result.get("failure_reason") or f"{txn.failure_type.value if hasattr(txn.failure_type, 'value') else txn.failure_type} detected on transaction"
        reasoning = result.get("reasoning") or f"Classified as Category {category.value} based on transaction profile, amount ₹{txn.amount:,.0f}, and failure telemetry."

        return TriageResult(
            transaction_id=txn.transaction_id,
            category=category,
            confidence=float(result.get("confidence", 0.88)),
            failure_reason=failure_reason,
            recovery_prob=float(result.get("recovery_prob", 0.65)),
            recommended_channel=channel,
            reasoning=reasoning,
        )


# Module-level singleton
_triage_agent: TriageAgent | None = None


def get_triage_agent() -> TriageAgent:
    global _triage_agent
    if _triage_agent is None:
        _triage_agent = TriageAgent()
    return _triage_agent
