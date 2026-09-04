'use client'

import type { RecoveryStats } from '@/types'

interface PipelineStatusProps {
  stats: RecoveryStats
}

function fmtINR(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function PipelineStatus({ stats }: PipelineStatusProps) {
  const tiles = [
    {
      id: 'at-risk',
      label: 'At risk',
      value: fmtINR(stats.total_at_risk),
      sub: `${stats.total_transactions} transaction${stats.total_transactions !== 1 ? 's' : ''}`,
      valueColor: '#0F1117',
      accentColor: '#2B51D6',
    },
    {
      id: 'recovered',
      label: 'Recovered',
      value: fmtINR(stats.total_recovered),
      sub: `${stats.count_recovered} closed`,
      valueColor: '#15803D',
      accentColor: '#15803D',
    },
    {
      id: 'escalated',
      label: 'Escalated',
      value: String(stats.count_escalated || 0),
      sub: 'Needs review',
      valueColor: stats.count_escalated > 0 ? '#B91C1C' : '#0F1117',
      accentColor: stats.count_escalated > 0 ? '#B91C1C' : '#DDE1EA',
    },
    {
      id: 'filtered',
      label: 'Filtered',
      value: String(stats.count_aborted + stats.count_written_off),
      sub: 'DND · unit economics',
      valueColor: '#5A6578',
      accentColor: '#DDE1EA',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.id}
          className="t2-tile flex flex-col gap-2"
          style={{ padding: '14px 16px' }}
        >
          {/* Accent rule at top — 2px line, color encodes meaning */}
          <div
            style={{
              height: '2px',
              borderRadius: '1px',
              background: tile.accentColor,
              opacity: 0.35,
              marginBottom: '2px',
            }}
          />

          <span className="kpi-label">{tile.label}</span>

          <span
            className="kpi-value"
            style={{ color: tile.valueColor }}
          >
            {tile.value || '—'}
          </span>

          <span className="text-[11px]" style={{ color: '#8B9BB4' }}>
            {tile.sub}
          </span>
        </div>
      ))}
    </div>
  )
}
