'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { GraphNode, EdgeKind } from '../types'

// ── Node styles ────────────────────────────────────────────────────────────

const STEP_STYLE: Record<string, { bg: string; border: string; accent: string }> = {
  wallet:   { bg: '#1e3a5f', border: '#3b82f6', accent: '#93c5fd' },
  payment:  { bg: '#14402b', border: '#22c55e', accent: '#86efac' },
  market:   { bg: '#3b1f5e', border: '#a855f7', accent: '#d8b4fe' },
  solana:   { bg: '#422006', border: '#f97316', accent: '#fdba74' },
  chain:    { bg: '#1e1a40', border: '#6366f1', accent: '#a5b4fc' },
  service:  { bg: '#164040', border: '#06b6d4', accent: '#67e8f9' },
}

function WorkflowNode({ data }: NodeProps) {
  const style = STEP_STYLE[data.category as string] ?? STEP_STYLE.service
  const active = data.active as boolean
  return (
    <div
      style={{
        background: style.bg,
        border: `2px solid ${active ? style.accent : style.border}`,
        borderRadius: 10,
        padding: '10px 16px',
        minWidth: 140,
        textAlign: 'center',
        boxShadow: active
          ? `0 0 14px ${style.accent}88`
          : `0 0 6px ${style.border}33`,
        transition: 'all 0.3s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: style.border, width: 8, height: 8 }} />
      <div style={{ fontSize: 9, color: style.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {data.category as string}
      </div>
      <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 700, marginBottom: 2 }}>
        {data.label as string}
      </div>
      {data.sub ? (
        <div style={{ fontSize: 10, color: '#9ca3af' }}>{String(data.sub)}</div>
      ) : null}
      {(Number(data.count) > 0) && (
        <div style={{
          marginTop: 6,
          background: style.border + '33',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 11,
          color: style.accent,
          fontFamily: 'monospace',
        }}>
          ×{String(data.count)}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: style.border, width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { workflow: WorkflowNode }

const EDGE_COLOR: Record<EdgeKind, string> = {
  pay:     '#22c55e',
  trade:   '#a855f7',
  balance: '#60a5fa',
  invoice: '#f59e0b',
}

// ── Static workflow layout ─────────────────────────────────────────────────

interface Props {
  payCount: number
  tradeCount: number
  walletAddress: string
  activeNodes?: Set<string>
}

export function WorkflowCanvas({ payCount, tradeCount, walletAddress, activeNodes = new Set() }: Props) {
  const nodes: Node[] = useMemo(() => [
    // Column 1 — Chains
    { id: 'base',     type: 'workflow', position: { x: 0,   y: 0   }, data: { label: 'Base',     category: 'chain',   sub: 'eip155:8453',  count: 0, active: activeNodes.has('base')     } },
    { id: 'arb',      type: 'workflow', position: { x: 0,   y: 110 }, data: { label: 'Arbitrum', category: 'chain',   sub: 'eip155:42161', count: 0, active: activeNodes.has('arb')      } },
    { id: 'solana',   type: 'workflow', position: { x: 0,   y: 220 }, data: { label: 'Solana',   category: 'chain',   sub: 'mainnet-beta', count: 0, active: activeNodes.has('solana')   } },

    // Column 2 — Wallet
    { id: 'wallet',   type: 'workflow', position: { x: 220, y: 80  }, data: { label: 'Wallet',   category: 'wallet',  sub: walletAddress ? walletAddress.slice(0, 10) + '…' : 'no key set', count: 0, active: activeNodes.has('wallet') } },

    // Column 3 — Core tools
    { id: 'pay',      type: 'workflow', position: { x: 440, y: 0   }, data: { label: 'Pay',      category: 'payment', sub: 'x402 auto-pay', count: payCount,   active: payCount > 0        } },
    { id: 'balance',  type: 'workflow', position: { x: 440, y: 110 }, data: { label: 'Balance',  category: 'wallet',  sub: 'USDC + SOL',    count: 0,           active: !!walletAddress     } },
    { id: 'receive',  type: 'workflow', position: { x: 440, y: 220 }, data: { label: 'Receive',  category: 'payment', sub: 'invoice 30min', count: 0,           active: false               } },

    // Column 4 — Services
    { id: 'market',   type: 'workflow', position: { x: 660, y: 0   }, data: { label: 'Market',   category: 'market',  sub: 'CoinGecko · DeFiLlama', count: 0,         active: false } },
    { id: 'trading',  type: 'workflow', position: { x: 660, y: 110 }, data: { label: 'Trading',  category: 'solana',  sub: 'pump.fun · Raydium',    count: tradeCount, active: tradeCount > 0 } },
    { id: 'x402scan', type: 'workflow', position: { x: 660, y: 220 }, data: { label: 'x402scan', category: 'service', sub: 'API discovery',          count: 0,         active: false } },

    // Column 5 — Frameworks
    { id: 'mcp',      type: 'workflow', position: { x: 880, y: 0   }, data: { label: 'MCP',        category: 'service', sub: 'Claude / Cursor', count: 0, active: false } },
    { id: 'langchain',type: 'workflow', position: { x: 880, y: 110 }, data: { label: 'LangChain',   category: 'service', sub: 'agent tools',    count: 0, active: false } },
    { id: 'vercel',   type: 'workflow', position: { x: 880, y: 220 }, data: { label: 'Vercel AI',   category: 'service', sub: 'useTools()',      count: 0, active: false } },
  ], [payCount, tradeCount, walletAddress, activeNodes])

  const edges: Edge[] = useMemo(() => [
    // Chains → Wallet
    { id: 'e-base-wallet',   source: 'base',   target: 'wallet', style: { stroke: EDGE_COLOR.balance, strokeWidth: 1.5, opacity: 0.6 } },
    { id: 'e-arb-wallet',    source: 'arb',    target: 'wallet', style: { stroke: EDGE_COLOR.balance, strokeWidth: 1.5, opacity: 0.6 } },
    { id: 'e-sol-wallet',    source: 'solana', target: 'wallet', style: { stroke: EDGE_COLOR.balance, strokeWidth: 1.5, opacity: 0.6 } },
    // Wallet → Tools
    { id: 'e-wallet-pay',     source: 'wallet', target: 'pay',     animated: payCount > 0, style: { stroke: EDGE_COLOR.pay,     strokeWidth: payCount > 0 ? 2 : 1.5, opacity: 0.7 } },
    { id: 'e-wallet-balance', source: 'wallet', target: 'balance', style: { stroke: EDGE_COLOR.balance, strokeWidth: 1.5, opacity: 0.6 } },
    { id: 'e-wallet-receive', source: 'wallet', target: 'receive', style: { stroke: EDGE_COLOR.invoice, strokeWidth: 1.5, opacity: 0.6 } },
    // Tools → Services
    { id: 'e-pay-market',    source: 'pay',     target: 'market',   style: { stroke: EDGE_COLOR.pay,   strokeWidth: 1.5, opacity: 0.5 } },
    { id: 'e-pay-trading',   source: 'pay',     target: 'trading',  animated: tradeCount > 0, style: { stroke: EDGE_COLOR.trade, strokeWidth: tradeCount > 0 ? 2 : 1.5, opacity: 0.7 } },
    { id: 'e-pay-x402',      source: 'pay',     target: 'x402scan', style: { stroke: EDGE_COLOR.pay,   strokeWidth: 1.5, opacity: 0.5 } },
    // Services → Frameworks
    { id: 'e-market-mcp',    source: 'market',  target: 'mcp',      style: { stroke: '#4b5563', strokeWidth: 1, opacity: 0.4 } },
    { id: 'e-trading-lc',    source: 'trading', target: 'langchain',style: { stroke: '#4b5563', strokeWidth: 1, opacity: 0.4 } },
    { id: 'e-x402-vercel',   source: 'x402scan',target: 'vercel',   style: { stroke: '#4b5563', strokeWidth: 1, opacity: 0.4 } },
  ], [payCount, tradeCount])

  return (
    <div style={{ width: '100%', height: 380, borderRadius: 10, overflow: 'hidden', background: '#0a0f1e' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        colorMode="dark"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
        <Controls style={{ background: '#1f2937', border: '1px solid #374151' }} showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
