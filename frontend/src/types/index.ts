export type TransactionState =
  | 'DETECTED'
  | 'TRIAGED'
  | 'INTERVENTION_PLANNED'
  | 'OUTREACH_SENT'
  | 'CUSTOMER_REPLIED'
  | 'NEGOTIATING'
  | 'PTP_LOGGED'
  | 'RECOVERED'
  | 'ESCALATED'
  | 'ABORTED'
  | 'WRITTEN_OFF'

export type TransactionCategory = 'A' | 'B' | 'C' | 'SENTINEL'
export type Channel = 'WHATSAPP' | 'EMAIL' | 'VOICE' | 'RETRY' | 'NONE'

export interface Transaction {
  id: string
  merchant_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  amount: number
  failure_type: string
  state: TransactionState
  state_version: number
  category: TransactionCategory | null
  recovery_prob: number
  channel: Channel
  days_overdue: number
  prior_contact_count: number
  has_consent: boolean
  is_preemptive: boolean
  is_live_demo_row: boolean
  payment_link_url: string | null
  abort_reason: string | null
  extra: string
  created_at: string
  updated_at: string
}

export interface Decision {
  id: string
  transaction_id: string
  agent: string
  input_summary: string
  output_json: string
  hard_block: boolean
  timestamp: string
}

export interface StateTransition {
  id: string
  transaction_id: string
  from_state: TransactionState | null
  to_state: TransactionState
  agent: string
  reasoning: string
  timestamp: string
}

export interface Escalation {
  id: string
  transaction_id: string
  customer_name: string
  amount: number
  reason: string
  context_summary: string
  status: 'open' | 'resolved'
  created_at: string
  days_overdue: number
}

export interface RecoveryStats {
  merchant_id: string
  total_transactions: number
  total_at_risk: number
  total_recovered: number
  count_recovered: number
  count_aborted: number
  count_written_off: number
  count_escalated: number
  ai_cost_inr: number
  roi_multiple: number
}

export interface WSEvent {
  type: 'audit_row' | 'state_change' | 'counter_update' | 'decision_ledger' | 'recovery_confirmed' | 'escalation' | 'ping'
  transaction_id?: string
  merchant_id?: string
  customer_name?: string
  amount?: number
  state?: TransactionState
  category?: TransactionCategory
  agent?: string
  message?: string
  timestamp?: string
  outcome?: string
  abort_reason?: string
  stats?: RecoveryStats
  proposal?: Record<string, unknown>
  risk_verdict?: Record<string, unknown>
  arbiter_ruling?: Record<string, unknown>
  payment_link_url?: string
  amount_recovered?: number
  channel?: string
  escalation_id?: string
  context_summary?: string
}

export interface ChartData {
  hours: string[]
  ai_recovered: number[]
  standard_dunning: number[]
  lift_pct: number
  total_recovered: number
  updated_at: string
}

export interface UpcomingRenewal {
  transaction_id: string
  customer_name: string
  amount: number
  days_overdue: number
  charge_at: string
  subscription_id: string
}
