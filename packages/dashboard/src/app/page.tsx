'use client'

import { useEffect, useReducer, useCallback, useState } from 'react'
import { connectEventSource } from '../lib/events'
import { AgentGraph, NODE_COLOR, EDGE_COLOR } from '../components/AgentGraph'
import { WorkflowCanvas } from '../components/WorkflowCanvas'
import { TransactionFeed } from '../components/TransactionFeed'
import { WalletCard } from '../components/WalletCard'
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
    case 'pay': {
      item.label = event.url
      item.sub = `${event.amount} · ${event.network}`
      payCount++
      applyPayEvent(gs, event.url, event.network)
      break
    }
    case 'trade': {
      item.label = `${event.side.toUpperCase()} ${event.mint.slice(0, 8)}…`
      item.sub = `${event.sol} SOL`
      tradeCount++
      applyTradeEvent(gs, event.mint, event.side)
      break
    }
    case 'balance': {
      item.label = `Balance: ${event.address.slice(0, 10)}…`
      walletAddress = event.address
      applyBalanceEvent(gs, event.address)
      break
    }
    case 'invoice': {
      item.label = `Invoice: ${event.amount} ${event.token}`
      item.sub = event.address.slice(0, 10) + '…'
      applyInvoiceEvent(gs, event.address, event.token)
      break
    }
    case 'error': {
      item.label = event.message
      item.sub = event.tool
      errorCount++
      break
    }
  }

  feed = [item, ...feed].slice(0, MAX_FEED)
  const snap = graphSnapshot(gs)

  return { feed, nodes: gs.nodes, edges: snap.edges, payCount, tradeCount, errorCount, walletAddress }
}

function getInitialState(): State {
  const gs = createGraphState()
  return {
    feed: [],
    nodes: gs.nodes,
    edges: [],
    payCount: 0,
    tradeCount: 0,
    errorCount: 0,
    walletAddress: '',
  }
}

type GraphView = 'network' | 'workflow'

export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)
  const [graphWidth, setGraphWidth] = useState(900)
  const [view, setView] = useState<GraphView>('workflow')

  const handleEvent = useCallback((event: AgentiEvent) => {
    dispatch({ type: 'event', event })
  }, [])

  useEffect(() => {
    return connectEventSource(handleEvent)
  }, [handleEvent])

  useEffect(() => {
    const update = () => setGraphWidth(Math.min(window.innerWidth - 48, 1400))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const graphNodes = Array.from(state.nodes.values())

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: '#f1f5f9',
      fontFamily: 'system-ui, sans-serif',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#f9fafb' }}>
          agenti <span style={{ color: '#3b82f6' }}>dashboard</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Real-time agent activity — payments · trades · balances
        </p>
      </div>

      {/* Wallet stats */}
      <div style={{ marginBottom: 20 }}>
        <WalletCard wallet={{
          address: state.walletAddress,
          payCount: state.payCount,
          tradeCount: state.tradeCount,
          errorCount: state.errorCount,
        }} />
      </div>

      {/* Graph view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <SectionTitle>Graph</SectionTitle>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {(['workflow', 'network'] as GraphView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '3px 12px',
                borderRadius: 6,
                border: `1px solid ${view === v ? '#3b82f6' : '#374151'}`,
                background: view === v ? '#1e3a5f' : 'transparent',
                color: view === v ? '#93c5fd' : '#6b7280',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {v === 'workflow' ? 'Workflow' : '3D Network'}
            </button>
          ))}
        </div>
      </div>

      {/* Graph panel */}
      <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden' }}>
        {view === 'workflow' ? (
          <WorkflowCanvas
            payCount={state.payCount}
            tradeCount={state.tradeCount}
            walletAddress={state.walletAddress}
          />
        ) : (
          <AgentGraph nodes={graphNodes} edges={state.edges} width={graphWidth} height={560} />
        )}
      </div>

      {/* Legend (network view only) */}
      {view === 'network' && <GraphLegend />}

      {/* Event feed */}
      <SectionTitle>Event Feed</SectionTitle>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <TransactionFeed items={state.feed} />
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 13,
      fontWeight: 600,
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      margin: '0 0 10px',
    }}>
      {children}
    </h2>
  )
}

function GraphLegend() {
  const nodeItems: Array<{ kind: keyof typeof NODE_COLOR; label: string }> = [
    { kind: 'chain',   label: 'Chain'    },
    { kind: 'service', label: 'Service'  },
    { kind: 'wallet',  label: 'Wallet'   },
    { kind: 'token',   label: 'Token'    },
    { kind: 'url',     label: 'Endpoint' },
  ]
  const edgeItems: Array<{ kind: keyof typeof EDGE_COLOR; label: string }> = [
    { kind: 'pay',     label: 'Pay'     },
    { kind: 'trade',   label: 'Trade'   },
    { kind: 'balance', label: 'Balance' },
    { kind: 'invoice', label: 'Invoice' },
  ]
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
      {nodeItems.map(({ kind, label }) => (
        <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLOR[kind] }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{label}</span>
        </div>
      ))}
      <div style={{ width: 1, height: 14, background: '#1f2937', margin: '0 4px' }} />
      {edgeItems.map(({ kind, label }) => (
        <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 18, height: 2, background: EDGE_COLOR[kind] }} />
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}
