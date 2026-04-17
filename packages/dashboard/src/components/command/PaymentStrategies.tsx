'use client'

import { useCommand } from './CommandContext'

const TYPES = [
  { key: 'pay',     label: 'Payments',  color: '#00ffcc' },
  { key: 'trade',   label: 'Trades',    color: '#00ff6a' },
  { key: 'invoice', label: 'Invoices',  color: '#ff9500' },
  { key: 'error',   label: 'Errors',    color: '#ff3b3b' },
] as const

export function PaymentStrategies() {
  const { payCount, tradeCount, invoiceCount, errorCount, payEvents, tradeEvents, networksUsed } = useCommand()

  const counts: Record<string, number> = { pay: payCount, trade: tradeCount, invoice: invoiceCount, error: errorCount }
  const total = payCount + tradeCount + invoiceCount + errorCount || 1

  const recentPays = payEvents.slice(0, 5)

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Event Mix</span>
          <span className="swarm-text-dim" style={{ fontSize: 9, fontFamily: 'var(--mono)' }}>{total - 1}</span>
        </div>
        <span className="swarm-live">
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00ff6a', display: 'inline-block', animation: 'ping 1.5s ease-in-out infinite' }} />
          LIVE
        </span>
      </div>

      {/* Type breakdown */}
      <div style={{ padding: '8px 10px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {TYPES.map(t => {
          const count = counts[t.key] ?? 0
          const pct = Math.round((count / total) * 100)
          return (
            <div key={t.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555' }}>{t.label}</span>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: count > 0 ? t.color : '#3a5555' }}>{count}</span>
              </div>
              <div style={{ height: 2, borderRadius: 2, background: '#0a1515', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: t.color, opacity: 0.7, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid rgba(0,255,255,0.06)', borderTop: '1px solid rgba(0,255,255,0.06)' }}>
        <span className="swarm-subtitle">NETWORKS</span>
        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {networksUsed.length === 0
            ? <span style={{ fontSize: 9, color: '#3a5555' }}>—</span>
            : networksUsed.map(n => (
                <span key={n} style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 8, fontFamily: 'var(--mono)', fontWeight: 700,
                  background: 'rgba(0,255,204,0.06)', color: '#00ffcc', border: '1px solid rgba(0,255,204,0.1)',
                  textTransform: 'uppercase',
                }}>
                  {n}
                </span>
              ))
          }
        </div>
      </div>

      {/* Recent pays */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '4px 12px', borderBottom: '1px solid rgba(0,255,255,0.04)' }}>
          <span className="swarm-subtitle">RECENT PAYS</span>
        </div>
        {recentPays.length === 0
          ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, fontSize: 10, color: '#3a5555' }}>
              No payments yet
            </div>
          : recentPays.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.02)',
              }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#5a7a7a', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.url.replace(/^https?:\/\//, '').slice(0, 20)}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: '#00ffcc' }}>
                  {p.amount}
                </span>
              </div>
            ))
        }
      </div>
    </div>
  )
}
