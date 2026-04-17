'use client'

import { useCommand } from './CommandContext'

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function TradeFlow() {
  const { tradeEvents } = useCommand()
  const recent = tradeEvents.slice(0, 30)

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Trade Flow</span>
          <span className="swarm-subtitle">SOLANA</span>
        </div>
        <span className="swarm-live">
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00ff6a', display: 'inline-block', animation: 'ping 1.5s ease-in-out infinite' }} />
          LIVE
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {recent.length === 0
          ? <div className="swarm-grid-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 10, color: '#3a5555', fontFamily: 'var(--mono)' }}>
              Awaiting trades…
            </div>
          : recent.map((t, i) => {
              const isBuy = t.side === 'buy'
              return (
                <div
                  key={t.id}
                  className={i === 0 ? 'swarm-animate-in' : ''}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: i === 0 ? 'rgba(0,255,255,0.02)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#3a5555' }}>{fmt(t.ts)}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: isBuy ? '#00ff6a' : '#ff3b3b' }}>
                      {isBuy ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: '#fff' }}>
                      {t.sol.toFixed(4)} SOL
                    </span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#3a5555' }}>
                      {t.mint.slice(0, 6)}
                    </span>
                  </div>
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
