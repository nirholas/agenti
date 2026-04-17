'use client'

interface WalletInfo {
  address: string
  payCount: number
  tradeCount: number
  errorCount: number
}

export function WalletCard({ wallet }: { wallet: WalletInfo }) {
  return (
    <div
      style={{
        background: '#1f2937',
        borderRadius: 10,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#22c55e',
            display: 'inline-block',
            boxShadow: '0 0 6px #22c55e',
          }}
        />
        <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
          {wallet.address ? `${wallet.address.slice(0, 8)}…${wallet.address.slice(-6)}` : 'No wallet connected'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <Stat label="Payments" value={wallet.payCount} color="#22c55e" />
        <Stat label="Trades" value={wallet.tradeCount} color="#3b82f6" />
        <Stat label="Errors" value={wallet.errorCount} color="#ef4444" />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}
