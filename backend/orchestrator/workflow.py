import logging
import json
import asyncio
from datetime import datetime

from models.transaction import Transaction, TransactionState, TransactionCategory, AbortReason, Channel
from models.agents import RecoveryProposal, RiskVerdict, ArbiterRuling

from gate.policy_gate import run_policy_gate
from scoring.recovery_scorer import score_transaction
from agents.triage import get_triage_agent
from agents.salary_day_sequencer import get_salary_day_sequencer
from agents.b2b_debt_chaser import get_b2b_debt_chaser
from agents.cart_rescuer import get_cart_rescuer
from agents.sentinel import get_sentinel_agent
from agents.risk_agent import get_risk_agent
from agents.arbiter import get_arbiter_agent

from actions.razorpay_client import create_payment_link
from actions.channel_router import send_message
from actions.ptp_ledger import record_ptp

from db import database as db
from state import redis_store
from event_queue import event_bus

logger = logging.getLogger(__name__)

MERCHANT_ID = "merchant_001"


def _build_audit_event(txn: Transaction, event_type: str, message: str,
                        agent: str = "system", extra: dict = None) -> dict:
    """Build a standardized event dict for WebSocket broadcast."""
    return {
        "type": event_type,
        "transaction_id": txn.transaction_id,
        "merchant_id": txn.merchant_id,
        "customer_name": txn.customer_name,
        "amount": txn.amount,
        "state": txn.state.value if hasattr(txn.state, 'value') else txn.state,
        "category": txn.category.value if txn.category and hasattr(txn.category, 'value') else txn.category,
        "agent": agent,
        "message": message,
        "timestamp": datetime.utcnow().isoformat(),
        **(extra or {}),
    }


async def _transition(txn: Transaction, new_state: TransactionState,
                       agent: str, reasoning: str) -> bool:
    """Transition transaction state with CAS guard + DB record."""
    old_state = txn.state
    new_version = txn.state_version + 1

    # CAS in Redis
    success = await redis_store.set_transaction_state_cas(
        txn.transaction_id, txn.state_version, new_state.value, new_version
    )
    if not success:
        logger.warning(f"CAS failed for {txn.transaction_id} — stale version {txn.state_version}")
        return False

    txn.state = new_state
    txn.state_version = new_version
    txn.updated_at = datetime.utcnow()

    # Persist to DB
    await db.record_transition(txn.transaction_id, txn.merchant_id, old_state, new_state, agent, reasoning)
    await db.upsert_transaction(txn)

    # Broadcast
    event = _build_audit_event(txn, "state_change", reasoning, agent)
    await redis_store.publish_event(event)
    await event_bus.broadcast_event(event)

    return True


async def _abort(txn: Transaction, reason: AbortReason, message: str, agent: str = "PolicyGate") -> None:
    txn.abort_reason = reason
    if reason == AbortReason.UNIT_ECONOMICS:
        await _transition(txn, TransactionState.WRITTEN_OFF, agent, message)
    else:
        await _transition(txn, TransactionState.ABORTED, agent, message)

    # Add to DND if it was a hostile / compliance abort
    if reason in (AbortReason.DND, AbortReason.HOSTILE_SENTIMENT, AbortReason.COMPLIANCE_BLOCK):
        await redis_store.add_dnd(txn.customer_id)
        await db.add_to_dnd(txn.customer_id, txn.merchant_id, reason.value)

    # Broadcast abort event
    event = _build_audit_event(txn, "audit_row", message, agent, {
        "outcome": "aborted" if reason != AbortReason.UNIT_ECONOMICS else "written_off",
        "abort_reason": reason.value,
    })
    await event_bus.broadcast_event(event)

    # Update stats
    await _broadcast_stats(txn.merchant_id)


async def _escalate(txn: Transaction, reason: str, context_summary: str) -> None:
    await _transition(txn, TransactionState.ESCALATED, "orchestrator", reason)
    esc_id = await db.create_escalation(
        txn.transaction_id, txn.merchant_id, txn.customer_id,
        txn.customer_name, txn.amount, reason, context_summary
    )
    event = _build_audit_event(txn, "escalation", reason, "orchestrator", {
        "escalation_id": esc_id,
        "outcome": "escalated",
        "context_summary": context_summary,
    })
    await event_bus.broadcast_event(event)
    await _broadcast_stats(txn.merchant_id)


async def _broadcast_stats(merchant_id: str) -> None:
    stats = await db.get_stats(merchant_id)
    await event_bus.broadcast_event({"type": "counter_update", "stats": stats})
    await redis_store.publish_event({"type": "counter_update", "stats": stats})


