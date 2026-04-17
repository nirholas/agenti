'use client'

import type { FeedItem } from '../types.js'

const TYPE_COLOR: Record<FeedItem['type'], string> = {
  pay: '#22c55e',
  trade: '#3b82f6',
  balance: '#eab308',
  invoice: '#a855f7',
  error: '#ef4444',
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

export function TransactionFeed({ items }: { items: FeedItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.length === 0 && (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Waiting for agent activity…</div>
      )}
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            borderRadius: 6,
            background: '#1f2937',
            borderLeft: `3px solid ${TYPE_COLOR[item.type]}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: TYPE_COLOR[item.type],
              minWidth: 52,
              textTransform: 'uppercase',
            }}
          >
            {item.type}
          </span>
          <span style={{ flex: 1, fontSize: 13, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          {item.sub && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{item.sub}</span>
          )}
          <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(item.ts)}</span>
        </div>
      ))}
    </div>
  )
}
