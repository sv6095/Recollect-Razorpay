import aiosqlite
import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Any
from config import get_settings

settings = get_settings()

# Strip SQLAlchemy URL prefix if present
_raw_url = settings.database_url
DB_PATH = _raw_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
if not DB_PATH:
    DB_PATH = "recollect.db"

# Module-level connection (set during lifespan)
_db: Optional[aiosqlite.Connection] = None


async def init_db() -> aiosqlite.Connection:
    global _db
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row

    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        schema = f.read()
    await db.executescript(schema)
    await db.commit()

    _db = db
    return db


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await init_db()
    return _db


async def close_db():
    global _db
    if _db:
        await _db.close()
        _db = None


# ─── Transactions ────────────────────────────────────────────────────────────

async def upsert_transaction(txn) -> None:
    """Insert or update a Transaction dataclass into the DB."""
    db = await get_db()
    await db.execute(
        """
        INSERT INTO transactions (
            id, merchant_id, customer_id, customer_name, customer_phone,
            customer_email, amount, failure_type, state, state_version,
            category, recovery_prob, channel, days_overdue, prior_contact_count,
            has_consent, is_preemptive, is_live_demo_row,
            payment_link_id, payment_link_url, abort_reason, extra,
            created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
            state=excluded.state,
            state_version=excluded.state_version,
            category=excluded.category,
            recovery_prob=excluded.recovery_prob,
            channel=excluded.channel,
            prior_contact_count=excluded.prior_contact_count,
            payment_link_id=excluded.payment_link_id,
            payment_link_url=excluded.payment_link_url,
            abort_reason=excluded.abort_reason,
            extra=excluded.extra,
            updated_at=excluded.updated_at
        """,
        (
            txn.transaction_id, txn.merchant_id, txn.customer_id,
            txn.customer_name, txn.customer_phone, txn.customer_email,
            txn.amount, txn.failure_type.value if hasattr(txn.failure_type, 'value') else txn.failure_type,
            txn.state.value if hasattr(txn.state, 'value') else txn.state,
            txn.state_version,
            txn.category.value if txn.category and hasattr(txn.category, 'value') else txn.category,
            txn.recovery_prob,
            txn.channel.value if hasattr(txn.channel, 'value') else txn.channel,
            txn.days_overdue, txn.prior_contact_count,
            int(txn.has_consent), int(txn.is_preemptive), int(txn.is_live_demo_row),
            txn.payment_link_id, txn.payment_link_url,
            txn.abort_reason.value if txn.abort_reason and hasattr(txn.abort_reason, 'value') else txn.abort_reason,
            json.dumps(txn.extra),
            txn.created_at.isoformat(), txn.updated_at.isoformat()
        )
    )
    await db.commit()


