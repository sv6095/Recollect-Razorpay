from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from agents.base import BaseAgent
from models.transaction import Transaction, Channel
from models.agents import RecoveryProposal
from config import get_settings

settings = get_settings()
IST = ZoneInfo("Asia/Kolkata")

SYSTEM_PROMPT = """You are the Salary-Day Sequencer agent for Project Re-Collect, handling Category A (B2C subscription) payment failures.

Your job is to:
1. Determine the optimal retry date (align to next salary day: 1st-5th of next month)
2. Confirm that an RBI e-Mandate pre-debit notification will be sent at least 24 hours before the retry
3. Draft a short, empathetic SMS/notification message to inform the customer

You MUST return valid JSON:
{
  "action": "scheduled_retry",
  "retry_date": "YYYY-MM-DD",
  "rbi_notification_date": "YYYY-MM-DD",
  "rbi_notification_sent": true,
  "message": "Customer-facing notification message (under 160 chars)",
  "reasoning": "1-2 sentence explanation of why this retry date was chosen"
}

Important:
- If the current date is already the 1st-10th of month, schedule for the 1st of NEXT month
- If current date is 11th-31st, schedule for the 1st of next month
- RBI pre-debit notification MUST be sent at least 24h before the retry fires
- Keep the message professional, empathetic, and under 160 characters
- Do NOT mention the word "failed" — use "couldn't be processed" instead
"""


class SalaryDaySequencer(BaseAgent):
    def __init__(self):
        super().__init__(model=settings.triage_model, agent_name="SalaryDaySequencer")

    async def plan_retry(self, txn: Transaction) -> RecoveryProposal:
        now_ist = datetime.now(IST)

        # Compute the next 1st of month in IST
        if now_ist.day <= 5:
            # We're already in salary window — retry next month
            next_1st = datetime(now_ist.year, now_ist.month, 1, tzinfo=IST) + timedelta(days=32)
            next_1st = next_1st.replace(day=1)
        else:
            # Schedule for 1st of next month
            next_1st = datetime(now_ist.year, now_ist.month, 1, tzinfo=IST) + timedelta(days=32)
            next_1st = next_1st.replace(day=1)

        rbi_notification_date = (next_1st - timedelta(days=1)).strftime("%Y-%m-%d")
        retry_date = next_1st.strftime("%Y-%m-%d")

        user_message = f"""B2C Subscription Failure to handle:

Customer: {txn.customer_name}
Amount: ₹{txn.amount:,.2f}
Merchant: {txn.merchant_id}
Failure Type: {txn.failure_type.value if hasattr(txn.failure_type, 'value') else txn.failure_type}
Today (IST): {now_ist.strftime('%Y-%m-%d')}
Suggested Retry Date: {retry_date}
Suggested RBI Notification Date: {rbi_notification_date}

Draft the recovery plan with the appropriate retry date and RBI pre-debit notification."""

        result = await self.chat_json(
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=2048,
            temperature=0.1,
        )

        return RecoveryProposal(
            transaction_id=txn.transaction_id,
            agent="SalaryDaySequencer",
            action=result.get("action", "scheduled_retry"),
            message=result.get("message", f"Your ₹{txn.amount:.0f} payment will be retried on {retry_date}."),
            channel=Channel.RETRY,
            retry_date=result.get("retry_date", retry_date),
            rbi_notification_sent=result.get("rbi_notification_sent", True),
            reasoning=result.get("reasoning", "Scheduled for next salary window."),
        )


_agent: SalaryDaySequencer | None = None


def get_salary_day_sequencer() -> SalaryDaySequencer:
    global _agent
    if _agent is None:
        _agent = SalaryDaySequencer()
    return _agent
