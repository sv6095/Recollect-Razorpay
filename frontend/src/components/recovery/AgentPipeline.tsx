'use client'

import type { WSEvent } from '@/types'

// Real agent names from workflow.py
const PIPELINE_STEPS = [
  {
    key: 'PolicyGate',
    label: 'Policy Gate',
    role: 'DND · calling hours · rate limit',
    icon: 'shield_lock',
    color: '#5A6578',
  },
  {
    key: 'TriageAgent',
    label: 'Triage',
    role: 'Classify failure, assign category',
    icon: 'sort',
    color: '#2B51D6',
  },
  {
    key: 'SalaryDaySequencer',
    label: 'Salary Day',
    role: 'Cat A — retry on pay-credit date',
    icon: 'calendar_today',
    color: '#7C3AED',
  },
  {
    key: 'B2BDebtChaser',
    label: 'B2B Chaser',
    role: 'Cat B — invoice dunning',
    icon: 'business',
    color: '#0369A1',
  },
  {
    key: 'CartRescuer',
    label: 'Cart Rescuer',
    role: 'Cat C — partial link recovery',
    icon: 'shopping_cart',
    color: '#D97706',
  },
  {
    key: 'SentinelAgent',
    label: 'Sentinel',
    role: 'Pre-debit mandate check',
    icon: 'radar',
    color: '#B45309',
  },
  {
    key: 'RiskAgent',
    label: 'Risk Agent',
    role: 'Semantic guardrail',
    icon: 'security',
    color: '#B91C1C',
  },
  {
    key: 'ArbiterAgent',
    label: 'Arbiter',
    role: 'Business adjudication',
    icon: 'balance',
    color: '#0F766E',
  },
]

export { PIPELINE_STEPS }

interface AgentPipelineProps {
  rows: WSEvent[]
  activeAgent: string | null
  onAgentClick: (agentKey: string | null) => void
}

export function AgentPipeline({ rows, activeAgent, onAgentClick }: AgentPipelineProps) {
  const countForAgent = (key: string) => rows.filter((r) => r.agent === key).length

  return (
    // Tier 1: no border, no shadow, no fill — just whitespace + label
    <section className="flex flex-col gap-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: '#0F1117' }}>
            Agent pipeline
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
            {rows.length} events processed · click a step to filter the audit trail
          </p>
        </div>
        {activeAgent && (
          <button
            onClick={() => onAgentClick(null)}
            className="text-[11px] font-medium transition-colors"
            style={{ color: '#2B51D6' }}
          >
            Clear filter ×
          </button>
        )}
      </div>

      {/* Rail container */}
      <div className="relative pipeline-container">
        {/* The physical connector rail — a continuous line through all nodes */}
        <div className="pipeline-rail" />

        {/* Step nodes — laid out in a flex row, each takes equal width */}
        <div className="flex">
          {PIPELINE_STEPS.map((step, idx) => {
            const count    = countForAgent(step.key)
            const isActive = activeAgent === step.key
            const hasEvents = count > 0

            // Node appearance encodes state:
            // Idle → grey circle with step number only
            // Has events → white circle with agent-colored icon (no pastel bg)
            // Selected → accent-filled circle with white icon + subtle glow
            const nodeBg = isActive
              ? '#2B51D6'
              : hasEvents
              ? '#FFFFFF'
              : '#F1F3F7'

            const nodeBorder = isActive
              ? '2px solid #2B51D6'
              : hasEvents
              ? `1.5px solid ${step.color}60`
              : '1.5px solid #DDE1EA'

            const iconColor = isActive ? '#FFFFFF' : hasEvents ? step.color : '#C4CBDB'

            return (
              <button
                key={step.key}
                onClick={() => hasEvents ? onAgentClick(isActive ? null : step.key) : undefined}
                disabled={!hasEvents}
                className="flex-1 flex flex-col items-center gap-2 pb-3 px-1 relative"
                style={{
                  cursor: hasEvents ? 'pointer' : 'default',
                  zIndex: 10,
                }}
                title={hasEvents ? `Filter by ${step.label}` : step.label}
              >
                {/* Node circle — centered on the rail */}
                <div
                  className={isActive ? 'node-selected' : ''}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: nodeBg,
                    border: nodeBorder,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s, border-color 0.15s',
                    position: 'relative',
                    zIndex: 10,
                  }}
                >
                  {hasEvents ? (
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{
                        color: iconColor,
                        fontVariationSettings: `'FILL' ${isActive ? '1' : '1'}`,
                      }}
                    >
                      {step.icon}
                    </span>
                  ) : (
                    // Idle: just the step number, monochrome
                    <span
                      className="font-mono text-[10px] font-bold"
                      style={{ color: '#C4CBDB' }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Event count — below node, in agent color */}
                {count > 0 && (
                  <span
                    className="font-mono text-[10px] font-bold leading-none"
                    style={{ color: isActive ? '#2B51D6' : step.color }}
                  >
                    {count}
                  </span>
                )}

                {/* Agent label — sentence case, tight */}
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className="text-[11px] font-semibold text-center leading-tight"
                    style={{ color: isActive ? '#2B51D6' : hasEvents ? '#1A2130' : '#8B9BB4' }}
                  >
                    {step.label}
                  </span>
                  <span
                    className="text-[10px] text-center leading-relaxed px-1"
                    style={{ color: '#8B9BB4' }}
                  >
                    {step.role}
                  </span>
                </div>

                {/* Step number — bottom, very subtle */}
                <span
                  className="font-mono text-[9px]"
                  style={{ color: '#C4CBDB' }}
                >
                  {`0${idx + 1}`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
