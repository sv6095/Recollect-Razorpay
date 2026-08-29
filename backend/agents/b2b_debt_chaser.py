from agents.base import BaseAgent
from models.transaction import Transaction, Channel
from models.agents import RecoveryProposal, DisputeObject
from config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are the B2B Debt Chaser agent for Project Re-Collect, handling Category B (B2B invoice overdue) cases.

Your job is to:
1. Draft a professional, context-aware overdue invoice email
2. Propose a recovery action (Partial Payment Link, NEFT/RTGS, installment plan)
3. Detect if the customer is disputing the invoice and extract structured dispute information

You MUST return valid JSON:
{
  "action": "send_email",
  "email_subject": "Overdue Invoice - [Company/Merchant] - Action Required",
  "email_body": "Professional email body (2-3 paragraphs, firm but respectful)",
  "ptp_amount": <suggested partial payment amount as float>,
  "ptp_due_date": "YYYY-MM-DD",
  "payment_method_recommended": "PARTIAL_LINK" | "NEFT_RTGS" | "INSTALLMENT",
  "dispute": {
    "disputed": true | false,
    "reason_code": "" | "goods_not_received" | "price_dispute" | "service_not_rendered" | "duplicate_invoice" | "already_paid",
    "evidence_summary": "what the customer claims, if disputed"
  },
  "reasoning": "1-2 sentences on your approach"
}

Email guidelines:
- Professional tone, never threatening or aggressive
- Reference specific invoice amount and days overdue
- Offer a clear call to action with Razorpay Partial Payment Link
- For invoices > ₹1 lakh, suggest NEFT/RTGS as an option
- For disputed invoices, acknowledge the dispute professionally and ask for documentation
- PTP amount: suggest the full amount for first contact, or 50% if 30+ days overdue
"""


class B2BDebtChaser(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.reasoning_model, agent_name="B2BDebtChaser")

    async def chase(self, txn: Transaction) -> RecoveryProposal:
        user_message = f"""B2B Invoice to chase:

Customer/Company: {txn.customer_name}
Customer Email: {txn.customer_email}
Amount Overdue: ₹{txn.amount:,.2f}
Days Overdue: {txn.days_overdue}
Merchant: {txn.merchant_id}
Prior Contact Count: {txn.prior_contact_count}
Extra Context: {txn.extra}

Draft the collection email and extract any dispute information."""

        result = await self.chat_json(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=1024,
            temperature=0.2,
        )

        # Extract dispute object
        dispute_data = result.get("dispute", {})
        dispute = DisputeObject(
            disputed=dispute_data.get("disputed", False),
            reason_code=dispute_data.get("reason_code", ""),
            evidence_summary=dispute_data.get("evidence_summary", ""),
        )

        ptp_amount = float(result.get("ptp_amount", txn.amount))
        from datetime import datetime, timedelta
        default_due = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")

        return RecoveryProposal(
            transaction_id=txn.transaction_id,
            agent="B2BDebtChaser",
            action=result.get("action", "send_email"),
            message=result.get("email_body", "Please clear your outstanding invoice."),
            channel=Channel.EMAIL,
            ptp_amount=ptp_amount,
            ptp_due_date=result.get("ptp_due_date", default_due),
            dispute=dispute,
            reasoning=result.get("reasoning", ""),
        )


_agent: B2BDebtChaser | None = None


def get_b2b_debt_chaser() -> B2BDebtChaser:
    global _agent
    if _agent is None:
        _agent = B2BDebtChaser()
    return _agent
