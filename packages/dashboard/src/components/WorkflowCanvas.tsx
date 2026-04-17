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

// ── SVG icons ──────────────────────────────────────────────────────────────

const Icons = {
  chain: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  wallet: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
    </svg>
  ),
  pay: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7"/>
      <path d="M12 19V5"/>
    </svg>
  ),
  balance: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 9l9-6 9 6M3 9h18M5 15l7 4 7-4"/>
    </svg>
  ),
  receive: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>
  ),
  market: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  trading: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
    </svg>
  ),
  api: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
      <path d="M2 12h20"/>
    </svg>
  ),
  mcp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="10" x="4" y="9" rx="2"/>
      <path d="M8 9V5a2 2 0 1 1 4 0v4M12 9V5a2 2 0 1 1 4 0v4"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
  ),
  code: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
}

// ── Theme per node category ────────────────────────────────────────────────

interface Theme { color: string; bg: string; border: string; glow: string }

const THEMES: Record<string, Theme> = {
  chain:   { color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.3)',  glow: 'rgba(99,102,241,0.4)' },
  wallet:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)',  glow: 'rgba(59,130,246,0.4)' },
  payment: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   glow: 'rgba(34,197,94,0.4)'  },
  market:  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.3)',  glow: 'rgba(139,92,246,0.4)' },
  solana:  { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)',  glow: 'rgba(249,115,22,0.4)' },
  service: { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.3)',   glow: 'rgba(6,182,212,0.4)'  },
}

const ICONS: Record<string, JSX.Element> = {
  chain: Icons.chain,
  wallet: Icons.wallet,
  payment_pay: Icons.pay,
  payment_balance: Icons.balance,
  payment_receive: Icons.receive,
  market: Icons.market,
  solana: Icons.trading,
  service_x402scan: Icons.api,
  service_mcp: Icons.mcp,
  service_langchain: Icons.code,
  service_vercel: Icons.code,
}

// ── Custom ReactFlow node ──────────────────────────────────────────────────

