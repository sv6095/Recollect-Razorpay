'use client'

import { useState, useCallback, useEffect } from 'react'
import type { WSEvent, RecoveryStats, Escalation } from '@/types'
import { useWebSocket } from '@/hooks/useWebSocket'

import { ToastProvider } from '@/components/recovery/ToastContext'
import { Header } from '@/components/recovery/Header'
import { Sidebar } from '@/components/recovery/Sidebar'
import { PipelineStatus } from '@/components/recovery/PipelineStatus'
import { AgentPipeline } from '@/components/recovery/AgentPipeline'
import { AuditTrail } from '@/components/recovery/AuditTrail'
import { EscalationPanel } from '@/components/recovery/EscalationPanel'
import { ComplianceGate } from '@/components/recovery/ComplianceGate'
import { SentinelPanel } from '@/components/recovery/SentinelPanel'

const DEFAULT_STATS: RecoveryStats = {
  merchant_id: '',
  total_transactions: 0,
  total_at_risk: 0,
  total_recovered: 0,
  count_recovered: 0,
  count_aborted: 0,
  count_written_off: 0,
  count_escalated: 0,
  ai_cost_inr: 0,
  roi_multiple: 0,
}

const MAX_AUDIT_ROWS = 300

function RecoveryConsolePage() {
  const [stats, setStats]           = useState<RecoveryStats>(DEFAULT_STATS)
  const [auditRows, setAuditRows]   = useState<WSEvent[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/api/demo/stats')
      .then((r) => r.json())
      .then((data) => setStats((s) => ({ ...s, ...data })))
      .catch(() => {})

    fetch('/api/demo/escalations')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setEscalations(data))
      .catch(() => {})
  }, [])

  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === 'counter_update' && event.stats) {
      setStats((s) => ({ ...s, ...event.stats }))
      setRefreshKey((k) => k + 1)
      return
    }
    if (
      event.type === 'audit_row'    ||
      event.type === 'decision_ledger' ||
      event.type === 'recovery_confirmed'
    ) {
      setAuditRows((prev) => [event, ...prev].slice(0, MAX_AUDIT_ROWS))
      if (event.type === 'recovery_confirmed' && event.stats) {
        setStats((s) => ({ ...s, ...event.stats }))
        setRefreshKey((k) => k + 1)
      }
    }
    if (event.type === 'escalation') {
      setAuditRows((prev) => [event, ...prev].slice(0, MAX_AUDIT_ROWS))
      fetch('/api/demo/escalations')
        .then((r) => r.json())
        .then((data) => Array.isArray(data) && setEscalations(data))
        .catch(() => {})
    }
    if (event.type === 'state_change') {
      fetch('/api/demo/stats')
        .then((r) => r.json())
        .then((data) => setStats((s) => ({ ...s, ...data })))
        .catch(() => {})
    }
  }, [])

  useWebSocket({ onEvent: handleEvent })

  useEffect(() => {
    const check = async () => {
      try { setIsConnected((await fetch('/api/demo/stats')).ok) }
      catch { setIsConnected(false) }
    }
    check()
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <Header
        isConnected={isConnected}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <Sidebar escalationCount={escalations.length} />

      <div className="layout-main">
        <main
          className="w-full px-6 py-6 min-h-screen"
          style={{ background: '#F1F3F7' }}
        >
          <div className="flex flex-col gap-6 max-w-[1400px]">

            {/* Page title */}
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[11px] font-medium mb-1" style={{ color: '#8B9BB4' }}>
                  Revenue recovery
                </p>
                <h1
                  className="text-[20px] font-bold tracking-tight leading-none"
                  style={{ color: '#0F1117', letterSpacing: '-0.025em' }}
                >
                  Recovery Console
                </h1>
              </div>
              {isConnected && (
                <span className="font-mono text-[10px]" style={{ color: '#C4CBDB' }}>
                  connected
                </span>
              )}
            </div>

            {/* 4 KPI tiles */}
            <PipelineStatus stats={stats} />

            {/* Agent pipeline */}
            <AgentPipeline
              rows={auditRows}
              activeAgent={activeAgent}
              onAgentClick={setActiveAgent}
            />

            {/* Two-column workspace */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left — audit trail */}
              <div className="xl:col-span-8">
                <AuditTrail
                  rows={auditRows}
                  agentFilter={activeAgent}
                  searchQuery={searchQuery}
                />
              </div>

              {/* Right rail */}
              <div className="xl:col-span-4 flex flex-col gap-5">
                <EscalationPanel escalations={escalations} />
                <SentinelPanel refreshKey={refreshKey} />
                <ComplianceGate stats={stats} />
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  )
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <RecoveryConsolePage />
    </ToastProvider>
  )
}

