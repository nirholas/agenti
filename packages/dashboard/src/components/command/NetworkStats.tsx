'use client'

import { useCommand } from './CommandContext'

export function NetworkStats() {
  const { payEvents, tradeEvents, networksUsed, payCount, tradeCount } = useCommand()

  // Token breakdown from trades
  const mintCounts = tradeEvents.reduce<Record<string, { buys: number; sells: number; sol: number }>>((acc, t) => {
    if (!acc[t.mint]) acc[t.mint] = { buys: 0, sells: 0, sol: 0 }
    if (t.side === 'buy') acc[t.mint]!.buys++
    else acc[t.mint]!.sells++
    acc[t.mint]!.sol += t.sol
    return acc
  }, {})

  const topMints = Object.entries(mintCounts)
    .sort((a, b) => (b[1].buys + b[1].sells) - (a[1].buys + a[1].sells))
    .slice(0, 4)

  const totalTrades = payCount + tradeCount || 1
  const tradePct = Math.round((tradeCount / totalTrades) * 100)

  // Activity milestones
  const milestones = [
    { count: 10,  label: '10 events',   reached: payCount + tradeCount >= 10 },
    { count: 50,  label: '50 events',   reached: payCount + tradeCount >= 50 },
    { count: 100, label: '100 events',  reached: payCount + tradeCount >= 100 },
    { count: 500, label: '500 events',  reached: payCount + tradeCount >= 500 },
  ]
  const progress = Math.min(((payCount + tradeCount) / 100) * 100, 100)

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Network Stats</span>
          <span className="swarm-subtitle">SESSION</span>
        </div>
      </div>

      {/* Activity progress */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555' }}>ACTIVITY</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: '#00ffcc' }}>{progress.toFixed(0)}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#0a1515', border: '1px solid rgba(0,255,204,0.08)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#00ffcc40,#00ffcc)', transition: 'width 1s ease', borderRadius: 4 }} />
          {milestones.map(m => (
            <div key={m.count} style={{ position: 'absolute', top: 0, height: '100%', width: 1, background: 'rgba(255,255,255,0.1)', left: `${(m.count / 100) * 100}%` }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          {milestones.map(m => (
            <span key={m.count} style={{ fontSize: 7, fontWeight: 700, color: m.reached ? '#00ffcc' : '#3a5555' }}>{m.count}</span>
          ))}
        </div>
      </div>

      {/* Networks */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
        <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555', marginBottom: 6 }}>NETWORKS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {networksUsed.length === 0
            ? <span style={{ fontSize: 9, color: '#3a5555' }}>—</span>
            : networksUsed.map(n => (
                <span key={n} style={{
                  padding: '2px 8px', borderRadius: 3, fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
                  background: 'rgba(0,255,204,0.06)', color: '#00ffcc', border: '1px solid rgba(0,255,204,0.1)',
                  textTransform: 'uppercase',
                }}>
                  {n}
                </span>
              ))
          }
        </div>
      </div>

      {/* Top tokens */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '6px 12px 4px' }}><span className="swarm-subtitle">TOP TOKENS</span></div>
        {topMints.length === 0
          ? <div style={{ padding: '12px', fontSize: 10, color: '#3a5555', textAlign: 'center' }}>No trades yet</div>
          : topMints.map(([mint, stats]) => (
              <div key={mint} style={{ padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#5a7a7a' }}>{mint.slice(0, 12)}…</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: '#00ff6a' }}>{stats.sol.toFixed(3)} SOL</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 8, color: '#00ff6a' }}>▲ {stats.buys}</span>
                  <span style={{ fontSize: 8, color: '#ff3b3b' }}>▼ {stats.sells}</span>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )
}
