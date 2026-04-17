'use client'

import dynamic from 'next/dynamic'
import { useRef, useMemo, useCallback } from 'react'
import type { GraphNode, GraphEdge, NodeKind, EdgeKind } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph3D = dynamic<any>(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div style={{
      background: '#111827',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#4b5563',
      fontSize: 13,
      fontFamily: 'monospace',
      letterSpacing: '0.05em',
    }}>
      initializing 3d graph…
    </div>
  ),
})

export const NODE_COLOR: Record<NodeKind, string> = {
  chain:   '#f97316',
  service: '#06b6d4',
  agent:   '#eab308',
  wallet:  '#3b82f6',
  token:   '#a855f7',
  url:     '#22c55e',
}

const NODE_BASE_VAL: Record<NodeKind, number> = {
  chain:   12,
  service: 10,
  agent:   7,
  wallet:  5,
  token:   8,
  url:     3,
}

export const EDGE_COLOR: Record<EdgeKind, string> = {
  pay:     '#22c55e',
  trade:   '#a855f7',
  balance: '#60a5fa',
  invoice: '#f59e0b',
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
}

export function AgentGraph({ nodes, edges, width = 900, height = 520 }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)

  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),
    links: edges.map(e => ({
      source: typeof e.source === 'string' ? e.source : (e.source as GraphNode).id,
      target: typeof e.target === 'string' ? e.target : (e.target as GraphNode).id,
      kind: e.kind,
    })),
  }), [nodes, edges])

  const nodeColor    = useCallback((n: any) => NODE_COLOR[n.kind as NodeKind] ?? '#9ca3af', [])
  const nodeVal      = useCallback((n: any) => (NODE_BASE_VAL[n.kind as NodeKind] ?? 4) + (n.hits ?? 0) * 0.3, [])
  const linkColor    = useCallback((l: any) => EDGE_COLOR[l.kind as EdgeKind] ?? '#4b5563', [])
  const linkParticles = useCallback((l: any) => (l.kind === 'pay' || l.kind === 'trade') ? 3 : 0, [])
  const linkParticleColor = useCallback((l: any) => EDGE_COLOR[l.kind as EdgeKind] ?? '#ffffff', [])

  const onEngineStop = useCallback(() => {
    const ctrl = fgRef.current?.controls()
    if (ctrl) {
      ctrl.autoRotate = true
      ctrl.autoRotateSpeed = 0.4
    }
  }, [])

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      nodeLabel="label"
      nodeColor={nodeColor}
      nodeVal={nodeVal}
      linkColor={linkColor}
      linkWidth={1.5}
      linkDirectionalParticles={linkParticles}
      linkDirectionalParticleSpeed={0.004}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleColor={linkParticleColor}
      backgroundColor="#0f172a"
      width={width}
      height={height}
      onEngineStop={onEngineStop}
    />
  )
}
