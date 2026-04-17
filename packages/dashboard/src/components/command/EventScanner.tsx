'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useCommand } from './CommandContext'

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1

interface Blip {
  x: number; y: number; color: string; age: number; intensity: number; label: string
}

const EVENT_COLORS: Record<string, string> = {
  pay: '#00ffcc', trade_buy: '#00ff6a', trade_sell: '#ff3b3b',
  invoice: '#ff9500', error: '#ff3b3b',
}

export function EventScanner() {
  const { payEvents, tradeEvents, invoiceEvents, errorEvents, isConnected } = useCommand()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blipsRef = useRef<Blip[]>([])
  const sweepRef = useRef(0)
  const frameRef = useRef(0)

  // Build blips from recent events
  useEffect(() => {
    const newBlips: Blip[] = []
    const cx = 0.5, cy = 0.5, radius = 0.38
    let idx = 0
    const total = payEvents.length + tradeEvents.length + invoiceEvents.length + errorEvents.length
    const add = (color: string, label: string, intensity: number) => {
      const angle = (idx / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2
      const dist = radius * (0.4 + Math.random() * 0.5)
      newBlips.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, color, age: 0, intensity, label })
      idx++
    }
    payEvents.slice(0, 6).forEach(() => add(EVENT_COLORS.pay, 'P', 1))
    tradeEvents.slice(0, 6).forEach(t => add(t.side === 'buy' ? EVENT_COLORS.trade_buy : EVENT_COLORS.trade_sell, 'T', 0.9))
    invoiceEvents.slice(0, 3).forEach(() => add(EVENT_COLORS.invoice, 'I', 0.7))
    errorEvents.slice(0, 2).forEach(() => add(EVENT_COLORS.error, 'E', 0.8))
    blipsRef.current = newBlips
  }, [payEvents.length, tradeEvents.length, invoiceEvents.length, errorEvents.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width / DPR, h = canvas.height / DPR
    const cx = w / 2, cy = h / 2
    const r = Math.min(w, h) * 0.42

    ctx.save(); ctx.scale(DPR, DPR)
    ctx.fillStyle = '#020508'; ctx.fillRect(0, 0, w, h)

    // Grid circles
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, (r / 4) * i, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0,255,204,${0.05 + i * 0.01})`; ctx.lineWidth = 0.5; ctx.stroke()
    }
    // Cross
    ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
    ctx.strokeStyle = 'rgba(0,255,204,0.06)'; ctx.lineWidth = 0.5; ctx.stroke()

    // Sweep
    sweepRef.current += 0.012
    const sweepAngle = sweepRef.current % (Math.PI * 2)
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, sweepAngle - 0.4, sweepAngle); ctx.closePath()
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(0,255,204,0.12)'); grad.addColorStop(1, 'rgba(0,255,204,0)')
    ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath(); ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r)
    ctx.strokeStyle = 'rgba(0,255,204,0.5)'; ctx.lineWidth = 1; ctx.stroke()

    // Blips
    for (const blip of blipsRef.current) {
      const bx = blip.x * w, by = blip.y * h
      const glowR = 4 + blip.intensity * 3
      const glowGrad = ctx.createRadialGradient(bx, by, 0, bx, by, glowR * 2)
      glowGrad.addColorStop(0, blip.color + '80'); glowGrad.addColorStop(1, blip.color + '00')
      ctx.fillStyle = glowGrad; ctx.fillRect(bx - glowR * 2, by - glowR * 2, glowR * 4, glowR * 4)
      ctx.beginPath(); ctx.arc(bx, by, 2 + blip.intensity, 0, Math.PI * 2)
      ctx.fillStyle = blip.color; ctx.fill()
      blip.age += 0.016
    }

    // Center
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fillStyle = '#00ffcc'; ctx.fill()

    ctx.font = '700 8px Inter, monospace'; ctx.fillStyle = '#3a5555'; ctx.textAlign = 'center'
    ctx.fillText('EVENT SCANNER', cx, h - 8)

    ctx.restore()
    frameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * DPR; canvas.height = rect.height * DPR
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    frameRef.current = requestAnimationFrame(draw)
    return () => { ro.disconnect(); cancelAnimationFrame(frameRef.current) }
  }, [draw])

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Scanner</span>
          <span className="swarm-subtitle">EVENTS</span>
        </div>
        <span className={isConnected ? 'swarm-live' : 'swarm-badge-error'}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isConnected ? '#00ff6a' : '#ff3b3b', display: 'inline-block' }} />
          {isConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </div>
  )
}
