'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction } from '@/types'
import { useToast } from './ToastContext'
import { WhatsAppIcon } from './WhatsAppIcon'
import { getCustomerDetails } from './customerUtils'

interface WhatsAppTemplate {
  id: string
  name: string
  preview: string
  category: 'recovery' | 'reminder' | 'ptp' | 'settlement'
}

interface WhatsAppModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}

const TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 't1',
    name: 'Friendly Reminder',
    preview: 'Hi {name}! A gentle nudge about your pending payment of ₹{amount}. Tap the link to settle in 2 clicks 👉',
    category: 'reminder',
  },
  {
    id: 't2',
    name: 'Partial Payment Offer',
    preview: 'Hello {name}, we noticed ₹{amount} is pending. Re-Collect lets you split this into 3 EMIs — zero interest. Interested?',
    category: 'recovery',
  },
  {
    id: 't3',
    name: 'PTP Confirmation',
    preview: 'Thank you {name}! Confirming your Promise-to-Pay for ₹{amount} today. We will auto-debit — no action needed from you 🙌',
    category: 'ptp',
  },
  {
    id: 't4',
    name: 'Settlement Confirm',
    preview: '✅ Payment received: ₹{amount}. Thank you for settling with Razorpay Re-Collect. Your receipt is attached.',
    category: 'settlement',
  },
]

function renderTemplate(tpl: string, txn?: Transaction | null): string {
  const details = getCustomerDetails(txn)
  const name = details.name.split(' ')[0]
  const amount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(details.amount)
  return tpl.replace('{name}', name).replace('{amount}', amount)
}

