'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Transaction } from '@/types'
import { Header } from '@/components/recovery/Header'
import { Sidebar } from '@/components/recovery/Sidebar'
import { ToastProvider, useToast } from '@/components/recovery/ToastContext'

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const CALENDAR_DAYS = [
  { d: '30', prev: true },
  { d: '31', tag: 'Notice batch', tagColor: '#2B51D6', cellBg: '#EEF2FE', sub: 'Pre-debit notice', subMono: 'SMS + WhatsApp' },
  { d: '01', tag: 'MNC / Tech',   tagColor: '#0F1117', cellBg: '#EEF2FE', sub: '₹4.80 L', subMono: '3,120 debits' },
  { d: '02', tag: 'PSU / Corp',   tagColor: '#3F4A5F', cellBg: '#F1F3F7', sub: '₹3.20 L', subMono: '2,410 debits' },
  { d: '03', tag: 'Mid-market',   tagColor: '#3F4A5F', cellBg: '#F1F3F7', sub: '₹2.65 L', subMono: '1,820 debits' },
  { d: '04', tag: 'Tier-2 / Govt',tagColor: '#5A6578', cellBg: '#F9FAFB', sub: '₹1.95 L', subMono: '1,210 debits' },
  { d: '05', tag: 'Sweep batch',  tagColor: '#15803D', cellBg: '#F0FDF4', sub: '₹1.68 L', subMono: '940 debits' },
]

const RETRY_RULES = [
  { trigger: 'T − 48h', cohort: 'Tier-1 corporate payroll', lead: '48h compliant', leadColor: '#2B51D6', channel: 'WhatsApp + SMS', gate: 'Instant auto-charge' },
  { trigger: 'T − 24h', cohort: 'PSU & SME subscribers',   lead: '24h minimum',   leadColor: '#2B51D6', channel: 'Email + in-app',  gate: 'Auto-charge primed' },
  { trigger: 'T+0 09:00 IST', cohort: 'General subscriptions', lead: 'Post-notice gate', leadColor: '#5A6578', channel: 'Pre-debit SMS',   gate: 'Secondary bank routing' },
]

const COMPLIANCE_CARDS = [
  {
    icon: 'notifications_active',
    title: '24h–48h notice window',
    value: '0 lapses',
    valueColor: '#15803D',
    desc: 'Mandatory notification before debit. Charges auto-held if the window has not elapsed.',
    stats: [{ label: 'Statutory lapses', value: '0 incidents' }, { label: 'Audited batches', value: '14,820 / 14,820' }],
  },
  {
    icon: 'link',
    title: '1-click opt-out',
    value: 'Zero-hop URL',
    valueColor: '#2B51D6',
    desc: 'Every pre-debit message carries a unique link to pause, modify, or revoke the mandate immediately.',
    stats: [{ label: 'Opt-out friction', value: 'Zero hops' }, { label: 'Chargeback shield', value: '99.8%' }],
  },
  {
    icon: 'block',
    title: 'Max 3 retries',
    value: '318 protected',
    valueColor: '#D97706',
    desc: 'Automated debit stops after 3 consecutive failures to prevent penal bounce charges from retail banks.',
    stats: [{ label: 'Subscribers protected', value: '318 this cycle' }, { label: 'Fallback', value: 'WhatsApp partial link' }],
  },
]

function SubscriptionsContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    fetch('/api/demo/transactions')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTransactions(data) })
      .catch(() => {})
    fetch('/api/demo/stats').then(r => { setIsConnected(r.ok) }).catch(() => {})
  }, [])

  const sentinelFeed = transactions.filter(t =>
    t.category === 'SENTINEL' || t.category === 'A' || t.failure_type === 'RECURRING_DEBIT_FAILURE'
  )

  const totalMandates = transactions.length
  const totalAmount   = transactions.reduce((s, t) => s + (t.amount ?? 0), 0)
  const recovered     = transactions.filter(t => t.state === 'RECOVERED')
  const successRate   = totalMandates > 0 ? ((recovered.length / totalMandates) * 100).toFixed(1) : '0.0'

  const riskLabel = (txn: Transaction) => {
    const p = txn.recovery_prob ?? 0.5
    if (p < 0.3) return { label: `${Math.round((1-p)*100)}% low balance`,   color: '#D97706' }
    if (p < 0.6) return { label: `${Math.round((1-p)*100)}% high traffic`,  color: '#B91C1C' }
    if (p < 0.8) return { label: `${Math.round((1-p)*100)}% token invalid`, color: '#B91C1C' }
    return           { label: `${Math.round((1-p)*100)}% late credit`,       color: '#5A6578' }
  }

  const actionLabel = (txn: Transaction) => {
    if (txn.state === 'RECOVERED')  return { label: 'Completed',            color: '#15803D' }
    if (txn.state === 'PTP_LOGGED') return { label: 'Pre-debit dispatched', color: '#2B51D6' }
    if (txn.state === 'ABORTED')    return { label: 'Rescheduled',          color: '#D97706' }
    if (txn.state === 'ESCALATED')  return { label: 'Card refreshed',       color: '#15803D' }
    return                                 { label: 'Rescheduled',          color: '#D97706' }
  }

  return (
    <>
      <Header isConnected={isConnected} />
      <Sidebar escalationCount={0} />

      <div className="layout-main">
        <main className="w-full px-6 py-6 min-h-screen" style={{ background: '#F1F3F7' }}>
          <div className="flex flex-col gap-6 max-w-[1400px]">

            {/* Page title */}
            <div className="flex items-baseline justify-between">
              <div>
                <nav className="flex items-center gap-1 text-[11px] mb-1" style={{ color: '#8B9BB4' }}>
                  <Link href="/" className="hover:text-[#2B51D6] transition-colors">Recovery</Link>
                  <span style={{ color: '#C4CBDB' }}>›</span>
                  <span>Subscriptions</span>
                </nav>
                <h1 className="text-[20px] font-bold tracking-tight" style={{ color: '#0F1117', letterSpacing: '-0.025em' }}>
                  Subscriptions & e-mandates
                </h1>
                <p className="text-[12px] mt-1" style={{ color: '#8B9BB4' }}>
                  Salary-cycle retry orchestration · pre-debit compliance · sentinel forecast
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary text-[12px]">
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export CSV
                </button>
                <button
                  onClick={() => showToast('Batch queued', 'Salary cluster pre-debit batch scheduled for execution')}
                  className="btn-primary text-[12px]"
                >
                  <span className="material-symbols-outlined text-[14px]">play_circle</span>
                  Run pre-debit batch
                </button>
              </div>
            </div>

            {/* KPI strip — Tier 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'e-Mandates monitored', value: totalMandates > 0 ? totalMandates.toLocaleString('en-IN') : '—', sub: totalAmount > 0 ? `${fmt(totalAmount)} portfolio` : 'No mandates loaded', accent: '#2B51D6' },
                { label: 'Pre-debit success rate', value: `${successRate}%`, sub: `Predicted: ${(parseFloat(successRate) + 1.8).toFixed(1)}%`, accent: '#15803D' },
                { label: 'Salary cluster yield', value: totalAmount > 0 ? `₹${(totalAmount/100000).toFixed(2)} L` : '₹0 L', sub: 'Recovered 1st–5th window', accent: '#2B51D6' },
                { label: 'RBI compliance SLA', value: '100.0%', sub: '0 statutory lapses', accent: '#15803D' },
              ].map((kpi) => (
                <div key={kpi.label} className="t2-tile flex flex-col gap-2" style={{ padding: '14px 16px' }}>
                  <div style={{ height: 2, borderRadius: 1, background: kpi.accent, opacity: 0.35, marginBottom: 2 }} />
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-value">{kpi.value}</span>
                  <span className="text-[11px]" style={{ color: '#8B9BB4' }}>{kpi.sub}</span>
                </div>
              ))}
            </div>

            {/* Salary-cycle calendar — Tier 2 */}
            <div className="t2-tile flex flex-col gap-4" style={{ padding: '18px 20px' }}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Salary-cycle retry orchestration</h2>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
                    Settlement windows aligned to institutional payroll schedules (1st–5th of every month)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                    <span className="w-3 h-3 rounded inline-block" style={{ background: '#EEF2FE', border: '1px solid #C4CEFC' }} /> Notice
                    <span className="w-3 h-3 rounded inline-block ml-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }} /> Sweep
                    <span className="w-3 h-3 rounded inline-block ml-2" style={{ background: '#F9FAFB', border: '1px solid #DDE1EA' }} /> Standard
                  </div>
                  <div
                    className="flex items-center gap-1 font-mono text-[11px]"
                    style={{ background: '#F9FAFB', border: '1px solid #DDE1EA', borderRadius: 4, padding: '4px 10px' }}
                  >
                    <button style={{ color: '#8B9BB4' }}>‹</button>
                    <span className="font-semibold px-2" style={{ color: '#0F1117' }}>April 2025</span>
                    <button style={{ color: '#8B9BB4' }}>›</button>
                  </div>
                </div>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-center font-mono text-[10px] py-1.5" style={{ color: '#8B9BB4', background: '#F9FAFB', borderRadius: 3, border: '1px solid #E8EBF0' }}>
                    {d}
                  </div>
                ))}
                {CALENDAR_DAYS.map((day, i) => (
                  <div
                    key={i}
                    className="min-h-[72px] flex flex-col justify-between"
                    style={{
                      padding: '8px',
                      borderRadius: 4,
                      border: `1px solid ${day.prev ? '#E8EBF0' : '#DDE1EA'}`,
                      background: day.prev ? '#FAFAFA' : (day.cellBg ?? '#FFFFFF'),
                      opacity: day.prev ? 0.4 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold" style={{ color: day.tag ? '#0F1117' : '#C4CBDB' }}>{day.d}</span>
                      {day.tag && (
                        <span
                          className="font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: day.tagColor + '18', color: day.tagColor, border: `1px solid ${day.tagColor}30` }}
                        >
                          {day.tag}
                        </span>
                      )}
                    </div>
                    {day.sub && (
                      <div>
                        <p className="font-semibold text-[11px] leading-tight" style={{ color: '#0F1117' }}>{day.sub}</p>
                        <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>{day.subMono}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Retry rules table */}
              <div style={{ borderTop: '1px solid #E8EBF0', paddingTop: 16 }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-semibold" style={{ color: '#0F1117' }}>Retry orchestration rules</span>
                  <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>Fallback: NPCI NACH + UPI Autopay v2</span>
                </div>
                <div className="overflow-x-auto" style={{ border: '1px solid #DDE1EA', borderRadius: 4 }}>
                  <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #DDE1EA' }}>
                        {['Trigger', 'Cohort', 'Lead time', 'Channel', 'Gate', ''].map(h => (
                          <th key={h} className="font-mono text-[10px] font-semibold" style={{ padding: '8px 14px', color: '#8B9BB4' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {RETRY_RULES.map((rule) => (
                        <tr key={rule.trigger} style={{ borderBottom: '1px solid #F1F3F7' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="font-mono font-bold text-[11px]" style={{ padding: '10px 14px', color: '#0F1117' }}>{rule.trigger}</td>
                          <td className="font-medium text-[12px]" style={{ padding: '10px 14px', color: '#3F4A5F' }}>{rule.cohort}</td>
                          <td className="font-mono font-bold text-[11px]" style={{ padding: '10px 14px', color: rule.leadColor }}>{rule.lead}</td>
                          <td className="text-[12px]" style={{ padding: '10px 14px', color: '#5A6578' }}>{rule.channel}</td>
                          <td className="font-mono text-[11px]" style={{ padding: '10px 14px', color: '#8B9BB4' }}>{rule.gate}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <button className="btn-secondary text-[11px]" style={{ padding: '3px 8px' }}>Configure</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sentinel feed — Tier 2 */}
            <div className="t2-tile flex flex-col gap-4" style={{ padding: '18px 20px' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px]" style={{ color: '#B45309', fontVariationSettings: "'FILL' 1" }}>radar</span>
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Sentinel preemptive feed</h3>
                    <p className="text-[11px]" style={{ color: '#8B9BB4' }}>High bounce-probability mandates flagged 48h before trigger</p>
                  </div>
                </div>
                <select
                  className="font-mono text-[11px] focus:outline-none transition-colors"
                  style={{ padding: '5px 10px', background: '#F9FAFB', border: '1px solid #DDE1EA', borderRadius: 4, color: '#5A6578' }}
                >
                  <option>All risk levels</option>
                  <option>High risk</option>
                  <option>Medium risk</option>
                  <option>Low risk</option>
                </select>
              </div>

              <div className="overflow-x-auto" style={{ border: '1px solid #DDE1EA', borderRadius: 4 }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #DDE1EA' }}>
                      {['Mandate', 'Subscriber', 'Amount', 'Risk signal', 'Preemptive action', 'Status', ''].map(h => (
                        <th key={h} className="font-mono text-[10px] font-semibold" style={{ padding: '8px 14px', color: '#8B9BB4' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sentinelFeed.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-[12px]" style={{ color: '#8B9BB4' }}>
                          No preemptive events — load a batch on the recovery console
                        </td>
                      </tr>
                    ) : (
                      sentinelFeed.map((txn) => {
                        const risk   = riskLabel(txn)
                        const action = actionLabel(txn)
                        return (
                          <tr key={txn.id} style={{ borderBottom: '1px solid #F1F3F7' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '10px 14px' }}>
                              <span className="font-mono text-[11px] font-semibold" style={{ color: '#2B51D6' }}>{txn.id?.slice(0, 10)}</span>
                              <span className="font-mono text-[10px] block" style={{ color: '#C4CBDB' }}>{txn.channel} AutoPay</span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="font-medium text-[12px] block" style={{ color: '#0F1117' }}>{txn.customer_name}</span>
                              <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>{txn.failure_type?.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="font-mono font-bold text-right text-[12px]" style={{ padding: '10px 14px', color: '#0F1117', fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(txn.amount)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="font-mono text-[10px] font-semibold" style={{ color: risk.color }}>{risk.label}</span>
                            </td>
                            <td className="text-[12px]" style={{ padding: '10px 14px', color: '#5A6578' }}>
                              {txn.state === 'PTP_LOGGED' ? 'Shifted to salary window' : txn.state === 'RECOVERED' ? 'Completed auto-debit' : 'Rerouted via clearing'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span className="font-mono text-[11px] font-semibold" style={{ color: action.color }}>{action.label}</span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <button
                                className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                                style={{ background: '#F9FAFB', border: '1px solid #DDE1EA', color: '#8B9BB4' }}
                              >
                                <span className="material-symbols-outlined text-[13px]">more_vert</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RBI Compliance — Tier 2, 3 cols */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>RBI statutory compliance gate</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
                    Enforcing RBI/2020-21/74 · pre-debit notifications · retry limits
                  </p>
                </div>
                <span className="chip chip-recovered">Active</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COMPLIANCE_CARDS.map((card) => (
                  <div key={card.title} className="t2-tile flex flex-col gap-3" style={{ padding: '16px 18px' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[15px]" style={{ color: '#5A6578', fontVariationSettings: "'FILL' 0" }}>
                          {card.icon}
                        </span>
                        <span className="text-[12px] font-semibold" style={{ color: '#0F1117' }}>{card.title}</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold shrink-0" style={{ color: card.valueColor }}>
                        {card.value}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed" style={{ color: '#5A6578' }}>{card.desc}</p>

                    <div className="flex flex-col gap-1.5" style={{ paddingTop: 10, borderTop: '1px solid #E8EBF0' }}>
                      {card.stats.map((s) => (
                        <div key={s.label} className="flex items-center justify-between">
                          <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>{s.label}</span>
                          <span className="font-mono text-[10px] font-semibold" style={{ color: '#3F4A5F' }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  )
}

export default function SubscriptionsPage() {
  return (
    <ToastProvider>
      <SubscriptionsContent />
    </ToastProvider>
  )
}
