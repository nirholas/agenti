'use client'

import { useCommand } from './CommandContext'

export function FundingOverview() {
  const { payCount, tradeCount, invoiceCount, errorCount, solBought, solSold, walletAddress, networksUsed, payEvents } = useCommand()

  const netSol = solBought - solSold
  const topUrls = Object.entries(
    payEvents.reduce<Record<string, number>>((acc, p) => { acc[p.url] = (acc[p.url] ?? 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const metrics = [
    { label: 'WALLET', value: walletAddress ? walletAddress.slice(0, 8) + '…' : '—', color: '#e0e0e0', mono: true },
    { label: 'PAYMENTS', value: String(payCount), color: '#00ffcc', mono: true },
    { label: 'TRADES', value: String(tradeCount), color: '#00ff6a', mono: true },
    { label: 'INVOICES', value: String(invoiceCount), color: '#ff9500', mono: true },
    { label: 'ERRORS', value: String(errorCount), color: errorCount > 0 ? '#ff3b3b' : '#3a5555', mono: true },
    { label: 'SOL BOUGHT', value: solBought.toFixed(4), color: '#00ff6a', mono: true },
    { label: 'SOL SOLD', value: solSold.toFixed(4), color: '#ff3b3b', mono: true },
    { label: 'NET SOL', value: `${netSol >= 0 ? '+' : ''}${netSol.toFixed(4)}`, color: netSol >= 0 ? '#00ff6a' : '#ff3b3b', mono: true },
    { label: 'NETWORKS', value: networksUsed.length > 0 ? networksUsed.join(', ') : '—', color: '#8b5cf6', mono: false },
  ]

  return (
    <div className="swarm-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="swarm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="swarm-title">Overview</span>
          <span className="swarm-subtitle">FUNDING</span>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {metrics.map(m => (
              <tr key={m.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '5px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555' }}>
                  {m.label}
                </td>
                <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                  <span style={{ fontSize: 11, fontFamily: m.mono ? 'var(--mono)' : undefined, fontWeight: 700, color: m.color }}>
                    {m.value}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {topUrls.length > 0 && (
          <>
            <div style={{ padding: '6px 12px 4px', borderTop: '1px solid rgba(0,255,255,0.06)' }}>
              <span className="swarm-subtitle">TOP ENDPOINTS</span>
            </div>
            {topUrls.map(([url, count]) => (
              <div key={url} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#5a7a7a', maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {url.replace(/^https?:\/\//, '')}
                </span>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: '#00ffcc' }}>{count}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
