'use client'

import { useEffect, useReducer, useCallback, useState } from 'react'
import { connectEventSource } from '../lib/events'
import { AgentGraph } from '../components/AgentGraph'
import { WorkflowCanvas } from '../components/WorkflowCanvas'
import { TransactionFeed } from '../components/TransactionFeed'
import {
  createGraphState,
  graphSnapshot,
  applyPayEvent,
  applyTradeEvent,
  applyBalanceEvent,
  applyInvoiceEvent,
} from '../lib/graph'
import type { GraphState } from '../lib/graph'
import type { AgentiEvent } from '@agenti/sdk'
import type { FeedItem, GraphNode, GraphEdge } from '../types'

const MAX_FEED = 50

interface State {
  feed: FeedItem[]
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  payCount: number
  tradeCount: number
  errorCount: number
  walletAddress: string
}

type Action = { type: 'event'; event: AgentiEvent }

function idFromEvent(e: AgentiEvent): string {
  return `${e.type}-${e.ts}-${Math.random().toString(36).slice(2, 7)}`
}

function reducer(state: State, action: Action): State {
  const { event } = action
  const gs: GraphState = {
    nodes: new Map([...state.nodes.entries()].map(([k, v]) => [k, { ...v }])),
    edges: [...state.edges],
  }
  let feed = state.feed
  let { payCount, tradeCount, errorCount, walletAddress } = state
  const item: FeedItem = { id: idFromEvent(event), type: event.type, label: '', ts: event.ts }

  switch (event.type) {
    case 'pay':     { item.label = event.url; item.sub = `${event.amount} · ${event.network}`; payCount++; applyPayEvent(gs, event.url, event.network); break }
    case 'trade':   { item.label = `${event.side.toUpperCase()} ${event.mint.slice(0, 8)}…`; item.sub = `${event.sol} SOL`; tradeCount++; applyTradeEvent(gs, event.mint, event.side); break }
    case 'balance': { item.label = event.address.slice(0, 10) + '…'; walletAddress = event.address; applyBalanceEvent(gs, event.address); break }
    case 'invoice': { item.label = `${event.amount} ${event.token}`; item.sub = event.address.slice(0, 10) + '…'; applyInvoiceEvent(gs, event.address, event.token); break }
    case 'error':   { item.label = event.message; item.sub = event.tool; errorCount++; break }
  }

  feed = [item, ...feed].slice(0, MAX_FEED)
  const snap = graphSnapshot(gs)
  return { feed, nodes: gs.nodes, edges: snap.edges, payCount, tradeCount, errorCount, walletAddress }
}

function getInitialState(): State {
  const gs = createGraphState()
  return { feed: [], nodes: gs.nodes, edges: [], payCount: 0, tradeCount: 0, errorCount: 0, walletAddress: '' }
}

type View = 'workflow' | 'network'

export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)
  const [view, setView] = useState<View>('workflow')

  const handleEvent = useCallback((event: AgentiEvent) => dispatch({ type: 'event', event }), [])
  useEffect(() => connectEventSource(handleEvent), [handleEvent])

  const graphNodes = Array.from(state.nodes.values())
  const connected = !!state.walletAddress

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 15% 50%, rgba(59,130,246,0.05) 0%, transparent 60%), radial-gradient(ellipse at 85% 20%, rgba(139,92,246,0.05) 0%, transparent 60%), #04060f' }}>

      {/* ── Topbar ───────────────────────────────────────────────────── */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7,
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>a</div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em',
            background: 'linear-gradient(90deg, #f1f5f9, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            agenti
          </span>
        </div>

        <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 16 }}>/</span>

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', width: 7, height: 7 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%',
              background: connected ? '#22c55e' : '#334155' }} />
            {connected && <span style={{ position: 'absolute', inset: '-3px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.3)', animation: 'ping 2s ease infinite' }} />}
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: connected ? '#64748b' : '#334155' }}>
            {connected ? `${state.walletAddress.slice(0,8)}…${state.walletAddress.slice(-6)}` : 'no wallet'}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 3, gap: 2 }}>
          {(['workflow', 'network'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '3px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
              background: view === v ? 'rgba(59,130,246,0.18)' : 'transparent',
              color: view === v ? '#93c5fd' : '#475569',
              fontSize: 11, fontWeight: 500, letterSpacing: '0.01em', transition: 'all 0.15s' }}>
              {v === 'workflow' ? 'Workflow' : '3D'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>

        {/* Graph */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
          borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>

          <Label>{view === 'workflow' ? 'Agent Workflow' : 'Transaction Network'}</Label>

          <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
            {view === 'workflow'
              ? <WorkflowCanvas payCount={state.payCount} tradeCount={state.tradeCount} walletAddress={state.walletAddress} />
              : <AgentGraph nodes={graphNodes} edges={state.edges} width={800} height={600} />}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Stat cards */}
          <div style={{ padding: '16px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <Label>Activity</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <StatCard label="Payments" value={state.payCount} color="#22c55e" glow="rgba(34,197,94,0.15)" icon="↗" />
              <StatCard label="Trades" value={state.tradeCount} color="#3b82f6" glow="rgba(59,130,246,0.15)" icon="⇄" />
              <StatCard label="Errors" value={state.errorCount} color={state.errorCount > 0 ? '#ef4444' : '#334155'} glow="rgba(239,68,68,0.1)" icon="✕" />
              <StatCard label="Events" value={state.feed.length} color="#8b5cf6" glow="rgba(139,92,246,0.1)" icon="◎" />
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 14px' }} />

          {/* Feed */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Label>Live Feed</Label>
              {state.feed.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#334155',
                  fontFamily: 'var(--mono)', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 5px' }}>
                  {state.feed.length}
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
              <TransactionFeed items={state.feed} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: '#334155',
      textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      {children}
    </div>
  )
}

function StatCard({ label, value, color, glow, icon }: { label: string; value: number; color: string; glow: string; icon: string }) {
  const active = value > 0
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      background: active ? glow : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? color + '30' : 'rgba(255,255,255,0.05)'}`,
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: active ? color + 'bb' : '#334155',
          textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: active ? color : '#1e293b' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: active ? color : '#1e293b',
        fontFamily: 'var(--mono)', lineHeight: 1, transition: 'all 0.3s ease' }}>
        {value}
      </div>
    </div>
  )
}
