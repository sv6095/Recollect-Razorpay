'use client'

import { useRef } from 'react'
import { WhatsAppIcon } from './WhatsAppIcon'

interface HeaderProps {
  isConnected: boolean
  searchQuery?: string
  onSearchChange?: (value: string) => void
  onOpenChat?: () => void
  onOpenWhatsApp?: () => void
  onOpenVoiceCall?: () => void
}

interface IconBtnProps {
  icon?: string
  customIcon?: React.ReactNode
  label: string
  onClick?: () => void
  color?: string
  bgHover?: string
  badge?: string
}

function IconBtn({ icon, customIcon, label, onClick, color = 'var(--color-text-3)', bgHover = 'var(--color-surface-soft)', badge }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all relative shrink-0"
      style={{ color, background: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = bgHover; e.currentTarget.style.color = 'var(--color-text)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = color }}
    >
      {customIcon ? (
        customIcon
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      )}
      {badge && (
        <span
          className="absolute -top-0.5 -right-0.5 text-[9px] font-bold px-1 rounded-full"
          style={{
            background: 'var(--color-rose-500)',
            color: '#fff',
            boxShadow: '0 0 0 2px #fff',
            minWidth: 14,
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

export function Header({ isConnected, searchQuery = '', onSearchChange, onOpenChat, onOpenWhatsApp, onOpenVoiceCall }: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header
      className="app-header flex items-center justify-between px-6"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'saturate(180%) blur(16px)',
        WebkitBackdropFilter: 'saturate(180%) blur(16px)',
        borderBottom: '1px solid var(--color-border-soft)',
      }}
    >
      {/* Logo + brand mark */}
      <div className="flex items-center gap-3 select-none">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2B51D6 0%, #3B5BED 60%, #5A78F5 100%)',
            boxShadow: '0 6px 18px rgba(43,81,214,0.28)',
          }}
        >
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: 20, fontVariationSettings: "'FILL' 1, 'wght' 600" }}
          >
            payments
          </span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-[15px] tracking-tight" style={{ color: 'var(--color-text)' }}>
            Razorpay <span style={{ fontWeight: 500, color: 'var(--color-text-3)' }}>·</span> Re-Collect
          </span>
          <div className="flex items-center gap-1.5 mt-[3px]">
            <span className="eyebrow" style={{ letterSpacing: '0.08em' }}>Revenue Recovery</span>
            {isConnected && (
              <>
                <span style={{ color: 'var(--color-text-5)' }}>·</span>
                <span className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-green-700)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-green-500)' }} />
                  Live
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex items-center flex-1 max-w-xl mx-8">
        <div
          className="flex items-center gap-2 w-full px-3.5 py-2 rounded-xl transition-all"
          style={{
            background: 'var(--color-surface-mute)',
            border: `1px solid ${searchQuery ? 'var(--color-brand-200)' : 'var(--color-border)'}`,
            boxShadow: searchQuery ? '0 0 0 3px rgba(59,91,237,0.08)' : 'none',
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 19, color: searchQuery ? 'var(--color-brand-600)' : 'var(--color-text-4)' }}
          >
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search by customer, transaction ID, amount, or reason…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="bg-transparent border-0 p-0 text-[13px] text-[var(--color-text)] focus:outline-none flex-1 min-w-0 pr-2 placeholder:text-[var(--color-text-4)]"
            style={{ caretColor: 'var(--color-brand-600)' }}
          />
          {searchQuery && (
            <button
              onClick={(e) => { e.stopPropagation(); onSearchChange?.('') }}
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--color-border)] mr-1"
              style={{ color: 'var(--color-text-4)' }}
              title="Clear search"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
            </button>
          )}
          <div
            className="hidden md:inline-flex items-center gap-1 px-1.5 py-[2px] rounded mono shrink-0"
            style={{
              fontSize: 10.5,
              color: 'var(--color-text-4)',
              border: '1px solid var(--color-border)',
              background: '#fff',
            }}
          >
            ⌘K
          </div>
        </div>
      </div>

      {/* Right: status, actions, profile */}
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'var(--color-green-50)', color: 'var(--color-green-700)', border: '1px solid var(--color-green-100)' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? '' : 'animate-pulse'}`} style={{ background: 'var(--color-green-500)' }} />
          {isConnected ? 'Connected' : 'Live Stream'}
        </span>

        {/* ── Communication Quick-Action Buttons ── */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80">
          <IconBtn
            icon="chat_bubble"
            label="Open Live Chat"
            onClick={onOpenChat}
            color="var(--color-brand-700)"
            bgHover="var(--color-brand-50)"
            badge="3"
          />
          <IconBtn
            customIcon={<WhatsAppIcon size={17} color="#027A48" />}
            label="Open WhatsApp"
            onClick={onOpenWhatsApp}
            color="#027A48"
            bgHover="var(--color-green-50)"
          />
          <IconBtn
            icon="call"
            label="Voice Agent Call"
            onClick={onOpenVoiceCall}
            color="var(--color-violet-600)"
            bgHover="var(--color-violet-50)"
          />
        </div>

        <div className="w-px h-6" style={{ background: 'var(--color-border)' }} />

        <button
          className="btn-secondary btn-sm"
          title="Export current view"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export
        </button>

        <div className="w-px h-6" style={{ background: 'var(--color-border)' }} />

        <button
          title="Notifications"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors relative"
          style={{ color: 'var(--color-text-3)', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-soft)'; e.currentTarget.style.color = 'var(--color-text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-3)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--color-rose-500)', boxShadow: '0 0 0 2px #fff' }}
          />
        </button>

        {/* Merchant avatar */}
        <div className="flex items-center gap-2.5 pl-1">
          <div className="hidden lg:flex flex-col items-end leading-tight">
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--color-text-3)' }}>
              Merchant · Production
            </span>
          </div>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white cursor-pointer shrink-0"
            style={{
              background: 'linear-gradient(135deg, #1A2138 0%, #3F4A5F 100%)',
              boxShadow: '0 2px 8px rgba(16,24,40,0.08)',
            }}
            title="Merchant account settings"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 19 }}>person</span>
          </div>
        </div>
      </div>
    </header>
  )
}
