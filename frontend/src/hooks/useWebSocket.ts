'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { WSEvent } from '@/types'

// Derive WebSocket URL from the page's own origin so it always matches the
// page protocol (ws: on http, wss: on https) — avoids mixed-content blocks
// when accessed via tunnel (zrok/cloudflare). Falls back to explicit env var.
function getWsUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/events'
  }
  const envUrl = process.env.NEXT_PUBLIC_WS_URL
  if (envUrl) {
    // Upgrade ws:// → wss:// when page is HTTPS (browser mixed-content rule)
    if (window.location.protocol === 'https:' && envUrl.startsWith('ws://')) {
      return envUrl.replace('ws://', 'wss://')
    }
    return envUrl
  }
  // No env var: connect via the page's own host (works through any tunnel)
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/events`
}

const WS_URL = getWsUrl()

interface UseWebSocketOptions {
  onEvent: (event: WSEvent) => void
  reconnectDelay?: number
}

export function useWebSocket({ onEvent, reconnectDelay = 3000 }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected to Re-Collect event stream')
        // Send ping every 25s to keep alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 25000)
        ;(ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval = pingInterval
      }

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WSEvent
          if (event.type === 'ping') return
          onEvent(event)
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        console.warn('[WS] Connection error')
      }

      ws.onclose = () => {
        const ws_ = ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> }
        if (ws_._pingInterval) clearInterval(ws_._pingInterval)
        if (mountedRef.current) {
          console.log(`[WS] Disconnected. Reconnecting in ${reconnectDelay}ms...`)
          reconnectTimer.current = setTimeout(connect, reconnectDelay)
        }
      }
    } catch (err) {
      console.error('[WS] Failed to connect:', err)
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(connect, reconnectDelay)
      }
    }
  }, [onEvent, reconnectDelay])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return wsRef
}
