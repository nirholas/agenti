'use client'

interface WalletInfo {
  address: string
  payCount: number
  tradeCount: number
  errorCount: number
}

export function WalletCard({ wallet }: { wallet: WalletInfo }) {
  const connected = !!wallet.address

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      padding: '12px 20px',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      flexWrap: 'wrap',
    }}>
      {/* Status + address */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
        <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
          <span style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: connected ? '#22c55e' : '#475569',
            animation: connected ? 'glow-pulse 2s ease infinite' : 'none',
          }} />
          {connected && (
            <span style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'ping 1.5s ease infinite',
              opacity: 0.6,
            }} />
          )}
        </div>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: connected ? '#94a3b8' : '#475569',
          letterSpacing: '0.02em',
        }}>
          {connected
            ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}`
            : 'awaiting connection'}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 4 }}>
        <StatPill label="pay" value={wallet.payCount} color="#22c55e" bg="rgba(34,197,94,0.1)" />
        <StatPill label="trade" value={wallet.tradeCount} color="#3b82f6" bg="rgba(59,130,246,0.1)" />
        {wallet.errorCount > 0 && (
          <StatPill label="err" value={wallet.errorCount} color="#ef4444" bg="rgba(239,68,68,0.1)" />
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: value > 0 ? bg : 'transparent',
      border: `1px solid ${value > 0 ? color + '30' : 'transparent'}`,
      transition: 'all 0.2s ease',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: value > 0 ? color : '#475569', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: value > 0 ? color + 'aa' : '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  )
}
