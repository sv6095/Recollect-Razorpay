'use client'

import { motion } from 'framer-motion'
import type { Escalation, UpcomingRenewal } from '@/types'

interface PriorityActionsProps {
  escalations: Escalation[]
  renewals?: UpcomingRenewal[]
  totalAtRisk: number
  escalatedValue: number
}

function fmtINR(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function fmtChargeAt(chargeAt: string): string {
  if (!chargeAt) return 'soon'
  try {
    const ts = parseInt(chargeAt) * 1000
    if (isNaN(ts)) return 'soon'
    const diffDays = Math.ceil((ts - Date.now()) / 86_400_000)
    if (diffDays <= 0) return 'today'
    if (diffDays === 1) return 'tomorrow'
    return `in ${diffDays} days`
  } catch { return 'soon' }
}

export function PriorityActions({
  escalations,
  renewals = [],
  totalAtRisk,
  escalatedValue,
}: PriorityActionsProps) {
  const topEscalations = escalations.slice(0, 3)
  const topRenewals = renewals.slice(0, 3)
  const totalExposure = escalatedValue + renewals.reduce((s, r) => s + r.amount, 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-4"
    >
      {/* Left: Escalations needing human review */}
      <div
        className="lg:col-span-6 action-card card-hover flex flex-col justify-between h-full"
        style={
          {
            ['--accent-glow' as any]: 'linear-gradient(135deg, rgba(240,68,56,0.08), transparent 60%)',
            background: '#fff',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          } as React.CSSProperties
        }
      >
        <div className="flex items-start justify-between gap-3 mb-4 relative">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-rose-50)', color: 'var(--color-rose-700)' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 21, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
              >
                report_gmailerrorred
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-text)] truncate">
                  Escalations awaiting your review
                </h3>
                {escalations.length > 0 && (
                  <span className="badge badge-rose shrink-0">
                    {escalations.length} open
                  </span>
                )}
              </div>
              <p className="text-[12px] mt-0.5 text-[var(--color-text-4)] leading-relaxed">
                Arbiter/risk guardrails have escalated these for a human finance decision
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 pl-2">
            <div className="display-num" style={{ fontSize: 22, color: 'var(--color-rose-700)' }}>
              {fmtINR(escalatedValue)}
            </div>
            <div className="text-[11px] mono mt-0.5 whitespace-nowrap" style={{ color: 'var(--color-text-4)' }}>
              value at stake
            </div>
          </div>
        </div>
        {topEscalations.length === 0 ? (
          <div className="flex flex-col gap-3 flex-1 justify-between">
            <div
              className="flex items-center gap-3 p-4 rounded-xl relative"
              style={{ background: 'var(--color-green-50)', border: '1px solid var(--color-green-100)' }}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{ color: 'var(--color-green-700)', fontSize: 22, fontVariationSettings: "'FILL' 1" }}
              >
                task_alt
              </span>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--color-green-700)' }}>
                  No active escalations
                </div>
                <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                  All recovery decisions are resolving within policy guardrails.
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between text-[11.5px] text-slate-500 mt-auto">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Autonomous Arbiter Active · 0 statutory violations
              </span>
              <span className="font-mono text-slate-400 text-[10.5px]">DND / RBI compliant</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 relative flex-1 justify-between">
            <div className="flex flex-col gap-2">
              {topEscalations.map((esc) => (
                <div
                  key={esc.id}
                  className="group flex items-start gap-3 p-3.5 rounded-xl transition-all cursor-pointer"
                  style={{
                    background: 'var(--color-surface-mute)',
                    border: '1px solid var(--color-border-soft)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.borderColor = 'var(--color-rose-100)'
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(240,68,56,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-mute)'
                    e.currentTarget.style.borderColor = 'var(--color-border-soft)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div
                    className="w-1 h-full min-h-[36px] rounded-full shrink-0 mt-1"
                    style={{ background: 'var(--color-rose-500)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                          {esc.customer_name}
                        </span>
                        {esc.days_overdue > 0 && (
                          <span className="badge badge-rose">{esc.days_overdue}d overdue</span>
                        )}
                      </div>
                      <span
                        className="mono font-bold text-[13.5px]"
                        style={{ color: 'var(--color-text-2)', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {fmtINR(esc.amount)}
                      </span>
                    </div>
                    <p className="text-[12px] leading-snug line-clamp-2 mb-2" style={{ color: 'var(--color-text-3)' }}>
                      {esc.reason}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-gray mono">#{esc.id.slice(0, 8)}</span>
                      <button className="badge badge-rose ml-auto">
                        Review case
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {escalations.length > 3 && (
              <button className="label flex items-center gap-1 justify-center py-1.5 mt-auto">
                + {escalations.length - 3} more escalations
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: Sentinel pre-debit prevention */}
      <div
        className="lg:col-span-6 action-card card-hover flex flex-col justify-between h-full"
        style={
          {
            ['--accent-glow' as any]: 'linear-gradient(135deg, rgba(217,119,6,0.09), transparent 60%)',
            background: '#fff',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          } as React.CSSProperties
        }
      >
        <div className="flex items-start justify-between gap-3 mb-4 relative">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--color-amber-50)', color: 'var(--color-amber-700)' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 21, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
              >
                shield_moon
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-tight text-[var(--color-text)] truncate">
                  Sentinel · pre-debit prevention
                </h3>
                {topRenewals.length > 0 && (
                  <span className="badge badge-amber shrink-0">{topRenewals.length} flagged</span>
                )}
              </div>
              <p className="text-[12px] mt-0.5 text-[var(--color-text-4)] leading-relaxed">
                Intervene 48h before mandate debit — stop failures before they happen
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 pl-2">
            <div className="display-num" style={{ fontSize: 22, color: 'var(--color-amber-700)' }}>
              {fmtINR(renewals.reduce((s, r) => s + r.amount, 0))}
            </div>
            <div className="text-[11px] mono mt-0.5 whitespace-nowrap" style={{ color: 'var(--color-text-4)' }}>
              protected value
            </div>
          </div>
        </div>

        {topRenewals.length === 0 ? (
          <div className="flex flex-col gap-3 flex-1 justify-between">
            <div
              className="flex items-center gap-3 p-4 rounded-xl relative"
              style={{ background: 'var(--color-surface-mute)', border: '1px solid var(--color-border-soft)' }}
            >
              <span
                className="material-symbols-outlined shrink-0"
                style={{ color: 'var(--color-amber-600)', fontSize: 22, fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
                  Mandate health scan optimal
                </div>
                <div className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                  All clear for the next 48 hours — no upcoming mandate risks detected.
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between text-[11.5px] text-slate-500 mt-auto">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Continuous NACH / UPI mandate health scan active
              </span>
              <span className="font-mono text-slate-400 text-[10.5px]">Zero debit bounce</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 relative flex-1 justify-between">
            <div className="flex flex-col gap-1.5">
              {topRenewals.map((r) => (
                <div
                  key={r.transaction_id}
                  className="group flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer"
                  style={{
                    background: 'var(--color-amber-50)',
                    border: '1px solid var(--color-amber-100)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FFF8E6'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-amber-50)'
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {r.customer_name}
                    </div>
                    <div className="mono text-[10.5px]" style={{ color: 'var(--color-amber-700)' }}>
                      Scheduled {fmtChargeAt(r.charge_at)}
                    </div>
                  </div>
                  <span
                    className="mono font-bold text-[13px] shrink-0 ml-2"
                    style={{ color: 'var(--color-amber-700)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtINR(r.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  )
}
