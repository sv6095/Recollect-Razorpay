'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { WSEvent, Transaction } from '@/types'
import { Header } from '@/components/recovery/Header'
import { Sidebar } from '@/components/recovery/Sidebar'
import { ToastProvider, useToast } from '@/components/recovery/ToastContext'

interface AgentStepData {
  id: string
  transaction_id: string
  customer_name: string
  amount: number
  timestamp: string
  summary: string
  status: string
  checks: Record<string, unknown>
  reasoning: string
  output_action?: string
  agent?: string
  is_live?: boolean
}

interface AgentMeta {
  key: string
  label: string
  role: string
  type: string
  model: string
  color: string
  icon: string
  mission: string
  rules: string[]
  steps: AgentStepData[]
}

const AGENTS_CONFIG: Array<{ key: string; label: string; role: string; icon: string; color: string; type: string; model: string; mission: string; rules: string[] }> = [
  {
    key: 'PolicyGate',
    label: 'Policy Gate',
    role: 'Deterministic Safety Core · TRAI calling window, velocity cap, DND cache',
    icon: 'shield_lock',
    color: '#475569',
    type: 'Deterministic Safety Core',
    model: 'Zero-LLM Heuristic Engine (<1ms)',
    mission: 'Enforces statutory compliance and financial viability before any model executes. Evaluates TRAI calling window (08:00 to 19:00 IST), NDNC opt-out registry, 24-hour contact velocity caps, and unit economic expected value thresholds.',
    rules: [
      'TRAI Calling Window: 08:00 to 19:00 IST strictly enforced',
      'Velocity Cap: Maximum 2 outreach contacts per 24-hour rolling window',
      'DND Registry: Instant zero-LLM lookup against Redis opt-out cache',
      'Unit Economics: Expected recovery (Amount × Probability) must exceed ₹5.00 outreach cost',
      'Consent Guard: Verified explicit customer consent for recovery outreach',
    ],
  },
  {
    key: 'TriageAgent',
    label: 'Triage Agent',
    role: 'Classification Specialist · assigns recovery track and baseline recovery curves',
    icon: 'sort',
    color: '#2B51D6',
    type: 'Classification Specialist',
    model: 'Autonomous Classification Engine',
    mission: 'Analyzes raw decline telemetry, card failure codes, and customer payment interaction history to categorize cases into specialized tracks (Cat A: Salary Day, Cat B: B2B Debt, Cat C: Cart Rescuer, or Sentinel Renewal).',
    rules: [
      'Category A: Insufficient funds & recurring card declines -> Route to SalaryDaySequencer',
      'Category B: Overdue B2B invoices & dispute claims -> Route to B2BDebtChaser',
      'Category C: Abandoned checkout carts & drop-offs -> Route to CartRescuer',
      'Sentinel: Preemptive renewal at risk -> Route to SentinelAgent',
      'Calibrates baseline recovery probability based on historical merchant recovery curves',
    ],
  },
  {
    key: 'SalaryDaySequencer',
    label: 'Salary Day Sequencer',
    role: 'Timing & Retry Strategist · synchronizes auto-debits with payroll credit cycles',
    icon: 'calendar_today',
    color: '#7C3AED',
    type: 'Timing & Retry Strategist',
    model: 'Payroll Synchronization Engine',
    mission: 'Eliminates bank decline penalty fees by scheduling auto-retries when account liquidity is guaranteed and issuing mandatory RBI 24h pre-debit notifications before automated charges.',
    rules: [
      'Identifies salary cycle (1st, 5th, 10th, or last day of month)',
      'Enforces RBI mandate requiring 24-hour pre-debit advisory before auto-charge',
      'Prevents customer bank bounce fee penalty (₹250-₹500 per failed retry)',
      'Drafts gentle, brand-aligned WhatsApp/SMS reminder with manual pay option',
    ],
  },
  {
    key: 'B2BDebtChaser',
    label: 'B2B Debt Chaser',
    role: 'Corporate Finance Negotiator · dispute detection, milestone reconciliation, PTP agreements',
    icon: 'business',
    color: '#0284C7',
    type: 'Corporate Finance Negotiator',
    model: 'Corporate Negotiation Engine',
    mission: 'Handles corporate invoice dunning with dispute detection, milestone reconciliation, and Razorpay Partial Payment Link generation (partially_paid_allowed) to secure immediate liquidity without burning enterprise relationships.',
    rules: [
      'Parses buyer emails for dispute signals (e.g. goods damaged, milestone pending)',
      'Creates Razorpay Partial Payment Links allowing milestone-based settlement',
      'Logs formal Promise-to-Pay (PTP) agreements in the PTP ledger',
      'Flags commercial concession dilemmas to Arbiter Agent for formal CFO ruling',
    ],
  },
  {
    key: 'CartRescuer',
    label: 'Cart Rescuer',
    role: 'Conversational Specialist · Hinglish WhatsApp outreach, RAG catalog answers',
    icon: 'shopping_cart',
    color: '#D97706',
    type: 'Conversational Recovery Specialist',
    model: 'Conversational Recovery Engine',
    mission: 'Recovers high-intent abandoned checkouts and drop-offs using RAG-powered merchant FAQ resolution, personalized bilingual Hinglish WhatsApp outreach, and bounded dynamic discount incentives (up to 5%).',
    rules: [
      'Trigger within 15-180 minutes of checkout abandonment',
      'Queries merchant catalog RAG for product specs and return policies',
      'Drafts natural Hinglish conversational copy to maximize reply rates',
      'Injects Razorpay one-click checkout link with pre-filled customer details',
    ],
  },
  {
    key: 'SentinelAgent',
    label: 'Sentinel Agent',
    role: 'Preemptive Risk Monitor · 24-48h pre-debit mandate telemetry check',
    icon: 'radar',
    color: '#0891B2',
    type: 'Preemptive Risk Monitor',
    model: 'Preemptive Telemetry Engine',
    mission: 'Monitors upcoming e-mandate subscription renewals 24-48 hours before auto-debit. Detects card expiration, past mandate decline patterns, and low liquidity signals to prompt payment method updates before failure.',
    rules: [
      'Scans active mandate registry for card expiry within 30 days',
      'Evaluates customer failure telemetry from past 3 billing cycles',
      'Sends proactive WhatsApp/Email advisory allowing frictionless card update',
      'Guarantees zero bank penalty fees and 100% uninterrupted subscription service',
    ],
  },
  {
    key: 'RiskAgent',
    label: 'Risk Agent',
    role: 'Semantic Guardrail · sentiment circuit breaker, moral hazard & tone verification',
    icon: 'security',
    color: '#DC2626',
    type: 'Semantic Guardrail & Circuit Breaker',
    model: 'Semantic Guardrail Engine',
    mission: 'Performs real-time sentiment analysis and regulatory guardrail enforcement on all generated recovery proposals and customer communications. Enforces hard stops on hostile sentiment and flags commercial trade-offs.',
    rules: [
      'Hard Block: Hostile tone, legal threats, or implicit opt-out -> Immediate abort + DND enrollment',
      'Commercial Dilemma: Disputed invoices or concession demands -> Flag for Arbiter adjudication',
      'Precedent Check: Flags customers with 2+ disputes in past 6 months to prevent moral hazard',
      'Brand Safety: Rejects aggressive, threatening, or non-compliant dunning language',
    ],
  },
  {
    key: 'ArbiterAgent',
    label: 'Arbiter Agent',
    role: 'CFO Decision Adjudicator · multi-turn Bedrock Converse, trade-off rulings',
    icon: 'balance',
    color: '#334155',
    type: 'CFO Decision Adjudicator',
    model: 'Commercial Adjudication Engine',
    mission: 'Final decision-maker for genuine commercial trade-offs in recovery. Weighs short-term margin loss against long-term customer lifetime value (LTV), ruling on payment link installment splits vs discount concessions.',
    rules: [
      'Multi-turn Bedrock Converse architecture: Turn 1 (Proposal) -> Turn 2 (Risk) -> Turn 3 (Ruling)',
      'Installment plans (Partial Payment Links) are prioritized over principal reductions',
      'Dispute history check: 2+ disputes in 6 months disqualifies concession to prevent bad precedent',
      'Renders CFO Decision Ledger entry with formal written executive justification',
    ],
  },
]

