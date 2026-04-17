'use client'

import { useState, useEffect } from 'react'
import { useCommand } from './CommandContext'

export function CommandTopbar() {
  const { walletAddress, payCount, tradeCount, errorCount, solBought, solSold, networksUsed, isConnected } = useCommand()
  const [timeStr, setTimeStr] = useState('--:--:--')

  useEffect(() => {
    const tick = () => setTimeStr(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const netSol = solBought - solSold

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 16px',
      background: '#000000',
      borderBottom: '1px solid rgba(0,255,255,0.06)',
      flexShrink: 0,
      height: 44,
    }}>
      {/* Left: branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em', color: '#00ffcc' }}>AGENTI</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>
            COMMAND
          </span>
        </div>
        {walletAddress && (
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
            letterSpacing: '0.08em', background: 'rgba(0,255,204,0.08)', color: '#00ffcc',
            border: '1px solid rgba(0,255,204,0.12)',
          }}>
            {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}
          </span>
        )}
        <span className="swarm-text-dim" style={{ fontSize: 9, fontFamily: 'var(--mono)' }}>
          AI AGENT MONITOR
        </span>
      </div>

      {/* Center: connection + networks */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {networksUsed.length > 0 && (
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: '#3a5555' }}>
            {networksUsed.join(' · ').toUpperCase()}
          </span>
        )}
        <span className={isConnected ? 'swarm-live' : 'swarm-badge-error'}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isConnected ? '#00ff6a' : '#ff3b3b',
            display: 'inline-block',
            ...(isConnected ? { animation: 'ping 1.5s ease-in-out infinite' } : {}),
          }} />
          {isConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      {/* Right: metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {[
          { label: 'PAYS', value: payCount, color: '#00ffcc' },
          { label: 'TRADES', value: tradeCount, color: '#00ff6a' },
          { label: 'ERRORS', value: errorCount, color: errorCount > 0 ? '#ff3b3b' : '#3a5555' },
        ].map(m => (
          <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555' }}>{m.label}:</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: m.color }}>{m.value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3a5555' }}>NET SOL:</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: netSol >= 0 ? '#00ff6a' : '#ff3b3b' }}>
            {netSol >= 0 ? '+' : ''}{netSol.toFixed(4)}
          </span>
        </div>
        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          {timeStr}
        </span>
      </div>
    </div>
  )
}
