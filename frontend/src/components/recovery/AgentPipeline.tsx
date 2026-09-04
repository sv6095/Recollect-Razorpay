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
  onInspectAgent?: (agentKey: string) => void
}

export function AgentPipeline({ rows, activeAgent, onAgentClick, onInspectAgent }: AgentPipelineProps) {
  const countForAgent = (key: string) => rows.filter((r) => r.agent === key).length

  return (
    // Tier 1: no border, no shadow, no fill — just whitespace + label
    <section className="flex flex-col gap-5">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold" style={{ color: '#0F1117' }}>
              Agent pipeline
            </h2>
            <span className="chip chip-recovered text-[9px]">
              ● LIVE WS STREAM
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: '#8B9BB4' }}>
            {rows.length} live event{rows.length === 1 ? '' : 's'} streamed · click a step to filter or inspect execution traces
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onInspectAgent && (
            <button
              onClick={() => onInspectAgent(activeAgent || PIPELINE_STEPS[0].key)}
              className="btn-secondary text-[12px] py-1 px-3 flex items-center gap-1.5"
              style={{ background: '#FFFFFF', borderColor: '#DDE1EA', color: '#1A2130' }}
            >
              <span className="material-symbols-outlined text-[15px] text-[#2B51D6]">
                troubleshoot
              </span>
              <span>Inspect Agent Steps</span>
            </button>
          )}

          {activeAgent && (
            <button
              onClick={() => onAgentClick(null)}
              className="text-[11px] font-medium transition-colors px-2 py-1 rounded"
              style={{ color: '#2B51D6', background: '#EEF2FE' }}
            >
              Clear filter ×
            </button>
          )}
        </div>
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
            // Has events → white circle with agent-colored icon
            // Selected → accent-filled circle with white icon + subtle glow
            const nodeBg = isActive
              ? '#2B51D6'
              : hasEvents
              ? '#FFFFFF'
              : '#F9FAFB'

            const nodeBorder = isActive
              ? '2px solid #2B51D6'
              : hasEvents
              ? `2px solid ${step.color}`
              : '1.5px solid #DDE1EA'

            const iconColor = isActive ? '#FFFFFF' : hasEvents ? step.color : '#8B9BB4'

            return (
              <button
                key={step.key}
                onClick={() => {
                  onAgentClick(isActive ? null : step.key)
                }}
                onDoubleClick={() => {
                  onInspectAgent?.(step.key)
                }}
                className="flex-1 flex flex-col items-center gap-2 pb-3 px-1 relative group cursor-pointer"
                style={{
                  zIndex: 10,
                }}
                title={`Click to filter by ${step.label} · Double-click to inspect`}
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
                  <span
                    className="material-symbols-outlined text-[15px]"
                    style={{
                      color: iconColor,
                      fontVariationSettings: `'FILL' ${isActive ? '1' : '0'}`,
                    }}
                  >
                    {step.icon}
                  </span>
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