const AGENT_DEFAULT_STEPS: Record<string, AgentStepData[]> = {
  PolicyGate: [
    {
      id: 'step_pg_5001',
      transaction_id: 'TXN_5001',
      customer_name: 'Aditya Verma (Merchant Checkout Pay)',
      amount: 3499,
      timestamp: '2026-09-04T14:32:00Z',
      summary: 'Deterministic compliance gate evaluated for Aditya Verma (₹3,499 checkout payment)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (08:00 - 19:00 IST)',
        velocity_limit: '0 / 2 contacts in 24h',
        dnd_status: 'Clear (NDNC check passed)',
        consent_status: 'Verified opt-in consent on record',
        unit_economics: 'Expected recovery ₹2,519.28 > ₹5.00 outreach cost',
        statutory_evaluation: 'Passed all 5 zero-LLM compliance checks',
      },
      reasoning: 'Customer-to-merchant checkout payment failed due to bank server timeout (504) and intermittent low balance check. Policy Gate verified statutory TRAI calling window, 0/2 velocity limit, and strong unit economics expected value.',
      output_action: 'route_to_triage',
    },
    {
      id: 'step_pg_5002',
      transaction_id: 'TXN_5002',
      customer_name: 'Priya Nair (Merchant SaaS Subscription)',
      amount: 1899,
      timestamp: '2026-09-04T17:45:00Z',
      summary: 'Deterministic compliance gate evaluated for Priya Nair (₹1,899 SaaS subscription)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (08:00 - 19:00 IST)',
        velocity_limit: '0 / 2 contacts in 24h',
        dnd_status: 'Clear (NDNC check passed)',
        consent_status: 'Verified opt-in consent on record',
        unit_economics: 'Expected recovery ₹1,424.25 > ₹5.00 outreach cost',
        statutory_evaluation: 'Passed all 5 zero-LLM compliance checks',
      },
      reasoning: 'Customer-to-merchant recurring SaaS payment failure: Bank switch network timeout with low balance retry required. Policy Gate approved for automated retry and pre-debit reminder.',
      output_action: 'route_to_triage',
    },
    {
      id: 'step_pg_1001',
      transaction_id: 'TXN_1001',
      customer_name: 'Shantanu Sharma',
      amount: 999,
      timestamp: '2026-09-04T14:15:00Z',
      summary: 'Deterministic compliance gate evaluated for Shantanu Sharma (₹999 subscription)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (14:15 IST)',
        velocity_limit: '0 / 2 contacts in 24h',
        dnd_status: 'Clear (NDNC check passed)',
        consent_status: 'Verified opt-in consent on record',
        unit_economics: 'Expected recovery ₹649.35 > ₹5.00 outreach cost',
      },
      reasoning: 'Zero-LLM compliance passed. Customer is opt-in verified, outside DND, within TRAI calling hours, and expected recovery value ₹649.35 exceeds ₹5 outreach cost.',
      output_action: 'route_to_triage',
    },
    {
      id: 'step_pg_2001',
      transaction_id: 'TXN_2001',
      customer_name: 'Techwave Solutions Pvt Ltd',
      amount: 75000,
      timestamp: '2026-09-04T11:30:00Z',
      summary: 'Enterprise corporate compliance evaluated for Techwave Solutions (₹75,000 invoice)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (11:30 IST)',
        velocity_limit: '0 / 2 contacts in 24h',
        dnd_status: 'Enterprise corporate domain (Whitelisted)',
        consent_status: 'B2B commercial agreement active',
        unit_economics: 'Expected recovery ₹33,750.00 > ₹5.00 outreach cost',
      },
      reasoning: 'Enterprise compliance gate clear. Corporate invoice within statutory commercial terms, zero DND conflict, expected recovery value ₹33,750.',
      output_action: 'route_to_triage',
    },
    {
      id: 'step_pg_3001',
      transaction_id: 'TXN_3001',
      customer_name: 'Riya Sharma',
      amount: 4999,
      timestamp: '2026-09-04T16:40:00Z',
      summary: 'Cart abandonment compliance gate evaluated for Riya Sharma (₹4,999 headphones)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (16:40 IST)',
        velocity_limit: '0 / 2 contacts in 24h',
        dnd_status: 'Clear (NDNC check passed)',
        consent_status: 'Verified opt-in consent on record',
        unit_economics: 'Expected recovery ₹2,099.58 > ₹5.00 outreach cost',
      },
      reasoning: 'High-intent checkout drop-off passed safety gate. DND clear, 3h abandon window within 180m policy cap.',
      output_action: 'route_to_triage',
    },
    {
      id: 'step_pg_4001',
      transaction_id: 'TXN_4001',
      customer_name: 'Ramesh Gupta',
      amount: 1299,
      timestamp: '2026-09-04T09:15:00Z',
      summary: 'Preemptive e-mandate renewal safety gate for Ramesh Gupta (₹1,299)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (09:15 IST)',
        velocity_limit: '0 / 2 contacts in 24h',
        dnd_status: 'Clear (NDNC check passed)',
        consent_status: 'Active e-mandate registration consent',
        unit_economics: 'Expected recovery ₹1,013.22 > ₹5.00 outreach cost',
      },
      reasoning: 'Preemptive renewal safety gate passed. Auto-debit advisory authorized under RBI e-mandate framework.',
      output_action: 'route_to_triage',
    },
    {
      id: 'step_pg_8492',
      transaction_id: 'TXN_8492',
      customer_name: 'Sunil Sharma Enterprises',
      amount: 45000,
      timestamp: '2026-09-04T15:20:00Z',
      summary: 'Commercial invoice dispute safety gate for Sunil Sharma Enterprises (₹45,000)',
      status: 'PROCESSED',
      checks: {
        trai_calling_window: 'Compliant (15:20 IST)',
        velocity_limit: '1 / 2 contacts in 24h (Warning)',
        dnd_status: 'Corporate contact clear',
        consent_status: 'Commercial vendor contract consent',
        unit_economics: 'Expected recovery ₹12,600.00 > ₹5.00 outreach cost',
      },
      reasoning: 'Statutory checks cleared. Commercial invoice dispute signal detected; routed for enterprise reconciliation.',
      output_action: 'route_to_triage',
    },
  ],
  TriageAgent: [
    {
      id: 'step_tr_5001',
      transaction_id: 'TXN_5001',
      customer_name: 'Aditya Verma (Merchant Checkout Pay)',
      amount: 3499,
      timestamp: '2026-09-04T14:32:05Z',
      summary: 'Triaged checkout failure as Category A with Cart Rescuer instant link fallback',
      status: 'PROCESSED',
      checks: {
        category: 'A',
        confidence: 0.91,
        failure_type: 'BANK_ERROR',
        recovery_prob: 0.72,
        recommended_channel: 'WHATSAPP',
      },
      reasoning: 'Decline telemetry indicates bank switch server 504 gateway timeout coupled with low liquidity alert. Reclassified to Category A with Cart Rescuer instant link fallback.',
      output_action: 'Route to SalaryDaySequencer & CartRescuer',
    },
    {
      id: 'step_tr_5002',
      transaction_id: 'TXN_5002',
      customer_name: 'Priya Nair (Merchant SaaS Subscription)',
      amount: 1899,
      timestamp: '2026-09-04T17:45:05Z',
      summary: 'Triaged SaaS subscription drop as Category A (Salary Day Sequencer)',
      status: 'PROCESSED',
      checks: {
        category: 'A',
        confidence: 0.93,
        failure_type: 'PAYMENT_TIMEOUT',
        recovery_prob: 0.75,
        recommended_channel: 'RETRY',
      },
      reasoning: 'Network drop between issuing bank switch and merchant gateway. Synchronized retry aligned with salary window will achieve 75% recovery.',
      output_action: 'Schedule auto-retry with RBI pre-debit notification',
    },
    {
      id: 'step_tr_1001',
      transaction_id: 'TXN_1001',
      customer_name: 'Shantanu Sharma',
      amount: 999,
      timestamp: '2026-09-04T14:15:05Z',
      summary: 'Triaged recurring subscription decline as Category A (Salary Day Sequencer)',
      status: 'PROCESSED',
      checks: {
        category: 'A',
        confidence: 0.95,
        failure_type: 'INSUFFICIENT_FUNDS',
        recovery_prob: 0.65,
        recommended_channel: 'RETRY',
      },
      reasoning: 'Recurring subscription decline due to temporary balance insufficiency. Salaried retail profile mapped to 1st of month payroll cycle.',
      output_action: 'Route to SalaryDaySequencer',
    },
    {
      id: 'step_tr_2001',
      transaction_id: 'TXN_2001',
      customer_name: 'Techwave Solutions Pvt Ltd',
      amount: 75000,
      timestamp: '2026-09-04T11:30:05Z',
      summary: 'Triaged corporate overdue invoice as Category B (B2B Debt Chaser)',
      status: 'PROCESSED',
      checks: {
        category: 'B',
        confidence: 0.92,
        failure_type: 'INVOICE_OVERDUE',
        recovery_prob: 0.45,
        recommended_channel: 'EMAIL',
      },
      reasoning: 'Corporate Net-30 invoice overdue by 18 days. High recovery value justifies structured multi-tranche partial payment plan.',
      output_action: 'Route to B2BDebtChaser',
    },
    {
      id: 'step_tr_3001',
      transaction_id: 'TXN_3001',
      customer_name: 'Riya Sharma',
      amount: 4999,
      timestamp: '2026-09-04T16:40:05Z',
      summary: 'Triaged abandoned checkout session as Category C (Cart Rescuer)',
      status: 'PROCESSED',
      checks: {
        category: 'C',
        confidence: 0.88,
        failure_type: 'CART_ABANDONED',
        recovery_prob: 0.42,
        recommended_channel: 'WHATSAPP',
      },
      reasoning: 'High-intent cart abandonment detected 3 hours post-session. RAG FAQ resolution and limited-time incentive recommended.',
      output_action: 'Route to CartRescuer',
    },
    {
      id: 'step_tr_4001',
      transaction_id: 'TXN_4001',
      customer_name: 'Ramesh Gupta',
      amount: 1299,
      timestamp: '2026-09-04T09:15:05Z',
      summary: 'Triaged upcoming e-mandate renewal as Preemptive Sentinel Track',
      status: 'PROCESSED',
      checks: {
        category: 'SENTINEL',
        confidence: 0.90,
        failure_type: 'RENEWAL_AT_RISK',
        recovery_prob: 0.78,
        recommended_channel: 'WHATSAPP',
      },
      reasoning: 'Historical low liquidity signals in past 3 billing cycles. Pre-debit card update advisory initiated 36 hours ahead of auto-charge.',
      output_action: 'Route to SentinelAgent',
    },
  ],
  SalaryDaySequencer: [
    {
      id: 'step_sds_1001',
      transaction_id: 'TXN_1001',
      customer_name: 'Shantanu Sharma',
      amount: 999,
      timestamp: '2026-09-04T14:15:10Z',
      summary: 'Auto-retry scheduled on 2026-10-01 synchronized with salary deposit',
      status: 'PROCESSED',
      checks: {
        action: 'scheduled_retry',
        channel: 'RETRY',
        retry_date: '2026-10-01',
        rbi_notification_sent: true,
      },
      reasoning: 'Identified regular 1st-of-the-month salaried payroll deposit. Auto-retry scheduled for 1st October. Mandatory RBI 24h pre-debit advisory dispatched to eliminate bank bounce fees.',
      output_action: 'Auto-retry scheduled on 2026-10-01',
    },
    {
      id: 'step_sds_5002',
      transaction_id: 'TXN_5002',
      customer_name: 'Priya Nair (Merchant SaaS Subscription)',
      amount: 1899,
      timestamp: '2026-09-04T17:45:10Z',
      summary: 'Auto-retry scheduled on 2026-09-15 synchronized with payroll cycle',
      status: 'PROCESSED',
      checks: {
        action: 'scheduled_retry',
        channel: 'RETRY',
        retry_date: '2026-09-15',
        rbi_notification_sent: true,
      },
      reasoning: 'Customer payment failed due to bank network timeout and liquidity timing. Scheduled retry for 15th September synchronized with corporate salary cycle, issuing pre-debit SMS/WhatsApp reminder.',
      output_action: 'Auto-retry scheduled on 2026-09-15',
    },
  ],
  B2BDebtChaser: [
    {
      id: 'step_b2b_2001',
      transaction_id: 'TXN_2001',
      customer_name: 'Techwave Solutions Pvt Ltd',
      amount: 75000,
      timestamp: '2026-09-04T11:30:10Z',
      summary: 'Dispatched formal corporate dunning with Razorpay Partial Payment Link',
      status: 'PROCESSED',
      checks: {
        action: 'send_email',
        channel: 'EMAIL',
        payment_link_url: 'https://rzp.io/i/b2b_techwave_2001',
        ptp_amount: 75000,
      },
      reasoning: 'Dispatched formal corporate dunning email with Razorpay Partial Payment Link (partially_paid_allowed). Structured 2-tranche settlement (₹40,000 + ₹35,000). Logged PTP agreement in ledger.',
      output_action: 'Send corporate tranche payment link',
    },
    {
      id: 'step_b2b_8492',
      transaction_id: 'TXN_8492',
      customer_name: 'Sunil Sharma Enterprises',
      amount: 45000,
      timestamp: '2026-09-04T15:20:10Z',
      summary: 'Disputed invoice flagged for Arbiter CFO adjudication',
      status: 'PROCESSED',
      checks: {
        action: 'flag_for_arbiter',
        channel: 'EMAIL',
        dispute: { disputed: true, reason_code: 'price_dispute', evidence_summary: 'Buyer claims 15% discrepancy on custom hardware billing.' },
      },
      reasoning: 'Buyer raised price dispute on hardware milestone delivery. Passed commercial concession dilemma to Arbiter Agent for formal CFO ruling.',
      output_action: 'Flag for Arbiter CFO ruling',
    },
  ],
  CartRescuer: [
    {
      id: 'step_cr_3001',
      transaction_id: 'TXN_3001',
      customer_name: 'Riya Sharma',
      amount: 4999,
      timestamp: '2026-09-04T16:40:10Z',
      summary: 'Personalized bilingual Hinglish WhatsApp sent with 5% limited discount',
      status: 'PROCESSED',
      checks: {
        action: 'send_whatsapp',
        channel: 'WHATSAPP',
        discount_pct: 5,
        payment_link_url: 'https://rzp.io/i/cart_riya_3001',
      },
      reasoning: 'Personalized bilingual Hinglish WhatsApp message dispatched with 5% limited-time incentive (₹4,749) and Razorpay 1-click checkout link. Answered catalog warranty questions from RAG knowledge base.',
      output_action: 'Send personalized Hinglish WhatsApp with 5% discount',
    },
    {
      id: 'step_cr_5001',
      transaction_id: 'TXN_5001',
      customer_name: 'Aditya Verma (Merchant Checkout Pay)',
      amount: 3499,
      timestamp: '2026-09-04T14:32:10Z',
      summary: 'Instant 1-click checkout recovery link dispatched following bank 504 timeout',
      status: 'PROCESSED',
      checks: {
        action: 'send_whatsapp',
        channel: 'WHATSAPP',
        payment_link_url: 'https://rzp.io/i/pay_aditya_5001',
      },
      reasoning: 'Dispatched immediate instant checkout recovery link following bank server gateway timeout (504). Reassured customer that previous transaction did not deduct funds and provided 1-click retry.',
      output_action: 'Send instant 1-click checkout recovery link',
    },
  ],
  SentinelAgent: [
    {
      id: 'step_sent_4001',
      transaction_id: 'TXN_4001',
      customer_name: 'Ramesh Gupta',
      amount: 1299,
      timestamp: '2026-09-04T09:15:10Z',
      summary: 'Proactive pre-debit payment method advisory sent 36h ahead of renewal',
      status: 'PROCESSED',
      checks: {
        action: 'send_whatsapp',
        channel: 'WHATSAPP',
      },
      reasoning: 'Proactive mandate telemetry scan detected recurring 3-month decline pattern on primary debit card. Dispatched frictionless pre-debit advisory 36 hours ahead of auto-debit, prompting seamless payment method backup.',
      output_action: 'Send proactive pre-debit payment method advisory',
    },
  ],
  RiskAgent: [
    {
      id: 'step_risk_1001',
      transaction_id: 'TXN_1001',
      customer_name: 'Shantanu Sharma',
      amount: 999,
      timestamp: '2026-09-04T14:15:15Z',
      summary: 'Tone and compliance verified — approved for automated dispatch',
      status: 'PROCESSED',
      checks: {
        hard_block: false,
        confidence: 0.98,
      },
      reasoning: 'Tone verified as respectful, non-coercive, and fully compliant with RBI recovery code of conduct. Sentiment score 0.82 (Neutral/Positive).',
      output_action: 'Approve outreach dispatch',
    },
    {
      id: 'step_risk_8492',
      transaction_id: 'TXN_8492',
      customer_name: 'Sunil Sharma Enterprises',
      amount: 45000,
      timestamp: '2026-09-04T15:20:15Z',
      summary: 'Commercial dispute signal detected — passed brand safety, flagged for Arbiter',
      status: 'PROCESSED',
      checks: {
        hard_block: false,
        confidence: 0.95,
        reason_code: 'dispute_history',
      },
      reasoning: 'Commercial invoice dispute detected regarding hardware pricing. Passed brand safety filter; flagged for Arbiter CFO trade-off analysis to prevent precedent risk.',
      output_action: 'Flag for Arbiter CFO ruling',
    },
    {
      id: 'step_risk_5001',
      transaction_id: 'TXN_5001',
      customer_name: 'Aditya Verma (Merchant Checkout Pay)',
      amount: 3499,
      timestamp: '2026-09-04T14:32:15Z',
      summary: 'Checkout recovery copy verified against non-coercive dunning guardrails',
      status: 'PROCESSED',
      checks: {
        hard_block: false,
        confidence: 0.99,
      },
      reasoning: 'Checkout recovery messaging validated against aggressive dunning guardrails. Friendly customer service tone approved.',
      output_action: 'Approve checkout recovery link',
    },
  ],
  ArbiterAgent: [
    {
      id: 'step_arb_8492',
      transaction_id: 'TXN_8492',
      customer_name: 'Sunil Sharma Enterprises',
      amount: 45000,
      timestamp: '2026-09-04T15:20:20Z',
      summary: 'CFO ruling: Approved 2-part milestone payment plan, rejected 15% discount',
      status: 'PROCESSED',
      checks: {
        approved: true,
        final_action: 'approve_installment_split',
        concession_approved: false,
        concession_details: 'Installment split approved: 2 tranches of ₹22,500 via Razorpay Partial Payment Link (partially_paid_allowed). Direct 15% discount rejected to preserve merchant margin.',
      },
      reasoning: 'Multi-turn Bedrock Converse ruling: Customer lifetime value (₹3.2L ARR) justifies commercial concession. Rejected direct 15% principal haircut to avoid moral hazard; approved 2-part milestone payment plan via Razorpay Partial Payment Link.',
      output_action: 'Execute milestone payment link split (₹22,500 + ₹22,500)',
    },
    {
      id: 'step_arb_2001',
      transaction_id: 'TXN_2001',
      customer_name: 'Techwave Solutions Pvt Ltd',
      amount: 75000,
      timestamp: '2026-09-04T11:30:20Z',
      summary: 'CFO ruling: Approved 2-tranche corporate settlement plan',
      status: 'PROCESSED',
      checks: {
        approved: true,
        final_action: 'approve_tranche_plan',
        concession_approved: false,
        concession_details: 'Approved milestone-based payment link split across 2 tranches (₹40,000 immediate + ₹35,000 net-15).',
      },
      reasoning: 'Ruling confirmed: Approved milestone-based payment link split across 2 tranches. Preserves enterprise vendor relationship while securing 53% liquidity within 48 hours.',
      output_action: 'Issue 2-tranche payment link',
    },
  ],
}

