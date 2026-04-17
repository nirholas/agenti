'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Category colors ────────────────────────────────────────────────────────

const CAT: Record<string, { accent: string; dim: string }> = {
  chain:   { accent: '#6366f1', dim: '#1a1a3a' },
  wallet:  { accent: '#00ffcc', dim: '#001a18' },
  payment: { accent: '#00ff6a', dim: '#001a0d' },
  market:  { accent: '#b668ff', dim: '#160020' },
  solana:  { accent: '#ff9500', dim: '#1a0d00' },
  service: { accent: '#06b6d4', dim: '#001418' },
}

// ── Terminal-style node ────────────────────────────────────────────────────

function TermNode({ data }: NodeProps) {
  const cat = (data.category as string) ?? 'service'
  const { accent, dim } = CAT[cat] ?? CAT.service
  const count = Number(data.count ?? 0)
  const active = (data.active as boolean) || count > 0

  return (
    <div style={{
      background: active ? dim : '#04040a',
      border: `1px solid ${active ? accent + '55' : 'rgba(0,255,204,0.08)'}`,
      borderRadius: 3,
      minWidth: 148,
      fontFamily: 'var(--mono)',
      boxShadow: active ? `0 0 12px ${accent}22, inset 0 0 20px ${accent}08` : 'none',
      transition: 'all 0.4s ease',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        background: active ? accent + '18' : 'rgba(0,255,204,0.02)',
        borderBottom: `1px solid ${active ? accent + '30' : 'rgba(0,255,204,0.06)'}`,
        padding: '3px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: active ? accent : '#3a5555' }}>
          {cat}
        </span>
        {count > 0 && (
          <span style={{ fontSize: 9, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
            {count}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '6px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#e8f8f8' : '#3a5555', letterSpacing: '-0.01em', marginBottom: 2 }}>
          {data.label as string}
        </div>
        {data.sub ? (
          <div style={{ fontSize: 9, color: active ? '#3a5555' : '#1a2a2a', letterSpacing: '0.02em' }}>
            {String(data.sub)}
          </div>
        ) : null}
      </div>

      {/* Active bottom accent */}
      {active && (
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }} />
      )}

      <Handle type="target" position={Position.Left}
        style={{ background: active ? accent : '#1a3030', width: 5, height: 5, border: 'none', borderRadius: 1 }} />
      <Handle type="source" position={Position.Right}
        style={{ background: active ? accent : '#1a3030', width: 5, height: 5, border: 'none', borderRadius: 1 }} />
    </div>
  )
}

const nodeTypes = { term: TermNode }

// ── Component ──────────────────────────────────────────────────────────────

interface Props { payCount: number; tradeCount: number; walletAddress: string }

export function WorkflowCanvas({ payCount, tradeCount, walletAddress }: Props) {
  const addr = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : 'no key set'

  const nodes: Node[] = useMemo(() => [
    mk('base',      'chain',   { x: 0,   y: 0   }, 'Base',       'eip155:8453',      0,          payCount > 0),
    mk('arb',       'chain',   { x: 0,   y: 80  }, 'Arbitrum',   'eip155:42161',     0,          false),
    mk('sol-chain', 'chain',   { x: 0,   y: 160 }, 'Solana',     'mainnet-beta',     0,          tradeCount > 0),

    mk('wallet',    'wallet',  { x: 210, y: 64  }, 'Wallet',     addr,               0,          !!walletAddress),

    mk('pay',       'payment', { x: 420, y: 0   }, 'Pay',        'x402 auto-pay',    payCount,   payCount > 0),
    mk('balance',   'payment', { x: 420, y: 80  }, 'Balance',    'USDC · SOL',       0,          !!walletAddress),
    mk('receive',   'payment', { x: 420, y: 160 }, 'Receive',    'invoice 30m',      0,          false),

    mk('market',    'market',  { x: 630, y: 0   }, 'Market',     'CoinGecko · DL',   0,          false),
    mk('trading',   'solana',  { x: 630, y: 80  }, 'Trading',    'pump · raydium',   tradeCount, tradeCount > 0),
    mk('x402scan',  'service', { x: 630, y: 160 }, 'x402scan',   'API registry',     0,          false),

    mk('mcp',       'service', { x: 840, y: 0   }, 'MCP',        'claude · cursor',  0,          false),
    mk('langchain', 'service', { x: 840, y: 80  }, 'LangChain',  'agent tools',      0,          false),
    mk('vercel',    'service', { x: 840, y: 160 }, 'Vercel AI',  'useTools()',       0,          false),
  ], [payCount, tradeCount, walletAddress, addr])

  const edges: Edge[] = useMemo(() => [
    e('base-w',   'base',     'wallet',    '#6366f1', false),
    e('arb-w',    'arb',      'wallet',    '#6366f1', false),
    e('sol-w',    'sol-chain','wallet',    '#6366f1', false),
    e('w-pay',    'wallet',   'pay',       '#00ff6a', payCount > 0),
    e('w-bal',    'wallet',   'balance',   '#00ffcc', !!walletAddress),
    e('w-rec',    'wallet',   'receive',   '#1a3030', false),
    e('pay-mkt',  'pay',      'market',    '#1a3030', false),
    e('pay-trd',  'pay',      'trading',   '#ff9500', tradeCount > 0),
    e('pay-x402', 'pay',      'x402scan',  '#00ff6a', payCount > 0),
    e('mkt-mcp',  'market',   'mcp',       '#1a3030', false),
    e('trd-lc',   'trading',  'langchain', '#1a3030', false),
    e('x402-v',   'x402scan', 'vercel',    '#1a3030', false),
  ], [payCount, tradeCount, walletAddress])

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={nodeTypes}
        fitView fitViewOptions={{ padding: 0.15 }}
        colorMode="dark"
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24} size={1}
          color="rgba(0,255,204,0.07)"
        />
      </ReactFlow>
    </div>
  )
}

function mk(id: string, category: string, position: { x: number; y: number }, label: string, sub: string, count: number, active: boolean): Node {
  return { id, type: 'term', position, data: { label, category, sub, count, active } }
}

function e(id: string, source: string, target: string, color: string, animated: boolean): Edge {
  return {
    id, source, target, animated,
    style: { stroke: color, strokeWidth: animated ? 1.5 : 1, opacity: animated ? 0.6 : 0.2 },
  }
}
