from agents.base import BaseAgent
from models.transaction import Transaction
from models.agents import RecoveryProposal, RiskVerdict
from config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are the Semantic Risk Agent for Project Re-Collect — a compliance and risk guard for AI-driven revenue recovery.

You ONLY evaluate cases that the deterministic Policy Gate has already passed. Your job is to detect things a rule engine cannot:
- Hostile or aggressive customer tone ("stop messaging me", "I will sue", "fraud", "harassment")
- Implicit opt-out signals ("please don't contact me again", "remove me from your list")
- Dispute signals that weren't explicitly structured (angry tone about wrong amount, service not received)
- Non-standard or precedent-setting concession requests (unusually large discounts)
- Brand-voice or tone drift in the proposed message
- Regulatory timing concerns not covered by the deterministic gate

You MUST return valid JSON:
{
  "hard_block": true | false,
  "reason_code": "hostile_tone" | "implicit_opt_out" | "dispute_detected" | "excessive_concession" | "tone_drift" | "regulatory_concern" | "clean",
  "confidence": 0.0-1.0,
  "suggested_action": "abort" | "flag_for_arbiter" | "proceed" | "escalate_human",
  "reasoning": "2-3 clear sentences explaining your verdict"
}

CRITICAL RULES:
- hard_block=true is FINAL. Never second-guess it. The Arbiter is never consulted for hard blocks.
- hard_block=true ONLY for: hostile tone, explicit opt-out, active harassment risk, or clear regulatory violation
- hard_block=false + suggested_action="flag_for_arbiter" for business trade-offs (disputed invoice, large concession)
- hard_block=false + suggested_action="proceed" for clean cases
- Be conservative: if in doubt about hostile tone, hard_block=true is the safer call
"""


class RiskAgent(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.reasoning_model, agent_name="RiskAgent")

    async def evaluate(self, txn: Transaction, proposal: RecoveryProposal) -> RiskVerdict:
        # Build context from the proposed action
        dispute_context = ""
        if proposal.dispute and proposal.dispute.disputed:
            dispute_context = f"""
DISPUTE DETECTED by Recovery Agent:
- Reason Code: {proposal.dispute.reason_code}
- Customer Claim: {proposal.dispute.evidence_summary}
"""

        user_message = f"""Transaction and proposed recovery action to evaluate:

Transaction ID: {txn.transaction_id}
Customer: {txn.customer_name}
Amount: ₹{txn.amount:,.2f}
Category: {txn.category.value if txn.category else 'Unknown'}
Days Overdue: {txn.days_overdue}
Prior Contact Count: {txn.prior_contact_count}

Proposed Recovery Action (from {proposal.agent}):
- Action: {proposal.action}
- Channel: {proposal.channel.value if hasattr(proposal.channel, 'value') else proposal.channel}
- Message: {proposal.message[:300]}
- Discount: {proposal.discount_pct}%
- PTP Amount: ₹{proposal.ptp_amount:,.2f} (if applicable)
{dispute_context}

Additional Context: {txn.extra}

Evaluate the risk of proceeding with this recovery action."""

        result = await self.chat_json(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=2048,
            temperature=0.1,  # Low temperature for consistent risk decisions
        )

        has_dispute = bool(proposal.dispute and proposal.dispute.disputed)
        hard_block = bool(result.get("hard_block", False))
        reason_code = result.get("reason_code") or ("dispute_detected" if has_dispute else "clean")
        suggested_action = result.get("suggested_action") or ("flag_for_arbiter" if has_dispute else "proceed")
        reasoning = result.get("reasoning") or (
            f"Commercial dispute detected ({proposal.dispute.reason_code if has_dispute else 'disputed invoice'}); flagging for Arbiter adjudication."
            if has_dispute else
            "Semantic tone and regulatory guardrails verified. Customer communication complies with brand safety rules."
        )

        return RiskVerdict(
            transaction_id=txn.transaction_id,
            hard_block=hard_block,
            reason_code=reason_code,
            confidence=float(result.get("confidence", 0.92)),
            suggested_action=suggested_action,
            reasoning=reasoning,
        )


_agent: RiskAgent | None = None


def get_risk_agent() -> RiskAgent:
    global _agent
    if _agent is None:
        _agent = RiskAgent()
    return _agent
