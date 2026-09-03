'use client'

import type { RecoveryStats } from '@/types'

interface LifecycleWorkflowProps {
  stats: RecoveryStats
}

type NodeVariant = 'idle' | 'active' | 'warning' | 'ptp' | 'recovered' | 'aborted'

interface StageNode {
  count: number
  label: string
  sublabel: string
  variant: NodeVariant
}

export function LifecycleWorkflow({ stats }: LifecycleWorkflowProps) {
  const totalTxns      = stats.total_transactions
  const countRecovered = stats.count_recovered
  const countEscalated = stats.count_escalated
  const countWrittenOff = stats.count_written_off
  const countAborted   = stats.count_aborted

  const passed     = totalTxns - countAborted - countWrittenOff
  const notified   = Math.max(passed - countEscalated, 0)
  const inProgress = Math.max(notified - countRecovered, 0)
  const ptpCount   = Math.max(inProgress - Math.floor(inProgress * 0.5), 0)

  const fmtINR = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const stages: StageNode[] = [
    { count: totalTxns || 0, label: 'DETECTED',    sublabel: 'Ingested',      variant: 'idle' },
    { count: totalTxns || 0, label: 'TRIAGED',     sublabel: 'Segmented',     variant: 'idle' },
    { count: passed || 0,    label: 'POLICY GATE', sublabel: `${(countAborted + countWrittenOff) || 0} filtered`, variant: 'active' },
    { count: passed || 0,    label: 'SCHEDULED',   sublabel: 'Queue ready',    variant: 'idle' },
    { count: notified || 0,  label: 'NOTIFIED',    sublabel: 'Outreach sent',  variant: 'idle' },
    { count: inProgress || 0, label: 'NEGOTIATING', sublabel: 'In progress',   variant: 'warning' },
    { count: ptpCount || 0,  label: 'PTP',         sublabel: 'Payment plan',   variant: 'ptp' },
  ]

  const nodeStyle: Record<NodeVariant, string> = {
    idle:      'bg-white border-[#E5E9F0] text-[#475569]',
    active:    'bg-[#528FF0] border-[#528FF0] text-white node-active',
    warning:   'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
    ptp:       'bg-[#EEF4FE] border-[#C5D9FB] text-[#1D4ED8]',
    recovered: 'bg-[#10B981] border-[#10B981] text-white',
    aborted:   'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]',
  }

  const labelStyle: Record<NodeVariant, string> = {
    idle:      'text-[#64748B]',
    active:    'text-[#528FF0] font-bold',
    warning:   'text-[#92400E]',
    ptp:       'text-[#1D4ED8]',
    recovered: 'text-[#059669] font-bold',
    aborted:   'text-[#991B1B]',
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EEF4FE] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#528FF0] text-[16px]">account_tree</span>
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[#0F172A] leading-tight">Recovery Pipeline</h2>
            <p className="text-[12px] text-[#64748B]">State machine with policy enforcement</p>
          </div>
        </div>
        <span className="chip chip-default font-mono text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] live-dot inline-block" />
          {totalTxns > 0 ? `${totalTxns} transitions today` : 'No data yet'}
        </span>
      </div>

      {/* Pipeline */}
      <div className="relative overflow-x-auto">
        <div className="flex items-center min-w-[900px] gap-1 py-4 px-2">
          {/* Background connector line */}
          <div className="absolute top-1/2 left-6 right-6 h-px bg-[#E5E9F0] -translate-y-1/2 z-0" />

          {stages.map((stage, i) => (
            <div key={stage.label} className="contents">
              <div className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer flex-1">
                <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-mono font-bold text-[13px] transition-transform group-hover:scale-110 shadow-sm ${nodeStyle[stage.variant]}`}>
                  {stage.count}
                </div>
                <span className={`text-[10px] font-semibold tracking-wide text-center ${labelStyle[stage.variant]}`}>
                  {stage.label}
                </span>
                <span className="text-[10px] text-[#94A3B8] text-center leading-tight">{stage.sublabel}</span>
              </div>

              {i < stages.length - 1 && (
                <span className="material-symbols-outlined text-[16px] text-[#CBD5E1] z-10 shrink-0">
                  chevron_right
                </span>
              )}
            </div>
          ))}

          {/* Arrow to RECOVERED */}
          <span className="material-symbols-outlined text-[16px] text-[#10B981] z-10 shrink-0">chevron_right</span>

          {/* RECOVERED node */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 group cursor-pointer flex-1">
            <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${nodeStyle.recovered}`}>
              <span className="material-symbols-outlined text-[18px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <span className="text-[10px] font-bold text-[#059669] tracking-wide">RECOVERED</span>
            <span className="text-[10px] font-bold text-[#059669] text-center">
              {countRecovered > 0 ? fmtINR(stats.total_recovered) : '₹0'}
            </span>
          </div>
        </div>
      </div>

      {/* Exception branches */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            dot: '#EF4444',
            label: 'DND / Regulatory Halt',
            sub: 'TRAI DND or consumer opt-out',
            count: `${countAborted}`,
            bg: 'bg-[#FEF2F2]',
            border: 'border-[#FECACA]',
            textColor: 'text-[#991B1B]',
            chipClass: 'chip-aborted',
          },
          {
            dot: '#94A3B8',
            label: 'Below Economic Threshold',
            sub: 'Outreach cost exceeds expected yield',
            count: `${countWrittenOff}`,
            bg: 'bg-[#F8FAFC]',
            border: 'border-[#E5E9F0]',
            textColor: 'text-[#475569]',
            chipClass: 'chip-written',
          },
          {
            dot: '#F59E0B',
            label: 'Escalated to Treasury',
            sub: 'High-value dispute, manual review',
            count: `${countEscalated}`,
            bg: 'bg-[#FFFBEB]',
            border: 'border-[#FDE68A]',
            textColor: 'text-[#92400E]',
            chipClass: 'chip-escalated',
          },
        ].map((branch) => (
          <div
            key={branch.label}
            className={`flex items-center justify-between p-3 rounded-lg border ${branch.bg} ${branch.border}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: branch.dot }} />
              <div>
                <span className={`text-[11px] font-semibold ${branch.textColor} block leading-tight`}>{branch.label}</span>
                <span className="text-[10px] text-[#64748B]">{branch.sub}</span>
              </div>
            </div>
            <span className={`chip ${branch.chipClass} shrink-0`}>{branch.count}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
