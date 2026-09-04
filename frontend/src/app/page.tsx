'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { WSEvent, RecoveryStats, Escalation, Transaction, UpcomingRenewal } from '@/types'
import { useWebSocket } from '@/hooks/useWebSocket'

import { ToastProvider } from '@/components/recovery/ToastContext'
import { Header } from '@/components/recovery/Header'
import { Sidebar } from '@/components/recovery/Sidebar'
import { HeroMetrics } from '@/components/recovery/HeroMetrics'
import { PriorityActions } from '@/components/recovery/PriorityActions'
import { TransactionsTable } from '@/components/recovery/TransactionsTable'
import { ChatModal } from '@/components/recovery/ChatModal'
import { WhatsAppModal } from '@/components/recovery/WhatsAppModal'
import { VoiceCallModal } from '@/components/recovery/VoiceCallModal'
import { AgentStepInspector } from '@/components/recovery/AgentStepInspector'

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

const DEFAULT_TXN: Transaction = {
  id: '',
  merchant_id: '',
  customer_id: '',
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  amount: 0,
  failure_type: '',
  state: 'DETECTED',
  state_version: 0,
  category: null,
  recovery_prob: 0,
  channel: 'NONE',
  days_overdue: 0,
  prior_contact_count: 0,
  has_consent: true,
  is_preemptive: false,
  payment_link_url: null,
  abort_reason: null,
  extra: '',
  created_at: '',
  updated_at: '',
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <RecoveryConsolePage />
    </ToastProvider>
  )
}

