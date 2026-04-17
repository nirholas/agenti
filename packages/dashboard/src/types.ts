export type AgentiEventType = 'pay' | 'trade' | 'balance' | 'invoice' | 'error'

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
  kind: 'wallet' | 'token' | 'url'
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  kind: 'pay' | 'trade'
}
