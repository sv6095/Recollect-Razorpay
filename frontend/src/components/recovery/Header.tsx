'use client'

import { useRef } from 'react'

interface HeaderProps {
  isConnected: boolean
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

export function Header({ isConnected, searchQuery = '', onSearchChange }: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header
      className="layout-header flex items-center justify-between px-5"
      style={{ background: '#0B0E14', borderBottom: '1px solid #181E2C' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 select-none">
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ background: '#2B51D6' }}
        >
          <span
            className="material-symbols-outlined text-white text-[12px]"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}
          >
            bolt
          </span>
        </div>
        <div className="flex flex-col leading-none gap-[2px]">
          <span className="font-semibold text-[13px] text-white tracking-tight">Razorpay</span>
          <span
            className="text-[9px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: '#3F4A5F' }}
          >
            Re-Collect
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Connection status — quiet text only, no pulsing dot */}
        {!isConnected && (
          <span className="text-[11px] font-medium" style={{ color: '#5A6578' }}>
            Reconnecting…
          </span>
        )}

        {/* Search — fully functional, filters audit trail */}
        <div
          className="hidden lg:flex items-center gap-2 w-56 px-3 py-1.5 rounded text-[12px] transition-colors"
          style={{
            background: '#111722',
            border: `1px solid ${searchQuery ? '#2B51D6' : '#222C3C'}`,
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <span className="material-symbols-outlined text-[13px]" style={{ color: searchQuery ? '#2B51D6' : '#3F4A5F' }}>
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter by txn ID or message…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="bg-transparent border-0 p-0 text-[12px] text-white focus:outline-none w-full"
            style={{ caretColor: '#2B51D6' }}
          />
          {searchQuery && (
            <button
              onClick={(e) => { e.stopPropagation(); onSearchChange?.('') }}
              className="shrink-0 flex items-center justify-center transition-colors"
              style={{ color: '#4A5568' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8B9BB4')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5568')}
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: '#222C3C' }} />

        {/* Notifications */}
        <button
          title="Notifications"
          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
          style={{ color: '#4A5568' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#8B9BB4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5568')}
        >
          <span className="material-symbols-outlined text-[17px]">notifications</span>
        </button>
        <button
          title="Help"
          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
          style={{ color: '#4A5568' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#8B9BB4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#4A5568')}
        >
          <span className="material-symbols-outlined text-[17px]">help_outline</span>
        </button>

        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] cursor-pointer shrink-0"
          style={{ background: '#19212E', border: '1px solid #222C3C' }}
          title="Merchant account"
        >
          M
        </div>
      </div>
    </header>
  )
}

