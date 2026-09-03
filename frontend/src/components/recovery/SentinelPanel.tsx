'use client'

import { useState, useEffect } from 'react'
import type { UpcomingRenewal } from '@/types'

interface SentinelPanelProps {
  stats?: unknown
  refreshKey?: number
}

function formatChargeAt(chargeAt: string): string {
  if (!chargeAt) return 'soon'
  try {
    const ts = parseInt(chargeAt) * 1000
    if (isNaN(ts)) return 'soon'
    const diffDays = Math.ceil((new Date(ts).getTime() - Date.now()) / 86_400_000)
    if (diffDays <= 0) return 'today'
    if (diffDays === 1) return 'tomorrow'
    return `in ${diffDays}d`
  } catch { return 'soon' }
}

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n)
}

export function SentinelPanel({ refreshKey }: SentinelPanelProps) {
  const [renewals, setRenewals] = useState<UpcomingRenewal[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/demo/upcoming-renewals')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => alive && Array.isArray(data) && setRenewals(data))
      .catch(() => {})
    return () => { alive = false }
  }, [refreshKey])

  const flaggedCount = renewals.length
  const totalAtRisk  = renewals.reduce((s, r) => s + r.amount, 0)

  return (
    // Tier 3: real elevation, left amber accent bar (t3-panel t3-sentinel)
    <section
      className="t3-panel t3-sentinel flex flex-col"
      style={{ padding: '18px 20px', gap: '14px' }}
    >
      {/* Panel header — plain icon, no pastel circle */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: '#D97706', fontVariationSettings: "'FILL' 1" }}
            >
              shield_moon
            </span>
            <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>
              Sentinel prevention
            </h3>
          </div>
          <p className="text-[11px]" style={{ color: '#8B9BB4' }}>
            Pre-debit interception · 48h forecast
          </p>
        </div>

        {/* Flagged count — a number, not a chip */}
        {flaggedCount > 0 ? (
          <span className="font-mono text-[12px] font-bold" style={{ color: '#D97706' }}>
            {flaggedCount} at risk
          </span>
        ) : (
          <span className="font-mono text-[11px]" style={{ color: '#C4CBDB' }}>
            clear
          </span>
        )}
      </div>

      {/* Forecast summary — uses amber tint, sentence case */}
      <div
        style={{
          padding: '10px 12px',
          background: '#FFFBEB',
          borderRadius: '4px',
          border: '1px solid #FDE68A',
        }}
      >
        <p className="text-[12px] leading-relaxed" style={{ color: '#78350F' }}>
          {flaggedCount > 0
            ? `${flaggedCount} renewal mandate${flaggedCount > 1 ? 's' : ''} flagged — ${fmtINR(totalAtRisk)} exposure`
            : 'No renewal risks in the next 48 hours. E-mandate balances tracking normally.'}
        </p>
      </div>

      {/* Renewal rows — left-bar treatment, consistent with escalation style */}
      {renewals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {renewals.slice(0, 3).map((r) => (
            <div
              key={r.transaction_id}
              className="flex items-center justify-between"
              style={{
                padding: '8px 10px',
                borderLeft: '2px solid #D97706',
                background: '#FFFBEB',
                borderRadius: '0 3px 3px 0',
              }}
            >
              <div className="min-w-0">
                <span
                  className="text-[12px] font-medium block truncate"
                  style={{ color: '#0F1117' }}
                >
                  {r.customer_name}
                </span>
                <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                  Due {formatChargeAt(r.charge_at)}
                </span>
              </div>
              <span
                className="font-mono text-[12px] font-bold ml-2 shrink-0"
                style={{ color: '#D97706', fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtINR(r.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
