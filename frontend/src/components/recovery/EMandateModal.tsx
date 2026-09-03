'use client'

import type { Transaction } from '@/types'

interface EMandateModalProps {
  onClose: () => void
  transaction?: Transaction | null
}

export function EMandateModal({ onClose, transaction }: EMandateModalProps) {
  const customerName = transaction?.customer_name ?? 'Customer'
  const amount = transaction?.amount
  const txnId = transaction?.id ?? 'TXN_DEMO'
  const channel = transaction?.channel ?? 'WHATSAPP'

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded border border-[#E2E8F0] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#001C3D] text-white border-b border-[#0A3B75]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  RBI e-Mandate Pre-Debit Notification (Category A)
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-mono-code text-[10px] font-bold">
                  24h Regulatory Mandate • RBI/2020-21/74
                </span>
              </div>
              <p className="font-mono-code text-[11px] text-slate-400">
                Txn: {txnId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Sub-header */}
        <div className="px-6 py-2 bg-slate-50 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 font-mono-code text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">schedule</span>
            <span>Scheduled Execution:</span>
            <strong className="text-slate-900 font-bold">1st of Month (08:00 AM IST)</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Notice Window:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[11px]">
              Dispatched &gt;24h Prior (Compliant)
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Mandate details + dispatch preview */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="font-mono-code text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Mandate &amp; Notification Details
                </span>
                <span className="px-2 py-0.5 rounded bg-[#EBF6FF] text-[#0274D9] font-mono-code text-[10px] font-bold border border-[#0D94FB]/20">
                  Cat A: Salary-Day
                </span>
              </div>

              <div className="flex flex-col gap-2 p-3.5 rounded bg-slate-50 border border-slate-200 mb-3">
                <div className="grid grid-cols-2 gap-2 text-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 font-mono-code text-[10px] block">Customer:</span>
                    <strong className="font-bold text-slate-900">{customerName}</strong>
                    {transaction?.customer_phone && (
                      <span className="text-slate-400 font-mono-code block text-[11px]">{transaction.customer_phone}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono-code text-[10px] block">Mandate Amount:</span>
                    <strong className="text-emerald-700 font-mono-code text-sm">
                      {amount ? fmt(amount) : '—'}
                    </strong>
                    <span className="text-slate-400 font-mono-code block text-[11px]">Recurring Monthly</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono-code text-[10px] block">Channel:</span>
                    <span className="font-mono-code text-slate-800 text-xs">{channel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-mono-code text-[10px] block">Failure Type:</span>
                    <span className="font-mono-code text-[#0D94FB] font-bold text-xs">
                      {transaction?.failure_type?.replace(/_/g, ' ') ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
                  <span className="font-mono-code text-[10px] text-slate-400 block mb-1 font-bold">
                    Regulatory Mandate Clause:
                  </span>
                  <p className="italic text-[11px] leading-relaxed">
                    Section 3(b) RBI Circular on Processing of e-Mandates: Notification delivered 24
                    to 48 hours before execution with opt-out / modification link.
                  </p>
                </div>
              </div>

              {/* Dispatch preview */}
              <div className="flex flex-col gap-2">
                <span className="font-mono-code text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Multi-Channel Dispatch Preview
                </span>

                {/* SMS */}
                <div className="p-3 rounded bg-[#001C3D] text-slate-200 font-mono-code text-xs border border-[#0A3B75]">
                  <div className="flex items-center justify-between pb-1 text-slate-400 text-[10px]">
                    <span className="uppercase font-bold text-emerald-400">
                      SMS • RBI Compliant
                    </span>
                    <span className="text-[10px]">Status: QUEUED</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    &ldquo;Alert: {amount ? fmt(amount) : '[Amount]'} will be debited on 01st for
                    your subscription. To modify or cancel mandate, click the opt-out link in WhatsApp.&rdquo;
                  </p>
                </div>

                {/* WhatsApp */}
                <div className="p-3 rounded bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between pb-1 font-mono-code text-xs">
                    <span className="uppercase text-[#0D94FB] font-bold text-[10px]">
                      WhatsApp Utility Template (DPDP Scoped)
                    </span>
                    <span className="px-1.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px]">
                      Opt-in Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-2">
                    &ldquo;Hi {customerName.split(' ')[0]}, confirming your subscription debit
                    for {amount ? fmt(amount) : '[amount]'} scheduled on 01st. Manage schedule below.&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-2.5 py-1 rounded bg-[#0D94FB] text-white font-mono-code text-[11px] font-bold hover:bg-[#0274D9] transition-colors">
                      Confirm Schedule
                    </button>
                    <button className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono-code text-[11px] font-semibold hover:bg-slate-100 transition-colors">
                      Pause Mandate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Policy gate verification */}
            <div className="flex flex-col gap-3">
              <div>
                <span className="font-mono-code text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Deterministic Policy Gate &amp; Verification
                </span>
                <p className="text-xs text-slate-500">
                  Zero human intervention • RBI compliant execution pipeline
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  {
                    icon: 'check_circle',
                    cls: 'text-emerald-600',
                    title: 'Pre-debit SMS Sent',
                    desc: 'Delivered via DLT Carrier Gateway at 08:00 AM IST (24h SLA respected)',
                  },
                  {
                    icon: 'check_circle',
                    cls: 'text-emerald-600',
                    title: 'Customer Token Validity',
                    desc: 'Card token verified against NPCI Token Reference Directory. Active status.',
                  },
                  {
                    icon: 'pending_actions',
                    cls: 'text-[#0D94FB]',
                    title: 'Awaiting Execution Trigger',
                    desc: 'Batch scheduled for 1st of month 08:00 AM via Redis Cron Daemon',
                  },
                ].map((step) => (
                  <div
                    key={step.title}
                    className="p-3 rounded bg-slate-50 border border-slate-200 flex items-start gap-2.5"
                  >
                    <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${step.cls}`}>
                      {step.icon}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{step.title}</span>
                      <span className="text-xs text-slate-500">{step.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 flex items-center justify-end border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}
