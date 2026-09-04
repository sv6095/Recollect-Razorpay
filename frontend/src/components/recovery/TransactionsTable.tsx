'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction, TransactionCategory, TransactionState } from '@/types'
import { WhatsAppIcon } from './WhatsAppIcon'
import { formatPhone } from './customerUtils'

interface TransactionsTableProps {
  transactions: Transaction[]
  searchQuery?: string
  onSelect?: (t: Transaction) => void
  onInspectTransaction?: (t: Transaction) => void
  onChatCustomer?: (t: Transaction) => void
  onWhatsAppCustomer?: (t: Transaction) => void
  onCallCustomer?: (t: Transaction) => void
}

type FilterKey = 'all' | 'recovering' | 'recovered' | 'escalated' | 'aborted' | 'b2b' | 'subscription' | 'cart'

const FILTERS: Array<{ key: FilterKey; label: string; count?: (s: Set<string>, t: Transaction[]) => number }> = [
  { key: 'all', label: 'All cases' },
  { key: 'recovering', label: 'In recovery' },
  { key: 'recovered', label: 'Recovered' },
  { key: 'b2b', label: 'B2B invoices' },
  { key: 'subscription', label: 'Subscriptions' },
  { key: 'cart', label: 'Cart / E-com' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'aborted', label: 'Aborted / Written off' },
]

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtTime(ts?: string) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffH = Math.floor(diffMs / 3_600_000)
    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))}m ago`
    if (diffH < 24) return `${diffH}h ago`
    const diffD = Math.floor(diffH / 24)
    return `${diffD}d ago`
  } catch {
    return ts.slice(0, 10)
  }
}

function stateMeta(state: TransactionState | string): { label: string; cls: string; dot: string } {
  const s = (state || '').toUpperCase()
  if (s.includes('RECOVER')) return { label: 'Recovered', cls: 'badge-green', dot: 'var(--color-green-600)' }
  if (s.includes('OUTREACH') || s.includes('NEGOT') || s.includes('PTP') || s.includes('INTERVENTION') || s.includes('TRIAGE'))
    return { label: 'In recovery', cls: 'badge-blue', dot: 'var(--color-brand-600)' }
  if (s.includes('ESCALAT')) return { label: 'Escalated', cls: 'badge-rose', dot: 'var(--color-rose-600)' }
  if (s.includes('ABORT') || s.includes('WRITTEN'))
    return { label: s.includes('WRITTEN') ? 'Written off' : 'Aborted', cls: 'badge-gray', dot: 'var(--color-text-4)' }
  if (s.includes('DETECT')) return { label: 'New', cls: 'badge-violet', dot: 'var(--color-violet-600)' }
  return { label: (state as string).replace(/_/g, ' ') || 'Unknown', cls: 'badge-gray', dot: 'var(--color-text-4)' }
}

function categoryMeta(cat: TransactionCategory | null | string): { label: string; cls: string; agent: string; icon: string } {
  switch (cat) {
    case 'B':
      return { label: 'B2B Invoice', cls: 'badge-blue', agent: 'B2B Debt Chaser', icon: 'apartment' }
    case 'A':
      return { label: 'Subscription', cls: 'badge-violet', agent: 'Salary Day Sequencer', icon: 'subscriptions' }
    case 'C':
      return { label: 'Cart / E-com', cls: 'badge-amber', agent: 'Cart Rescuer', icon: 'shopping_cart' }
    case 'SENTINEL':
      return { label: 'Sentinel', cls: 'badge-amber', agent: 'Sentinel Agent', icon: 'shield_moon' }
    default:
      return { label: 'Unclassified', cls: 'badge-gray', agent: 'Triage pending', icon: 'help_outline' }
  }
}

export function TransactionsTable({
  transactions,
  searchQuery = '',
  onSelect,
  onInspectTransaction,
  onChatCustomer,
  onWhatsAppCustomer,
  onCallCustomer,
}: TransactionsTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sortKey, setSortKey] = useState<'updated_at' | 'amount' | 'days_overdue'>('updated_at')

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const out = transactions.filter((t) => {
      // Text search
      if (q) {
        const hay = [
          t.customer_name, t.id, t.transaction_id, t.customer_email, t.customer_phone,
          String(t.amount), t.failure_type, t.category,
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      const s = (t.state || '').toUpperCase()
      switch (filter) {
        case 'all': return true
        case 'recovering':
          return s.includes('OUTREACH') || s.includes('NEGOT') || s.includes('PTP') || s.includes('INTERVENTION') || s.includes('TRIAGE') || s.includes('DETECT')
        case 'recovered': return s.includes('RECOVER')
        case 'escalated': return s.includes('ESCALAT')
        case 'aborted': return s.includes('ABORT') || s.includes('WRITTEN')
        case 'b2b': return t.category === 'B'
        case 'subscription': return t.category === 'A'
        case 'cart': return t.category === 'C'
        default: return true
      }
    })
    out.sort((a, b) => {
      if (sortKey === 'amount') return (b.amount || 0) - (a.amount || 0)
      if (sortKey === 'days_overdue') return (b.days_overdue || 0) - (a.days_overdue || 0)
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    })
    return out.slice(0, 50)
  }, [transactions, searchQuery, filter, sortKey])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of transactions) {
      const s = (t.state || '').toUpperCase()
      c.all = (c.all || 0) + 1
      if (s.includes('OUTREACH') || s.includes('NEGOT') || s.includes('PTP') || s.includes('INTERVENTION') || s.includes('TRIAGE') || s.includes('DETECT'))
        c.recovering = (c.recovering || 0) + 1
      if (s.includes('RECOVER')) c.recovered = (c.recovered || 0) + 1
      if (s.includes('ESCALAT')) c.escalated = (c.escalated || 0) + 1
      if (s.includes('ABORT') || s.includes('WRITTEN')) c.aborted = (c.aborted || 0) + 1
      if (t.category === 'B') c.b2b = (c.b2b || 0) + 1
      if (t.category === 'A') c.subscription = (c.subscription || 0) + 1
      if (t.category === 'C') c.cart = (c.cart || 0) + 1
    }
    return c
  }, [transactions])

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="card overflow-hidden"
    >
      {/* Section header */}
      <div className="flex items-start justify-between flex-wrap gap-4 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--color-border-soft)' }}>
        <div>
          <div className="eyebrow mb-1.5">Live recovery pipeline</div>
          <h3 className="text-[18px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
            All cases
          </h3>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--color-text-4)' }}>
            Every failed payment routed through AI recovery. Updated in real-time via WebSocket.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as 'updated_at' | 'amount' | 'days_overdue')}
            className="input"
            style={{ fontSize: 12.5, padding: '6px 10px' }}
          >
            <option value="updated_at">Sort: Most recent</option>
            <option value="amount">Sort: Largest amount</option>
            <option value="days_overdue">Sort: Most overdue</option>
          </select>
          <button className="btn-secondary btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>tune</span>
            Columns
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-6 py-3" style={{ background: 'var(--color-surface-mute)', borderBottom: '1px solid var(--color-border-soft)' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const n = counts[f.key] || 0
            const on = filter === f.key
            return (
              <button
                key={f.key}
                className={`filter-chip ${on ? 'on' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span className={`mono text-[10.5px] ${on ? 'opacity-80' : ''}`}>· {n}</span>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11.5px] text-slate-600 font-medium shrink-0 ml-auto shadow-xs">
          <span className="mono font-semibold text-slate-900">{filtered.length}</span> of {transactions.length} cases
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="table-pro">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Customer</th>
              <th style={{ width: '13%' }}>Category</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Amount</th>
              <th style={{ width: '12%' }}>Status</th>
              <th style={{ width: '14%' }}>Agent</th>
              <th style={{ width: '10%' }}>Days overdue</th>
              <th style={{ width: '11%', textAlign: 'right' }}>Last activity</th>
              <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div
                      className="flex flex-col items-center justify-center gap-2 py-12"
                      style={{ color: 'var(--color-text-4)' }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 32, opacity: 0.7 }}
                      >
                        manage_search
                      </span>
                      <div className="text-[13px] font-medium">
                        {searchQuery ? `No cases match "${searchQuery}"` : filter === 'all' ? 'No cases in pipeline yet' : 'No cases in this view'}
                      </div>
                      <div className="text-[12px]">Live Razorpay webhooks will populate this automatically.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const st = stateMeta(t.state)
                  const cat = categoryMeta(t.category)
                  const initials = (t.customer_name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <motion.tr
                      key={t.id || t.transaction_id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="cursor-pointer transition-colors"
                      onClick={() => {
                        onSelect?.(t)
                        onInspectTransaction?.(t)
                      }}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${
                                t.category === 'B' ? '#0369A1' :
                                t.category === 'A' ? '#7C3AED' :
                                t.category === 'C' ? '#D97706' :
                                '#475569'
                              } 0%, #1A2138 100%)`,
                            }}
                          >
                            {initials || '??'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                              {t.customer_name || 'Enterprise Customer'}
                            </div>
                            <div className="text-[11.5px] truncate mono" style={{ color: 'var(--color-text-4)' }}>
                              {t.customer_email || (t.customer_phone ? formatPhone(t.customer_phone) : null) || t.transaction_id || t.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${cat.cls}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{cat.icon}</span>
                          {cat.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="mono font-semibold num-target text-[14px]" style={{ color: 'var(--color-text-2)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtINR(t.amount || 0)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${st.cls}`}>
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: st.dot }}
                          />
                          {st.label}
                        </span>
                      </td>
                      <td>
                        <div className="text-[12.5px] font-medium" style={{ color: 'var(--color-text-2)' }}>
                          {cat.agent}
                        </div>
                        {(t.prior_contact_count ?? 0) > 0 && (
                          <div className="text-[10.5px] mono mt-0.5" style={{ color: 'var(--color-text-4)' }}>
                            {t.prior_contact_count} prior contact{t.prior_contact_count === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>
                      <td>
                        {(t.days_overdue ?? 0) > 0 ? (
                          <span className={`mono font-semibold text-[12.5px] ${
                            t.days_overdue >= 30 ? 'text-[var(--color-rose-700)]' :
                            t.days_overdue >= 15 ? 'text-[var(--color-amber-700)]' :
                            'text-[var(--color-text-3)]'
                          }`}>
                            {t.days_overdue}d
                          </span>
                        ) : (
                          <span className="text-[12px]" style={{ color: 'var(--color-text-4)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="mono text-[11.5px] font-medium" style={{ color: 'var(--color-text-3)' }}>
                          {fmtTime(t.updated_at || t.created_at)}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          {t.payment_link_url && (
                            <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 6px' }}>
                              Link sent
                            </span>
                          )}
                          {t.abort_reason && (
                            <span className="badge badge-gray" style={{ fontSize: 10, padding: '2px 6px' }}>
                              {t.abort_reason.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onInspectTransaction?.(t)}
                            title="Inspect all AI agent steps & reasoning"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                            style={{ color: '#0284C7', background: '#F0F9FF' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#E0F2FE'; e.currentTarget.style.transform = 'scale(1.08)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#F0F9FF'; e.currentTarget.style.transform = 'scale(1)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_tree</span>
                          </button>
                          <button
                            onClick={() => onChatCustomer?.(t)}
                            title="Chat with customer"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: 'var(--color-brand-700)', background: 'var(--color-brand-50)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-brand-100)'; e.currentTarget.style.transform = 'scale(1.08)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-brand-50)'; e.currentTarget.style.transform = 'scale(1)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
                          </button>
                          <button
                            onClick={() => onWhatsAppCustomer?.(t)}
                            title="WhatsApp customer"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: '#027A48', background: 'var(--color-green-50)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-green-100)'; e.currentTarget.style.transform = 'scale(1.08)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-green-50)'; e.currentTarget.style.transform = 'scale(1)' }}
                          >
                            <WhatsAppIcon size={14} color="#027A48" />
                          </button>
                          <button
                            onClick={() => onCallCustomer?.(t)}
                            title="Voice call with agent"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: 'var(--color-violet-600)', background: 'var(--color-violet-50)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-violet-100)'; e.currentTarget.style.transform = 'scale(1.08)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-violet-50)'; e.currentTarget.style.transform = 'scale(1)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: "'FILL' 1" }}>call</span>
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3.5" style={{ background: 'var(--color-surface-mute)', borderTop: '1px solid var(--color-border-soft)' }}>
          <div className="label">
            Showing <span className="mono font-semibold" style={{ color: 'var(--color-text-2)' }}>1–{filtered.length}</span> of{' '}
            <span className="mono font-semibold" style={{ color: 'var(--color-text-2)' }}>{transactions.length}</span> cases
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn-secondary btn-sm" disabled>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_left</span>
            </button>
            <button className="btn-secondary btn-sm" style={{ background: 'var(--color-brand-600)', color: '#fff', borderColor: 'var(--color-brand-600)' }}>
              1
            </button>
            <button className="btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </motion.section>
  )
}
