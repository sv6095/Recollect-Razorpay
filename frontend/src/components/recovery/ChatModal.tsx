'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction } from '@/types'
import { useToast } from './ToastContext'
import { WhatsAppIcon } from './WhatsAppIcon'
import { getCustomerDetails } from './customerUtils'

interface ChatMessage {
  id: string
  sender: 'customer' | 'merchant' | 'ai-agent'
  text: string
  timestamp: string
}

interface ChatModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}

const QUICK_REPLIES = [
  'Payment link please?',
  'Can we schedule a callback?',
  'Confirming PTP today',
  'Need EMI option',
]

function makeInitialMessages(txn?: Transaction | null): ChatMessage[] {
  const name = txn?.customer_name || 'Customer'
  const amt = txn?.amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(txn.amount) : 'the pending amount'
  const today = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return [
    {
      id: 'm1',
      sender: 'ai-agent',
      text: `Hi ${name} 👋 This is Re-Collect AI from Razorpay. We noticed ${amt} is pending on your account. Happy to help with a flexible payment plan today!`,
      timestamp: today,
    },
    {
      id: 'm2',
      sender: 'customer',
      text: 'Oh sorry, I missed the auto-debit notification. Can you share the payment link again?',
      timestamp: today,
    },
  ]
}

export function ChatModal({ open, onClose, transaction }: ChatModalProps) {
  const { showToast } = useToast()
  const details = getCustomerDetails(transaction)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setMessages(makeInitialMessages(transaction))
      setDraft('')
    }
  }, [open, transaction])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = (text: string) => {
    const content = text.trim()
    if (!content) return
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [
      ...prev,
      { id: `s-${Date.now()}`, sender: 'merchant', text: content, timestamp: now },
    ])
    setDraft('')

    setIsTyping(true)
    setTimeout(() => {
      const replies = [
        'Understood — sending a fresh payment link to your registered email and WhatsApp in one moment.',
        'Great — I can split this into 3 interest-free installments. Want me to set that up?',
        'Thank you! Confirming PTP logged for today — your account will reflect recovery shortly.',
        'A finance agent will call you within 15 minutes to walk through options. Stay tuned.',
      ]
      const reply = replies[Math.floor(Math.random() * replies.length)]
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        { id: `r-${Date.now()}`, sender: 'customer', text: reply, timestamp: now },
      ])
    }, 1200)
  }

  const handleEsc = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  const initials = (details.name || 'AS').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

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
          style={{ width: '100%', maxWidth: 560, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onKeyDown={handleEsc}
          role="dialog"
          aria-modal="true"
          aria-label="Live Chat"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-5"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand-600) 0%, var(--color-brand-700) 100%)',
              color: '#fff',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#fff',
                }}
              >
                {initials || 'AS'}
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <h3 className="text-[14.5px] font-semibold">
                  Chat with {details.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-green-500)' }} />
                  Active session · AI Copilot assisting
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => showToast('Call initiated', 'Switching to voice channel with customer…', 'info')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Switch to call"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>call</span>
              </button>
              <button
                onClick={() => showToast('Opened WhatsApp', 'Opening same conversation in WhatsApp…', 'info')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Switch to WhatsApp"
              >
                <WhatsAppIcon size={18} color="#fff" />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Close chat"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
          </div>

          {/* Context chip */}
          {transaction && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ background: 'var(--color-brand-50)', borderBottom: '1px solid var(--color-brand-100)' }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--color-brand-700)' }}>receipt_long</span>
                <span className="text-[12px]" style={{ color: 'var(--color-text-3)' }}>
                  Regarding <strong style={{ color: 'var(--color-text-2)' }}>{transaction.failure_type?.replace(/_/g, ' ')}</strong>
                </span>
              </div>
              <span className="mono font-bold text-[13px]" style={{ color: 'var(--color-brand-700)' }}>
                {transaction.amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(transaction.amount) : ''}
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex flex-col gap-3 px-5 py-4 overflow-y-auto"
            style={{ maxHeight: 380, background: 'var(--color-surface-mute)' }}
          >
            {messages.map((m) => {
              const isMe = m.sender === 'merchant'
              const isAI = m.sender === 'ai-agent'
              return (
                <motion.div
                  key={m.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="flex items-end gap-2 max-w-[78%]">
                    {!isMe && (
                      <div
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: isAI
                            ? 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-700))'
                            : '#fff',
                          color: isAI ? '#fff' : 'var(--color-text-3)',
                          border: !isAI ? '1px solid var(--color-border)' : 'none',
                        }}
                      >
                        {isAI ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                        ) : (
                          initials
                        )}
                      </div>
                    )}
                    <div
                      className="flex flex-col gap-1"
                      style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}
                    >
                      <div
                        className="px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed"
                        style={{
                          background: isMe
                            ? 'var(--color-brand-600)'
                            : isAI
                              ? '#fff'
                              : '#fff',
                          color: isMe ? '#fff' : 'var(--color-text-2)',
                          border: !isMe ? '1px solid var(--color-border)' : 'none',
                          borderBottomRightRadius: isMe ? 4 : undefined,
                          borderBottomLeftRadius: !isMe ? 4 : undefined,
                          boxShadow: isMe
                            ? '0 4px 12px rgba(43,81,214,0.22)'
                            : '0 1px 2px rgba(16,24,40,0.04)',
                        }}
                      >
                        {m.text}
                      </div>
                      <span className="text-[10px] mono" style={{ color: 'var(--color-text-4)' }}>
                        {m.timestamp}
                        {isAI && <span className="ml-1" style={{ color: 'var(--color-brand-600)' }}>· AI</span>}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}

            {isTyping && (
              <motion.div
                className="flex justify-start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex items-end gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: '#fff', border: '1px solid var(--color-border)', color: 'var(--color-text-3)' }}
                  >
                    {initials}
                  </div>
                  <div
                    className="px-4 py-3 rounded-2xl"
                    style={{ background: '#fff', border: '1px solid var(--color-border)', borderBottomLeftRadius: 4 }}
                  >
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-text-4)', animation: 'bounce 1s infinite 0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-text-4)', animation: 'bounce 1s infinite 0.2s' }} />
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-text-4)', animation: 'bounce 1s infinite 0.4s' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick replies */}
          <div
            className="flex items-center gap-2 px-5 py-3 overflow-x-auto"
            style={{ borderTop: '1px solid var(--color-border-soft)', background: '#fff' }}
          >
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16, color: 'var(--color-text-4)' }}>bolt</span>
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => sendMessage(qr)}
                className="shrink-0 text-[11.5px] font-medium px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: 'var(--color-surface-mute)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-brand-50)'
                  e.currentTarget.style.borderColor = 'var(--color-brand-200)'
                  e.currentTarget.style.color = 'var(--color-brand-700)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-mute)'
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.color = 'var(--color-text-3)'
                }}
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Input */}
          <div
            className="flex items-end gap-2 p-4"
            style={{ borderTop: '1px solid var(--color-border-soft)', background: '#fff' }}
          >
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
              style={{ color: 'var(--color-text-3)', background: 'var(--color-surface-mute)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-soft)'; e.currentTarget.style.color = 'var(--color-text-2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-mute)'; e.currentTarget.style.color = 'var(--color-text-3)' }}
              title="Attach"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>attach_file</span>
            </button>
            <div className="flex-1 relative">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage(draft)
                  }
                }}
                placeholder="Type a message — AI will help personalize…"
                rows={1}
                className="w-full resize-none rounded-xl text-[13px] p-2.5 pr-10"
                style={{
                  background: 'var(--color-surface-mute)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  minHeight: 40,
                  maxHeight: 110,
                  outline: 'none',
                }}
              />
              <button
                className="absolute right-2 bottom-1.5 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                style={{ color: draft.trim() ? 'var(--color-brand-700)' : 'var(--color-text-4)', background: draft.trim() ? 'var(--color-brand-50)' : 'transparent' }}
                onClick={() => showToast('AI suggested', 'Personalization hint injected into draft', 'info')}
                title="Ask AI to improve this message"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              </button>
            </div>
            <button
              onClick={() => sendMessage(draft)}
              disabled={!draft.trim() && !isTyping ? false : false}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={{
                background: 'var(--color-brand-600)',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(43,81,214,0.25)',
                opacity: draft.trim() ? 1 : 0.5,
              }}
              onMouseEnter={(e) => draft.trim() && (e.currentTarget.style.background = 'var(--color-brand-700)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-brand-600)')}
              title="Send message"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>send</span>
            </button>
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </AnimatePresence>
  )
}
