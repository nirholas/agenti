'use client'

import { useEffect, useRef } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force'
import type { GraphNode, GraphEdge } from '../types.js'

const NODE_COLOR: Record<GraphNode['kind'], string> = {
  wallet: '#3b82f6',
  token: '#a855f7',
  url: '#22c55e',
}

const EDGE_COLOR: Record<GraphEdge['kind'], string> = {
  pay: '#22c55e',
  trade: '#3b82f6',
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
}

export function AgentGraph({ nodes, edges, width = 600, height = 400 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Deep-copy so D3 can mutate positions
    const simNodes: GraphNode[] = nodes.map((n) => ({ ...n }))
    const nodeById = new Map(simNodes.map((n) => [n.id, n]))

    const simEdges = edges
      .map((e) => ({
        source: nodeById.get(typeof e.source === 'string' ? e.source : e.source.id) ?? simNodes[0],
        target: nodeById.get(typeof e.target === 'string' ? e.target : e.target.id) ?? simNodes[0],
        kind: e.kind,
      }))
      .filter((e) => e.source && e.target)

    const sim = forceSimulation<GraphNode>(simNodes)
      .force('link', forceLink(simEdges).id((d) => (d as GraphNode).id).distance(80))
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide(20))

    function draw() {
      ctx!.clearRect(0, 0, width, height)

      // Edges
      for (const e of simEdges) {
        const s = e.source as GraphNode
        const t = e.target as GraphNode
        if (!s.x || !s.y || !t.x || !t.y) continue
        ctx!.beginPath()
        ctx!.moveTo(s.x, s.y)
        ctx!.lineTo(t.x, t.y)
        ctx!.strokeStyle = EDGE_COLOR[e.kind]
        ctx!.globalAlpha = 0.5
        ctx!.lineWidth = 1.5
        ctx!.stroke()
        ctx!.globalAlpha = 1
      }

      // Nodes
      for (const n of simNodes) {
        if (!n.x || !n.y) continue
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, 10, 0, Math.PI * 2)
        ctx!.fillStyle = NODE_COLOR[n.kind]
        ctx!.fill()
        ctx!.fillStyle = '#f9fafb'
        ctx!.font = '10px sans-serif'
        ctx!.textAlign = 'center'
        ctx!.fillText(n.label.slice(0, 10), n.x, n.y + 22)
      }
    }

    sim.on('tick', draw)

    return () => { sim.stop() }
  }, [nodes, edges, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ borderRadius: 10, background: '#111827', display: 'block' }}
    />
  )
}
