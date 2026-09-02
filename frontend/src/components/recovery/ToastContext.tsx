'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  title: string
  message: string
  variant: ToastVariant
  exiting?: boolean
}

interface ToastContextValue {
  showToast: (title: string, message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 260)
  }, [])

  const showToast = useCallback(
    (title: string, message: string, variant: ToastVariant = 'success') => {
      const id = `toast_${Date.now()}_${Math.random()}`
      setToasts((prev) => [...prev, { id, title, message, variant }])
      const timer = setTimeout(() => removeToast(id), 3500)
      timers.current.set(id, timer)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[200] pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl min-w-[280px] max-w-sm
              ${toast.exiting ? 'toast-exit' : 'toast-enter'}
              ${
                toast.variant === 'error'
                  ? 'bg-[#7F1D1D] border-[#EF4444]/30 text-white'
                  : toast.variant === 'info'
                  ? 'bg-[#071C36] border-[#528FF0]/30 text-white'
                  : 'bg-[#071C36] border-[#10B981]/30 text-white'
              }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${
                toast.variant === 'error'
                  ? 'text-[#FCA5A5]'
                  : toast.variant === 'info'
                  ? 'text-[#528FF0]'
                  : 'text-[#34D399]'
              }`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {toast.variant === 'error' ? 'error' : toast.variant === 'info' ? 'info' : 'check_circle'}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-semibold tracking-tight truncate">{toast.title}</span>
              <span className="text-[11px] text-[#94A3B8] leading-relaxed">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
