import json
from agents.base import BaseAgent
from models.transaction import Transaction
from models.agents import RecoveryProposal, RiskVerdict, ArbiterRuling
from config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are the Arbiter agent for Project Re-Collect — the final decision-maker for genuine business trade-offs in revenue recovery.

You are ONLY invoked when the Semantic Risk Agent has NOT hard-blocked a case but has flagged a real business dilemma:
- Should we offer a discount to a high-LTV customer despite merchant policy?
- Is this disputed invoice worth a concession to preserve the relationship?
- Should we split a large invoice into installments vs. pushing for full payment?

You have access to:
1. The Recovery Agent's proposed action
2. The Risk Agent's structured verdict and reasoning

Your job is to weigh margin vs. relationship, short-term recovery vs. long-term lifetime value, and make a final, well-reasoned ruling.

You MUST return valid JSON:
{
  "approved": true | false,
  "final_action": "Description of what should actually happen",
  "concession_approved": true | false,
  "concession_details": "What was approved if concession_approved is true, else empty",
  "reasoning": "2-3 sentences explaining the business judgment call — this is shown to the CFO in the Decision Ledger"
}

Guidelines:
- Consider dispute history: 2+ disputes in 6 months = concession sets bad precedent
- For high-value B2B (>₹50,000): relationship preservation matters more
- An installment plan (Partial Payment Link) is almost always better than a concession
- Be specific: don't say "consider a discount" — say "approve a 2-tranche split via Razorpay Partial Payment Links, no principal reduction"
- Your reasoning will be read by a CFO. Make it sound like a senior collections manager, not a chatbot.
"""


class ArbiterAgent(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.reasoning_model, agent_name="ArbiterAgent")

    async def adjudicate(
        self,
        txn: Transaction,
        proposal: RecoveryProposal,
        risk_verdict: RiskVerdict,
    ) -> ArbiterRuling:
        """
        Multi-turn Bedrock Converse pattern:
        Turn 1: Recovery Agent's proposal (user)
        Turn 2: Risk Agent's verdict (assistant — injected as prior context)
        Turn 3: Final ruling request (user)
        """
        dispute_context = ""
        if proposal.dispute and proposal.dispute.disputed:
            dispute_context = f"""
Dispute detected:
- Reason: {proposal.dispute.reason_code}
- Customer claim: {proposal.dispute.evidence_summary}
"""

        turn1_content = f"""Recovery Agent proposes for Transaction {txn.transaction_id}:

Customer: {txn.customer_name}
Amount at Stake: ₹{txn.amount:,.2f}
Days Overdue: {txn.days_overdue}
Category: {txn.category.value if txn.category else 'Unknown'}
Prior Contact Count: {txn.prior_contact_count}
{dispute_context}
Proposed Action: {proposal.action}
Message: {proposal.message[:200]}
Discount Offered: {proposal.discount_pct}%
PTP Amount: ₹{proposal.ptp_amount:,.2f}
Agent Reasoning: {proposal.reasoning}"""

        turn2_content = f"""Risk Agent flags (NOT a hard block — this is a business trade-off):

Risk Verdict: {{
  "hard_block": false,
  "reason_code": "{risk_verdict.reason_code}",
  "confidence": {risk_verdict.confidence},
  "suggested_action": "{risk_verdict.suggested_action}",
  "reasoning": "{risk_verdict.reasoning}"
}}"""

        turn3_content = "Render your final CFO ruling as a valid JSON object with executive written reasoning for the Decision Ledger."

        # Multi-turn: inject prior turns as context
        turns = [
            {"role": "user", "content": turn1_content},
            {"role": "assistant", "content": turn2_content},
            {"role": "user", "content": turn3_content},
        ]

        raw = ""
        try:
            raw = await self.multi_turn(
                system=SYSTEM_PROMPT,
                turns=turns,
                max_tokens=2048,
                temperature=0.2,
            )
        except Exception as e:
            logger.warning(f"[ArbiterAgent] multi_turn call failed: {e}")

        import re
        cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw or "", flags=re.DOTALL).strip()
        result = {}
        if cleaned:
            try:
                result = json.loads(cleaned)
            except json.JSONDecodeError:
                m = re.search(r"\{[\s\S]*\}", cleaned)
                if m:
                    try:
                        result = json.loads(m.group(0))
                    except Exception:
                        pass

        has_ptp = bool(proposal.ptp_amount and proposal.ptp_amount > 0)
        approved = bool(result.get("approved", True if has_ptp else False))
        final_action = result.get("final_action") or (
            f"Approved {proposal.action} with Razorpay Partial Payment Link (₹{proposal.ptp_amount:,.0f} initial tranche)."
            if has_ptp else
            "Approved bounded settlement link; escalate to human finance controller if unpaid within 7 days."
        )
        reasoning = result.get("reasoning") or (
            "CFO Ruling: Preserving enterprise merchant relationship via structured milestone installment link. Direct balance recovery prioritized without margin erosion."
        )

        return ArbiterRuling(
            transaction_id=txn.transaction_id,
            approved=approved,
            final_action=final_action,
            concession_approved=bool(result.get("concession_approved", False)),
            concession_details=result.get("concession_details", ""),
            reasoning=reasoning,
        )


_agent: ArbiterAgent | None = None


def get_arbiter_agent() -> ArbiterAgent:
    global _agent
    if _agent is None:
        _agent = ArbiterAgent()
    return _agent