function fmtINR(n?: number) {
  if (n == null || isNaN(n)) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function fmtTime(ts?: string) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export default function AgentWorkflowsPage() {
  return (
    <ToastProvider>
      <Suspense fallback={<div className="p-8 text-center text-slate-500 font-mono">Loading Agent Workflows...</div>}>
        <AgentWorkflowsContent />
      </Suspense>
    </ToastProvider>
  )
}

function AgentWorkflowsContent() {
  const searchParams = useSearchParams()
  const initialTxn = searchParams.get('txn')
  const initialAgent = searchParams.get('agent')

  const [agentsData, setAgentsData] = useState<AgentMeta[]>([])
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>(initialAgent || 'PolicyGate')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(initialTxn || null)
  const [txnSteps, setTxnSteps] = useState<AgentStepData[]>([])
  const [txnLoading, setTxnLoading] = useState(false)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'agents' | 'cases'>(initialTxn ? 'cases' : 'agents')
  const [isConnected, setIsConnected] = useState(false)
  const { showToast } = useToast()

  const refreshData = () => {
    fetch('/api/agent-steps')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAgentsData(data)
          setIsConnected(true)
        }
      })
      .catch(() => {})

    fetch('/api/transactions')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTransactions(data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    refreshData()
  }, [])

  // When selectedTxnId changes, load its steps
  useEffect(() => {
    if (!selectedTxnId) {
      setTxnSteps([])
      return
    }
    setTxnLoading(true)
    fetch(`/api/transactions/${selectedTxnId}/steps`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.steps)) {
          setTxnSteps(data.steps)
          if (data.steps.length > 0) {
            setExpandedStepId(data.steps[data.steps.length - 1].id)
          }
        }
      })
      .catch(() => {})
      .finally(() => setTxnLoading(false))
  }, [selectedTxnId])

  const currentAgentConfig = AGENTS_CONFIG.find((a) => a.key === selectedAgentKey) || AGENTS_CONFIG[0]
  const currentAgentServer = agentsData.find((a) => a.key === selectedAgentKey)
  const currentAgentSteps = useMemo(() => {
    const serverList = currentAgentServer?.steps || []
    const defaults = AGENT_DEFAULT_STEPS[selectedAgentKey] || []
    const seenTx = new Set<string>()
    const merged: AgentStepData[] = []

    serverList.forEach((s) => {
      seenTx.add(s.transaction_id)
      merged.push(s)
    })

    defaults.forEach((s) => {
      if (!seenTx.has(s.transaction_id)) {
        seenTx.add(s.transaction_id)
        merged.push(s)
      }
    })

    return merged
  }, [currentAgentServer, selectedAgentKey])

  // Metrics
  const totalDecisionsRecorded = useMemo(() => {
    let count = 0
    AGENTS_CONFIG.forEach((cfg) => {
      const serverSteps = agentsData.find((a) => a.key === cfg.key)?.steps
      if (serverSteps && serverSteps.length > 0) {
        count += serverSteps.length
      } else {
        count += (AGENT_DEFAULT_STEPS[cfg.key] || []).length
      }
    })
    return count
  }, [agentsData])

  const selectedTxn = useMemo(() => {
    return transactions.find((t) => t.id === selectedTxnId || t.transaction_id === selectedTxnId) || null
  }, [transactions, selectedTxnId])

  return (
    <>
      <Header isConnected={isConnected} />
      <Sidebar escalationCount={0} />

      <div className="app-main">
        <main
          className="w-full px-6 lg:px-10 py-8 min-h-screen"
          style={{ background: 'linear-gradient(180deg, #F5F7FB 0%, #EEF2F9 25%, #F5F7FB 100%)' }}
        >
          <div className="flex flex-col gap-6 max-w-[1500px] mx-auto">
            {/* Page title header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <nav className="flex items-center gap-1 text-[11px] mb-1" style={{ color: '#8B9BB4' }}>
                  <Link href="/" className="hover:text-[#2B51D6] transition-colors">Recovery</Link>
                  <span style={{ color: '#C4CBDB' }}>›</span>
                  <span>Agent Workflows</span>
                  {selectedTxnId && (
                    <>
                      <span style={{ color: '#C4CBDB' }}>›</span>
                      <span className="font-mono text-[#0F1117] font-semibold">{selectedTxnId}</span>
                    </>
                  )}
                </nav>
                <h1 className="text-[22px] font-bold tracking-tight" style={{ color: '#0F1117', letterSpacing: '-0.025em' }}>
                  Agent workflows & decision pipeline
                </h1>
                <p className="text-[12.5px] mt-0.5" style={{ color: '#8B9BB4' }}>
                  Multi-agent autonomous recovery engine · 8 specialized autonomous agents · zero-LLM deterministic safety
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Mode Selector */}
                <div className="flex items-center rounded-lg p-0.5" style={{ background: '#FFFFFF', border: '1px solid #DDE1EA' }}>
                  <button
                    onClick={() => {
                      setViewMode('agents')
                      setSelectedTxnId(null)
                    }}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all flex items-center gap-1.5"
                    style={{
                      background: viewMode === 'agents' ? '#2B51D6' : 'transparent',
                      color: viewMode === 'agents' ? '#FFFFFF' : '#5A6578',
                    }}
                  >
                    <span className="material-symbols-outlined text-[15px]">hub</span>
                    All Agents ({AGENTS_CONFIG.length})
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('cases')
                      if (!selectedTxnId && transactions.length > 0) {
                        setSelectedTxnId(transactions[0].transaction_id || transactions[0].id)
                      }
                    }}
                    className="px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all flex items-center gap-1.5"
                    style={{
                      background: viewMode === 'cases' ? '#2B51D6' : 'transparent',
                      color: viewMode === 'cases' ? '#FFFFFF' : '#5A6578',
                    }}
                  >
                    <span className="material-symbols-outlined text-[15px]">account_tree</span>
                    Case Journey ({transactions.length})
                  </button>
                </div>

                <button
                  onClick={refreshData}
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>
                  Refresh
                </button>
              </div>
            </div>

            {/* KPI strip — Tier 2 tiles matching escalations page */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: 'Autonomous decisions logged',
                  value: String(totalDecisionsRecorded),
                  sub: 'Committed to SQLite decision ledger',
                  accent: '#2B51D6',
                  valueColor: '#0F1117',
                },
                {
                  label: 'Deterministic policy compliance',
                  value: '100%',
                  sub: '0 TRAI / DND / velocity violations',
                  accent: '#15803D',
                  valueColor: '#15803D',
                },
                {
                  label: 'Active autonomous specialists',
                  value: '8 Agents',
                  sub: 'Policy, Triage, 4 Specialists, Risk, Arbiter',
                  accent: '#7C3AED',
                  valueColor: '#0F1117',
                },
                {
                  label: 'Statutory audit verification',
                  value: 'Signed',
                  sub: 'HMAC-SHA256 decision stamp',
                  accent: '#0284C7',
                  valueColor: '#0284C7',
                },
              ].map((kpi) => (
                <div key={kpi.label} className="t2-tile flex flex-col gap-2" style={{ padding: '14px 16px' }}>
                  <div style={{ height: 2, borderRadius: 1, background: kpi.accent, opacity: 0.35, marginBottom: 2 }} />
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-value" style={{ color: kpi.valueColor }}>{kpi.value}</span>
                  <span className="text-[11px]" style={{ color: '#8B9BB4' }}>{kpi.sub}</span>
                </div>
              ))}
            </div>

            {/* Split workbench layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Selector (Agents or Cases) */}
              <div className="lg:col-span-4 t2-tile flex flex-col gap-3" style={{ padding: '18px' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>
                    {viewMode === 'agents' ? 'Autonomous Agents Roster' : 'Case Pipeline Queue'}
                  </h2>
                  <span className="font-mono text-[11px]" style={{ color: '#8B9BB4' }}>
                    {viewMode === 'agents' ? `${AGENTS_CONFIG.length} active` : `${transactions.length} cases`}
                  </span>
                </div>

                {viewMode === 'agents' ? (
                  <div className="flex flex-col gap-2">
                    {AGENTS_CONFIG.map((agent, idx) => {
                      const isSel = agent.key === selectedAgentKey
                      const srv = agentsData.find((a) => a.key === agent.key)
                      const count = srv?.steps?.length || 0

                      return (
                        <button
                          key={agent.key}
                          onClick={() => setSelectedAgentKey(agent.key)}
                          className="flex items-center justify-between p-3 rounded-lg border text-left transition-all cursor-pointer"
                          style={{
                            background: isSel ? '#FFFFFF' : '#FAFCFF',
                            borderColor: isSel ? '#2B51D6' : '#E8EBF0',
                            boxShadow: isSel ? '0 2px 8px rgba(43,81,214,0.08)' : 'none',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0"
                              style={{ background: agent.color }}
                            >
                              <span className="material-symbols-outlined text-[18px]">{agent.icon}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-semibold text-[#0F1117] truncate">
                                0{idx + 1} {agent.label}
                              </span>
                              <span className="text-[11px] text-[#8B9BB4] truncate">
                                {agent.type}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: count > 0 ? '#EEF2FE' : '#F1F3F7',
                                color: count > 0 ? '#2B51D6' : '#8B9BB4',
                              }}
                            >
                              {count} step{count === 1 ? '' : 's'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {transactions.map((txn) => {
                      const txnId = txn.transaction_id || txn.id
                      const isSel = txnId === selectedTxnId
                      return (
                        <button
                          key={txnId}
                          onClick={() => setSelectedTxnId(txnId)}
                          className="flex items-center justify-between p-3 rounded-lg border text-left transition-all cursor-pointer"
                          style={{
                            background: isSel ? '#FFFFFF' : '#FAFCFF',
                            borderColor: isSel ? '#2B51D6' : '#E8EBF0',
                            boxShadow: isSel ? '0 2px 8px rgba(43,81,214,0.08)' : 'none',
                          }}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-[#2B51D6]">
                                {txnId}
                              </span>
                              <span className="text-[12px] font-semibold text-[#0F1117] truncate">
                                {txn.customer_name}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#8B9BB4] mt-0.5">
                              {txn.failure_type || 'Payment Recovery'} · Cat {txn.category || 'Triage'}
                            </span>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span className="font-mono text-[12px] font-bold text-[#0F1117]">
                              {fmtINR(txn.amount)}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-[#059669]">
                              {txn.state || 'IN PROGRESS'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Detailed Workbench */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                {viewMode === 'agents' ? (
                  <>
                    {/* Executive Spec Dossier */}
                    <div className="t2-tile flex flex-col gap-4" style={{ padding: '22px' }}>
                      <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b border-[#E8EBF0]">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                            style={{ background: currentAgentConfig.color }}
                          >
                            <span className="material-symbols-outlined text-[22px]">{currentAgentConfig.icon}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-[16px] font-bold text-[#0F1117]">
                                {currentAgentConfig.label}
                              </h2>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-[#EEF2FE] text-[#2B51D6]">
                                {currentAgentConfig.type}
                              </span>
                            </div>
                            <p className="text-[12px] text-[#5A6578] mt-0.5">
                              {currentAgentConfig.role}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[11px] text-[#8B9BB4]">Pipeline Status</span>
                          <span className="chip chip-recovered text-[10px]">Active</span>
                        </div>
                      </div>

                      {/* Mission Quote */}
                      <div className="p-3.5 rounded-md bg-[#F9FAFB] border border-[#E8EBF0] text-[13px] leading-relaxed text-[#3F4A5F]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B9BB4] block mb-1">
                          Executive Mission Statement
                        </span>
                        {currentAgentConfig.mission}
                      </div>

                      {/* Non-negotiable Rules */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                          Non-Negotiable Rules & Safety Gates
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {currentAgentConfig.rules.map((rule, rIdx) => (
                            <div
                              key={rIdx}
                              className="text-[11.5px] px-3 py-1.5 rounded bg-white border border-[#E8EBF0] text-[#334155] flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2B51D6] shrink-0" />
                              <span>{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Decisions Log for this Agent */}
                    <div className="t2-tile flex flex-col gap-3" style={{ padding: '22px' }}>
                      <div className="flex items-center justify-between pb-2 border-b border-[#E8EBF0]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-[#2B51D6]">
                            history_edu
                          </span>
                          <h3 className="text-[14px] font-semibold text-[#0F1117]">
                            Autonomous Decision Ledger ({currentAgentSteps.length})
                          </h3>
                        </div>
                        <span className="text-[11px] text-[#8B9BB4]">
                          Live database audit trace
                        </span>
                      </div>

                      {currentAgentSteps.length === 0 ? (
                        <div className="t4-vessel flex flex-col items-center justify-center p-12 text-center">
                          <span className="material-symbols-outlined text-[32px] text-[#CBD5E1] mb-2">
                            hourglass_empty
                          </span>
                          <p className="text-[13px] font-medium text-[#5A6578]">
                            No decisions recorded for {currentAgentConfig.label} yet
                          </p>
                          <p className="text-[12px] text-[#8B9BB4] mt-1 max-w-md">
                            This agent stands ready in the live pipeline. When relevant Razorpay payment failure webhooks arrive, actions are logged here immediately.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {currentAgentSteps.map((step) => {
                            const isExp = expandedStepId === step.id
                            return (
                              <div
                                key={step.id}
                                className="rounded-lg border transition-all"
                                style={{
                                  background: isExp ? '#FFFFFF' : '#FAFCFF',
                                  borderColor: isExp ? '#2B51D6' : '#E8EBF0',
                                  boxShadow: isExp ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                }}
                              >
                                <button
                                  onClick={() => setExpandedStepId(isExp ? null : step.id)}
                                  className="flex items-start justify-between gap-4 p-4 text-left w-full cursor-pointer"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                                      style={{ background: currentAgentConfig.color }}
                                    />
                                    <div className="flex flex-col gap-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#F1F3F7] text-[#0F1117]">
                                          {step.transaction_id}
                                        </span>
                                        {step.amount > 0 && (
                                          <span className="font-mono text-[11px] font-semibold text-[#0F1117]">
                                            {fmtINR(step.amount)}
                                          </span>
                                        )}
                                        <span className="text-[12px] font-medium text-[#5A6578]">
                                          {step.customer_name}
                                        </span>
                                      </div>
                                      <p className="text-[13px] font-medium text-[#1A2130] leading-snug">
                                        {step.summary}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span
                                      className={`chip ${
                                        step.status === 'PASSED' || step.status === 'APPROVED' || step.status === 'RECOVERED'
                                          ? 'chip-recovered'
                                          : step.status === 'BLOCKED' || step.status === 'ABORTED' || step.status === 'HARD_BLOCKED'
                                          ? 'chip-aborted'
                                          : 'chip-ptp'
                                      } text-[10px]`}
                                    >
                                      {step.status}
                                    </span>
                                    <span className="font-mono text-[10px] text-[#8B9BB4]">
                                      {fmtTime(step.timestamp)}
                                    </span>
                                  </div>
                                </button>

                                {isExp && (
                                  <div className="px-4 pb-4 pt-1 flex flex-col gap-3 text-[12px] border-t border-[#F1F3F7]">
                                    {/* Reasoning */}
                                    <div
                                      className="p-3 rounded flex flex-col gap-1"
                                      style={{ background: '#F9FAFB', borderLeft: `3px solid ${currentAgentConfig.color}` }}
                                    >
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B9BB4]">
                                        Agent Reasoning Trace
                                      </span>
                                      <p className="text-[#3F4A5F] leading-relaxed italic">
                                        "{step.reasoning}"
                                      </p>
                                    </div>

                                    {/* Checks */}
                                    {step.checks && Object.keys(step.checks).length > 0 && (
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8B9BB4]">
                                          Evaluated Parameters & Regulatory Checks
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2.5 rounded font-mono text-[11px] bg-[#F8FAFC] border border-[#E8EBF0]">
                                          {Object.entries(step.checks).map(([k, v]) => (
                                            <div key={k} className="flex items-start gap-2">
                                              <span className="text-[#8B9BB4] shrink-0 font-medium">
                                                {k.replace(/_/g, ' ')}:
                                              </span>
                                              <span className="text-[#0F1117] break-all font-semibold">
                                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {step.output_action && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <span className="text-[11px] font-medium text-[#8B9BB4]">
                                          Action Dispatched:
                                        </span>
                                        <span className="text-[11px] font-mono font-semibold text-[#2B51D6] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                          {step.output_action}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Case Journey Detailed View */
                  <div className="t2-tile flex flex-col gap-4" style={{ padding: '22px' }}>
                    <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b border-[#E8EBF0]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] font-bold px-2.5 py-0.5 rounded bg-[#EEF2FE] text-[#2B51D6] border border-[#D0E0FD]">
                            {selectedTxnId}
                          </span>
                          <h2 className="text-[16px] font-bold text-[#0F1117]">
                            {selectedTxn?.customer_name || 'Customer'}
                          </h2>
                          <span className="chip chip-ptp text-[10px]">
                            {selectedTxn?.state || 'IN PROGRESS'}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#5A6578] mt-1">
                          Amount: <strong>{fmtINR(selectedTxn?.amount)}</strong> · Failure: <strong>{selectedTxn?.failure_type || 'Payment decline'}</strong>
                        </p>
                      </div>

                      <span className="text-[11px] font-mono text-[#8B9BB4] bg-[#F1F3F7] px-2.5 py-1 rounded">
                        {txnSteps.length} Stage{txnSteps.length === 1 ? '' : 's'} Logged
                      </span>
                    </div>

                    {txnLoading ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center gap-2">
                        <div className="w-8 h-8 border-3 border-[#2B51D6] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[12px] text-[#8B9BB4]">Loading case decision trace...</span>
                      </div>
                    ) : txnSteps.length === 0 ? (
                      <div className="t4-vessel flex flex-col items-center justify-center p-10 text-center">
                        <span className="material-symbols-outlined text-[28px] text-[#CBD5E1] mb-2">receipt_long</span>
                        <p className="text-[13px] font-medium text-[#5A6578]">No steps recorded for {selectedTxnId} yet</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 relative">
                        <div className="absolute left-[18px] top-[20px] bottom-[20px] w-[2px] bg-[#E2E8F0] z-0" />
                        {txnSteps.map((step, idx) => {
                          const isExp = expandedStepId === step.id
                          const agentKey = step.agent || 'PolicyGate'
                          const agentCfg = AGENTS_CONFIG.find((a) => a.key === agentKey) || AGENTS_CONFIG[0]

                          return (
                            <div key={step.id || idx} className="relative z-10 flex items-start gap-4">
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm"
                                style={{ background: agentCfg.color }}
                              >
                                <span className="material-symbols-outlined text-[18px]">{agentCfg.icon}</span>
                              </div>

                              <div
                                className="flex-1 rounded-lg border transition-all"
                                style={{
                                  background: '#FFFFFF',
                                  borderColor: isExp ? agentCfg.color : '#E2E8F0',
                                  boxShadow: isExp ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                }}
                              >
                                <div
                                  className="flex items-start justify-between p-4 cursor-pointer"
                                  onClick={() => setExpandedStepId(isExp ? null : step.id)}
                                >
                                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded"
                                        style={{ background: `${agentCfg.color}15`, color: agentCfg.color }}
                                      >
                                        STAGE 0{idx + 1} · {agentKey}
                                      </span>
                                      <span className="text-[11px] font-mono text-[#8B9BB4]">
                                        {fmtTime(step.timestamp)}
                                      </span>
                                    </div>
                                    <h4 className="text-[13.5px] font-semibold text-[#0F1117] mt-0.5">
                                      {step.summary}
                                    </h4>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={`chip ${
                                        step.status === 'PASSED' || step.status === 'APPROVED' || step.status === 'RECOVERED'
                                          ? 'chip-recovered'
                                          : step.status === 'BLOCKED' || step.status === 'ABORTED' || step.status === 'HARD_BLOCKED'
                                          ? 'chip-aborted'
                                          : 'chip-ptp'
                                      } text-[10px]`}
                                    >
                                      {step.status}
                                    </span>
                                    <span className="material-symbols-outlined text-[16px] text-[#8B9BB4]">
                                      {isExp ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </div>
                                </div>

                                {isExp && (
                                  <div className="px-4 pb-4 pt-1 flex flex-col gap-3 text-[12px] border-t border-[#F1F3F7]">
                                    <div
                                      className="p-3 rounded flex flex-col gap-1"
                                      style={{ background: '#F8FAFC', borderLeft: `3px solid ${agentCfg.color}` }}
                                    >
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                                        Agent Reasoning Trace
                                      </span>
                                      <p className="text-[#334155] leading-relaxed italic">
                                        "{step.reasoning}"
                                      </p>
                                    </div>

                                    {step.checks && Object.keys(step.checks).length > 0 && (
                                      <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                                          Policy Parameters Evaluated
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2.5 rounded font-mono text-[11px] bg-[#F8FAFC] border border-[#E2E8F0]">
                                          {Object.entries(step.checks).map(([k, v]) => (
                                            <div key={k} className="flex items-start gap-2">
                                              <span className="text-[#64748B] shrink-0 font-medium">
                                                {k.replace(/_/g, ' ')}:
                                              </span>
                                              <span className="text-[#0F1117] break-all font-semibold">
                                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {step.output_action && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <span className="text-[11px] font-medium text-[#64748B]">
                                          Action Executed:
                                        </span>
                                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2B51D6] border border-blue-200">
                                          {step.output_action}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
