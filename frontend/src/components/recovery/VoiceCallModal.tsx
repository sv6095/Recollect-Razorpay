'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction } from '@/types'
import { useToast } from './ToastContext'
import { getCustomerDetails } from './customerUtils'

type CallState = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'ended'

interface TranscriptLine {
  id: string
  speaker: 'agent' | 'customer'
  text: string
  time: string
}

interface VoiceCallModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}

const WAVEFORM_BARS = 36
const BASE_WAVE = [12, 20, 8, 28, 16, 4, 22, 14, 24, 10, 30, 16, 6, 18, 26, 12, 20, 4, 22, 14, 28, 16, 8, 24, 12, 18, 30, 14, 6, 20, 26, 10, 4, 16, 22, 18]

const AGENT_SCRIPT = [
  'Good afternoon, this is Re-Collect AI on behalf of Razorpay. Am I speaking with {name}?',
  'Wonderful. We noticed a pending payment — I have the details right here with me.',
  'The total amount due is ₹{amount} — we can walk through a few flexible options.',
  'I understand cash-flow can sometimes be tight, so let me quickly walk you through three flexible options we have prepared for you today.',
  'Option one is to settle the full amount today and receive a 2% early-settlement discount.',
  'Option two splits the balance into three interest-free payments over the next 45 days.',
  'Option three defers payment by 14 days with a small processing fee of 1.5%.',
  'Which of these works best for you — or would you like me to pause and transfer you to a human colleague?',
]