export function WhatsAppModal({ open, onClose, transaction }: WhatsAppModalProps) {
  const { showToast } = useToast()
  const details = getCustomerDetails(transaction)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string>('t1')
  const [customMessage, setCustomMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentLog, setSentLog] = useState<Array<{ id: string; time: string; text: string }>>([])

  useEffect(() => {
    if (open) {
      setCustomMessage('')
    }
  }, [open])

  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0]
  const livePreview = customMessage.trim() || renderTemplate(selected.preview, transaction)

  const filteredTemplates = activeCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory)

  const catChips: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'reminder', label: 'Reminders' },
    { key: 'recovery', label: 'Recovery' },
    { key: 'ptp', label: 'PTP' },
    { key: 'settlement', label: 'Settlement' },
  ]

  const handleSend = async () => {
    if (!livePreview.trim()) return
    setSending(true)
    await new Promise((r) => setTimeout(r, 900))
    setSending(false)
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    setSentLog((prev) => [
      { id: `s-${Date.now()}`, time: now, text: livePreview },
      ...prev,
    ])
    showToast(
      'WhatsApp Sent',
      `Message dispatched via Twilio to ${details.phone}`,
      'success'
    )
    setCustomMessage('')
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
          style={{ width: '100%', maxWidth: 820, overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onKeyDown={handleEsc}
          role="dialog"
          aria-modal="true"
          aria-label="WhatsApp"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-5"
            style={{
              background: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
              color: '#fff',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
              >
                <WhatsAppIcon size={22} color="#fff" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <h3 className="text-[14.5px] font-semibold">WhatsApp Outreach</h3>
                <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#25D366' }} />
                  Messaging {details.name} · <span className="mono">{details.phone}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => showToast('Saved draft', 'Message saved to WhatsApp drafts', 'info')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Save draft"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bookmark</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                title="Close"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12" style={{ minHeight: 500 }}>
            {/* Left: Templates */}
            <div className="md:col-span-5 p-5" style={{ borderRight: '1px solid var(--color-border-soft)', background: 'var(--color-surface-mute)' }}>
              <div className="eyebrow mb-2" style={{ fontSize: 10 }}>Approved Templates</div>
              <h4 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Pick a template</h4>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {catChips.map((c) => {
                  const on = activeCategory === c.key
                  return (
                    <button
                      key={c.key}
                      onClick={() => setActiveCategory(c.key)}
                      className="text-[11.5px] px-2.5 py-1 rounded-full transition-all"
                      style={{
                        background: on ? '#128C7E' : '#fff',
                        color: on ? '#fff' : 'var(--color-text-3)',
                        border: `1px solid ${on ? '#128C7E' : 'var(--color-border)'}`,
                        fontWeight: 600,
                      }}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredTemplates.map((t) => {
                  const on = selectedId === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedId(t.id); setCustomMessage('') }}
                      className="text-left p-3.5 rounded-xl transition-all"
                      style={{
                        background: on ? '#fff' : 'transparent',
                        border: `1px solid ${on ? '#25D366' : 'var(--color-border-soft)'}`,
                        boxShadow: on ? '0 2px 10px rgba(37,211,102,0.15)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12.5px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
                          {t.name}
                        </span>
                        <span
                          className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: t.category === 'reminder' ? 'var(--color-amber-50)' :
                              t.category === 'recovery' ? 'var(--color-brand-50)' :
                              t.category === 'ptp' ? 'var(--color-violet-50)' :
                              'var(--color-green-50)',
                            color: t.category === 'reminder' ? 'var(--color-amber-700)' :
                              t.category === 'recovery' ? 'var(--color-brand-700)' :
                              t.category === 'ptp' ? 'var(--color-violet-600)' :
                              'var(--color-green-700)',
                          }}
                        >
                          {t.category}
                        </span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--color-text-3)' }}>
                        {renderTemplate(t.preview, transaction).slice(0, 92)}…
                      </p>
                    </button>
                  )
                })}
              </div>

              {sentLog.length > 0 && (
                <>
                  <div className="divider my-4" />
                  <div className="eyebrow mb-2" style={{ fontSize: 10 }}>Recently sent</div>
                  <div className="flex flex-col gap-1.5">
                    {sentLog.slice(0, 3).map((l) => (
                      <div
                        key={l.id}
                        className="p-2.5 rounded-lg flex items-start gap-2"
                        style={{ background: 'var(--color-green-50)', border: '1px solid var(--color-green-100)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-green-700)', marginTop: 1 }}>check_circle</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] leading-snug truncate" style={{ color: 'var(--color-green-700)' }}>
                            {l.text}
                          </p>
                          <span className="mono text-[9.5px]" style={{ color: 'var(--color-text-4)' }}>{l.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right: Composer + Preview */}
            <div className="md:col-span-7 p-5 flex flex-col gap-4">
              {/* Context chip */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: '#E7F6EE', border: '1px solid #C2E5CE' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                    style={{
                      background: '#128C7E',
                      color: '#fff',
                    }}
                  >
                    {initials || 'AS'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: '#064E3B' }}>
                      {details.name}
                    </div>
                    <div className="mono text-[11px]" style={{ color: '#047857' }}>
                      {details.phone} · {details.email}
                    </div>
                  </div>
                </div>
                <span className="mono font-bold text-[14px]" style={{ color: '#047857' }}>
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(details.amount)}
                </span>
              </div>

              {/* WhatsApp bubble preview */}
              <div>
                <div className="eyebrow mb-2" style={{ fontSize: 10 }}>Live phone preview</div>
                <div
                  className="p-5 rounded-2xl"
                  style={{
                    background:
                      'radial-gradient(circle at 0% 0%, rgba(18,140,126,0.08), transparent 55%), #E5DDD5',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex justify-end">
                    <div className="max-w-[85%]">
                      <div
                        className="px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap"
                        style={{
                          background: '#D9FDD3',
                          color: '#111B21',
                          borderBottomRightRadius: 3,
                          boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
                        }}
                      >
                        {livePreview}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1 pr-1" style={{ fontSize: 10, color: '#667781' }}>
                        <span className="mono">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#53BDEB', fontVariationSettings: "'FILL' 1" }}>done_all</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom message */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="eyebrow" style={{ fontSize: 10 }}>Customize message</label>
                  <span
                    className={`mono text-[10.5px] ${livePreview.length > 1600 ? 'text-[var(--color-rose-600)]' : 'text-[var(--color-text-4)]'}`}
                  >
                    {livePreview.length} / 1600 chars
                  </span>
                </div>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={renderTemplate(selected.preview, transaction)}
                  rows={4}
                  className="w-full resize-none rounded-xl text-[13px] p-3"
                  style={{
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#25D366'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,211,102,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>

              {/* Composer actions */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => showToast('Media attached', 'Invoice PDF attached to message', 'info')}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                    style={{ color: 'var(--color-text-3)', background: 'var(--color-surface-mute)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-soft)'; e.currentTarget.style.color = '#047857' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-mute)'; e.currentTarget.style.color = 'var(--color-text-3)' }}
                    title="Attach invoice"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>attach_file</span>
                  </button>
                  <button
                    onClick={() => showToast('Emoji panel', 'Insert emojis — powered by Twilio Unicode support', 'info')}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                    style={{ color: 'var(--color-text-3)', background: 'var(--color-surface-mute)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-soft)'; e.currentTarget.style.color = '#047857' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-mute)'; e.currentTarget.style.color = 'var(--color-text-3)' }}
                    title="Insert emoji"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mood</span>
                  </button>
                  <button
                    onClick={() => showToast('Payment link injected', 'Partial-payment Razorpay link appended', 'info')}
                    className="text-[11.5px] font-semibold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                    style={{ background: 'var(--color-green-50)', color: '#047857', border: '1px solid var(--color-green-100)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-green-100)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-green-50)')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link</span>
                    Insert payment link
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !livePreview.trim()}
                    className="btn-sm btn flex items-center gap-1.5 transition-all"
                    style={{
                      background: '#128C7E',
                      color: '#fff',
                      boxShadow: sending ? 'none' : '0 4px 14px rgba(18,140,126,0.32)',
                      opacity: sending || !livePreview.trim() ? 0.7 : 1,
                      border: 'none',
                    }}
                    onMouseEnter={(e) => !sending && (e.currentTarget.style.background = '#075E54')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#128C7E')}
                  >
                    {sending ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Sending via Twilio…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>send</span>
                        Send WhatsApp
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
