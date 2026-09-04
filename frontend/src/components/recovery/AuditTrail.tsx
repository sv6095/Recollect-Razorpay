'use client'

import { useState } from 'react'
import type { WSEvent, TransactionState } from '@/types'

interface AuditTrailProps {
  rows: WSEvent[]
  agentFilter: string | null
  searchQuery?: string
  onInspectAgent?: (agentKey: string) => void
}

const AGENT_COLORS: Record<string, string> = {
  orchestrator:        '#8B9BB4',
  PolicyGate:          '#5A6578',
  TriageAgent:         '#2B51D6',
  SalaryDaySequencer:  '#7C3AED',
  B2BDebtChaser:       '#0369A1',
  CartRescuer:         '#D97706',
  SentinelAgent:       '#B45309',
  RiskAgent:           '#B91C1C',
  ArbiterAgent:        '#0F766E',
  system:              '#C4CBDB',
}

const AGENT_LABELS: Record<string, string> = {
  orchestrator:        'Orchestrator',
  PolicyGate:          'Policy Gate',
  TriageAgent:         'Triage',
  SalaryDaySequencer:  'Salary Day Seq.',
  B2BDebtChaser:       'B2B Chaser',
  CartRescuer:         'Cart Rescuer',
  SentinelAgent:       'Sentinel',
  RiskAgent:           'Risk Agent',
  ArbiterAgent:        'Arbiter',
  system:              'System',
}

function outcomeChipClass(state?: TransactionState | string, outcome?: string) {
  const s = (state || outcome || '').toLowerCase().replace(/_/g, '-')
  if (s.includes('recovered'))  return 'chip chip-recovered'
  if (s.includes('ptp'))        return 'chip chip-ptp'
  if (s.includes('escalat'))   return 'chip chip-escalated'
  if (s.includes('abort'))     return 'chip chip-aborted'
  if (s.includes('written'))   return 'chip chip-written'
  if (s.includes('outreach'))  return 'chip chip-negotiating'
  return 'chip chip-default'
}

function outcomeLabel(row: WSEvent): string {
  if (row.type === 'recovery_confirmed') return 'Recovered'
  if (row.state) return row.state.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
  if (row.outcome) return row.outcome.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
  return row.type ?? '—'
}

function agentColor(agent?: string) { return AGENT_COLORS[agent ?? ''] ?? '#C4CBDB' }
function agentLabel(agent?: string) { return AGENT_LABELS[agent ?? ''] ?? agent ?? 'System' }

function fmtTime(ts?: string) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  } catch { return ts }
}

