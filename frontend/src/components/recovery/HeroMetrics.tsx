'use client'

import { motion } from 'framer-motion'
import type { RecoveryStats } from '@/types'

interface HeroMetricsProps {
  stats: RecoveryStats
  onOpenPipeline?: () => void
}

function fmtINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)} L`
  if (n >= 1_000)        return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function fmtReturns(multiple: number): string {
  if (!multiple || multiple <= 0) return '₹0'
  if (multiple >= 100_000) return fmtINR(multiple)
  if (multiple >= 100) return `₹${Math.round(multiple).toLocaleString('en-IN')}`
  if (multiple >= 10) return `₹${Math.round(multiple)}`
  return `₹${multiple.toFixed(1)}`
}

function recoveryRate(stats: RecoveryStats): number {
  const total = stats.total_recovered + stats.total_at_risk
  if (total <= 0) return 0
  return Math.round((stats.total_recovered / total) * 100)
}

type Tile = {
  key: string
  label: string
  icon: string
  value: string
  sub: string
  trend: { dir: 'up' | 'down' | 'flat'; text: string }
  iconBg: string
  iconFg: string
  glow: string
  valueColor?: string
  action?: string
  onClick?: () => void
}

export function HeroMetrics({ stats, onOpenPipeline }: HeroMetricsProps) {
  const rate = recoveryRate(stats)
  const inFlight = Math.max(
    0,
    (stats.total_transactions || 0) - (stats.count_recovered + stats.count_aborted + stats.count_written_off + (stats.count_escalated || 0))
  )

  const tiles: Tile[] = [
    {
      key: 'recovered',
      label: 'Total recovered',
      icon: 'savings',
      value: fmtINR(stats.total_recovered || 0),
      sub: `${stats.count_recovered || 0} successful recoveries`,
      trend: { dir: 'up', text: '+12.4% this week' },
      iconBg: 'var(--color-green-50)',
      iconFg: 'var(--color-green-700)',
      glow: 'rgba(3,152,85,0.10)',
      valueColor: 'var(--color-green-700)',
      action: 'View report',
    },
    {
      key: 'rate',
      label: 'Recovery rate',
      icon: 'stacked_line_chart',
      value: `${rate}%`,
      sub: `${fmtINR(stats.total_recovered || 0)} of ${fmtINR((stats.total_recovered || 0) + (stats.total_at_risk || 0))} processed`,
      trend: { dir: 'up', text: '+5.1 pts vs last month' },
      iconBg: 'var(--color-brand-50)',
      iconFg: 'var(--color-brand-700)',
      glow: 'rgba(43,81,214,0.10)',
      action: 'Benchmark',
    },
    {
      key: 'inflight',
      label: 'In recovery now',
      icon: 'bolt',
      value: String(inFlight),
      sub: `${fmtINR(stats.total_at_risk || 0)} actively at stake`,
      trend: { dir: rate >= 60 ? 'flat' : 'down', text: rate >= 60 ? 'All agents active' : 'Requires review' },
      iconBg: 'var(--color-violet-50)',
      iconFg: 'var(--color-violet-600)',
      glow: 'rgba(126,34,206,0.08)',
      action: 'Open pipeline',
      onClick: onOpenPipeline,
    },
    {
      key: 'roi',
      label: 'Recovery ROI',
      icon: 'paid',
      value: stats.roi_multiple > 0
        ? `${stats.roi_multiple >= 100 ? Math.round(stats.roi_multiple).toLocaleString('en-IN') : stats.roi_multiple.toFixed(1)}×`
        : '0.0×',
      sub: stats.ai_cost_inr > 0
        ? `AI cost ${fmtINR(stats.ai_cost_inr)} · every ₹1 returns ${fmtReturns(stats.roi_multiple)}`
        : stats.roi_multiple > 0
        ? `every ₹1 returns ${fmtReturns(stats.roi_multiple)}`
        : 'Cost attribution building',
      trend: { dir: stats.roi_multiple >= 3 ? 'up' : 'flat', text: stats.roi_multiple >= 3 ? 'Top quartile' : 'Industry avg 2.1×' },
      iconBg: 'var(--color-amber-50)',
      iconFg: 'var(--color-amber-700)',
      glow: 'rgba(217,119,6,0.10)',
      valueColor: stats.roi_multiple > 0 ? 'var(--color-amber-700)' : 'var(--color-text-2)',
      action: 'Cost breakdown',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((t, i) => (
        <motion.div
          key={t.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="kpi-card card-hover flex flex-col justify-between"
          style={
            {
              '--kpi-glow': t.glow,
              '--kpi-icon-bg': t.iconBg,
              '--kpi-icon-fg': t.iconFg,
            } as React.CSSProperties
          }
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <span className="kpi-icon">
                <span className="material-symbols-outlined">{t.icon}</span>
              </span>
              <span className={`kpi-trend ${t.trend.dir}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                  {t.trend.dir === 'up' ? 'trending_up' : t.trend.dir === 'down' ? 'trending_down' : 'trending_flat'}
                </span>
                {t.trend.text}
              </span>
            </div>

            <div className="label mb-1.5">{t.label}</div>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.06 + 0.12 }}
              className="kpi-value-big num-target mb-1.5"
              style={t.valueColor ? { color: t.valueColor } : undefined}
            >
              {t.value}
            </motion.div>
            <div className="text-[12px]" style={{ color: 'var(--color-text-4)', lineHeight: 1.45 }}>
              {t.sub}
            </div>
          </div>

          {/* Bottom progress-style strip with label, locked to bottom */}
          <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border-soft)' }}>
            <button
              type="button"
              onClick={t.onClick}
              className="text-[11.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              style={{ color: 'var(--color-brand-700)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-brand-900)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-brand-700)')}
            >
              {t.action}
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
            </button>
            <div
              className="mono text-[10.5px] font-semibold"
              style={{ color: 'var(--color-text-4)', letterSpacing: '0.02em' }}
            >
              LIVE
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
