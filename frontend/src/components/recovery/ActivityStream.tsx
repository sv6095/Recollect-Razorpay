'use client'

import { useState } from 'react'
import type { WSEvent, TransactionState } from '@/types'
import { useToast } from './ToastContext'

interface ActivityStreamProps {
  rows: WSEvent[]
  onRowClick: (event: WSEvent) => void
}

type FilterKey = 'all' | 'recovered' | 'ptp' | 'escalated' | 'aborted'

const FILTER_LABELS: Record<FilterKey, string> = {
  all:       'All',
  recovered: 'Recovered',
  ptp:       'PTP',
  escalated: 'Escalated',
  aborted:   'Aborted',
}

function stateChipClass(state?: TransactionState | string) {
  switch (state) {
    case 'RECOVERED':          return 'chip chip-recovered'
    case 'PTP_LOGGED':         return 'chip chip-ptp'
    case 'WRITTEN_OFF':        return 'chip chip-written'
    case 'ESCALATED':          return 'chip chip-escalated'
    case 'ABORTED':            return 'chip chip-aborted'
    case 'NEGOTIATING':
    case 'OUTREACH_SENT':      return 'chip chip-negotiating'
    case 'INTERVENTION_PLANNED':
    case 'TRIAGED':            return 'chip chip-default'
    default:                   return 'chip chip-default'
  }
}

function stateDotColor(state?: TransactionState | string) {
  switch (state) {
    case 'RECOVERED':   return '#10B981'
    case 'PTP_LOGGED':  return '#528FF0'
    case 'WRITTEN_OFF': return '#94A3B8'
    case 'ESCALATED':   return '#F59E0B'
    case 'ABORTED':     return '#EF4444'
    case 'OUTREACH_SENT':
    case 'NEGOTIATING': return '#F59E0B'
    default:            return '#CBD5E1'
  }
}

function fmtAmount(n?: number) {
  if (!n) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function fmtTime(ts?: string) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    })
  } catch { return ts }
}

export function ActivityStream({ rows, onRowClick }: ActivityStreamProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const { showToast } = useToast()

  const filteredRows = rows.filter((r) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'recovered') return r.state === 'RECOVERED' || r.type === 'recovery_confirmed'
    if (activeFilter === 'ptp') return r.state === 'PTP_LOGGED'
    if (activeFilter === 'escalated') return r.state === 'ESCALATED' || r.type === 'escalation'
    if (activeFilter === 'aborted') return r.state === 'ABORTED' || r.state === 'WRITTEN_OFF'
    return true
  })

  const filterCount = (key: FilterKey) => {
    if (key === 'all') return rows.length
    if (key === 'recovered') return rows.filter(r => r.state === 'RECOVERED' || r.type === 'recovery_confirmed').length
    if (key === 'ptp') return rows.filter(r => r.state === 'PTP_LOGGED').length
    if (key === 'escalated') return rows.filter(r => r.state === 'ESCALATED' || r.type === 'escalation').length
    if (key === 'aborted') return rows.filter(r => r.state === 'ABORTED' || r.state === 'WRITTEN_OFF').length
    return 0
  }

  const handleRowClick = (event: WSEvent) => {
    setHighlightId(event.transaction_id ?? null)
    onRowClick(event)
    showToast('Ledger Synced', `Reasoning trace loaded for ${event.transaction_id}`)
  }

  return (
    <section className="card flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] live-dot" />
          <h2 className="text-[14px] font-semibold text-[#0F172A]">Recovery Activity Stream</h2>
          <span className="chip chip-live text-[10px]">Live</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 px-5 py-3 border-b border-[#F1F5F9] overflow-x-auto">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`filter-tab ${activeFilter === key ? 'filter-tab-active' : 'filter-tab-inactive'}`}
          >
            {FILTER_LABELS[key]}
            <span className={`ml-1 ${activeFilter === key ? 'opacity-80' : 'opacity-60'}`}>
              {filterCount(key)}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Action</th>
              <th>Status</th>
              <th className="text-right">Inspect</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#F7F9FB] border border-[#E5E9F0] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px] text-[#528FF0]">wifi_find</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#475569]">Waiting for payment events...</p>
                      <p className="text-[12px] text-[#94A3B8] mt-0.5">
                        Live stream will populate as Razorpay webhook events arrive
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[12px] text-[#94A3B8]">
                  No events match this filter
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const isHighlighted = highlightId === row.transaction_id
                return (
                  <tr
                    key={`${row.transaction_id}-${idx}`}
                    onClick={() => handleRowClick(row)}
                    style={{ background: isHighlighted ? '#EEF4FE' : undefined }}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: stateDotColor(row.state) }}
                        />
                        <div>
                          <span className={`font-mono text-[12px] font-semibold ${isHighlighted ? 'text-[#528FF0]' : 'text-[#0F172A]'}`}>
                            {row.transaction_id ?? '—'}
                          </span>
                          <span className="font-mono text-[10px] text-[#94A3B8] block">
                            {fmtTime(row.timestamp)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium text-[13px] text-[#0F172A] block leading-tight truncate max-w-[140px]">
                        {row.customer_name ?? '—'}
                      </span>
                      <span className="text-[11px] text-[#94A3B8] font-mono">
                        {row.category ? `Cat ${row.category}` : ''}{row.channel ? ` · ${row.channel}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`font-mono font-semibold text-[13px] ${row.state === 'RECOVERED' ? 'text-[#059669]' : 'text-[#0F172A]'}`}>
                        {fmtAmount(row.amount)}
                      </span>
                      {row.state === 'RECOVERED' && (
                        <span className="text-[10px] text-[#10B981] font-medium block">Recovered ✓</span>
                      )}
                    </td>
                    <td className="max-w-[240px]">
                      <p className="text-[12px] text-[#475569] truncate leading-tight">{row.message ?? '—'}</p>
                    </td>
                    <td>
                      <span className={stateChipClass(row.state)}>
                        {row.state ?? row.type?.toUpperCase() ?? '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        className="btn-secondary text-[11px] py-1 px-2.5"
                        onClick={(e) => { e.stopPropagation(); handleRowClick(row) }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
