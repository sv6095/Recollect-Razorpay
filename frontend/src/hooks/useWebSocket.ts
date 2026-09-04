'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { WSEvent } from '@/types'

/**
 * Derive the WebSocket URL for the FastAPI backend.
 * Handles both local development (FastAPI on port 8000) and dual-tunnel zrok
 * environments (Frontend on vw5izkdjk7p5, Backend on nbuimbnbcdwy).
 */
function getWsUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws/events'
  }

  // 1. Explicit env var override (from .env.local)
  const envUrl = process.env.NEXT_PUBLIC_WS_URL
  if (envUrl && envUrl.trim() !== '') {
    if (window.location.protocol === 'https:' && envUrl.startsWith('ws://')) {
      return envUrl.replace('ws://', 'wss://')
    }
    return envUrl
  }

  const hostname = window.location.hostname

  // 2. Localhost / 127.0.0.1 development: connect directly to FastAPI backend on port 8000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://127.0.0.1:8000/ws/events'
  }

  // 3. zrok public share deployment
  // Frontend runs on vw5izkdjk7p5.shares.zrok.io; Backend runs on nbuimbnbcdwy.shares.zrok.io
  if (hostname.includes('shares.zrok.io') || hostname.includes('share.zrok.io')) {
    const backendHost = process.env.NEXT_PUBLIC_BACKEND_HOST || 'nbuimbnbcdwy.shares.zrok.io'
    return `wss://${backendHost}/ws/events`
  }

  // 4. Default fallback: same origin protocol and port 8000
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${hostname}:8000/ws/events`
}

interface UseWebSocketOptions {
  onEvent: (event: WSEvent) => void
  reconnectDelay?: number
}

export function useWebSocket({ onEvent, reconnectDelay = 2500 }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    try {
      const url = getWsUrl()
      console.log('[WS] Connecting to real backend WebSocket at:', url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected to live backend event stream:', url)
        setIsConnected(true)

        // Send ping every 25s to maintain keepalive
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
          if (event.type === 'ping' || event.type === 'connected') return
          onEvent(event)
        } catch {
          // ignore non-JSON or malformed messages
        }
      }

      ws.onerror = (e) => {
        console.warn('[WS] Connection error on:', url, e)
        setIsConnected(false)
      }

      ws.onclose = () => {
        const ws_ = ws as WebSocket & { _pingInterval?: ReturnType<typeof setInterval> }
        if (ws_._pingInterval) clearInterval(ws_._pingInterval)
        setIsConnected(false)
        if (mountedRef.current) {
          console.log(`[WS] Disconnected. Reconnecting in ${reconnectDelay}ms...`)
          reconnectTimer.current = setTimeout(connect, reconnectDelay)
        }
      }
    } catch (err) {
      console.error('[WS] Failed to initiate WebSocket connection:', err)
      setIsConnected(false)
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

  return { isConnected, wsRef }
}