async def process_transaction(txn: Transaction) -> None:
    """
    Main orchestrator coroutine — implements the full bounded recovery workflow.
    """
    logger.info(f"[Orchestrator] Processing {txn.transaction_id} for {txn.customer_name} (₹{txn.amount})")

    # ── Initial state ────────────────────────────────────────────────────────
    await db.upsert_transaction(txn)
    await redis_store.force_set_state(txn.transaction_id, txn.state.value, txn.state_version)

    # Broadcast DETECTED
    await event_bus.broadcast_event(_build_audit_event(
        txn, "audit_row", f"Analyzing transaction — ₹{txn.amount:,.0f} failure detected", "orchestrator",
        {"outcome": "in_progress"}
    ))

    # ── Step 1: Recovery Probability Scoring ─────────────────────────────────
    await score_transaction(txn)

    # ── Step 2: Policy Gate (deterministic, zero LLM) ────────────────────────
    gate_result = await run_policy_gate(txn)
    await db.record_decision(txn.transaction_id, txn.merchant_id, "PolicyGate",
                              f"Running policy gate for {txn.customer_id}",
                              gate_result.model_dump(), not gate_result.passed)

    if not gate_result.passed:
        await _abort(txn, gate_result.abort_reason, gate_result.details, "PolicyGate")
        return

    # ── Step 3: Triage ────────────────────────────────────────────────────────
    await _transition(txn, TransactionState.TRIAGED, "TriageAgent", "Running AI triage classification")

    triage_agent = get_triage_agent()
    triage_result = await triage_agent.triage(txn)

    # Update transaction with triage results
    txn.category = triage_result.category
    txn.recovery_prob = triage_result.recovery_prob
    txn.channel = triage_result.recommended_channel
    txn.updated_at = datetime.utcnow()
    await db.upsert_transaction(txn)
    await db.record_decision(txn.transaction_id, txn.merchant_id, "TriageAgent",
                              f"Classifying transaction",
                              triage_result.model_dump())

    # Re-run unit-economics gate with refined recovery_prob
    if not (txn.amount * txn.recovery_prob > 5.0):  # ₹5 outreach cost
        await _abort(txn, AbortReason.UNIT_ECONOMICS,
                     f"Expected recovery ₹{txn.amount * txn.recovery_prob:.2f} < ₹5 outreach cost. Auto-written off.",
                     "PolicyGate")
        return

    await event_bus.broadcast_event(_build_audit_event(
        txn, "audit_row",
        f"Triaged as Category {txn.category.value if txn.category else '?'} — {triage_result.failure_reason}",
        "TriageAgent", {"outcome": "in_progress", "category": txn.category.value if txn.category else None}
    ))

    # ── Step 4: Intervention Planning ────────────────────────────────────────
    await _transition(txn, TransactionState.INTERVENTION_PLANNED, "orchestrator", "Routing to specialist recovery agent")

    # Route to appropriate specialist agent
    proposal: RecoveryProposal = None

    if txn.category == TransactionCategory.SENTINEL:
        agent = get_sentinel_agent()
        proposal = await agent.preempt(txn)

    elif txn.category == TransactionCategory.A:
        agent = get_salary_day_sequencer()
        proposal = await agent.plan_retry(txn)

    elif txn.category == TransactionCategory.B:
        agent = get_b2b_debt_chaser()
        proposal = await agent.chase(txn)

    elif txn.category == TransactionCategory.C:
        agent = get_cart_rescuer()
        proposal = await agent.rescue(txn)

    else:
        # Fallback
        agent = get_salary_day_sequencer()
        proposal = await agent.plan_retry(txn)

    await db.record_decision(txn.transaction_id, txn.merchant_id, proposal.agent,
                              "Recovery intervention plan", proposal.model_dump())

    # ── Step 5: Semantic Risk Gate ────────────────────────────────────────────
    risk_agent = get_risk_agent()
    risk_verdict = await risk_agent.evaluate(txn, proposal)

    await db.record_decision(txn.transaction_id, txn.merchant_id, "RiskAgent",
                              "Semantic risk evaluation",
                              risk_verdict.model_dump(), risk_verdict.hard_block)

    if risk_verdict.hard_block:
        # Hard block is FINAL — Arbiter never consulted
        await _abort(txn, AbortReason.COMPLIANCE_BLOCK,
                     f"RISK BLOCK [{risk_verdict.reason_code}]: {risk_verdict.reasoning}",
                     "RiskAgent")
        if risk_verdict.reason_code in ("hostile_tone", "implicit_opt_out"):
            await _abort(txn, AbortReason.HOSTILE_SENTIMENT,
                         f"Sentiment circuit breaker tripped — {risk_verdict.reason_code}. Customer tagged DND.",
                         "RiskAgent")
        return

    arbiter_ruling: ArbiterRuling | None = None

    if risk_verdict.suggested_action == "flag_for_arbiter":
        # ── Step 6: Arbiter (business trade-offs only) ─────────────────────
        arbiter_agent = get_arbiter_agent()
        arbiter_ruling = await arbiter_agent.adjudicate(txn, proposal, risk_verdict)

        await db.record_decision(txn.transaction_id, txn.merchant_id, "ArbiterAgent",
                                  "Business trade-off arbitration",
                                  arbiter_ruling.model_dump())

        # Broadcast the full 3-line decision ledger exchange
        await event_bus.broadcast_event(_build_audit_event(
            txn, "decision_ledger", "Arbiter ruling issued", "ArbiterAgent", {
                "outcome": "arbiter_ruling",
                "proposal_summary": proposal.reasoning[:200],
                "risk_verdict": risk_verdict.model_dump(),
                "arbiter_ruling": arbiter_ruling.model_dump(),
            }
        ))

        if not arbiter_ruling.approved:
            # Arbiter rejected — escalate to human
            await _escalate(txn,
                             f"Arbiter rejected automated recovery: {arbiter_ruling.reasoning}",
                             f"Recovery agent proposed {proposal.action}. Risk flagged {risk_verdict.reason_code}. Arbiter ruled: {arbiter_ruling.final_action}")
            return

    elif risk_verdict.suggested_action == "escalate_human":
        await _escalate(txn,
                         f"Risk Agent recommends human intervention: {risk_verdict.reasoning}",
                         proposal.reasoning)
        return

    # ── Step 7: Execute Recovery Action ──────────────────────────────────────
    await _transition(txn, TransactionState.OUTREACH_SENT, proposal.agent,
                       f"Executing {proposal.action} via {proposal.channel.value if hasattr(proposal.channel, 'value') else proposal.channel}")

    # Generate Razorpay payment link if needed
    if txn.category in (TransactionCategory.B, TransactionCategory.C) and not txn.payment_link_url:
        link = await create_payment_link(txn, proposal)
        if link:
            txn.payment_link_id = link.get("id", "")
            txn.payment_link_url = link.get("short_url", "")
            proposal.payment_link_url = txn.payment_link_url
            await db.upsert_transaction(txn)

    # Send the message
    msg_with_link = proposal.message
    if txn.payment_link_url and "[PAYMENT_LINK]" in msg_with_link:
        msg_with_link = msg_with_link.replace("[PAYMENT_LINK]", txn.payment_link_url)
    elif txn.payment_link_url and txn.payment_link_url not in msg_with_link:
        msg_with_link += f"\n\n{txn.payment_link_url}"

    await send_message(txn, proposal.channel if hasattr(proposal.channel, 'value') else Channel.NONE,
                        msg_with_link)

    await event_bus.broadcast_event(_build_audit_event(
        txn, "audit_row",
        f"{proposal.action} executed via {proposal.channel.value if hasattr(proposal.channel, 'value') else proposal.channel} — {proposal.reasoning[:150]}",
        proposal.agent, {
            "outcome": "outreach_sent",
            "channel": proposal.channel.value if hasattr(proposal.channel, 'value') else str(proposal.channel),
            "payment_link_url": txn.payment_link_url or "",
            "proposal": proposal.model_dump(),
            "risk_verdict": risk_verdict.model_dump(),
            "arbiter_ruling": arbiter_ruling.model_dump() if arbiter_ruling else None,
        }
    ))

    # ── Step 8: Log PTP for negotiated payments ───────────────────────────────
    if proposal.ptp_amount and proposal.ptp_amount > 0:
        await _transition(txn, TransactionState.NEGOTIATING, proposal.agent, "PTP negotiation in progress")
        ptp_due = proposal.ptp_due_date or ""
        await record_ptp(txn, proposal.ptp_amount, ptp_due, txn.payment_link_id or "", txn.payment_link_url or "")
        await _transition(txn, TransactionState.PTP_LOGGED, proposal.agent,
                           f"PTP logged — ₹{proposal.ptp_amount:,.0f} due {ptp_due}")

        await event_bus.broadcast_event(_build_audit_event(
            txn, "audit_row",
            f"₹{proposal.ptp_amount:,.0f} split payment agreed — link generated, PTP logged",
            proposal.agent, {"outcome": "ptp_logged", "ptp_amount": proposal.ptp_amount}
        ))

    # For Sentinel and Cat A (scheduled retries), mark as recovered directly
    if txn.category in (TransactionCategory.A, TransactionCategory.SENTINEL):
        await _transition(txn, TransactionState.RECOVERED, proposal.agent,
                           "Retry scheduled — marking as recovery in progress")
        await db.mark_recovered(txn.transaction_id, txn.amount)

        await event_bus.broadcast_event(_build_audit_event(
            txn, "audit_row",
            f"Recovery scheduled — RBI pre-debit notification {'sent ✓' if proposal.rbi_notification_sent else 'queued'}. Retry on {proposal.retry_date}.",
            proposal.agent, {"outcome": "recovered", "recovered_amount": txn.amount}
        ))

    await _broadcast_stats(txn.merchant_id)
    logger.info(f"[Orchestrator] Completed {txn.transaction_id} → {txn.state.value}")