async def get_transaction(txn_id: str) -> Optional[dict]:
    db = await get_db()
    async with db.execute("SELECT * FROM transactions WHERE id=?", (txn_id,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def get_all_transactions(merchant_id: str = "merchant_001") -> List[dict]:
    db = await get_db()
    async with db.execute(
        "SELECT * FROM transactions WHERE merchant_id=? ORDER BY created_at DESC",
        (merchant_id,)
    ) as cur:
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


# ─── State Transitions ───────────────────────────────────────────────────────

async def record_transition(txn_id: str, merchant_id: str, from_state, to_state,
                             agent: str = "system", reasoning: str = "") -> None:
    db = await get_db()
    await db.execute(
        """
        INSERT INTO state_transitions (id, transaction_id, merchant_id, from_state, to_state, agent, reasoning, timestamp)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (
            str(uuid.uuid4()), txn_id, merchant_id,
            from_state.value if from_state and hasattr(from_state, 'value') else from_state,
            to_state.value if hasattr(to_state, 'value') else to_state,
            agent, reasoning, datetime.utcnow().isoformat()
        )
    )
    await db.commit()


async def get_transitions(txn_id: str) -> List[dict]:
    db = await get_db()
    async with db.execute(
        "SELECT * FROM state_transitions WHERE transaction_id=? ORDER BY timestamp ASC",
        (txn_id,)
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─── Decisions ───────────────────────────────────────────────────────────────

async def record_decision(txn_id: str, merchant_id: str, agent: str,
                           input_summary: str, output_json: Any, hard_block: bool = False) -> None:
    db = await get_db()
    output_str = json.dumps(output_json) if not isinstance(output_json, str) else output_json
    await db.execute(
        """
        INSERT INTO decisions (id, transaction_id, merchant_id, agent, input_summary, output_json, hard_block, timestamp)
        VALUES (?,?,?,?,?,?,?,?)
        """,
        (str(uuid.uuid4()), txn_id, merchant_id, agent, input_summary, output_str,
         int(hard_block), datetime.utcnow().isoformat())
    )
    await db.commit()


async def get_decisions(txn_id: str) -> List[dict]:
    db = await get_db()
    async with db.execute(
        "SELECT * FROM decisions WHERE transaction_id=? ORDER BY timestamp ASC",
        (txn_id,)
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─── Promise to Pay ──────────────────────────────────────────────────────────

async def log_ptp(txn_id: str, merchant_id: str, customer_id: str,
                   amount: float, due_date: str,
                   link_id: str = "", link_url: str = "") -> str:
    db = await get_db()
    ptp_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    await db.execute(
        """
        INSERT INTO promise_to_pay
        (id, transaction_id, merchant_id, customer_id, amount_promised, due_date,
         payment_link_id, payment_link_url, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """,
        (ptp_id, txn_id, merchant_id, customer_id, amount, due_date, link_id, link_url, "pending", now, now)
    )
    await db.commit()
    return ptp_id


async def mark_recovered(txn_id: str, amount_recovered: float) -> None:
    db = await get_db()
    now = datetime.utcnow().isoformat()
    await db.execute(
        "UPDATE promise_to_pay SET amount_recovered=?, status='paid', updated_at=? WHERE transaction_id=?",
        (amount_recovered, now, txn_id)
    )
    await db.execute(
        "UPDATE transactions SET state='RECOVERED', state_version=state_version+1, updated_at=? WHERE id=?",
        (now, txn_id)
    )
    await db.commit()


# ─── DND List ────────────────────────────────────────────────────────────────

async def add_to_dnd(customer_id: str, merchant_id: str, reason: str) -> None:
    db = await get_db()
    await db.execute(
        "INSERT OR IGNORE INTO dnd_list (customer_id, merchant_id, reason, added_at) VALUES (?,?,?,?)",
        (customer_id, merchant_id, reason, datetime.utcnow().isoformat())
    )
    await db.commit()


# ─── Escalations ─────────────────────────────────────────────────────────────

async def create_escalation(txn_id: str, merchant_id: str, customer_id: str,
                              customer_name: str, amount: float, reason: str,
                              context_summary: str = "") -> str:
    db = await get_db()
    esc_id = str(uuid.uuid4())
    await db.execute(
        """
        INSERT INTO escalations
        (id, transaction_id, merchant_id, customer_id, customer_name, amount, reason, context_summary, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        """,
        (esc_id, txn_id, merchant_id, customer_id, customer_name, amount, reason, context_summary, "open",
         datetime.utcnow().isoformat())
    )
    await db.commit()
    return esc_id


async def get_escalations(merchant_id: str = "merchant_001") -> List[dict]:
    db = await get_db()
    async with db.execute(
        "SELECT * FROM escalations WHERE merchant_id=? ORDER BY created_at DESC",
        (merchant_id,)
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


# ─── Stats ───────────────────────────────────────────────────────────────────

async def get_stats(merchant_id: str = "merchant_001") -> dict:
    db = await get_db()
    async with db.execute(
        "SELECT * FROM recovery_stats WHERE merchant_id=?", (merchant_id,)
    ) as cur:
        row = await cur.fetchone()
        if row:
            return dict(row)
        return {
            "merchant_id": merchant_id,
            "total_transactions": 0,
            "total_at_risk": 0.0,
            "total_recovered": 0.0,
            "count_recovered": 0,
            "count_aborted": 0,
            "count_written_off": 0,
            "count_escalated": 0,
        }
