'use client'

import { useCommand } from './CommandContext'

export function EventSummary() {
  const { payCount, tradeCount, invoiceCount, errorCount, solBought, solSold, payEvents, isConnected } = useCommand()

  const totalEvents = payCount + tradeCount + invoiceCount + errorCount
  const netSol = solBought - solSold

  // Event rate (events per minute based on last 60s)
  const now = Date.now()
  const recentPays = payEvents.filter(p => now - p.ts < 60000).length
  const evtRate = recentPays

  const statCards = [
    { label: 'TOTAL EVENTS', value: totalEvents, color: '#00ffcc', big: true },
    { label: 'PAYS / MIN', value: evtRate, color: '#00ffcc', big: false },
    { label: 'SOL BOUGHT', value: `${solBought.toFixed(3)}`, color: '#00ff6a', big: false },
    { label: 'SOL SOLD', value: `${solSold.toFixed(3)}`, color: '#ff3b3b', big: false },
    { label: 'NET SOL', value: `${netSol >= 0 ? '+' : ''}${netSol.toFixed(3)}`, color: netSol >= 0 ? '#00ff6a' : '#ff3b3b', big: false },
    { label: 'ERRORS', value: errorCount, color: errorCount > 0 ? '#ff3b3b' : '#3a5555', big: false },
  ]

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Summary</span>
          <span className="swarm-subtitle">SESSION</span>
        </div>
        <span className={isConnected ? 'swarm-live' : 'swarm-badge-error'}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isConnected ? '#00ff6a' : '#ff3b3b', display: 'inline-block' }} />
          {isConnected ? 'LIVE' : 'OFF'}
        </span>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, padding: 1, overflow: 'hidden' }}>
        {statCards.map(card => (
          <div
            key={card.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '8px 4px', background: 'rgba(0,255,204,0.02)', border: '1px solid rgba(0,255,255,0.04)', borderRadius: 2,
            }}
          >
            <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3a5555', marginBottom: 4 }}>
              {card.label}
            </div>
            <div style={{ fontSize: card.big ? 20 : 14, fontFamily: 'var(--mono)', fontWeight: 700, color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Event type bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(0,255,255,0.06)' }}>
        <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3a5555', marginBottom: 6 }}>
          EVENT BREAKDOWN
        </div>
        <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: '#0a1515' }}>
          {totalEvents > 0 && [
            { count: payCount, color: '#00ffcc' },
            { count: tradeCount, color: '#00ff6a' },
            { count: invoiceCount, color: '#ff9500' },
            { count: errorCount, color: '#ff3b3b' },
          ].map((seg, i) => (
            <div key={i} style={{ width: `${(seg.count / totalEvents) * 100}%`, background: seg.color, opacity: 0.7 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
