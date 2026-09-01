'use client'

import type { RecoveryStats } from '@/types'

interface HeroMetricsProps {
  stats: RecoveryStats
}

function fmtINR(n: number, decimals = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: decimals,
  }).format(n)
}

export function HeroMetrics({ stats }: HeroMetricsProps) {
  const totalAtRisk   = stats.total_at_risk
  const totalRecovered = stats.total_recovered
  const recoveredPct  = totalAtRisk > 0 ? Math.min((totalRecovered / totalAtRisk) * 100, 100) : 0
  const aiCost        = stats.ai_cost_inr
  const roi           = stats.roi_multiple
  const totalTxns     = stats.total_transactions
  const regulatoryBlocks = stats.count_aborted
  const filteredCount    = stats.count_aborted + stats.count_written_off
  const filteredPct      = totalTxns > 0 ? Math.round((filteredCount / totalTxns) * 100) : 0

  const kpis = [
    {
      id: 'at-risk',
      label: 'Revenue at Risk',
      value: fmtINR(totalAtRisk),
      sub: totalTxns > 0
        ? `${totalTxns} invoices • ${totalTxns - stats.count_escalated} evaluated`
        : 'Awaiting batch',
      badge: { text: `${totalTxns} Active`, variant: 'accent' as const },
      progress: totalTxns > 0 ? 100 : 0,
      progressColor: '#528FF0',
      icon: 'account_balance',
    },
    {
      id: 'recovered',
      label: 'Recovered',
      value: fmtINR(totalRecovered),
      sub: `${stats.count_recovered} transactions recovered`,
      badge: { text: `${recoveredPct.toFixed(1)}%`, variant: 'recovered' as const },
      progress: recoveredPct,
      progressColor: '#10B981',
      icon: 'trending_up',
      highlight: 'emerald',
    },
    {
      id: 'ai-cost',
      label: 'AI Recovery Cost',
      value: aiCost > 0 ? fmtINR(aiCost, 2) : '₹0.00',
      sub: 'Automated pipeline cost',
      badge: { text: 'Optimised', variant: 'default' as const },
      progress: aiCost > 0 ? 22 : 0,
      progressColor: '#528FF0',
      icon: 'smart_toy',
    },
    {
      id: 'roi',
      label: 'Recovery ROI',
      value: roi > 0 ? `${roi.toLocaleString('en-IN')}×` : '—',
      sub: aiCost > 0
        ? `+${fmtINR(Math.max(totalRecovered - aiCost * totalTxns, 0))} net margin lift`
        : fmtINR(totalRecovered),
      badge: {
        text: roi > 1000 ? '⚡ Top Tier' : roi > 0 ? 'Active' : 'Pending',
        variant: roi > 1000 ? 'recovered' as const : 'accent' as const,
      },
      progress: roi > 0 ? 96 : 0,
      progressColor: '#528FF0',
      icon: 'rocket_launch',
      highlight: 'accent',
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      {/* Page header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.06em]">
              Revenue Recovery Console
            </span>
            <span className="chip chip-live">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] live-dot inline-block" />
              Live Sync
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight leading-tight">
            Autonomous Recovery
          </h1>
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E9F0] text-[12px] text-[#475569]">
            <span className="material-symbols-outlined text-[#528FF0] text-[14px]">filter_alt</span>
            Filtered:
            <span className="font-bold text-[#528FF0] font-mono text-[11px]">
              {totalTxns > 0 ? `${filteredPct}% (${filteredCount}/${totalTxns})` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E9F0] text-[12px] text-[#475569]">
            <span className="material-symbols-outlined text-[#EF4444] text-[14px]">block</span>
            Regulatory Blocks:
            <span className="font-bold text-[#EF4444] font-mono text-[11px]">
              {regulatoryBlocks}
            </span>
          </div>

        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="card card-interactive p-5 flex flex-col justify-between gap-3"
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.05em]">
                  <span className={`material-symbols-outlined text-[13px] ${
                    kpi.id === 'recovered' ? 'text-[#10B981]' : 'text-[#528FF0]'
                  }`}>{kpi.icon}</span>
                  {kpi.label}
                </span>
              </div>
              <span className={`chip chip-${kpi.badge.variant} shrink-0`}>{kpi.badge.text}</span>
            </div>

            {/* Value */}
            <div>
              <div className={`text-[26px] font-bold tracking-tight leading-none mb-1 ${
                kpi.id === 'recovered'
                  ? 'text-[#059669]'
                  : kpi.id === 'roi'
                  ? 'text-[#528FF0]'
                  : 'text-[#0F172A]'
              }`}>
                {kpi.value}
              </div>
              <p className="text-[12px] text-[#64748B] leading-tight">{kpi.sub}</p>
            </div>

            {/* Progress */}
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${kpi.progress}%`, background: kpi.progressColor }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
