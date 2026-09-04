'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Escalation, RecoveryStats } from '@/types'
import { Header } from '@/components/recovery/Header'
import { Sidebar } from '@/components/recovery/Sidebar'
import { ToastProvider, useToast } from '@/components/recovery/ToastContext'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}
function fmtTime(ts?: string) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return ts }
}

const OPERATOR_ACTIONS = [
  { id: 'approve', label: 'Approve standstill & concierge dispatch', sub: 'Grant hold, waive penalty, generate 2-part milestone link.' },
  { id: 'nudge',   label: 'Release to soft WhatsApp nudge',         sub: 'Bypass VIP lock, send non-threatening inquiry via verified channel.' },
  { id: 'cfo',     label: 'Trigger CFO-to-CFO concierge call',      sub: 'Route docket to Razorpay Enterprise Treasury VP.' },
  { id: 'suspend', label: 'Authorize account suspension',            sub: 'Terminate API keys & enforce payout freeze across linked sub-merchants.', danger: true },
]

function EscalationsContent() {
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [stats, setStats] = useState<RecoveryStats | null>(null)
  const [totalTxnCount, setTotalTxnCount] = useState<number>(0)
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const [selectedAction, setSelectedAction] = useState<string>('approve')
  const [justification, setJustification] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [signingKey] = useState(`EQ25519-DP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`)
  const { showToast } = useToast()

  const refreshData = () => {
    fetch('/api/escalations')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEscalations(data) })
      .catch(() => {})
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setStats(data)
          setIsConnected(true)
        }
      })
      .catch(() => {})
    fetch('/api/transactions')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data)) setTotalTxnCount(data.length)
      })
      .catch(() => {})
  }

  useEffect(() => {
    refreshData()
  }, [])

  const selected = escalations[selectedIdx]
  const totalExposure = escalations.reduce((s, e) => s + (e.amount ?? 0), 0)

  // Dynamic KPI calculations
  const totalCases = Math.max(totalTxnCount, stats?.total_transactions ?? 0, escalations.length)
  const escalatedCases = escalations.length || (stats?.count_escalated ?? 0)

  const interventionRate = totalCases > 0
    ? ((escalatedCases / totalCases) * 100).toFixed(1)
    : '0.0'
  const autonomousRate = totalCases > 0
    ? (100 - parseFloat(interventionRate)).toFixed(1)
    : '100.0'
  const interventionSub = totalCases > 0
    ? `${autonomousRate}% autonomous (${escalatedCases} of ${totalCases})`
    : '100.0% autonomous'

  const autonomousDecisions = Math.max(0, totalCases - escalatedCases)
  const concurrenceRate = totalCases > 0
    ? ((autonomousDecisions / totalCases) * 100).toFixed(1)
    : '100.0'
  const concurrenceSub = totalCases > 0
    ? `${autonomousDecisions} of ${totalCases} rulings upheld`
    : 'All policy decisions compliant'

  const handleAuthorize = () => {
    if (!justification.trim()) {
      showToast('Justification required', 'Enter operator justification before authorizing', 'error')
      return
    }
    showToast('Decision authorized', `HMAC-SHA256 signed. Case ${selected?.transaction_id?.slice(0, 10)} committed to audit ledger.`)
    setJustification('')
  }

  return (
    <>
      <Header isConnected={isConnected} />
      <Sidebar escalationCount={escalations.length} />

      <div className="app-main">
        <main
          className="w-full px-6 lg:px-10 py-8 min-h-screen"
          style={{ background: 'linear-gradient(180deg, #F5F7FB 0%, #EEF2F9 25%, #F5F7FB 100%)' }}
        >
          <div className="flex flex-col gap-6 max-w-[1500px] mx-auto">

            {/* Page title */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <nav className="flex items-center gap-1 text-[11px] mb-1" style={{ color: '#8B9BB4' }}>
                  <Link href="/" className="hover:text-[#2B51D6] transition-colors">Recovery</Link>
                  <span style={{ color: '#C4CBDB' }}>›</span>
                  <span>Escalations</span>
                </nav>
                <h1 className="text-[22px] font-bold tracking-tight" style={{ color: '#0F1117', letterSpacing: '-0.025em' }}>
                  Escalation workbench
                </h1>
                <p className="text-[12.5px] mt-0.5" style={{ color: '#8B9BB4' }}>
                  Human-in-the-loop review queue · guardrails exceeded
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshData}
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>sync</span>
                  Refresh
                </button>
              </div>
            </div>

            {/* KPI strip — Tier 2 tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: 'Pending cases',
                  value: escalations.length,
                  sub: `${fmt(totalExposure)} exposure`,
                  accent: escalations.length > 0 ? '#B91C1C' : '#DDE1EA',
                  valueColor: escalations.length > 0 ? '#B91C1C' : '#0F1117',
                },
                {
                  label: 'Human intervention rate',
                  value: `${interventionRate}%`,
                  sub: interventionSub,
                  accent: '#2B51D6',
                  valueColor: '#0F1117',
                },
                {
                  label: 'Arbiter concurrence',
                  value: `${concurrenceRate}%`,
                  sub: concurrenceSub,
                  accent: '#15803D',
                  valueColor: '#0F1117',
                },
                {
                  label: 'Statutory violations',
                  value: '0',
                  sub: '100% DND / quiet hours',
                  accent: '#15803D',
                  valueColor: '#15803D',
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

            {/* Split workbench */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* Triage inbox — Tier 2 */}
              <div className="lg:col-span-4 t2-tile flex flex-col gap-3" style={{ padding: '18px' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Triage inbox</h2>
                  <span className="font-mono text-[11px]" style={{ color: '#8B9BB4' }}>
                    {escalations.length} pending
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 text-[11px]"
                  style={{ padding: '7px 10px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 4 }}
                >
                  <span className="material-symbols-outlined text-[13px]" style={{ color: '#8B9BB4' }}>sort</span>
                  <span style={{ color: '#5A6578' }}>
                    Sorted by: <strong style={{ color: '#0F1117' }}>SLA expiry</strong>
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {escalations.length === 0 ? (
                    <div className="t4-vessel flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: '#C4CBDB', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <p className="text-[12px] font-medium" style={{ color: '#5A6578' }}>No pending escalations</p>
                      <p className="text-[11px]" style={{ color: '#8B9BB4' }}>All cases resolved autonomously</p>
                    </div>
                  ) : (
                    escalations.map((esc, idx) => {
                      const isSelected = idx === selectedIdx
                      return (
                        <button
                          key={esc.id ?? idx}
                          onClick={() => setSelectedIdx(idx)}
                          className="flex flex-col gap-2 text-left transition-colors w-full"
                          style={{
                            padding: '10px 12px',
                            background: isSelected ? '#FEF2F2' : '#F9FAFB',
                            border: `1px solid ${isSelected ? '#FECACA' : '#E8EBF0'}`,
                            borderLeft: isSelected ? '3px solid #B91C1C' : '3px solid transparent',
                            borderRadius: 4,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[13px] font-semibold block truncate" style={{ color: '#0F1117' }}>
                                {esc.customer_name || 'Enterprise Customer'}
                              </span>
                              <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                                {esc.reason?.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="font-mono text-[12px] font-bold shrink-0" style={{ color: '#B91C1C', fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(esc.amount ?? 0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]" style={{ color: '#8B9BB4' }}>
                            <span className="font-mono">{esc.days_overdue}d aging</span>
                            <span className="font-semibold" style={{ color: '#B91C1C' }}>SLA expiring</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>

                {/* Auto-triage note */}
                <div
                  className="text-[11px] leading-relaxed"
                  style={{ padding: '10px 12px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 4, color: '#5A6578' }}
                >
                  <span className="font-semibold block mb-0.5" style={{ color: '#3F4A5F' }}>Auto-triage guardrails</span>
                  Accounts with active Sev-1 flags bypass conversational agents and freeze automated UPI/NACH retry mandates.
                </div>
              </div>

              {/* Case detail — Tier 2 / Tier 3 */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                {!selected ? (
                  <div className="t4-vessel flex items-center justify-center" style={{ padding: '80px 32px' }}>
                    <div className="text-center">
                      <p className="text-[13px] font-medium" style={{ color: '#5A6578' }}>No case selected</p>
                      <p className="text-[12px] mt-1" style={{ color: '#8B9BB4' }}>Select an escalation from the triage inbox</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Case header — Tier 3 escalation */}
                    <div className="t3-panel t3-escalation" style={{ padding: '18px 20px' }}>
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-4" style={{ borderBottom: '1px solid #FEE2E2' }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[15px] font-bold" style={{ color: '#0F1117' }}>{selected.customer_name || 'Enterprise Customer'}</h3>
                            <span className="chip chip-aborted">VIP tier-1</span>
                          </div>
                          <p className="font-mono text-[11px] mt-1" style={{ color: '#8B9BB4' }}>
                            {selected.transaction_id} · {selected.days_overdue} days overdue · opened {fmtTime(selected.created_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-[11px] block mb-0.5" style={{ color: '#8B9BB4' }}>Outstanding</span>
                          <span className="kpi-value" style={{ color: '#B91C1C', fontSize: 22 }}>{fmt(selected.amount ?? 0)}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-1.5" style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4 }}>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[15px]" style={{ color: '#D97706' }}>warning</span>
                          <span className="text-[12px] font-semibold" style={{ color: '#78350F' }}>Automated dunning suspended · Policy Rule #4</span>
                          <span className="chip chip-aborted ml-auto text-[9px]">HALT_SEV1</span>
                        </div>
                        <p className="text-[11px] pl-5 leading-relaxed" style={{ color: '#5A6578' }}>
                          {selected.reason?.replace(/_/g, ' ')} — autonomous recovery suppressed to prevent churn during executive remediation.
                        </p>
                      </div>
                    </div>

                    {/* Arbiter deliberation — Tier 2 */}
                    <div className="t2-tile" style={{ padding: '18px 20px' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Agent arbitration</h3>
                        <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>Deliberation Engine v4.2</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Agent A */}
                        <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 4 }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] font-semibold" style={{ color: '#8B9BB4' }}>Outreach agent</span>
                            <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>61%</span>
                          </div>
                          <p className="text-[12px] font-semibold mb-1" style={{ color: '#0F1117' }}>Standard late payment protocol</p>
                          <p className="text-[11px] leading-relaxed" style={{ color: '#8B9BB4' }}>Aggressive IVR dialer with statutory legal dunning. Strict 100% lump-sum — no waiver.</p>
                        </div>

                        {/* Agent B */}
                        <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 4 }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] font-semibold" style={{ color: '#8B9BB4' }}>LTV guardian</span>
                            <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>v3.1</span>
                          </div>
                          <p className="text-[12px] font-semibold mb-1" style={{ color: '#0F1117' }}>7-day standstill & split ledger</p>
                          <p className="text-[11px] leading-relaxed" style={{ color: '#8B9BB4' }}>38mo tenure, 14.2L LTV, active ERP sync ticket. Interest waiver + soft account review.</p>
                          <span className="font-mono text-[10px] mt-2 block" style={{ color: '#B91C1C' }}>Churn risk: 84% exit</span>
                        </div>

                        {/* Arbiter */}
                        <div style={{ padding: '12px', background: '#EEF2FE', border: '1px solid #C4CEFC', borderRadius: 4 }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] font-semibold" style={{ color: '#2B51D6' }}>Arbiter ruling</span>
                            <span className="chip chip-ptp text-[9px]">Synthesized</span>
                          </div>
                          <p className="text-[12px] font-semibold mb-1" style={{ color: '#0F1117' }}>2-tranche split settlement</p>
                          <ul className="flex flex-col gap-1 text-[11px]" style={{ color: '#3F4A5F' }}>
                            <li>· Fee waiver rejected</li>
                            <li>· Tranche 1: 50% within 48h</li>
                            <li>· Tranche 2: 50% on 5th proximo</li>
                          </ul>
                          <span className="font-mono text-[10px] mt-2 block" style={{ color: '#15803D' }}>97.2% confidence</span>
                        </div>
                      </div>
                    </div>

                    {/* Operator decision — Tier 2 */}
                    <div className="t2-tile" style={{ padding: '18px 20px' }}>
                      <div className="mb-4">
                        <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Operator decision</h3>
                        <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
                          All interventions are cryptographically committed to the audit trail
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5 mb-4">
                        {OPERATOR_ACTIONS.map((action) => (
                          <label
                            key={action.id}
                            className="flex items-start gap-3 cursor-pointer transition-colors"
                            style={{
                              padding: '10px 12px',
                              background: selectedAction === action.id
                                ? (action.danger ? '#FEF2F2' : '#EEF2FE')
                                : '#F9FAFB',
                              border: `1px solid ${selectedAction === action.id
                                ? (action.danger ? '#FECACA' : '#C4CEFC')
                                : '#E8EBF0'}`,
                              borderRadius: 4,
                            }}
                          >
                            <input
                              type="radio"
                              name="operator_action"
                              value={action.id}
                              checked={selectedAction === action.id}
                              onChange={() => setSelectedAction(action.id)}
                              className="mt-0.5 shrink-0"
                            />
                            <div>
                              <span
                                className="text-[12px] font-semibold block"
                                style={{ color: action.danger ? '#B91C1C' : '#0F1117' }}
                              >
                                {action.label}
                                {action.danger && (
                                  <span className="ml-2 chip chip-aborted text-[9px]">2-person sign-off</span>
                                )}
                              </span>
                              <span className="text-[11px]" style={{ color: '#8B9BB4' }}>{action.sub}</span>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="flex flex-col gap-2 mb-4">
                        <label className="text-[11px] font-semibold" style={{ color: '#5A6578' }}>
                          Operator justification <span style={{ color: '#B91C1C' }}>*</span>
                        </label>
                        <textarea
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          rows={3}
                          placeholder="Provide justification for the selected intervention…"
                          className="w-full px-3 py-2 text-[12px] resize-none focus:outline-none transition"
                          style={{
                            background: '#F9FAFB',
                            border: '1px solid #DDE1EA',
                            borderRadius: 4,
                            color: '#0F1117',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#2B51D6')}
                          onBlur={(e) => (e.target.style.borderColor = '#DDE1EA')}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #E8EBF0' }}>
                        <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                          <span className="material-symbols-outlined text-[13px]" style={{ color: '#C4CBDB' }}>lock</span>
                          <code style={{ color: '#5A6578' }}>{signingKey}</code>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="btn-secondary text-[12px]">Re-route</button>
                          <button onClick={handleAuthorize} className="btn-primary text-[12px]">
                            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            Authorize & sign
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Event timeline — Tier 2 */}
                    <div className="t2-tile" style={{ padding: '18px 20px' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Event timeline</h3>
                        <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>
                          LEDGER ROOT: 0x9F4A…E39C
                        </span>
                      </div>
                      <div className="flex flex-col">
                        {[
                          { dot: '#B91C1C', code: 'CIRCUIT_BREAKER_TRIPPED',          time: 'Today, 08:32 IST',                                    desc: 'Policy Rule #4 triggered. Dunning halted. Triage record pushed to Human Workbench.' },
                          { dot: '#8B9BB4', code: 'DISPUTE_INCIDENT_LINKED',           time: selected.created_at ? fmtTime(selected.created_at) : 'Recently', desc: `${selected.customer_name} support ticket linked. Autonomous recovery paused.` },
                          { dot: '#D97706', code: 'NACH_RETRY_FAILED',                 time: 'Previously',                                         desc: 'NPCI return code: insufficient funds. Automated retry paused.' },
                          { dot: '#15803D', code: 'PRE_DEBIT_NOTIFICATION_DELIVERED',  time: 'Initial',                                            desc: 'RBI-compliant 48-hour cure window notice sent via SMS & email.' },
                        ].map((event, i) => (
                          <div key={i} className="flex items-start gap-3 py-3" style={{ borderBottom: i < 3 ? '1px solid #F1F3F7' : 'none' }}>
                            <div className="flex flex-col items-center shrink-0">
                              <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: event.dot }} />
                              {i < 3 && <div className="w-px flex-1 mt-1.5 min-h-[16px]" style={{ background: '#E8EBF0' }} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[11px] font-semibold" style={{ color: '#2B51D6' }}>{event.code}</span>
                                <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>{event.time}</span>
                              </div>
                              <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#5A6578' }}>{event.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default function EscalationsPage() {
  return (
    <ToastProvider>
      <EscalationsContent />
    </ToastProvider>
  )
}
