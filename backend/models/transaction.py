from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
import uuid


class TransactionState(str, Enum):
    DETECTED = "DETECTED"
    TRIAGED = "TRIAGED"
    INTERVENTION_PLANNED = "INTERVENTION_PLANNED"
    OUTREACH_SENT = "OUTREACH_SENT"
    CUSTOMER_REPLIED = "CUSTOMER_REPLIED"
    NEGOTIATING = "NEGOTIATING"
    PTP_LOGGED = "PTP_LOGGED"
    RECOVERED = "RECOVERED"
    ESCALATED = "ESCALATED"
    ABORTED = "ABORTED"
    WRITTEN_OFF = "WRITTEN_OFF"


class TransactionCategory(str, Enum):
    A = "A"           # B2C subscription / insufficient funds
    B = "B"           # B2B invoice overdue
    C = "C"           # E-commerce cart abandonment
    SENTINEL = "SENTINEL"  # Pre-failure / upcoming renewal risk


class FailureType(str, Enum):
    INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS"
    CARD_DECLINED = "CARD_DECLINED"
    PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT"
    BANK_ERROR = "BANK_ERROR"
    CART_ABANDONED = "CART_ABANDONED"
    INVOICE_OVERDUE = "INVOICE_OVERDUE"
    RENEWAL_AT_RISK = "RENEWAL_AT_RISK"
    DISPUTE = "DISPUTE"
    UNKNOWN = "UNKNOWN"


class Channel(str, Enum):
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"
    VOICE = "VOICE"
    RETRY = "RETRY"
    NONE = "NONE"


class AbortReason(str, Enum):
    DND = "DND"
    RATE_LIMIT = "RATE_LIMIT"
    CALLING_HOURS = "CALLING_HOURS"
    NO_CONSENT = "NO_CONSENT"
    UNIT_ECONOMICS = "UNIT_ECONOMICS"
    HOSTILE_SENTIMENT = "HOSTILE_SENTIMENT"
    COMPLIANCE_BLOCK = "COMPLIANCE_BLOCK"


@dataclass
class Transaction:
    transaction_id: str
    merchant_id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_email: str
    amount: float                          # in INR
    failure_type: FailureType
    state: TransactionState = TransactionState.DETECTED
    state_version: int = 0
    category: Optional[TransactionCategory] = None
    recovery_prob: float = 0.0
    channel: Channel = Channel.NONE
    days_overdue: int = 0
    prior_contact_count: int = 0
    has_consent: bool = True
    is_preemptive: bool = False            # Sentinel rows
    is_live_demo_row: bool = False         # One of the final 5 live rows
    payment_link_id: Optional[str] = None
    payment_link_url: Optional[str] = None
    abort_reason: Optional[AbortReason] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    extra: dict = field(default_factory=dict)   # category-specific metadata


@dataclass
class StateTransition:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str = ""
    merchant_id: str = ""
    from_state: Optional[TransactionState] = None
    to_state: TransactionState = TransactionState.DETECTED
    agent: str = "system"
    reasoning: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DecisionRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str = ""
    merchant_id: str = ""
    agent: str = ""
    input_summary: str = ""
    output_json: str = ""
    hard_block: bool = False
    timestamp: datetime = field(default_factory=datetime.utcnow)
