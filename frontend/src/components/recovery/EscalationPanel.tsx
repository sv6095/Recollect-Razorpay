'use client'

import type { Escalation } from '@/types'
import { useToast } from './ToastContext'

interface EscalationPanelProps {
  escalations: Escalation[]
}

function fmtAmount(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n)
}

export function EscalationPanel({ escalations }: EscalationPanelProps) {
  const { showToast } = useToast()

  return (
    // Tier 3: real elevation, left red accent bar (t3-panel t3-escalation)
    <section
      className="t3-panel t3-escalation flex flex-col"
      style={{ padding: '18px 20px', gap: '16px' }}
    >
      {/* Panel header — plain icon, no pastel circle */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: '#B91C1C', fontVariationSettings: "'FILL' 1" }}
            >
              support_agent
            </span>
            <h3 className="text-[13px] font-semibold" style={{ color: '#0F1117' }}>
              Human escalation
            </h3>
          </div>
          <p className="text-[11px]" style={{ color: '#8B9BB4' }}>
            Guardrails exceeded · needs review
          </p>
        </div>

        {/* Count — only shown, never pulsing */}
        {escalations.length > 0 && (
          <span
            className="font-mono text-[12px] font-bold"
            style={{ color: '#B91C1C' }}
          >
            {escalations.length}
          </span>
        )}
      </div>

      {/* Escalation rows */}
      <div className="flex flex-col gap-2">
        {escalations.map((esc) => (
          <div
            key={esc.id}
            className="flex flex-col gap-2"
            style={{
              padding: '10px 12px',
              borderLeft: '2px solid #B91C1C',
              background: '#FEF2F2',
              borderRadius: '0 4px 4px 0',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px]" style={{ color: '#8B9BB4' }}>
                #{esc.id.slice(0, 8)}
              </span>
              <span
                className="font-mono text-[12px] font-bold"
                style={{ color: '#0F1117', fontVariantNumeric: 'tabular-nums' }}
              >
                {fmtAmount(esc.amount)}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed" style={{ color: '#7F1D1D' }}>
              {esc.reason}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: '#5A6578' }}>
                {esc.customer_name}
                {esc.days_overdue > 0 && (
                  <span className="ml-1.5 font-mono" style={{ color: '#B91C1C' }}>
                    {esc.days_overdue}d overdue
                  </span>
                )}
              </span>
              <button
                onClick={() => showToast('Case opened', `Loading escalation #${esc.id.slice(0, 8)}`, 'info')}
                className="text-[11px] font-semibold transition-colors"
                style={{ color: '#2B51D6' }}
              >
                {esc.status === 'open' ? 'Review →' : 'Acknowledge →'}
              </button>
            </div>
          </div>
        ))}

        {escalations.length === 0 && (
          <div
            className="flex items-center gap-2.5"
            style={{ padding: '10px 0' }}
          >
            <span
              className="material-symbols-outlined text-[15px]"
              style={{ color: '#15803D', fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <div>
              <p className="text-[12px] font-medium" style={{ color: '#3F4A5F' }}>
                No active escalations
              </p>
              <p className="text-[11px]" style={{ color: '#8B9BB4' }}>
                System operating within bounds
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
