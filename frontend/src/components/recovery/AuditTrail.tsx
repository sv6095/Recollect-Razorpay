'use client'

import { useState } from 'react'
import type { WSEvent, TransactionState } from '@/types'

interface AuditTrailProps {
  rows: WSEvent[]
  agentFilter: string | null
  searchQuery?: string
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

export function AuditTrail({ rows, agentFilter, searchQuery = '' }: AuditTrailProps) {
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
        {agentFilter && (
          <span className="chip chip-accent">{agentLabel(agentFilter)}</span>
        )}
        <span
          className="ml-auto font-mono text-[11px]"
          style={{ color: '#8B9BB4' }}
        >
          {filtered.length} events
        </span>
      </div>

      {/* Container switches tier based on content */}
      {isEmpty ? (
        // Tier 4: dashed vessel — signals "nothing here yet" distinctly from a data card
        <div
          className="t4-vessel flex flex-col items-center justify-center gap-4"
          style={{ padding: '64px 32px' }}
        >
          {/* No generic eye icon — just purposeful copy */}
          <div style={{ textAlign: 'center' }}>
            <p
              className="text-[13px] font-medium"
              style={{ color: '#5A6578', letterSpacing: '-0.01em' }}
            >
              {q
                ? `No events match "${searchQuery.trim()}"`
                : agentFilter
                ? `No events from ${agentLabel(agentFilter)} yet`
                : 'Waiting for payment events'}
            </p>
            <p
              className="text-[12px] mt-1.5"
              style={{ color: '#8B9BB4', lineHeight: 1.6 }}
            >
              {q
                ? 'Try a different transaction ID, agent name, or message fragment'
                : agentFilter
                ? 'This agent has not processed any transactions in the current session'
                : 'Agent decisions appear here in real time as Razorpay webhook events arrive'}
            </p>
          </div>
          {/* Monospaced placeholder that reads as "system idle" */}
          <div
            className="font-mono text-[10px] px-3 py-1.5 rounded"
            style={{
              color: '#C4CBDB',
              border: '1px solid #E8EBF0',
              background: '#F9FAFB',
              letterSpacing: '0.05em',
            }}
          >
            awaiting events…
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
                        <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>
                          {row.transaction_id.slice(0, 10)}…
                        </span>
                      )}

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
                      style={{ color: '#5A6578' }}
                    >
                      {row.message ?? '—'}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>
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

                {/* Expanded inline detail — no modal needed */}
                {isExpanded && (
                  <div
                    className="flex flex-col gap-3 text-[12px]"
                    style={{
                      margin: '0 16px 12px 28px',
                      padding: '12px 14px',
                      background: '#F9FAFB',
                      border: '1px solid #E8EBF0',
                      borderRadius: '4px',
                    }}
                  >
                    {row.state && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-28 shrink-0" style={{ color: '#8B9BB4' }}>
                          State after
                        </span>
                        <span className={`${outcomeChipClass(row.state)} text-[10px]`}>
                          {row.state.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {row.category && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-28 shrink-0" style={{ color: '#8B9BB4' }}>Category</span>
                        <span className="font-mono font-semibold text-[11px]" style={{ color: '#2B51D6' }}>
                          {row.category === 'SENTINEL' ? 'Sentinel' : `Category ${row.category}`}
                        </span>
                      </div>
                    )}
                    {row.channel && row.channel !== 'NONE' && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-28 shrink-0" style={{ color: '#8B9BB4' }}>Channel</span>
                        <span className="font-medium" style={{ color: '#0F1117' }}>
                          {row.channel.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {row.abort_reason && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium w-28 shrink-0" style={{ color: '#8B9BB4' }}>Abort reason</span>
                        <span className="font-mono font-medium" style={{ color: '#B91C1C' }}>
                          {row.abort_reason.replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                    {(row.risk_verdict || row.arbiter_ruling) && (
                      <div className="flex flex-col gap-2">
                        {row.risk_verdict && (
                          <div>
                            <span className="font-medium block mb-1" style={{ color: '#8B9BB4' }}>Risk verdict</span>
                            <pre
                              className="font-mono text-[10px] overflow-x-auto"
                              style={{
                                padding: '8px 10px',
                                background: '#FFFFFF',
                                border: '1px solid #E8EBF0',
                                borderRadius: '3px',
                                color: '#5A6578',
                                lineHeight: 1.6,
                              }}
                            >
                              {JSON.stringify(row.risk_verdict, null, 2)}
                            </pre>
                          </div>
                        )}
                        {row.arbiter_ruling && (
                          <div>
                            <span className="font-medium block mb-1" style={{ color: '#8B9BB4' }}>Arbiter ruling</span>
                            <pre
                              className="font-mono text-[10px] overflow-x-auto"
                              style={{
                                padding: '8px 10px',
                                background: '#FFFFFF',
                                border: '1px solid #E8EBF0',
                                borderRadius: '3px',
                                color: '#5A6578',
                                lineHeight: 1.6,
                              }}
                            >
                              {JSON.stringify(row.arbiter_ruling, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="font-medium" style={{ color: '#8B9BB4' }}>Decision</span>
                      <p style={{ color: '#3F4A5F', lineHeight: 1.6 }}>{row.message ?? '—'}</p>
                    </div>
                    {row.transaction_id && (
                      <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #E8EBF0' }}>
                        <span className="font-medium w-28 shrink-0" style={{ color: '#C4CBDB' }}>Transaction</span>
                        <span className="font-mono text-[10px] break-all" style={{ color: '#C4CBDB' }}>
                          {row.transaction_id}
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
    </section>
  )
}
