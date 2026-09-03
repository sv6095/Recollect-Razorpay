'use client'

import type { Transaction } from '@/types'
import { useToast } from './ToastContext'

interface TransactionInspectorProps {
  selectedTxn: Transaction | null
  onOpenWebhookModal: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function stateChipClass(state?: string) {
  switch (state) {
    case 'RECOVERED':  return 'chip chip-recovered'
    case 'PTP_LOGGED': return 'chip chip-ptp'
    case 'ESCALATED':
    case 'ABORTED':    return 'chip chip-aborted'
    case 'NEGOTIATING':
    case 'OUTREACH_SENT': return 'chip chip-negotiating'
    default:           return 'chip chip-default'
  }
}

export function TransactionInspector({ selectedTxn, onOpenWebhookModal }: TransactionInspectorProps) {
  const { showToast } = useToast()

  if (!selectedTxn) {
    return (
      <section className="card flex flex-col items-center justify-center gap-3 p-10 min-h-[160px]">
        <div className="w-12 h-12 rounded-xl bg-[#F7F9FB] border border-[#E5E9F0] flex items-center justify-center">
          <span className="material-symbols-outlined text-[24px] text-[#CBD5E1]">manage_search</span>
        </div>
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[#475569]">No Transaction Selected</p>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">Click any row in the Activity Stream to inspect</p>
        </div>
      </section>
    )
  }

  const stateDisplay = selectedTxn.state?.replace(/_/g, ' ') ?? '—'

  return (
    <section className="card flex flex-col gap-0">
      {/* Inspection header */}
      <div className="flex flex-col gap-3 p-5 border-b border-[#F1F5F9]">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="chip chip-accent text-[10px]">INSPECTION</span>
              <span className="text-[11px] text-[#64748B] font-mono">{selectedTxn.id}</span>
            </div>
            <h3 className="text-[14px] font-semibold text-[#0F172A] leading-tight">
              {selectedTxn.failure_type?.replace(/_/g, ' ')} · {fmt(selectedTxn.amount)}
            </h3>
          </div>
          <span className={stateChipClass(selectedTxn.state)}>{stateDisplay}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#64748B]">
          <span>Customer: <strong className="text-[#0F172A] font-medium">{selectedTxn.customer_name}</strong></span>
          {selectedTxn.days_overdue > 0 && (
            <span>Overdue: <strong className="text-[#EF4444] font-mono">{selectedTxn.days_overdue}d</strong></span>
          )}
          {selectedTxn.channel && selectedTxn.channel !== 'NONE' && (
            <span>Channel: <strong className="text-[#528FF0]">{selectedTxn.channel.replace(/_/g, ' ')}</strong></span>
          )}
          {selectedTxn.category && (
            <span>Category: <strong className="text-[#0F172A]">Cat {selectedTxn.category}</strong></span>
          )}
        </div>
      </div>

      {/* Recovery probability */}
      {(selectedTxn.recovery_prob > 0 || selectedTxn.abort_reason) && (
        <div className="flex flex-col gap-2 px-5 py-4 bg-[#F8FAFC] border-b border-[#F1F5F9]">
          {selectedTxn.recovery_prob > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#475569]">Recovery Probability</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-[#E5E9F0] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selectedTxn.recovery_prob * 100}%`,
                      background: selectedTxn.recovery_prob > 0.6 ? '#10B981' : selectedTxn.recovery_prob > 0.3 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                <span className={`font-mono text-[13px] font-bold ${
                  selectedTxn.recovery_prob > 0.6 ? 'text-[#059669]' : selectedTxn.recovery_prob > 0.3 ? 'text-[#D97706]' : 'text-[#EF4444]'
                }`}>
                  {(selectedTxn.recovery_prob * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          {selectedTxn.abort_reason && (
            <div className="flex items-center gap-2 text-[12px] text-[#991B1B]">
              <span className="material-symbols-outlined text-[14px]">block</span>
              Abort: <strong>{selectedTxn.abort_reason.replace(/_/g, ' ')}</strong>
            </div>
          )}
        </div>
      )}

      {/* Payment link */}
      {selectedTxn.payment_link_url ? (
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#528FF0] text-[16px]">link</span>
              <span className="text-[13px] font-semibold text-[#0F172A]">Partial Payment Link</span>
            </div>
            <span className="chip chip-recovered text-[10px]">Active</span>
          </div>

          <div className="p-3 rounded-lg bg-[#F7F9FB] border border-[#E5E9F0]">
            <span className="text-[10px] text-[#94A3B8] block mb-1">Endpoint</span>
            <a
              href={selectedTxn.payment_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-[#528FF0] font-medium hover:underline truncate block"
            >
              {selectedTxn.payment_link_url}
            </a>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#94A3B8] bg-[#F7F9FB] border border-[#E5E9F0] px-2 py-1 rounded-md">
              accept_partial: true
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-[12px] py-1.5 px-3"
                onClick={() => {
                  navigator.clipboard?.writeText(selectedTxn.payment_link_url!).catch(() => {})
                  showToast('Link Copied', 'Payment link copied to clipboard')
                }}
              >
                Copy
              </button>
              <button
                onClick={onOpenWebhookModal}
                className="btn-primary text-[12px] py-1.5 px-3"
              >
                Simulate Payment
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5 flex items-center justify-between">
          <span className="text-[12px] text-[#94A3B8]">No payment link generated</span>
          <span className="chip chip-default text-[11px] font-mono">{selectedTxn.state}</span>
        </div>
      )}
    </section>
  )
}
