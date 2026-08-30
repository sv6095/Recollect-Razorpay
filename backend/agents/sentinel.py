from agents.base import BaseAgent
from models.transaction import Transaction, Channel
from models.agents import RecoveryProposal
from config import get_settings
from datetime import datetime, timedelta

settings = get_settings()

SYSTEM_PROMPT = """You are the Sentinel Agent for Project Re-Collect, handling SENTINEL category (preemptive intervention before payment failure).

Your job is to reach out to customers whose upcoming renewal (in the next 24-48 hours) shows risk signals suggesting the payment might fail.

You MUST return valid JSON:
{
  "action": "send_preemptive_alert",
  "message": "Friendly, helpful message warning about upcoming charge and offering assistance (under 200 chars)",
  "channel": "WHATSAPP" | "EMAIL",
  "suggested_action_for_customer": "update_card" | "ensure_funds" | "reschedule" | "contact_support",
  "reasoning": "1-2 sentences"
}

Tone guidelines:
- Helpful and proactive, NOT alarming
- Make it feel like a friendly reminder, not a debt collector
- Offer a clear action: "Tap here to update your payment method"
- Example: "Hi Priya! Your Netflix-style subscription of ₹499 renews in 2 days. Want us to shift it to the 5th to be safe? Reply YES 👍"
"""


class SentinelAgent(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.triage_model, agent_name="SentinelAgent")

    async def preempt(self, txn: Transaction) -> RecoveryProposal:
        renewal_date = (datetime.utcnow() + timedelta(hours=48)).strftime("%Y-%m-%d")

        user_message = f"""Upcoming renewal at risk:

Customer: {txn.customer_name}
Phone: {txn.customer_phone}
Renewal Amount: ₹{txn.amount:,.2f}
Renewal Date: {renewal_date}
Risk Signals: {txn.extra.get('risk_signals', 'Low balance pattern detected')}
Merchant/Service: {txn.merchant_id}

Draft a friendly preemptive alert to help the customer prepare for this renewal."""

        result = await self.chat_json(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=400,
            temperature=0.25,
        )

        channel_map = {"WHATSAPP": Channel.WHATSAPP, "EMAIL": Channel.EMAIL}
        channel = channel_map.get(result.get("channel", "WHATSAPP"), Channel.WHATSAPP)

        return RecoveryProposal(
            transaction_id=txn.transaction_id,
            agent="SentinelAgent",
            action=result.get("action", "send_preemptive_alert"),
            message=result.get("message", f"Your ₹{txn.amount:.0f} renewal is in 2 days. Tap to update payment method."),
            channel=channel,
            reasoning=result.get("reasoning", "Preemptive intervention before failure."),
        )


_agent: SentinelAgent | None = None


def get_sentinel_agent() -> SentinelAgent:
    global _agent
    if _agent is None:
        _agent = SentinelAgent()
    return _agent
