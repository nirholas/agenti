'use client'

import { useEffect, useReducer, useCallback } from 'react'
import { connectEventSource } from '../lib/events.js'
import { AgentGraph } from '../components/AgentGraph.js'
import { TransactionFeed } from '../components/TransactionFeed.js'
import { WalletCard } from '../components/WalletCard.js'
import type { AgentiEvent } from '@agenti/sdk'
import type { FeedItem, GraphNode, GraphEdge } from '../types.js'

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

function ensureNode(nodes: Map<string, GraphNode>, id: string, label: string, kind: GraphNode['kind']) {
  if (!nodes.has(id)) nodes.set(id, { id, label, kind })
}

function reducer(state: State, action: Action): State {
  const { event } = action
  const nodes = new Map(state.nodes)
  const edges = [...state.edges]
  let feed = state.feed
  let { payCount, tradeCount, errorCount, walletAddress } = state

  const item: FeedItem = { id: idFromEvent(event), type: event.type, label: '', ts: event.ts }

  switch (event.type) {
    case 'pay': {
      item.label = event.url
      item.sub = `${event.amount} · ${event.network}`
      payCount++
      ensureNode(nodes, event.url, new URL(event.url).hostname, 'url')
      ensureNode(nodes, event.network, event.network, 'wallet')
      edges.push({ source: event.network, target: event.url, kind: 'pay' })
      break
    }
    case 'trade': {
      item.label = `${event.side.toUpperCase()} ${event.mint.slice(0, 8)}…`
      item.sub = `${event.sol} SOL`
      tradeCount++
      ensureNode(nodes, event.mint, `${event.mint.slice(0, 6)}…`, 'token')
      ensureNode(nodes, 'SOL', 'SOL', 'wallet')
      const [src, tgt] = event.side === 'buy' ? ['SOL', event.mint] : [event.mint, 'SOL']
      edges.push({ source: src, target: tgt, kind: 'trade' })
      break
    }
    case 'balance': {
      item.label = `Balance update: ${event.address.slice(0, 10)}…`
      walletAddress = event.address
      ensureNode(nodes, event.address, `${event.address.slice(0, 6)}…`, 'wallet')
      break
    }
    case 'invoice': {
      item.label = `Invoice: ${event.amount} ${event.token}`
      item.sub = event.address.slice(0, 10) + '…'
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

  return {
    feed,
    nodes,
    edges: edges.slice(-300),
    payCount,
    tradeCount,
    errorCount,
    walletAddress,
  }
}

const INITIAL: State = {
  feed: [],
  nodes: new Map(),
  edges: [],
  payCount: 0,
  tradeCount: 0,
  errorCount: 0,
  walletAddress: '',
}

export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  const handleEvent = useCallback((event: AgentiEvent) => {
    dispatch({ type: 'event', event })
  }, [])

  useEffect(() => {
    return connectEventSource(handleEvent)
  }, [handleEvent])

  const graphNodes = Array.from(state.nodes.values())

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#f9fafb' }}>
          agenti <span style={{ color: '#3b82f6' }}>dashboard</span>
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Real-time agent activity — payments · trades · balances
        </p>
      </div>

      {/* Wallet card */}
      <div style={{ marginBottom: 20 }}>
        <WalletCard
          wallet={{
            address: state.walletAddress,
            payCount: state.payCount,
            tradeCount: state.tradeCount,
            errorCount: state.errorCount,
          }}
        />
      </div>

      {/* Graph + Feed */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 540px' }}>
          <SectionTitle>Activity Graph</SectionTitle>
          <AgentGraph nodes={graphNodes} edges={state.edges} width={580} height={360} />
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          <SectionTitle>Event Feed</SectionTitle>
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <TransactionFeed items={state.feed} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
      {children}
    </h2>
  )
}