function WorkflowNode({ data }: NodeProps) {
  const category = data.category as string
  const iconKey = (data.iconKey as string) ?? category
  const theme = THEMES[category] ?? THEMES.service
  const count = Number(data.count ?? 0)
  const active = data.active as boolean || count > 0
  const icon = ICONS[iconKey] ?? ICONS[category] ?? Icons.chain

  return (
    <div style={{
      position: 'relative',
      background: active
        ? `linear-gradient(135deg, ${theme.bg}, rgba(0,0,0,0.2))`
        : 'rgba(255,255,255,0.02)',
      border: `1px solid ${active ? theme.border : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 11,
      padding: '11px 14px',
      minWidth: 138,
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      boxShadow: active ? `0 4px 24px ${theme.glow}, 0 0 0 1px ${theme.border}` : '0 1px 3px rgba(0,0,0,0.4)',
      transition: 'all 0.35s ease',
    }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: theme.color, width: 6, height: 6, border: 'none', opacity: 0.7 }}
      />

      {/* Icon circle + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: active ? theme.bg : 'rgba(255,255,255,0.03)',
          border: `1px solid ${active ? theme.border : 'rgba(255,255,255,0.06)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: active ? theme.color : '#334155',
          transition: 'all 0.3s ease',
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#f1f5f9' : '#475569',
            whiteSpace: 'nowrap', transition: 'color 0.3s ease', letterSpacing: '-0.01em' }}>
            {data.label as string}
          </div>
          {data.sub ? (
            <div style={{ fontSize: 9, color: active ? '#334155' : '#1e293b',
              fontFamily: 'var(--mono)', letterSpacing: '0.01em', marginTop: 1, transition: 'color 0.3s ease' }}>
              {String(data.sub)}
            </div>
          ) : null}
        </div>
        {count > 0 && (
          <span style={{ marginLeft: 'auto', paddingLeft: 6, fontSize: 13, fontWeight: 700,
            color: theme.color, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>
            {count}
          </span>
        )}
      </div>

      {/* Active bottom glow line */}
      {active && (
        <div style={{ position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 1,
          background: `linear-gradient(90deg, transparent, ${theme.color}88, transparent)`,
          borderRadius: '0 0 11px 11px' }} />
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: theme.color, width: 6, height: 6, border: 'none', opacity: 0.7 }}
      />
    </div>
  )
}

const nodeTypes = { workflow: WorkflowNode }

// ── Edge colors ────────────────────────────────────────────────────────────

const EC = {
  chain:   '#6366f1',
  payment: '#22c55e',
  trade:   '#f97316',
  neutral: 'rgba(255,255,255,0.08)',
}

// ── Canvas component ───────────────────────────────────────────────────────

interface Props {
  payCount: number
  tradeCount: number
  walletAddress: string
}

export function WorkflowCanvas({ payCount, tradeCount, walletAddress }: Props) {
  const nodes: Node[] = useMemo(() => {
    const addr = walletAddress
      ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
      : 'no key'

    return [
      // Col 1 — Chains
      { id: 'base',      type: 'workflow', position: { x: 0,   y: 0   }, data: { label: 'Base',      category: 'chain',   iconKey: 'chain',            sub: 'eip155:8453',    count: 0,          active: payCount > 0   } },
      { id: 'arb',       type: 'workflow', position: { x: 0,   y: 82  }, data: { label: 'Arbitrum',  category: 'chain',   iconKey: 'chain',            sub: 'eip155:42161',   count: 0,          active: false          } },
      { id: 'sol-chain', type: 'workflow', position: { x: 0,   y: 164 }, data: { label: 'Solana',    category: 'chain',   iconKey: 'chain',            sub: 'mainnet-beta',   count: 0,          active: tradeCount > 0 } },

      { id: 'wallet',    type: 'workflow', position: { x: 210, y: 64  }, data: { label: 'Wallet',    category: 'wallet',  iconKey: 'wallet',           sub: addr,             count: 0,          active: !!walletAddress} },

      { id: 'pay',       type: 'workflow', position: { x: 420, y: 0   }, data: { label: 'Pay',       category: 'payment', iconKey: 'payment_pay',      sub: 'x402 auto-pay',  count: payCount,   active: payCount > 0   } },
      { id: 'balance',   type: 'workflow', position: { x: 420, y: 82  }, data: { label: 'Balance',   category: 'payment', iconKey: 'payment_balance',  sub: 'USDC · SOL',     count: 0,          active: !!walletAddress} },
      { id: 'receive',   type: 'workflow', position: { x: 420, y: 164 }, data: { label: 'Receive',   category: 'payment', iconKey: 'payment_receive',  sub: 'invoice 30m',    count: 0,          active: false          } },

      { id: 'market',    type: 'workflow', position: { x: 630, y: 0   }, data: { label: 'Market',    category: 'market',  iconKey: 'market',           sub: 'CoinGecko · DL', count: 0,          active: false          } },
      { id: 'trading',   type: 'workflow', position: { x: 630, y: 82  }, data: { label: 'Trading',   category: 'solana',  iconKey: 'solana',           sub: 'pump.fun · Ray', count: tradeCount, active: tradeCount > 0 } },
      { id: 'x402scan',  type: 'workflow', position: { x: 630, y: 164 }, data: { label: 'x402scan',  category: 'service', iconKey: 'service_x402scan', sub: 'API discovery',  count: 0,          active: false          } },

      { id: 'mcp',       type: 'workflow', position: { x: 840, y: 0   }, data: { label: 'MCP',       category: 'service', iconKey: 'service_mcp',      sub: 'Claude · Cursor',count: 0,          active: false          } },
      { id: 'langchain', type: 'workflow', position: { x: 840, y: 82  }, data: { label: 'LangChain', category: 'service', iconKey: 'service_langchain', sub: 'agent tools',   count: 0,          active: false          } },
      { id: 'vercel',    type: 'workflow', position: { x: 840, y: 164 }, data: { label: 'Vercel AI', category: 'service', iconKey: 'service_vercel',   sub: 'useTools()',     count: 0,          active: false          } },
    ]
  }, [payCount, tradeCount, walletAddress])

  const edges: Edge[] = useMemo(() => [
    // Chains → Wallet
    edge('base-w',   'base',     'wallet',   EC.chain,   false),
    edge('arb-w',    'arb',      'wallet',   EC.chain,   false),
    edge('sol-w',    'sol-chain','wallet',   EC.chain,   false),
    // Wallet → Tools
    edge('w-pay',    'wallet',   'pay',      EC.payment, payCount > 0),
    edge('w-bal',    'wallet',   'balance',  EC.chain,   !!walletAddress),
    edge('w-rec',    'wallet',   'receive',  EC.neutral, false),
    // Tools → Services
    edge('pay-mkt',  'pay',      'market',   EC.neutral, false),
    edge('pay-trd',  'pay',      'trading',  EC.trade,   tradeCount > 0),
    edge('pay-x402', 'pay',      'x402scan', EC.payment, payCount > 0),
    // Services → Frameworks
    edge('mkt-mcp',  'market',   'mcp',      EC.neutral, false),
    edge('trd-lc',   'trading',  'langchain',EC.neutral, false),
    edge('x402-v',   'x402scan', 'vercel',   EC.neutral, false),
  ], [payCount, tradeCount, walletAddress])

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: '#04060f' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        colorMode="dark"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.04)" />
      </ReactFlow>
    </div>
  )
}

function edge(id: string, source: string, target: string, color: string, animated: boolean): Edge {
  return {
    id, source, target, animated,
    style: { stroke: color, strokeWidth: animated ? 1.5 : 1, opacity: animated ? 0.7 : 0.3 },
    type: 'default',
  }
}
