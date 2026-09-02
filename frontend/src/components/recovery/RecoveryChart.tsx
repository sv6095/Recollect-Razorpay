'use client'

import { useState, useEffect, useRef } from 'react'
import type { RecoveryStats, ChartData } from '@/types'

interface RecoveryChartProps {
  stats: RecoveryStats
  refreshKey?: number
}

const VIEW_WIDTH = 900
const VIEW_HEIGHT = 160
const CHART_TOP = 20
const CHART_BOTTOM = 140
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP
const CHART_LEFT = 0
const CHART_RIGHT = VIEW_WIDTH

function smoothBezierPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`

  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

function buildAreaPath(linePath: string): string {
  return `${linePath} L ${CHART_RIGHT} ${CHART_BOTTOM} L ${CHART_LEFT} ${CHART_BOTTOM} Z`
}

function generateChartPaths(chartData: ChartData) {
  const hours = chartData.hours
  const ai = chartData.ai_recovered
  const dun = chartData.standard_dunning

  const n = hours.length
  const maxVal = Math.max(1, ...ai, ...dun)

  const xStep = VIEW_WIDTH / Math.max(n - 1, 1)

  const aiPoints: [number, number][] = ai.map((val, i) => {
    const x = CHART_LEFT + i * xStep
    const norm = val / maxVal
    const y = CHART_BOTTOM - norm * CHART_HEIGHT
    return [x, y]
  })

  const dunPoints: [number, number][] = dun.map((val, i) => {
    const x = CHART_LEFT + i * xStep
    const norm = val / maxVal
    const y = CHART_BOTTOM - norm * CHART_HEIGHT
    return [x, y]
  })

  const aiLine = smoothBezierPath(aiPoints)
  const dunLine = smoothBezierPath(dunPoints)

  const sampledPoints: [number, number][] = []
  for (let i = 1; i < aiPoints.length - 1; i += Math.max(1, Math.floor(n / 5))) {
    sampledPoints.push(aiPoints[i])
  }
  if (aiPoints.length > 0) {
    sampledPoints.push(aiPoints[aiPoints.length - 1])
  }

  return {
    aiLine,
    aiArea: buildAreaPath(aiLine),
    dunLine,
    dunArea: buildAreaPath(dunLine),
    dataPoints: sampledPoints.slice(-5),
    lastPoint: aiPoints[aiPoints.length - 1] || [VIEW_WIDTH, CHART_BOTTOM],
    maxVal,
  }
}

export function RecoveryChart({ stats, refreshKey }: RecoveryChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/demo/chart-data')
        if (!alive) return
        if (res.ok) {
          const data = await res.json()
          if (data && Array.isArray(data.hours)) {
            const hasAnyData = data.ai_recovered?.some((v: number) => v > 0)
            setChartData(hasAnyData ? data : null)
          } else {
            setChartData(null)
          }
        } else {
          setChartData(null)
        }
      } catch {
        if (alive) setChartData(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      mountedRef.current = false
      alive = false
    }
  }, [refreshKey])

  const currentHour = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  })

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

  const recovered = stats.total_recovered || 0
  const liftPct = chartData?.lift_pct || 0
  const hourlyRate = recovered > 0 ? recovered / 24 : 0

  return (
    <section className="card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#EEF4FE] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#528FF0] text-[16px]">monitoring</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-semibold text-[#0F172A]">Recovery vs Standard Dunning</h2>
              {liftPct > 0 && (
                <span className="chip chip-recovered text-[10px]">+{liftPct.toFixed(1)}% lift</span>
              )}
            </div>
            <p className="text-[12px] text-[#64748B]">AI multi-agent vs legacy email reminders · Past 24h</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[12px] shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-0.5 bg-[#528FF0] rounded-full inline-block" style={{ boxShadow: '0 0 6px rgba(82,143,240,0.5)' }} />
            <span className="text-[#1E293B] font-medium">Re-Collect (AI)</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="20" height="2" viewBox="0 0 20 2" className="inline-block"><line x1="0" y1="1" x2="20" y2="1" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 3" /></svg>
            <span className="text-[#94A3B8]">Standard Dunning</span>
          </div>
          <div className="px-2 py-1 rounded-md bg-[#F8FAFC] border border-[#E5E9F0] text-[11px] font-mono text-[#64748B]">
            1h interval
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative w-full h-48 rounded-lg bg-[#FAFCFF] border border-[#EFF2F7] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-[#CBD5E1] animate-spin">progress_activity</span>
              <span className="text-[11px] text-[#94A3B8]">Loading chart data…</span>
            </div>
          </div>
        ) : !chartData ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] border border-[#E5E9F0] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] text-[#94A3B8]">bar_chart</span>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#475569]">No recovery data yet</p>
              <p className="text-[12px] text-[#94A3B8] mt-0.5">
                Chart will populate as transactions are processed through the pipeline
              </p>
            </div>
            {/* Subtle skeleton grid lines */}
            <svg className="absolute inset-0 w-full h-full opacity-30" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" fill="none">
              {[20, 60, 100, 140].map((y) => (
                <line key={y} x1="0" x2={VIEW_WIDTH} y1={y} y2={y} stroke="#E5E9F0" strokeDasharray="3 3" />
              ))}
            </svg>
          </div>
        ) : (
          <>
            <svg className="w-full h-full" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" fill="none">
              <defs>
                <linearGradient id="accentGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#528FF0" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#528FF0" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="dunningGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[20, 60, 100, 140].map((y) => (
                <line key={y} x1="0" x2={VIEW_WIDTH} y1={y} y2={y} stroke="#E5E9F0" strokeDasharray="3 3" strokeOpacity="0.7" />
              ))}
              <line x1="0" x2={VIEW_WIDTH} y1="140" y2="140" stroke="#E5E9F0" />

              {(() => {
                const paths = generateChartPaths(chartData)
                return (
                  <>
                    <path d={paths.dunArea} fill="url(#dunningGrad)" />
                    <path d={paths.dunLine} stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="5 4" />
                    <path d={paths.aiArea} fill="url(#accentGrad)" />
                    <path d={paths.aiLine} stroke="#528FF0" strokeWidth="2.5" strokeLinecap="round" />
                    {paths.dataPoints.slice(0, -1).map(([cx, cy], idx) => (
                      <circle key={`pt-${idx}`} cx={cx} cy={cy} r="4" fill="#fff" stroke="#528FF0" strokeWidth="2.5" />
                    ))}
                    {paths.lastPoint && (
                      <circle cx={paths.lastPoint[0]} cy={paths.lastPoint[1]} r="5" fill="#528FF0" stroke="#fff" strokeWidth="2" />
                    )}
                  </>
                )
              })()}
            </svg>

            <div className="absolute right-4 top-4 bg-[#071C36] text-white px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium shadow-lg border border-[#528FF0]/30 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] live-dot" />
              <span>
                <strong>{fmt(hourlyRate)}</strong>/hr recovered
              </span>
            </div>

            <div className="absolute bottom-1 left-0 right-0 flex items-center justify-between px-3 text-[10px] font-mono text-[#CBD5E1]">
              {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map((t) => (
                <span key={t}>{t}</span>
              ))}
              <span className="text-[#528FF0] font-bold">{currentHour} IST</span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
