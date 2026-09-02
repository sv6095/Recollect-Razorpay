'use client'

import type { RecoveryStats } from '@/types'

interface ComplianceGateProps {
  stats: RecoveryStats
}

export function ComplianceGate({ stats }: ComplianceGateProps) {
  const rules = [
    {
      icon: 'schedule',
      title: 'Calling hours',
      sub: '7 PM – 8 AM IST blocked',
      value: 'Enforced',
      valueColor: '#15803D',
      dotColor: '#15803D',
    },
    {
      icon: 'block',
      title: 'DND registry',
      sub: 'Telecom sync, real-time',
      value: stats.count_aborted > 0 ? `${stats.count_aborted} filtered` : 'All clear',
      valueColor: stats.count_aborted > 0 ? '#B91C1C' : '#5A6578',
      dotColor: stats.count_aborted > 0 ? '#B91C1C' : '#DDE1EA',
    },
    {
      icon: 'speed',
      title: 'Rate limit',
      sub: 'Max 2 contacts / 24h',
      value: 'Compliant',
      valueColor: '#2B51D6',
      dotColor: '#2B51D6',
    },
    {
      icon: 'verified_user',
      title: 'Consent scope',
      sub: 'DPDP · WhatsApp opt-in',
      value: 'Scoped',
      valueColor: '#5A6578',
      dotColor: '#DDE1EA',
    },
    {
      icon: 'calculate',
      title: 'Unit economics',
      sub: 'amount × p(recov) > outreach cost',
      value: stats.count_written_off > 0 ? `${stats.count_written_off} pruned` : 'All pass',
      valueColor: stats.count_written_off > 0 ? '#5A6578' : '#5A6578',
      dotColor: stats.count_written_off > 0 ? '#5A6578' : '#DDE1EA',
    },
  ]

  return (
    // Tier 2: data tile — hairline border, 4px radius, no shadow
    <section className="t2-tile flex flex-col gap-4" style={{ padding: '18px 20px' }}>
      {/* Header — flat, no pastel icon circle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[15px]"
            style={{ color: '#5A6578', fontVariationSettings: "'FILL' 0" }}
          >
            lock_clock
          </span>
          <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>
            Compliance gate
          </h3>
        </div>
        <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>
          deterministic
        </span>
      </div>

      {/* Rules list */}
      <div className="flex flex-col" style={{ gap: 0 }}>
        {rules.map((rule, idx) => (
          <div
            key={rule.title}
            className="flex items-center justify-between gap-2"
            style={{
              padding: '9px 0',
              borderBottom: idx < rules.length - 1 ? '1px solid #F1F3F7' : 'none',
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Semantic dot — color encodes status, not decoration */}
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: rule.dotColor }}
              />
              <div className="min-w-0">
                <span
                  className="text-[12px] font-medium block leading-tight"
                  style={{ color: '#1A2130' }}
                >
                  {rule.title}
                </span>
                <span
                  className="font-mono text-[10px] block truncate"
                  style={{ color: '#8B9BB4' }}
                >
                  {rule.sub}
                </span>
              </div>
            </div>
            <span
              className="font-mono text-[11px] font-semibold shrink-0"
              style={{ color: rule.valueColor }}
            >
              {rule.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