function fmtAmount(n?: number) {
  if (!n) return null
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function AuditTrail({ rows, agentFilter, searchQuery = '', onInspectAgent }: AuditTrailProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const q = searchQuery.trim().toLowerCase()

  const filtered = rows.filter((r) => {
    if (agentFilter && r.agent !== agentFilter) return false
    if (!q) return true
    const haystack = [
      r.transaction_id,
      r.message,
      r.agent,
      r.state,
      r.outcome,
      r.amount != null ? String(r.amount) : '',
    ].join(' ').toLowerCase()
    return haystack.includes(q)
  })

  const toggleExpand = (key: string) => setExpandedId((p) => (p === key ? null : key))

  const isEmpty = filtered.length === 0

  return (
    <section className="flex flex-col">
      {/* Header — sits above the container, not inside a card */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-[14px] font-semibold" style={{ color: '#0F1117' }}>
          Audit trail
        </h2>
        <span className="chip chip-recovered text-[9px]">
          ● LIVE WS
        </span>
        {agentFilter && (
          <span className="chip chip-accent">{agentLabel(agentFilter)}</span>
        )}
        <span
          className="ml-auto font-mono text-[11px]"
          style={{ color: '#8B9BB4' }}
        >
          {filtered.length} live event{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Container switches tier based on content */}
      {isEmpty ? (
        // Tier 4: dashed vessel — signals "nothing here yet" distinctly from a data card
        <div
          className="t4-vessel flex flex-col items-center justify-center gap-4"
          style={{ padding: '64px 32px' }}
        >
          <div style={{ textAlign: 'center' }}>
            <p
              className="text-[13px] font-medium"
              style={{ color: '#5A6578', letterSpacing: '-0.01em' }}
            >
              {q
                ? `No live events match "${searchQuery.trim()}"`
                : agentFilter
                ? `No live events from ${agentLabel(agentFilter)} in this session`
                : 'Real-time payment event stream active'}
            </p>
            <p
              className="text-[12px] mt-1.5"
              style={{ color: '#8B9BB4', lineHeight: 1.6 }}
            >
              {q
                ? 'Try a different transaction ID, agent name, or message fragment'
                : agentFilter
                ? 'This agent will activate automatically when matching failure events arrive'
                : 'Multi-agent execution steps stream here in real time as live Razorpay webhook events arrive'}
            </p>
          </div>
          {/* Monospaced live listening placeholder */}
          <div
            className="flex items-center gap-2 font-mono text-[10px] px-3 py-1.5 rounded"
            style={{
              color: '#2B51D6',
              border: '1px solid #C4CEFC',
              background: '#EEF2FE',
              letterSpacing: '0.04em',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] live-dot" />
            real-time websocket stream active · listening for webhooks
          </div>
        </div>
      ) : (
        // Tier 2: data card when content exists
        <div className="t2-tile flex flex-col">
          {filtered.map((row, idx) => {
            const rowKey    = `${row.transaction_id}-${idx}`
            const isExpanded = expandedId === rowKey
            const dot        = agentColor(row.agent)

            return (
              <div key={rowKey} className="flex flex-col">
                {/* Main row */}
                <button
                  onClick={() => toggleExpand(rowKey)}
                  className="flex items-start gap-3 text-left w-full group transition-colors"
                  style={{ padding: '12px 16px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Timeline dot + connector */}
                  <div className="flex flex-col items-center shrink-0 mt-[5px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: dot }}
                    />
                    {idx < filtered.length - 1 && (
                      <div
                        className="w-px mt-1"
                        style={{ flex: 1, background: '#E8EBF0', minHeight: 16 }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Agent tag */}
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: `${dot}18`, color: dot }}
                      >
                        {agentLabel(row.agent)}
                      </span>

                      {/* Amount */}
                      {row.amount && (
                        <span
                          className="font-mono text-[11px] font-semibold"
                          style={{ color: '#0F1117', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtAmount(row.amount)}
                        </span>
                      )}

                      {/* Txn ID */}
                      {row.transaction_id && (
                        <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                          {row.transaction_id}
                        </span>
                      )}

                      {/* Live tag */}
                      <span className="chip chip-accent text-[9px]">
                        LIVE
                      </span>

                      {/* Outcome chip — right-aligned */}
                      <span
                        className={`${outcomeChipClass(row.state, row.outcome)} text-[10px] ml-auto shrink-0`}
                      >
                        {outcomeLabel(row)}
                      </span>
                    </div>

                    {/* Decision message */}
                    <p
                      className="text-[12px] mt-1 leading-relaxed"
                      style={{ color: '#3F4A5F' }}
                    >
                      {row.message ?? '—'}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                      {fmtTime(row.timestamp)}
                    </span>
                    <span
                      className="material-symbols-outlined text-[13px] transition-colors"
                      style={{ color: isExpanded ? '#2B51D6' : '#DDE1EA' }}
                    >
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </button>

                {/* Expanded Multi-Agent Progression Stepper */}
                {isExpanded && (
                  <div
                    className="flex flex-col gap-4 text-[12px]"
                    style={{
                      margin: '0 16px 14px 28px',
                      padding: '14px 16px',
                      background: '#F9FAFB',
                      border: '1px solid #E8EBF0',
                      borderRadius: '6px',
                    }}
                  >
                    {/* Stepper Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#E8EBF0]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px] text-[#2B51D6]">
                          account_tree
                        </span>
                        <span className="font-semibold text-[#0F1117] text-[12px]">
                          Agent Pipeline Progression Trace
                        </span>
                      </div>
                      {row.agent && onInspectAgent && (
                        <button
                          onClick={() => onInspectAgent(row.agent || 'PolicyGate')}
                          className="text-[11px] font-semibold text-[#2B51D6] hover:underline flex items-center gap-1"
                        >
                          <span>Inspect {agentLabel(row.agent)} in Drawer</span>
                          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                        </button>
                      )}
                    </div>

                    {/* Sequential Multi-Agent Steps */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {/* Step 1: Policy Gate */}
                      <div className="p-2.5 rounded bg-white border border-[#E8EBF0] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-[#5A6578]">
                            01 POLICY GATE
                          </span>
                          <span className={`chip ${row.abort_reason ? 'chip-aborted' : 'chip-recovered'} text-[9px]`}>
                            {row.abort_reason ? 'ABORTED' : 'PASSED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5A6578] mt-0.5">
                          {row.abort_reason
                            ? `Blocked: ${row.abort_reason.replace(/_/g, ' ')}`
                            : 'TRAI hours 8AM-7PM valid, DND registry clear, velocity limit OK'}
                        </p>
                      </div>

                      {/* Step 2: Triage Agent */}
                      <div className="p-2.5 rounded bg-white border border-[#E8EBF0] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-[#2B51D6]">
                            02 TRIAGE AGENT
                          </span>
                          <span className="chip chip-ptp text-[9px]">
                            {row.category ? `CAT ${row.category}` : 'TRIAGED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5A6578] mt-0.5">
                          {row.category === 'A' && 'Category A: Salary Day sequence scheduled'}
                          {row.category === 'B' && 'Category B: Corporate B2B invoice dunning'}
                          {row.category === 'C' && 'Category C: Hinglish cart recovery outreach'}
                          {row.category === 'SENTINEL' && 'Sentinel: Pre-debit mandate renewal'}
                          {!row.category && (row.message || 'Telemetry classified')}
                        </p>
                      </div>

                      {/* Step 3: Risk & Arbiter Governance */}
                      <div className="p-2.5 rounded bg-white border border-[#E8EBF0] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-[#0F766E]">
                            03 GOVERNANCE
                          </span>
                          <span className={`chip ${row.arbiter_ruling ? 'chip-recovered' : 'chip-default'} text-[9px]`}>
                            {row.arbiter_ruling ? 'ARBITER RULED' : 'RISK CHECKED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5A6578] mt-0.5">
                          {row.arbiter_ruling
                            ? 'CFO Decision Ledger entry issued'
                            : row.risk_verdict
                            ? 'Semantic sentiment & guardrails verified'
                            : 'Automated compliance checks completed'}
                        </p>
                      </div>
                    </div>

                    {/* Rich Details */}
                    {(row.risk_verdict || row.arbiter_ruling || row.proposal) && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-[#E8EBF0]">
                        {row.arbiter_ruling && (
                          <div className="p-2.5 rounded bg-white border border-[#E8EBF0] flex flex-col gap-1">
                            <span className="font-mono text-[10px] font-bold text-[#0F766E] uppercase">
                              Arbiter CFO Ruling
                            </span>
                            <pre className="font-mono text-[10px] text-[#3F4A5F] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {JSON.stringify(row.arbiter_ruling, null, 2)}
                            </pre>
                          </div>
                        )}
                        {row.risk_verdict && (
                          <div className="p-2.5 rounded bg-white border border-[#E8EBF0] flex flex-col gap-1">
                            <span className="font-mono text-[10px] font-bold text-[#B91C1C] uppercase">
                              Risk Guardrail Verdict
                            </span>
                            <pre className="font-mono text-[10px] text-[#3F4A5F] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {JSON.stringify(row.risk_verdict, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata summary bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8EBF0] text-[11px] text-[#8B9BB4]">
                      <div className="flex items-center gap-3">
                        {row.channel && row.channel !== 'NONE' && (
                          <span>Channel: <strong className="text-[#0F1117] font-medium">{row.channel}</strong></span>
                        )}
                        {row.payment_link_url && (
                          <span>Razorpay Link: <a href={row.payment_link_url} target="_blank" rel="noopener noreferrer" className="text-[#2B51D6] underline font-mono">{row.payment_link_url}</a></span>
                        )}
                      </div>
                      <span className="font-mono text-[10px]">
                        Txn: {row.transaction_id || 'stream'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
