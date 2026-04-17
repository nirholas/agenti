'use client'

import type { FeedItem } from '../types'

const TYPE_META: Record<FeedItem['type'], { color: string; bg: string; icon: string; label: string }> = {
  pay:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: '↗', label: 'PAY'     },
  trade:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: '⇄', label: 'TRADE'   },
  balance: { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   icon: '◎', label: 'BAL'     },
  invoice: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  icon: '⊞', label: 'INV'     },
  error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '✕', label: 'ERR'     },
}

function reltime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TransactionFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '40px 20px',
        color: '#334155',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: 28, opacity: 0.4 }}>◌</span>
        <span style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
          waiting for agent activity
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item, i) => {
        const meta = TYPE_META[item.type]
        return (
          <div
            key={item.id}
            className="animate-fade"
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr auto',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: i === 0 ? meta.bg : 'transparent',
              transition: 'background 0.3s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = meta.bg)}
            onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? meta.bg : 'transparent')}
          >
            {/* Type badge */}
            <div style={{
              width: 28, height: 28,
              borderRadius: 8,
              background: meta.bg,
              border: `1px solid ${meta.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
              color: meta.color,
              flexShrink: 0,
            }}>
              {meta.icon}
            </div>

            {/* Content */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 12,
                color: '#e2e8f0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: item.type === 'pay' || item.type === 'trade' ? 'var(--mono)' : 'inherit',
              }}>
                {item.label}
              </div>
              {item.sub && (
                <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                  {item.sub}
                </div>
              )}
            </div>

            {/* Timestamp */}
            <span style={{
              fontSize: 10,
              color: '#334155',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--mono)',
            }}>
              {reltime(item.ts)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
