export type AgentiEventType = 'pay' | 'trade' | 'balance' | 'invoice' | 'error'
export type NodeKind = 'wallet' | 'token' | 'url' | 'chain' | 'service' | 'agent'
export type EdgeKind = 'pay' | 'trade' | 'balance' | 'invoice'

export interface FeedItem {
  id: string
  type: AgentiEventType
  label: string
  sub?: string
  ts: number
}

export interface GraphNode {
  id: string
  label: string
  kind: NodeKind
  hits?: number
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  fx?: number | null
  fy?: number | null
  fz?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  kind: EdgeKind
}
