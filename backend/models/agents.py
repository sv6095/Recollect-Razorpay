from pydantic import BaseModel
from typing import Optional
from models.transaction import TransactionCategory, Channel, AbortReason


class TriageResult(BaseModel):
    transaction_id: str
    category: TransactionCategory
    confidence: float                  # 0.0 – 1.0
    failure_reason: str
    recovery_prob: float               # 0.0 – 1.0
    recommended_channel: Channel
    reasoning: str


class DisputeObject(BaseModel):
    disputed: bool
    reason_code: str = ""             # e.g. "goods_not_received", "price_dispute"
    evidence_summary: str = ""


class RecoveryProposal(BaseModel):
    transaction_id: str
    agent: str
    action: str                       # e.g. "scheduled_retry", "send_whatsapp", "send_email"
    message: str = ""
    channel: Channel = Channel.NONE
    discount_pct: float = 0.0
    payment_link_url: str = ""
    retry_date: Optional[str] = None
    rbi_notification_sent: bool = False
    ptp_amount: float = 0.0
    ptp_due_date: Optional[str] = None
    dispute: Optional[DisputeObject] = None
    reasoning: str = ""


class RiskVerdict(BaseModel):
    transaction_id: str
    hard_block: bool
    reason_code: str                  # e.g. "hostile_tone", "dispute_history", "dnd_implicit"
    confidence: float
    suggested_action: str             # e.g. "flag_for_arbiter", "abort", "escalate_human"
    reasoning: str


class ArbiterRuling(BaseModel):
    transaction_id: str
    approved: bool
    final_action: str
    reasoning: str
    concession_approved: bool = False
    concession_details: str = ""


class GateResult(BaseModel):
    passed: bool
    abort_reason: Optional[AbortReason] = None
    details: str = ""
    trai_calling_window: str = "Active (08:00 - 19:00 IST)"
    velocity_limit: str = "0 / 2 contacts in 24h"
    dnd_status: str = "Clear (NDNC check passed)"
    consent_status: str = "Verified opt-in consent on record"
    unit_economics: str = "Expected recovery exceeds outreach cost"

