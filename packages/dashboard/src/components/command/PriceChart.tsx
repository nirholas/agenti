'use client'

import { useEffect, useRef } from 'react'
import { useCommand } from './CommandContext'

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1

export function PriceChart() {
  const { tradeEvents, isConnected } = useCommand()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const latestMint = tradeEvents[0]?.mint ?? null

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * DPR
    canvas.height = rect.height * DPR

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(DPR, DPR)

    const w = rect.width, h = rect.height

    // Background
    ctx.fillStyle = '#020508'
    ctx.fillRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = 'rgba(0,255,255,0.03)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }

    // Plot sol amounts as price proxy
    const points = tradeEvents.slice(0, 60).reverse().map(t => ({ sol: t.sol, side: t.side, ts: t.ts }))
    if (points.length < 2) {
      ctx.font = '700 10px Inter, sans-serif'; ctx.fillStyle = '#3a5555'; ctx.textAlign = 'center'
      ctx.fillText('AWAITING TRADE DATA', w / 2, h / 2)
      return
    }

    const minSol = Math.min(...points.map(p => p.sol)) * 0.98
    const maxSol = Math.max(...points.map(p => p.sol)) * 1.02
    const range = maxSol - minSol || 0.001
    const pad = { top: 20, bottom: 20, left: 8, right: 8 }

    const toX = (i: number) => pad.left + (i / (points.length - 1)) * (w - pad.left - pad.right)
    const toY = (sol: number) => pad.top + (1 - (sol - minSol) / range) * (h - pad.top - pad.bottom)

    // Area fill
    const lastIsPositive = (points[points.length - 1]?.sol ?? 0) >= (points[0]?.sol ?? 0)
    const color = lastIsPositive ? '0,255,106' : '255,59,59'

    ctx.beginPath()
    ctx.moveTo(toX(0), h - pad.bottom)
    for (let i = 0; i < points.length; i++) ctx.lineTo(toX(i), toY(points[i]!.sol))
    ctx.lineTo(toX(points.length - 1), h - pad.bottom)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, `rgba(${color},0.12)`)
    grad.addColorStop(1, `rgba(${color},0)`)
    ctx.fillStyle = grad; ctx.fill()

    // Line
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      const x = toX(i), y = toY(points[i]!.sol)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = `rgba(${color},0.8)`; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke()

    // Buy/sell dots
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      const x = toX(i), y = toY(p.sol)
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fillStyle = p.side === 'buy' ? '#00ff6a' : '#ff3b3b'; ctx.fill()
    }

    // Last price label
    const last = points[points.length - 1]!
    const lx = toX(points.length - 1), ly = toY(last.sol)
    ctx.font = '600 9px Inter, monospace'; ctx.fillStyle = `rgba(${color},1)`;
    ctx.textAlign = 'right'; ctx.fillText(`${last.sol.toFixed(4)} SOL`, w - pad.right - 4, ly - 4)

    // Title
    ctx.font = '700 11px Inter, sans-serif'; ctx.fillStyle = '#00ffcc'; ctx.textAlign = 'left'
    ctx.fillText('TRADE PRICE', pad.left + 4, 18)
    if (latestMint) {
      ctx.font = '600 8px Inter, monospace'; ctx.fillStyle = '#3a5555'
      ctx.fillText(latestMint.slice(0, 8) + '…', pad.left + 4, 30)
    }
  }, [tradeEvents, latestMint])

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * DPR; canvas.height = rect.height * DPR
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Trade Price</span>
          <span className="swarm-subtitle">{latestMint ? `${latestMint.slice(0, 6)}…` : 'NO TRADES'}</span>
        </div>
        <span className={isConnected ? 'swarm-live' : 'swarm-badge-error'}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isConnected ? '#00ff6a' : '#ff3b3b', display: 'inline-block' }} />
          {isConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </div>
  )
}
