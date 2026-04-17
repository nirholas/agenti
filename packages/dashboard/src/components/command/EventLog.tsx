'use client'

import { useState, useRef, useEffect } from 'react'
import { useCommand } from './CommandContext'

type Level = 'PAY' | 'TRADE' | 'INVOICE' | 'ERROR' | 'ALL'

interface LogEntry { id: string; level: Exclude<Level, 'ALL'>; message: string; ts: number }

const COLORS: Record<Exclude<Level, 'ALL'>, string> = {
  PAY: '#00ffcc', TRADE: '#00ff6a', INVOICE: '#ff9500', ERROR: '#ff3b3b',
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    fractionalSecondDigits: 2, hour12: false,
  })
}

export function EventLog() {
  const { payEvents, tradeEvents, invoiceEvents, errorEvents } = useCommand()
  const [filter, setFilter] = useState<Level>('ALL')
  const containerRef = useRef<HTMLDivElement>(null)

  // Build unified sorted log
  const entries: LogEntry[] = [
    ...payEvents.map(e => ({ id: e.id, level: 'PAY' as const, message: `${e.amount} → ${e.url.replace(/^https?:\/\//, '').slice(0, 40)} [${e.network}]`, ts: e.ts })),
    ...tradeEvents.map(e => ({ id: e.id, level: 'TRADE' as const, message: `${e.side.toUpperCase()} ${e.sol.toFixed(4)} SOL · ${e.mint.slice(0, 8)}`, ts: e.ts })),
    ...invoiceEvents.map(e => ({ id: e.id, level: 'INVOICE' as const, message: `${e.amount} ${e.token} ← ${e.address.slice(0, 12)}`, ts: e.ts })),
    ...errorEvents.map(e => ({ id: e.id, level: 'ERROR' as const, message: `[${e.tool}] ${e.message}`, ts: e.ts })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 200)

  const filtered = filter === 'ALL' ? entries : entries.filter(e => e.level === filter)
  const filters: Level[] = ['ALL', 'PAY', 'TRADE', 'INVOICE', 'ERROR']

  // Auto-scroll to top on new entries
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0
  }, [entries.length])

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Event Log</span>
          <span className="swarm-subtitle">AGENTI OPS</span>
        </div>
        <span className="swarm-live">
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00ff6a', display: 'inline-block', animation: 'ping 1.5s ease-in-out infinite' }} />
          LIVE
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderBottom: '1px solid rgba(0,255,255,0.06)', flexShrink: 0 }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '2px 8px', borderRadius: 3, border: 'none', cursor: 'pointer',
              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              background: filter === f ? 'rgba(0,255,204,0.12)' : 'transparent',
              color: filter === f ? '#00ffcc' : '#3a5555',
              transition: 'all 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, fontFamily: 'var(--mono)', fontSize: 10 }}>
        {filtered.length === 0
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#3a5555' }}>
              Listening for events…
            </div>
          : filtered.map((entry, i) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  background: i === 0 ? 'rgba(0,255,255,0.02)' : 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{ color: '#3a5555', flexShrink: 0, fontSize: 9 }}>{fmt(entry.ts)}</span>
                <span style={{ flexShrink: 0, fontWeight: 700, color: COLORS[entry.level] }}>[{entry.level}]</span>
                <span style={{ color: '#b0b0b0', wordBreak: 'break-all' }}>{entry.message}</span>
              </div>
            ))
        }
      </div>
    </div>
  )
}
