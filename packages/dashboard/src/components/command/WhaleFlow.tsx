'use client'

import { useCommand } from './CommandContext'
import type { PayEvent, TradeEvent } from './CommandContext'

const WHALE_SOL = 1.0
const WHALE_PAY = '5' // threshold for payment amounts (rough)

interface WhaleEntry {
  id: string; kind: 'pay' | 'trade'; direction?: 'buy' | 'sell'
  amount: string; label: string; ts: number; size: 'whale' | 'shark' | 'dolphin'
}

const SIZE_ICONS: Record<string, string> = { whale: '🐋', shark: '🦈', dolphin: '🐬' }
const SIZE_COLORS: Record<string, string> = { whale: '#ff3b3b', shark: '#ff9500', dolphin: '#00ffcc' }

function classifySol(sol: number): 'whale' | 'shark' | 'dolphin' {
  return sol >= 5 ? 'whale' : sol >= 1 ? 'shark' : 'dolphin'
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function WhaleFlow() {
  const { payEvents, tradeEvents, isConnected } = useCommand()

  const entries: WhaleEntry[] = [
    ...tradeEvents
      .filter(t => t.sol >= WHALE_SOL)
      .map(t => ({
        id: t.id, kind: 'trade' as const, direction: t.side,
        amount: `${t.sol.toFixed(3)} SOL`, label: t.mint.slice(0, 8),
        ts: t.ts, size: classifySol(t.sol),
      })),
    ...payEvents
      .filter(p => parseFloat(p.amount) >= parseFloat(WHALE_PAY))
      .map(p => ({
        id: p.id, kind: 'pay' as const,
        amount: p.amount, label: p.url.replace(/^https?:\/\//, '').slice(0, 16),
        ts: p.ts, size: 'dolphin' as const,
      })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 50)

  const buyVol = tradeEvents.filter(t => t.side === 'buy').reduce((s, t) => s + t.sol, 0)
  const sellVol = tradeEvents.filter(t => t.side === 'sell').reduce((s, t) => s + t.sol, 0)
  const totalVol = buyVol + sellVol || 1
  const buyPct = Math.round((buyVol / totalVol) * 100)

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Whale Flow</span>
          <span className="swarm-subtitle">ON-CHAIN</span>
        </div>
        <span className={isConnected ? 'swarm-live' : 'swarm-badge-error'}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isConnected ? '#00ff6a' : '#ff3b3b', display: 'inline-block' }} />
          {isConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>

      {/* Flow bar */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#00ff6a' }}>BUY {buyPct}%</span>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#ff3b3b' }}>SELL {100 - buyPct}%</span>
        </div>
        <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', background: '#0a1515' }}>
          <div style={{ width: `${buyPct}%`, background: 'linear-gradient(90deg,#00ff6a,#00cc55)', transition: 'width 0.5s' }} />
          <div style={{ width: `${100 - buyPct}%`, background: 'linear-gradient(90deg,#cc2f2f,#ff3b3b)', transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid rgba(0,255,255,0.06)', flexShrink: 0 }}>
        {[
          { label: 'BUY VOL', value: buyVol.toFixed(2), color: '#00ff6a' },
          { label: 'SELL VOL', value: sellVol.toFixed(2), color: '#ff3b3b' },
          { label: 'ENTRIES', value: String(entries.length), color: '#fff' },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', padding: '5px 0' }}>
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555' }}>{m.label}</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {entries.length === 0
          ? <div className="swarm-grid-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: '#3a5555', fontFamily: 'var(--mono)' }}>
              Scanning for whale activity…
            </div>
          : entries.map((entry, i) => (
              <div
                key={entry.id}
                className={i === 0 ? 'swarm-animate-in' : ''}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: i === 0 ? 'rgba(0,255,255,0.02)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11 }}>{SIZE_ICONS[entry.size]}</span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#3a5555' }}>{fmt(entry.ts)}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    color: entry.kind === 'pay' ? '#00ffcc' : entry.direction === 'buy' ? '#00ff6a' : '#ff3b3b',
                  }}>
                    {entry.kind === 'pay' ? 'PAY' : entry.direction?.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: SIZE_COLORS[entry.size] }}>
                    {entry.amount}
                  </span>
                  <span style={{ fontSize: 8, fontFamily: 'var(--mono)', color: '#3a5555' }}>{entry.label}</span>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}
