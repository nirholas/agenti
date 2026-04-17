import type { GraphNode, GraphEdge } from '../types.js'

export interface GraphState {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
}

export function createGraphState(): GraphState {
  return { nodes: new Map(), edges: [] }
}

export function ensureNode(
  state: GraphState,
  id: string,
  label: string,
  kind: GraphNode['kind'],
): GraphNode {
  if (!state.nodes.has(id)) {
    state.nodes.set(id, { id, label, kind })
  }
  return state.nodes.get(id)!
}

export function applyPayEvent(state: GraphState, url: string, network: string): void {
  ensureNode(state, url, new URL(url).hostname, 'url')
  ensureNode(state, `net:${network}`, network, 'wallet')
  state.edges.push({ source: `net:${network}`, target: url, kind: 'pay' })
}

export function applyTradeEvent(
  state: GraphState,
  mint: string,
  side: 'buy' | 'sell',
): void {
  ensureNode(state, mint, `${mint.slice(0, 6)}…`, 'token')
  ensureNode(state, 'SOL', 'SOL', 'wallet')
  const [src, tgt] = side === 'buy' ? ['SOL', mint] : [mint, 'SOL']
  state.edges.push({ source: src, target: tgt, kind: 'trade' })
}

export function graphSnapshot(state: GraphState): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return {
    nodes: Array.from(state.nodes.values()),
    edges: state.edges.slice(-200),
  }
}
