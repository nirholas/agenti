'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useCommand } from './CommandContext'
import type { PayEvent, TradeEvent } from './CommandContext'

const DPR = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1

interface MapNode {
  id: string
  label: string
  x: number
  y: number
  color: string
  active: boolean
  pulse: number
  hits: number
  orbitalAngle: number
  ring: number
}

interface Particle {
  x: number; y: number; tx: number; ty: number
  progress: number; color: string
}

const TYPE_COLORS: Record<string, string> = {
  pay: '#00ffcc', trade_buy: '#00ff6a', trade_sell: '#ff3b3b',
  network: '#8b5cf6', wallet: '#f59e0b',
}

function urlLabel(url: string): string {
  try { return new URL(url).hostname.slice(0, 8) } catch { return url.slice(0, 8) }
}

export function AgentNetwork() {
  const { payEvents, tradeEvents, walletAddress, isConnected } = useCommand()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<MapNode[]>([])
  const particlesRef = useRef<Particle[]>([])
  const frameRef = useRef(0)

  // Build nodes from pay/trade events
  useEffect(() => {
    const nodeMap = new Map<string, MapNode>()

    // Wallet node at center
    if (walletAddress) {
      const existing = nodesRef.current.find(n => n.id === 'wallet')
      nodeMap.set('wallet', {
        id: 'wallet', label: 'WALLET', x: existing?.x ?? 0.5, y: existing?.y ?? 0.5,
        color: '#f59e0b', active: true, pulse: existing?.pulse ?? 0, hits: 0,
        orbitalAngle: existing?.orbitalAngle ?? 0, ring: 0,
      })
    }

    // URL nodes from pay events
    const urls = [...new Set(payEvents.map(p => p.url))]
    urls.slice(0, 8).forEach((url, i) => {
      const existing = nodesRef.current.find(n => n.id === url)
      const angle = (i / Math.max(urls.length, 1)) * Math.PI * 2 - Math.PI / 2
      nodeMap.set(url, {
        id: url, label: urlLabel(url),
        x: existing?.x ?? (0.5 + Math.cos(angle) * 0.28),
        y: existing?.y ?? (0.5 + Math.sin(angle) * 0.28),
        color: '#00ffcc', active: payEvents.some(p => p.url === url && Date.now() - p.ts < 5000),
        pulse: existing?.pulse ?? 0, hits: payEvents.filter(p => p.url === url).length,
        orbitalAngle: existing?.orbitalAngle ?? angle, ring: 1,
      })
    })

    // Mint nodes from trade events
    const mints = [...new Set(tradeEvents.map(t => t.mint))]
    mints.slice(0, 6).forEach((mint, i) => {
      const existing = nodesRef.current.find(n => n.id === mint)
      const angle = (i / Math.max(mints.length, 1)) * Math.PI * 2
      nodeMap.set(mint, {
        id: mint, label: mint.slice(0, 4).toUpperCase(),
        x: existing?.x ?? (0.5 + Math.cos(angle) * 0.4),
        y: existing?.y ?? (0.5 + Math.sin(angle) * 0.4),
        color: '#00ff6a', active: tradeEvents.some(t => t.mint === mint && Date.now() - t.ts < 5000),
        pulse: existing?.pulse ?? 0, hits: tradeEvents.filter(t => t.mint === mint).length,
        orbitalAngle: existing?.orbitalAngle ?? angle, ring: 2,
      })
    })

    nodesRef.current = Array.from(nodeMap.values())
  }, [payEvents, tradeEvents, walletAddress])

  // Spawn particles on new events
  useEffect(() => {
    const nodes = nodesRef.current
    if (nodes.length < 2) return
    const latest = payEvents[0]
    if (!latest || Date.now() - latest.ts > 2000) return
    const from = nodes.find(n => n.id === 'wallet') ?? nodes[0]!
    const to = nodes.find(n => n.id === latest.url) ?? nodes[1]!
    particlesRef.current.push({ x: from.x, y: from.y, tx: to.x, ty: to.y, progress: 0, color: '#00ffcc' })
    if (from) from.pulse = 1
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payEvents[0]?.id])

  useEffect(() => {
    const nodes = nodesRef.current
    if (nodes.length < 2) return
    const latest = tradeEvents[0]
    if (!latest || Date.now() - latest.ts > 2000) return
    const from = nodes.find(n => n.id === 'wallet') ?? nodes[0]!
    const to = nodes.find(n => n.id === latest.mint) ?? nodes[nodes.length - 1]!
    particlesRef.current.push({ x: from.x, y: from.y, tx: to.x, ty: to.y, progress: 0, color: latest.side === 'buy' ? '#00ff6a' : '#ff3b3b' })
    if (from) from.pulse = 1
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeEvents[0]?.id])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width / DPR
    const h = canvas.height / DPR
    const cx = w / 2, cy = h / 2
    const now = Date.now()

    ctx.save()
    ctx.scale(DPR, DPR)
    ctx.fillStyle = '#020508'
    ctx.fillRect(0, 0, w, h)

    // Grid
    ctx.strokeStyle = 'rgba(0,255,204,0.025)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < w; x += 30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }

    const nodes = nodesRef.current
    const ringRadii = [0, 0.28, 0.4]

    // Ring guides
    for (const r of ringRadii.slice(1)) {
      ctx.beginPath()
      ctx.arc(cx, cy, Math.min(w, h) * r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0,255,204,0.03)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }

    // Hub
    const hubPulse = 0.4 + Math.sin(now * 0.002) * 0.15
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0,255,204,${hubPulse * 0.08})`
    ctx.fill()

    // Sweep
    const sweepAngle = (now * 0.001) % (Math.PI * 2)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(sweepAngle) * 18, cy + Math.sin(sweepAngle) * 18)
    ctx.strokeStyle = 'rgba(0,255,204,0.06)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Orbital drift
    for (const node of nodes) {
      if (node.ring === 0) continue
      node.orbitalAngle += 0.0003
      const r = ringRadii[node.ring] ?? 0.35
      node.x += ((0.5 + Math.cos(node.orbitalAngle) * r) - node.x) * 0.02
      node.y += ((0.5 + Math.sin(node.orbitalAngle) * r) - node.y) * 0.02
    }

    // Connections to hub
    for (const node of nodes) {
      if (node.ring === 0) continue
      const nx = node.x * w, ny = node.y * h
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(nx, ny)
      ctx.strokeStyle = node.active ? 'rgba(0,255,204,0.05)' : 'rgba(255,255,255,0.01)'
      ctx.lineWidth = 0.5
      ctx.setLineDash(node.active ? [] : [3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.progress += 0.02
      if (p.progress >= 1) return false
      const px = (p.x + (p.tx - p.x) * p.progress) * w
      const py = (p.y + (p.ty - p.y) * p.progress) * h
      const prevP = Math.max(0, p.progress - 0.05)
      const prevX = (p.x + (p.tx - p.x) * prevP) * w
      const prevY = (p.y + (p.ty - p.y) * prevP) * h
      ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(px, py)
      ctx.strokeStyle = p.color + '60'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2)
      ctx.fillStyle = p.color; ctx.fill()
      return true
    })

    // Nodes
    for (const node of nodes) {
      const nx = node.x * w, ny = node.y * h
      const r = node.ring === 0 ? 6 : node.active ? 5 : 3

      if (node.pulse > 0) {
        ctx.beginPath()
        ctx.arc(nx, ny, r + 2 + (1 - node.pulse) * 18, 0, Math.PI * 2)
        ctx.strokeStyle = node.color + Math.round(node.pulse * 80).toString(16).padStart(2, '0')
        ctx.lineWidth = 1; ctx.stroke()
        node.pulse = Math.max(0, node.pulse - 0.01)
      }

      if (node.active) {
        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 14)
        glow.addColorStop(0, node.color + '25'); glow.addColorStop(1, node.color + '00')
        ctx.fillStyle = glow; ctx.fillRect(nx - 14, ny - 14, 28, 28)
      }

      ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI * 2)
      ctx.fillStyle = node.active ? node.color : node.color + '40'; ctx.fill()

      ctx.font = '600 7px Inter, monospace'
      ctx.fillStyle = node.active ? '#b0b0b0' : '#3a5555'
      ctx.textAlign = 'center'
      ctx.fillText(node.label, nx, ny + 16)
    }

    // Title
    ctx.font = '700 11px Inter, sans-serif'
    ctx.fillStyle = '#00ffcc'; ctx.textAlign = 'left'
    ctx.fillText('AGENT NETWORK', 12, 18)
    ctx.font = '600 8px Inter, monospace'
    ctx.fillStyle = '#3a5555'
    ctx.fillText(`NODES: ${nodes.length}`, 12, 30)

    const activeCount = nodes.filter(n => n.active).length
    ctx.font = '700 9px Inter, monospace'
    ctx.fillStyle = '#00ff6a'; ctx.textAlign = 'right'
    ctx.fillText(`${activeCount} ACTIVE`, w - 12, 18)

    ctx.restore()
    frameRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const nw = Math.round(rect.width * DPR), nh = Math.round(rect.height * DPR)
      if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    frameRef.current = requestAnimationFrame(draw)
    return () => { ro.disconnect(); cancelAnimationFrame(frameRef.current) }
  }, [draw])

  return (
    <div className="swarm-panel" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
