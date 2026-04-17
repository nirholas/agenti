import type { GraphNode, GraphEdge, NodeKind, EdgeKind } from '../types'

export interface GraphState {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
}

const SEED_CHAINS: Array<{ id: string; label: string }> = [
  { id: 'chain:base', label: 'Base' },
  { id: 'chain:arbitrum', label: 'Arbitrum' },
  { id: 'chain:ethereum', label: 'Ethereum' },
  { id: 'chain:polygon', label: 'Polygon' },
  { id: 'chain:solana', label: 'Solana' },
  { id: 'chain:bsc', label: 'BSC' },
]

const SEED_SERVICES: Array<{ id: string; label: string }> = [
  { id: 'service:facilitator', label: 'Facilitator' },
  { id: 'service:mcp', label: 'MCP Server' },
  { id: 'service:x402', label: 'x402' },
]

const CAIP2_MAP: Record<string, string> = {
  'eip155:1': 'chain:ethereum',
  'eip155:8453': 'chain:base',
  'eip155:42161': 'chain:arbitrum',
  'eip155:137': 'chain:polygon',
  'eip155:56': 'chain:bsc',
  'eip155:84532': 'chain:base',
  'base': 'chain:base',
  'base-mainnet': 'chain:base',
  'base-sepolia': 'chain:base',
  'arbitrum': 'chain:arbitrum',
  'arbitrum-one': 'chain:arbitrum',
  'ethereum': 'chain:ethereum',
  'polygon': 'chain:polygon',
  'solana': 'chain:solana',
  'bsc': 'chain:bsc',
}

export function resolveChain(network: string): string {
  return CAIP2_MAP[network] ?? CAIP2_MAP[network.toLowerCase()] ?? 'chain:ethereum'
}

export function createGraphState(): GraphState {
  const nodes = new Map<string, GraphNode>()
  for (const c of SEED_CHAINS) {
    nodes.set(c.id, { id: c.id, label: c.label, kind: 'chain', hits: 0 })
  }
  for (const s of SEED_SERVICES) {
    nodes.set(s.id, { id: s.id, label: s.label, kind: 'service', hits: 0 })
  }
  return { nodes, edges: [] }
}

export function ensureNode(
  state: GraphState,
  id: string,
  label: string,
  kind: NodeKind,
): GraphNode {
  if (!state.nodes.has(id)) {
    state.nodes.set(id, { id, label, kind, hits: 0 })
  }
  return state.nodes.get(id)!
}

function bumpHits(state: GraphState, id: string): void {
  const n = state.nodes.get(id)
  if (n) state.nodes.set(id, { ...n, hits: (n.hits ?? 0) + 1 })
}

function addEdge(state: GraphState, source: string, target: string, kind: EdgeKind): void {
  state.edges.push({ source, target, kind })
}

export function applyPayEvent(state: GraphState, url: string, network: string): void {
  const chainId = resolveChain(network)
  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()
  ensureNode(state, url, hostname, 'url')
  bumpHits(state, chainId)
  bumpHits(state, 'service:x402')
  addEdge(state, chainId, url, 'pay')
  addEdge(state, 'service:x402', url, 'pay')
}

export function applyTradeEvent(state: GraphState, mint: string, side: 'buy' | 'sell'): void {
  ensureNode(state, mint, `${mint.slice(0, 6)}…`, 'token')
  ensureNode(state, 'token:SOL', 'SOL', 'token')
  bumpHits(state, 'chain:solana')
  bumpHits(state, mint)
  const [src, tgt] = side === 'buy' ? ['chain:solana', mint] : [mint, 'chain:solana']
  addEdge(state, src, tgt, 'trade')
}

export function applyBalanceEvent(state: GraphState, address: string): void {
  const isSolana = address.length >= 32 && !address.startsWith('0x')
  const chainId = isSolana ? 'chain:solana' : 'chain:base'
  ensureNode(state, address, `${address.slice(0, 6)}…`, 'wallet')
  bumpHits(state, chainId)
  bumpHits(state, address)
  addEdge(state, address, chainId, 'balance')
}

export function applyInvoiceEvent(state: GraphState, address: string, token: string): void {
  const tokenId = `token:${token}`
  ensureNode(state, address, `${address.slice(0, 6)}…`, 'wallet')
  ensureNode(state, tokenId, token, 'token')
  addEdge(state, address, tokenId, 'invoice')
}

export function graphSnapshot(state: GraphState): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: Array.from(state.nodes.values()),
    edges: state.edges.slice(-300),
  }
}