const CUSTOMER_REPLIES = [
  'Hi yes this is {name} speaking — hello.',
  'Okay sure, I did see a reminder. Can you walk me through it?',
  'Got it. I was actually expecting this call, honestly.',
  'Hmm, the three-installment plan sounds reasonable actually — but could you confirm zero interest?',
  'Alright, then let us go with option two please.',
  'Yes that is perfect — thank you for being so flexible.',
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function renderLine(line: string, txn?: Transaction | null): string {
  const details = getCustomerDetails(txn)
  const name = details.name.split(' ')[0]
  const amount = fmt(details.amount)
  return line.replace('{name}', name).replace('{amount}', amount)
}

export function VoiceCallModal({ open, onClose, transaction }: VoiceCallModalProps) {
  const { showToast } = useToast()
  const details = getCustomerDetails(transaction)
  const [callState, setCallState] = useState<CallState>('idle')
  const [muted, setMuted] = useState(false)
  const [hold, setHold] = useState(false)
  const [speaker, setSpeaker] = useState(true)
  const [callSeconds, setCallSeconds] = useState(0)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [scriptStep, setScriptStep] = useState(0)
  const [voiceLevel, setVoiceLevel] = useState(0.65)
  const [waveBoost, setWaveBoost] = useState<number[]>([])
  const transcriptScrollRef = useRef<HTMLDivElement>(null)

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const waveform = useMemo(() => {
    const bars = new Array(WAVEFORM_BARS).fill(0)
    return bars.map((_, i) => {
      const base = BASE_WAVE[i % BASE_WAVE.length] ?? 14
      const boost = waveBoost[i] ?? 0
      if (callState !== 'in-call' || hold) return 4
      if (muted) return 3 + (i % 3)
      return Math.min(30, base + boost)
    })
  }, [callState, hold, muted, waveBoost])

  useEffect(() => {
    if (!open) return
    setCallState('idle')
    setMuted(false)
    setHold(false)
    setSpeaker(true)
    setCallSeconds(0)
    setTranscript([])
    setScriptStep(0)
  }, [open])

  useEffect(() => {
    if (callState !== 'in-call' || hold) return
    const interval = setInterval(() => {
      setWaveBoost(
        new Array(WAVEFORM_BARS).fill(0).map(() => Math.floor(Math.random() * 14) - 4)
      )
    }, 120)
    return () => clearInterval(interval)
  }, [callState, hold])

  useEffect(() => {
    if (callState !== 'in-call') return
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [callState])

  useEffect(() => {
    if (callState !== 'in-call') return
    if (scriptStep >= AGENT_SCRIPT.length + CUSTOMER_REPLIES.length) return

    const delay = scriptStep === 0 ? 1400 : 2600 + Math.floor(Math.random() * 1400)
    const timer = setTimeout(() => {
      const isAgent = scriptStep % 2 === 0
      const pool = isAgent ? AGENT_SCRIPT : CUSTOMER_REPLIES
      const idx = Math.floor(scriptStep / 2)
      const raw = pool[idx] ?? (isAgent
        ? 'Let me confirm all details with you and send the payment link to your WhatsApp right now.'
        : 'Thank you, that works for me!')
      const now = new Date()
      const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setTranscript((prev) => [
        ...prev,
        {
          id: `l-${Date.now()}-${scriptStep}`,
          speaker: isAgent ? 'agent' : 'customer',
          text: renderLine(raw, transaction),
          time,
        },
      ])
      setScriptStep((s) => s + 1)
      setTimeout(() => {
        transcriptScrollRef.current?.scrollTo({ top: transcriptScrollRef.current.scrollHeight, behavior: 'smooth' })
      }, 50)
    }, delay)

    return () => clearTimeout(timer)
  }, [callState, scriptStep, transaction])

  const startCall = () => {
    setCallState('connecting')
    showToast('Dialing…', `Connecting B2B Voice Agent to ${details.name}`, 'info')
    setTimeout(() => setCallState('ringing'), 900)
    setTimeout(() => {
      setCallState('in-call')
      showToast('Call connected', `B2B Voice Agent is now speaking with ${details.name}`, 'success')
    }, 2600)
  }

  const endCall = () => {
    setCallState('ended')
    showToast(
      'Call completed',
      `Voice call ended — duration ${formatDuration(callSeconds)}. Transcript & summary logged to recovery pipeline.`,
      'info'
    )
  }

  const handleEsc = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  const initials = (details.name || 'AS').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase().slice(0, 2)
  const statusLabel: Record<CallState, string> = {
    idle: 'Ready to connect',
    connecting: 'Connecting via carrier…',
    ringing: 'Ringing customer…',
    'in-call': 'Active call — B2B Voice Agent speaking',
    ended: 'Call ended',
  }
  const statusColor: Record<CallState, string> = {
    idle: 'var(--color-text-4)',
    connecting: 'var(--color-amber-600)',
    ringing: 'var(--color-brand-600)',
    'in-call': 'var(--color-green-600)',
    ended: 'var(--color-text-3)',
  }

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="modal-surface"
          style={{ width: '100%', maxWidth: 640, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onKeyDown={handleEsc}
          role="dialog"
          aria-modal="true"
          aria-label="Voice Agent Call"
        >
          <div
            className="flex items-center justify-between p-5"
            style={{
              background: 'linear-gradient(135deg, #1A2138 0%, #0F1B4D 100%)',
              color: '#fff',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>record_voice_over</span>
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <h3 className="text-[14.5px] font-semibold">B2B Voice Agent · AI Call</h3>
                <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color: statusColor[callState] }}>
                  {callState === 'in-call' && (
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor[callState] }} />
                  )}
                  {statusLabel[callState]}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="Close"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>

          <div
            className="px-5 pt-5 pb-3"
            style={{
              background: 'radial-gradient(circle at 100% 0%, rgba(124,58,237,0.08), transparent 55%), #fff',
              borderBottom: '1px solid var(--color-border-soft)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-[18px] font-bold text-white shrink-0"
                    style={{
                      background: transaction?.category === 'B'
                        ? 'linear-gradient(135deg, #0369A1 0%, #1A2138 100%)'
                        : transaction?.category === 'A'
                          ? 'linear-gradient(135deg, #7C3AED 0%, #1A2138 100%)'
                          : transaction?.category === 'C'
                            ? 'linear-gradient(135deg, #D97706 0%, #1A2138 100%)'
                            : 'linear-gradient(135deg, #475569 0%, #1A2138 100%)',
                      boxShadow: '0 6px 18px rgba(26,33,56,0.22)',
                    }}
                  >
                    {initials || '??'}
                  </div>
                  {callState === 'in-call' && (
                    <motion.span
                      className="absolute rounded-full"
                      style={{
                        bottom: -2,
                        right: -2,
                        width: 18,
                        height: 18,
                        background: 'var(--color-green-500)',
                        boxShadow: '0 0 0 2px #fff',
                      }}
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {details.name}
                  </div>
                  <div className="mono text-[12px] font-medium" style={{ color: 'var(--color-brand-700)' }}>
                    {details.phone}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-4)' }}>
                    {details.email}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="mono font-bold" style={{ fontSize: 22, color: 'var(--color-brand-900)' }}>
                  {fmt(details.amount)}
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4" style={{ background: 'var(--color-surface-mute)', borderBottom: '1px solid var(--color-border-soft)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="eyebrow" style={{ fontSize: 10 }}>Live waveform · neural TTS</span>
              <span
                className="mono text-[12px] font-semibold"
                style={{
                  color: callState === 'in-call' ? 'var(--color-green-700)' : 'var(--color-text-3)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {callState === 'idle' ? '--:--' : formatDuration(callSeconds)}
              </span>
            </div>
            <div className="px-2">
              <svg className="w-full h-12" viewBox={`0 0 ${WAVEFORM_BARS * 6} 32`} preserveAspectRatio="none" fill="#7C3AED">
                {waveform.map((h, i) => (
                  <motion.rect
                    key={i}
                    x={i * 6}
                    y={(32 - h) / 2}
                    width="3"
                    height={h}
                    rx="1.5"
                    animate={{ opacity: hold ? 0.3 : muted ? 0.5 : 0.9 }}
                    transition={{ duration: 0.12 }}
                  />
                ))}
              </svg>
            </div>

            {callState === 'in-call' && (
              <div className="mt-3 flex items-center gap-3">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-violet-600)' }}>tune</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-violet-100)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${voiceLevel * 100}%`,
                      background: 'linear-gradient(90deg, #7C3AED, #9333EA)',
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={voiceLevel}
                  onChange={(e) => setVoiceLevel(parseFloat(e.target.value))}
                  className="w-20"
                  style={{ accentColor: '#7C3AED' }}
                />
              </div>
            )}
          </div>

          <div
            ref={transcriptScrollRef}
            className="px-5 py-4 overflow-y-auto"
            style={{ maxHeight: 200, background: '#fff' }}
          >
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
                <span className="material-symbols-outlined" style={{ fontSize: 26, color: 'var(--color-text-4)', opacity: 0.6 }}>transcribe</span>
                <div className="text-[12px]" style={{ color: 'var(--color-text-4)' }}>
                  {callState === 'idle'
                    ? 'Transcript will appear here once the agent begins conversation.'
                    : callState === 'ended'
                      ? 'No transcript captured.'
                      : 'Waiting for customer to pick up…'}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {transcript.map((l) => {
                  const isAgent = l.speaker === 'agent'
                  return (
                    <motion.div
                      key={l.id}
                      className={`flex gap-2 ${isAgent ? '' : 'flex-row-reverse'}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: isAgent
                            ? 'linear-gradient(135deg, #7C3AED, #9333EA)'
                            : '#F1F5F9',
                          color: isAgent ? '#fff' : 'var(--color-text-3)',
                        }}
                      >
                        {isAgent ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                        ) : (
                          initials
                        )}
                      </div>
                      <div
                        className="flex flex-col gap-0.5"
                        style={{ maxWidth: '78%', alignItems: isAgent ? 'flex-start' : 'flex-end' }}
                      >
                        <div
                          className="px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed"
                          style={{
                            background: isAgent ? 'var(--color-violet-50)' : 'var(--color-brand-50)',
                            color: 'var(--color-text-2)',
                            border: isAgent ? '1px solid var(--color-violet-100)' : '1px solid var(--color-brand-100)',
                            borderBottomLeftRadius: isAgent ? 4 : 16,
                            borderBottomRightRadius: isAgent ? 16 : 4,
                          }}
                        >
                          {l.text}
                        </div>
                        <span className="mono text-[9.5px]" style={{ color: 'var(--color-text-4)' }}>
                          {isAgent ? 'AI Voice' : details.name.split(' ')[0]} · {l.time}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-between px-6 py-5"
            style={{
              borderTop: '1px solid var(--color-border-soft)',
              background: 'linear-gradient(180deg, #FBFCFE 0%, #F5F7FB 100%)',
            }}
          >
            {callState === 'idle' || callState === 'ended' ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => showToast('Opened chat', 'Opening parallel chat with customer…', 'info')}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
                    style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-brand-100)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-brand-50)')}
                    title="Send message instead"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 21 }}>chat_bubble</span>
                  </button>
                  <button
                    onClick={() => showToast('Schedule', 'Opening scheduling with customer', 'info')}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
                    style={{ background: 'var(--color-amber-50)', color: 'var(--color-amber-700)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-amber-100)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-amber-50)')}
                    title="Schedule later"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 21 }}>schedule</span>
                  </button>
                </div>

                <button
                  onClick={startCall}
                  className="flex items-center gap-2 text-[14px] font-semibold px-5 py-3 rounded-2xl transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #12B76A 0%, #039855 100%)',
                    color: '#fff',
                    boxShadow: '0 8px 22px rgba(3,152,85,0.32)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 10px 28px rgba(3,152,85,0.42)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 22px rgba(3,152,85,0.32)'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>call</span>
                  {callState === 'ended' ? 'Call again' : 'Start AI Call'}
                </button>

                <button
                  onClick={() => showToast('Human agent', 'Transferring to a human collections specialist', 'info')}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
                  style={{ background: 'var(--color-surface-mute)', color: 'var(--color-text-3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-soft)'; e.currentTarget.style.color = 'var(--color-text-2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-mute)'; e.currentTarget.style.color = 'var(--color-text-3)' }}
                  title="Transfer to human"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 21 }}>supervisor_account</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    background: muted ? 'var(--color-rose-50)' : 'var(--color-surface-mute)',
                    color: muted ? 'var(--color-rose-700)' : 'var(--color-text-3)',
                    border: muted ? '1px solid var(--color-rose-100)' : '1px solid var(--color-border)',
                  }}
                  title={muted ? 'Unmute mic' : 'Mute mic'}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 22, fontVariationSettings: muted ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {muted ? 'mic_off' : 'mic'}
                  </span>
                </button>

                <button
                  onClick={() => setHold((h) => !h)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    background: hold ? 'var(--color-amber-50)' : 'var(--color-surface-mute)',
                    color: hold ? 'var(--color-amber-700)' : 'var(--color-text-3)',
                    border: hold ? '1px solid var(--color-amber-100)' : '1px solid var(--color-border)',
                  }}
                  title={hold ? 'Resume call' : 'Place on hold'}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 22, fontVariationSettings: hold ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {hold ? 'play_arrow' : 'pause'}
                  </span>
                </button>

                <button
                  onClick={() => setSpeaker((s) => !s)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    background: !speaker ? 'var(--color-text-4)' : 'var(--color-surface-mute)',
                    color: !speaker ? '#fff' : 'var(--color-text-3)',
                    border: !speaker ? '1px solid var(--color-text-4)' : '1px solid var(--color-border)',
                  }}
                  title={speaker ? 'Disable speaker' : 'Enable speaker'}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 22, fontVariationSettings: speaker ? "'FILL' 0" : "'FILL' 1" }}
                  >
                    {speaker ? 'volume_up' : 'volume_off'}
                  </span>
                </button>

                <button
                  onClick={() => showToast('Keypad', 'DTMF keypad opened', 'info')}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{ background: 'var(--color-surface-mute)', color: 'var(--color-text-3)', border: '1px solid var(--color-border)' }}
                  title="Keypad"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>dialpad</span>
                </button>

                <button
                  onClick={() => showToast('Add human', 'Human agent joining the call…', 'info')}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{ background: 'var(--color-violet-50)', color: 'var(--color-violet-600)', border: '1px solid var(--color-violet-100)' }}
                  title="Add human colleague"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>person_add</span>
                </button>

                <button
                  onClick={endCall}
                  className="w-14 h-14 rounded-[28px] flex items-center justify-center transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #F04438 0%, #D92D20 100%)',
                    color: '#fff',
                    boxShadow: '0 8px 22px rgba(240,68,56,0.35)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 10px 28px rgba(240,68,56,0.45)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 22px rgba(240,68,56,0.35)'
                  }}
                  title="End call"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 28, fontVariationSettings: "'FILL' 1", transform: 'rotate(135deg)' }}
                  >
                    call
                  </span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