function RecoveryConsolePage() {
  const [stats, setStats] = useState<RecoveryStats>(DEFAULT_STATS)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [renewals, setRenewals] = useState<UpcomingRenewal[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [, setSelectedTxn] = useState<Transaction | null>(null)

  // ── Agent Pipeline Inspector state ─────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorAgent, setInspectorAgent] = useState<string | null>(null)
  const [inspectorTxn, setInspectorTxn] = useState<Transaction | null>(null)
  const [liveEvents, setLiveEvents] = useState<WSEvent[]>([])

  const openPipelineInspector = (agentKey?: string | null) => {
    setInspectorTxn(null)
    setInspectorAgent(agentKey || null)
    setInspectorOpen(true)
  }

  const inspectTransaction = (txn: Transaction) => {
    setSelectedTxn(txn)
    setInspectorTxn(txn)
    setInspectorOpen(true)
  }

  // ── Communication modals state ─────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false)
  const [whatsAppOpen, setWhatsAppOpen] = useState(false)
  const [voiceCallOpen, setVoiceCallOpen] = useState(false)
  const [commTargetTxn, setCommTargetTxn] = useState<Transaction | null>(null)

  const openChatFor = (txn?: Transaction) => {
    setCommTargetTxn(txn ?? (transactions.length > 0 ? transactions[0] : null))
    setChatOpen(true)
  }
  const openWhatsAppFor = (txn?: Transaction) => {
    setCommTargetTxn(txn ?? (transactions.length > 0 ? transactions[0] : null))
    setWhatsAppOpen(true)
  }
  const openVoiceCallFor = (txn?: Transaction) => {
    setCommTargetTxn(txn ?? (transactions.length > 0 ? transactions[0] : null))
    setVoiceCallOpen(true)
  }

  // ── Initial data loads ─────────────────────────────────────────
  useEffect(() => {
    let alive = true
    fetch('/api/stats')
      .then((r) => r.ok ? r.json() : DEFAULT_STATS)
      .then((data) => alive && setStats((s) => ({ ...s, ...data })))
      .catch(() => {})

    fetch('/api/transactions')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!alive) return
        if (Array.isArray(data)) {
          const shaped: Transaction[] = data.map((t: any) => ({
            ...DEFAULT_TXN,
            id: t.id || t.transaction_id,
            transaction_id: t.transaction_id || t.id,
            merchant_id: t.merchant_id || DEFAULT_TXN.merchant_id,
            customer_id: t.customer_id || DEFAULT_TXN.customer_id,
            customer_name: t.customer_name || DEFAULT_TXN.customer_name,
            customer_phone: t.customer_phone || DEFAULT_TXN.customer_phone,
            customer_email: t.customer_email || DEFAULT_TXN.customer_email,
            amount: Number(t.amount) || 0,
            failure_type: t.failure_type || DEFAULT_TXN.failure_type,
            state: t.state || DEFAULT_TXN.state,
            state_version: t.state_version ?? 0,
            category: t.category ?? null,
            recovery_prob: Number(t.recovery_prob) || 0,
            channel: t.channel || DEFAULT_TXN.channel,
            days_overdue: Number(t.days_overdue) || 0,
            prior_contact_count: Number(t.prior_contact_count) || 0,
            has_consent: t.has_consent !== false,
            is_preemptive: !!t.is_preemptive,
            payment_link_url: t.payment_link_url ?? null,
            abort_reason: t.abort_reason ?? null,
            extra: typeof t.extra === 'string' ? t.extra : JSON.stringify(t.extra ?? {}),
            created_at: t.created_at || new Date().toISOString(),
            updated_at: t.updated_at || t.created_at || new Date().toISOString(),
          }))
          setTransactions(shaped)
        }
      })
      .catch(() => {})

    fetch('/api/escalations')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => alive && Array.isArray(data) && setEscalations(data))
      .catch(() => {})

    fetch('/api/upcoming-renewals')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => alive && Array.isArray(data) && setRenewals(data))
      .catch(() => {})

    return () => { alive = false }
  }, [])

  // ── Live WebSocket stream ──────────────────────────────────────
  const handleEvent = useCallback((event: WSEvent) => {
    setLiveEvents((prev) => [event, ...prev.slice(0, 49)])

    if (event.type === 'counter_update' && event.stats) {
      setStats((s) => ({ ...s, ...event.stats }))
      setRefreshKey((k) => k + 1)
      return
    }

    if (event.type === 'recovery_confirmed') {
      if (event.stats) setStats((s) => ({ ...s, ...event.stats }))
      if (event.transaction_id) {
        setTransactions((prev) =>
          prev.map((t) =>
            (t.id === event.transaction_id || t.transaction_id === event.transaction_id)
              ? { ...t, state: 'RECOVERED', updated_at: event.timestamp || new Date().toISOString() }
              : t
          )
        )
      }
      setRefreshKey((k) => k + 1)
      return
    }

    if (event.type === 'escalation') {
      fetch('/api/escalations')
        .then((r) => r.ok ? r.json() : [])
        .then((data) => Array.isArray(data) && setEscalations(data))
        .catch(() => {})
      return
    }

    if (event.type === 'state_change') {
      fetch('/api/stats')
        .then((r) => r.ok ? r.json() : DEFAULT_STATS)
        .then((data) => setStats((s) => ({ ...s, ...data })))
        .catch(() => {})
      return
    }
  }, [])

  const { isConnected } = useWebSocket({ onEvent: handleEvent })

  const escalatedValue = escalations.reduce((s, e) => s + (e.amount || 0), 0)

  return (
    <>
      <Header
        isConnected={isConnected}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenChat={() => openChatFor()}
        onOpenWhatsApp={() => openWhatsAppFor()}
        onOpenVoiceCall={() => openVoiceCallFor()}
      />
      <Sidebar
        escalationCount={escalations.length}
        onOpenChat={() => openChatFor()}
        onOpenWhatsApp={() => openWhatsAppFor()}
        onOpenVoiceCall={() => openVoiceCallFor()}
        onOpenPipeline={() => openPipelineInspector()}
      />

      <div className="app-main">
        <main
          className="w-full"
          style={{
            background:
              'linear-gradient(180deg, #F5F7FB 0%, #EEF2F9 25%, #F5F7FB 100%)',
            minHeight: '100vh',
          }}
        >
          {/* Wide page gutter for editorial spacing */}
          <div className="w-full px-6 lg:px-10 py-8 max-w-[1500px] mx-auto">

            {/* Page intro: merchant-greeting, not "Recovery Console" tech label */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-7"
            >
              <div>
                <h1
                  className="tracking-tight leading-[1.1] font-bold"
                  style={{
                    fontSize: '28px',
                    letterSpacing: '-0.03em',
                    color: 'var(--color-text)',
                  }}
                >
                  Payment Recovery Engine
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button className="btn-secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_today</span>
                  Last 14 days
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
                </button>
                <button className="btn-primary btn-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>north_east</span>
                  Invite teammate
                </button>
              </div>
            </motion.div>

            {/* ── 1. Hero KPIs ─────────────────────────────── */}
            <section className="mb-8">
              <HeroMetrics stats={stats} onOpenPipeline={() => openPipelineInspector()} />
            </section>

            {/* ── 2. Priority actions (Escalations + Sentinel) */}
            <section className="mb-8">
              <PriorityActions
                escalations={escalations}
                renewals={renewals}
                totalAtRisk={stats.total_at_risk || 0}
                escalatedValue={escalatedValue}
              />
            </section>



            {/* ── 4. All cases table ──────────────────────── */}
            <section id="cases-table-section">
              <TransactionsTable
                transactions={transactions}
                searchQuery={searchQuery}
                onSelect={(t) => inspectTransaction(t)}
                onInspectTransaction={(t) => inspectTransaction(t)}
                onChatCustomer={(t) => openChatFor(t)}
                onWhatsAppCustomer={(t) => openWhatsAppFor(t)}
                onCallCustomer={(t) => openVoiceCallFor(t)}
              />
            </section>

            {/* Footer */}
            <footer className="mt-12 pt-6 flex items-center justify-between flex-wrap gap-3" style={{ borderTop: '1px solid var(--color-border-soft)' }}>
              <div className="flex items-center gap-2" style={{ fontSize: 11.5, color: 'var(--color-text-4)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--color-text-5)' }}>info</span>
                Data refreshes in real-time via WebSocket. All times in IST.
              </div>
              <div className="flex items-center gap-4" style={{ fontSize: 11.5, color: 'var(--color-text-4)' }}>
                <span>v1.0 · Re-Collect by Razorpay</span>
                <span style={{ color: 'var(--color-text-5)' }}>•</span>
                <span className="mono">secure · tls · signed webhooks</span>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* ── Communication modals ─────────────────────────────── */}
      <ChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        transaction={commTargetTxn}
      />
      <WhatsAppModal
        open={whatsAppOpen}
        onClose={() => setWhatsAppOpen(false)}
        transaction={commTargetTxn}
      />
      <VoiceCallModal
        open={voiceCallOpen}
        onClose={() => setVoiceCallOpen(false)}
        transaction={commTargetTxn}
      />

      {/* ── Agent Step & Decision Inspector Modal ────────────── */}
      <AgentStepInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        selectedAgent={inspectorAgent}
        onSelectAgent={setInspectorAgent}
        liveRows={liveEvents}
        selectedTxn={inspectorTxn}
        onClearTxn={() => setInspectorTxn(null)}
      />
    </>
  )
}
