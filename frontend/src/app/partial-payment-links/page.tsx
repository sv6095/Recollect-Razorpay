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
function fmtTime(ts?: string) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) } catch { return ts }
}

function stateChip(state: string) {
  if (state === 'RECOVERED')  return 'chip chip-recovered'
  if (state === 'PTP_LOGGED') return 'chip chip-ptp'
  if (state === 'ESCALATED')  return 'chip chip-escalated'
  if (state === 'ABORTED')    return 'chip chip-aborted'
  return 'chip chip-default'
}

function PartialPaymentContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [featured, setFeatured] = useState<Transaction | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'recovered' | 'escalated'>('all')
  const [isConnected, setIsConnected] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    fetch('/api/demo/transactions')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTransactions(data)
          setFeatured(data.find((t: Transaction) => t.payment_link_url) ?? data[0] ?? null)
        }
      })
      .catch(() => {})
    fetch('/api/demo/stats').then(r => { setIsConnected(r.ok) }).catch(() => {})
  }, [])

  const activeLinkCount   = transactions.filter(t => t.payment_link_url).length
  const totalPipeline     = transactions.reduce((s, t) => s + (t.amount ?? 0), 0)
  const recovered         = transactions.filter(t => t.state === 'RECOVERED')
  const conversionRate    = transactions.length > 0 ? ((recovered.length / transactions.length) * 100).toFixed(1) : '0.0'

  const filteredRows = transactions.filter(t => {
    if (activeTab === 'recovered') return t.state === 'RECOVERED'
    if (activeTab === 'escalated') return t.state === 'ESCALATED'
    return true
  })

  const guardrails = [
    {
      title: '24h–48h notice window',
      value: '0 lapses',
      valueColor: '#15803D',
      desc: 'Mandatory statutory notification before debit. Charges auto-held if window has not elapsed.',
      mono: '14,820 / 14,820 audited batches',
    },
    {
      title: '1-click opt-out',
      value: 'Zero-hop URL',
      valueColor: '#2B51D6',
      desc: 'Every pre-debit message carries a verified unique link to pause, modify, or revoke the underlying mandate.',
      mono: '99.8% chargeback shield',
    },
    {
      title: 'Max 3 retries',
      value: '318 protected',
      valueColor: '#D97706',
      desc: 'Automated debit ceases after 3 consecutive failures to prevent penal bounce charges from retail banks.',
      mono: 'Fallback: WhatsApp partial link',
    },
  ]

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
                  <span>Payment links</span>
                </nav>
                <h1 className="text-[20px] font-bold tracking-tight" style={{ color: '#0F1117', letterSpacing: '-0.025em' }}>
                  Partial payment links
                </h1>
                <p className="text-[12px] mt-1" style={{ color: '#8B9BB4' }}>
                  Multi-tranche settlement links · arbiter ledger · audit log
                </p>
              </div>
              <button className="btn-primary text-[12px]">
                <span className="material-symbols-outlined text-[14px]">add_link</span>
                Generate link
              </button>
            </div>

            {/* KPI strip — Tier 2 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Active tranche links', value: activeLinkCount, sub: `${fmt(totalPipeline)} in pipeline`, accent: '#2B51D6' },
                { label: 'Settlement conversion', value: `${conversionRate}%`, sub: `${recovered.length} of ${transactions.length} recovered`, accent: '#15803D' },
                { label: 'Arbiter consensus', value: '94.8%', sub: '1,420 runs audited', accent: '#2B51D6' },
                { label: 'Avg resolution', value: '312ms', sub: 'p99: 480ms', accent: '#15803D' },
              ].map((kpi) => (
                <div key={kpi.label} className="t2-tile flex flex-col gap-2" style={{ padding: '14px 16px' }}>
                  <div style={{ height: 2, borderRadius: 1, background: kpi.accent, opacity: 0.35, marginBottom: 2 }} />
                  <span className="kpi-label">{kpi.label}</span>
                  <span className="kpi-value">{kpi.value}</span>
                  <span className="text-[11px]" style={{ color: '#8B9BB4' }}>{kpi.sub}</span>
                </div>
              ))}
            </div>

            {/* Featured transaction — Tier 2 */}
            {featured && (
              <div className="t2-tile flex flex-col gap-4" style={{ padding: '18px 20px' }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3" style={{ borderBottom: '1px solid #E8EBF0' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold" style={{ color: '#0F1117' }}>{featured.customer_name}</h3>
                      <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>{featured.id}</span>
                      {featured.days_overdue > 0 && (
                        <span className="chip chip-escalated text-[10px]">{featured.days_overdue}d overdue</span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
                      {featured.failure_type?.replace(/_/g, ' ')} · {fmt(featured.amount)}
                    </p>
                  </div>
                  <span className={`${stateChip(featured.state ?? '')}`}>
                    {featured.state?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Agent A vs B vs Arbiter */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 4 }}>
                    <span className="font-mono text-[10px] font-semibold block mb-2" style={{ color: '#8B9BB4' }}>Outreach agent</span>
                    <p className="text-[12px] font-semibold mb-1" style={{ color: '#0F1117' }}>Aggressive recovery</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#8B9BB4' }}>
                      Deterministic mandate for instant liquidation before next invoice cycle. Stance: 78.4%
                    </p>
                  </div>
                  <div style={{ padding: '12px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 4 }}>
                    <span className="font-mono text-[10px] font-semibold block mb-2" style={{ color: '#8B9BB4' }}>LTV guardian</span>
                    <p className="text-[12px] font-semibold mb-1" style={{ color: '#0F1117' }}>Retention & standstill</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#8B9BB4' }}>
                      7-day standstill, interest waiver, soft review.
                    </p>
                    <span className="font-mono text-[10px] mt-2 block" style={{ color: '#B91C1C' }}>
                      Churn risk: {Math.round(featured.recovery_prob * 100 || 40)}% exit
                    </span>
                  </div>
                  <div style={{ padding: '12px', background: '#EEF2FE', border: '1px solid #C4CEFC', borderRadius: 4 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] font-semibold" style={{ color: '#2B51D6' }}>Arbiter ruling</span>
                      <span className="chip chip-ptp text-[9px]">Synthesized</span>
                    </div>
                    <p className="text-[12px] font-semibold mb-2" style={{ color: '#0F1117' }}>
                      {featured.state === 'RECOVERED' ? '2-tranche settlement ✓' : '2-tranche split settlement'}
                    </p>
                    <ul className="text-[11px] flex flex-col gap-1" style={{ color: '#3F4A5F' }}>
                      <li>· Tranche 1: {fmt(Math.ceil(featured.amount / 2))} within 48h</li>
                      <li>· Tranche 2: {fmt(Math.floor(featured.amount / 2))} on 5th proximo</li>
                    </ul>
                    <span className="font-mono text-[10px] mt-2 block" style={{ color: '#15803D' }}>97.2% confidence</span>
                  </div>
                </div>

                {/* Payment link endpoint */}
                {featured.payment_link_url && (
                  <div
                    className="flex flex-col md:flex-row items-start md:items-center gap-3"
                    style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 4 }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: '#15803D' }}>Payment endpoint</span>
                      <code className="font-mono text-[11px] truncate" style={{ color: '#2B51D6' }}>{featured.payment_link_url}</code>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { navigator.clipboard?.writeText(featured.payment_link_url!).catch(() => {}); showToast('Copied', 'Link on clipboard') }}
                        className="btn-secondary text-[11px]"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        Copy
                      </button>
                      <button className="btn-primary text-[11px]">
                        <span className="material-symbols-outlined text-[13px]">send</span>
                        Dispatch
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Decision ledger — Tier 2 */}
            <div className="t2-tile flex flex-col gap-4" style={{ padding: '18px 20px' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Decision ledger</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
                    Cryptographic proofs of multi-agent settlements
                  </p>
                </div>
                <button className="btn-secondary text-[11px]">
                  <span className="material-symbols-outlined text-[13px]">download</span>
                  Export CSV
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1" style={{ borderBottom: '1px solid #E8EBF0', paddingBottom: 10 }}>
                {(['all', 'recovered', 'escalated'] as const).map((key) => {
                  const count = key === 'all' ? transactions.length : key === 'recovered' ? recovered.length : transactions.filter(t => t.state === 'ESCALATED').length
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`filter-tab ${activeTab === key ? 'filter-tab-active' : 'filter-tab-inactive'}`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Table */}
              <div className="overflow-x-auto" style={{ border: '1px solid #DDE1EA', borderRadius: 4 }}>
                <table className="w-full text-left text-[12px]" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #DDE1EA' }}>
                      {['Time', 'Customer', 'Amount', 'State', 'Yield', ''].map((h) => (
                        <th key={h} className="font-mono text-[10px] font-semibold" style={{ padding: '9px 14px', color: '#8B9BB4' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-[12px] py-10" style={{ color: '#8B9BB4' }}>
                          No transactions yet
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((txn) => (
                        <tr key={txn.id} style={{ borderBottom: '1px solid #F1F3F7' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="font-mono text-[11px]" style={{ padding: '10px 14px', color: '#5A6578' }}>
                            {fmtTime(txn.created_at)}
                            <span className="block text-[10px]" style={{ color: '#C4CBDB' }}>{txn.id?.slice(0, 10)}…</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span className="font-medium block" style={{ color: '#0F1117' }}>{txn.customer_name}</span>
                            <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>Cat {txn.category} · {txn.channel}</span>
                          </td>
                          <td className="font-mono font-bold text-right" style={{ padding: '10px 14px', color: '#0F1117', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(txn.amount)}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span className={`${stateChip(txn.state ?? '')} text-[10px]`}>
                              {txn.state?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-right" style={{ padding: '10px 14px' }}>
                            {txn.state === 'RECOVERED'  ? <span style={{ color: '#15803D' }}>100%</span>
                            : txn.state === 'PTP_LOGGED' ? <span style={{ color: '#2B51D6' }}>Pending</span>
                            : <span style={{ color: '#C4CBDB' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <button
                              onClick={() => setFeatured(txn)}
                              className="btn-secondary text-[11px]"
                              style={{ padding: '4px 10px' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Guardrails — Tier 2, 3 columns */}
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>Statutory guardrails</h3>
                <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>Deterministic policy enforcement — no LLM involved</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {guardrails.map((g) => (
                  <div key={g.title} className="t2-tile flex flex-col gap-3" style={{ padding: '16px 18px' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold" style={{ color: '#0F1117' }}>{g.title}</span>
                      <span className="font-mono text-[11px] font-bold" style={{ color: g.valueColor }}>{g.value}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#5A6578' }}>{g.desc}</p>
                    <pre
                      className="font-mono text-[10px] leading-relaxed"
                      style={{ padding: '8px 10px', background: '#F9FAFB', border: '1px solid #E8EBF0', borderRadius: 3, color: '#8B9BB4', whiteSpace: 'pre-wrap' }}
                    >
                      {g.mono}
                    </pre>
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

export default function PartialPaymentLinksPage() {
  return (
    <ToastProvider>
      <PartialPaymentContent />
    </ToastProvider>
  )
}
