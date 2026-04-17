'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { CommandProvider, useCommand } from '../components/command/CommandContext'
import { CommandTopbar } from '../components/command/CommandTopbar'
import { WorkflowCanvas } from '../components/WorkflowCanvas'

const AgentGraph = dynamic(
  () => import('../components/AgentGraph').then(m => ({ default: m.AgentGraph })),
  { ssr: false, loading: () => <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a5555', fontSize: 11 }}>LOADING 3D GRAPH…</div> }
)

type View = 'workflow' | 'network'

function Dashboard() {
  const cmd = useCommand()
  const [view, setView] = useState<View>('workflow')

  return (
    <div className="crt" style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <CommandTopbar />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left: graph ─────────────────────────────────────────── */}
        <div className="grid-bg" style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,255,204,0.07)', position: 'relative' }}>

          {/* View toggle */}
          <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 10, display: 'flex', gap: 2 }}>
            {(['workflow', 'network'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '3px 9px', border: `1px solid ${view === v ? 'rgba(0,255,204,0.3)' : 'rgba(0,255,204,0.08)'}`,
                background: view === v ? 'rgba(0,255,204,0.08)' : 'rgba(0,0,0,0.6)',
                color: view === v ? '#00ffcc' : '#3a5555',
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                borderRadius: 2, backdropFilter: 'blur(4px)',
              }}>
                {v === 'workflow' ? 'WORKFLOW' : '3D NET'}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {view === 'workflow'
              ? <WorkflowCanvas payCount={cmd.payCount} tradeCount={cmd.tradeCount} walletAddress={cmd.walletAddress} />
              : <AgentGraph nodes={[]} edges={[]} width={800} height={600} />
            }
          </div>

          {/* Bottom status bar */}
          <div style={{ borderTop: '1px solid rgba(0,255,204,0.07)', padding: '4px 12px', display: 'flex', gap: 20, alignItems: 'center', background: '#000' }}>
            <span style={{ fontSize: 9, color: '#3a5555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              NETWORKS:
            </span>
            {cmd.networksUsed.length === 0
              ? <span style={{ fontSize: 9, color: '#1a3030' }}>NONE DETECTED</span>
              : cmd.networksUsed.map(n => (
                  <span key={n} style={{ fontSize: 9, color: '#00ffcc', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{n}</span>
                ))
            }
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
              {Object.entries(cmd.urlHits).slice(0, 3).map(([url, hits]) => {
                const host = (() => { try { return new URL(url).hostname } catch { return url.slice(0, 20) } })()
                return (
                  <span key={url} style={{ fontSize: 9, color: '#5a7a7a', fontFamily: 'var(--mono)' }}>
                    <span style={{ color: '#00ffcc' }}>{hits}</span>×&nbsp;{host}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right: panels ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#000' }}>

          {/* Pay events */}
          <div className="panel" style={{ flex: cmd.payEvents.length > 0 ? '1 1 40%' : '0 0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: 'none', borderTop: 'none', borderRight: 'none' }}>
            <div className="panel-header">
              <span className="panel-title">PAY EVENTS</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: cmd.payCount > 0 ? '#00ffcc' : '#3a5555', fontWeight: 700 }}>
                {cmd.payCount.toString().padStart(3, '0')}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {cmd.payEvents.length === 0
                ? <EmptyRow label="AWAITING PAYMENTS" />
                : cmd.payEvents.slice(0, 30).map((e, i) => (
                    <EventRow key={e.id} fresh={i === 0}>
                      <Cell w={60} color="#00ffcc">{e.amount}</Cell>
                      <Cell w={80} color="#5a7a7a" mono>{e.network.slice(0, 10).toUpperCase()}</Cell>
                      <Cell flex color="#8a9a9a">{(() => { try { return new URL(e.url).hostname } catch { return e.url } })()}</Cell>
                      <Cell w={50} color="#3a5555" mono>{reltime(e.ts)}</Cell>
                    </EventRow>
                  ))
              }
            </div>
          </div>

          {/* Trade events */}
          <div className="panel" style={{ flex: cmd.tradeEvents.length > 0 ? '1 1 40%' : '0 0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: 'none', borderRight: 'none' }}>
            <div className="panel-header">
              <span className="panel-title">TRADE EVENTS</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {cmd.solBought > 0 && <span style={{ fontSize: 9, color: '#00ff6a', fontWeight: 700 }}>+{cmd.solBought.toFixed(3)} SOL</span>}
                {cmd.solSold > 0 && <span style={{ fontSize: 9, color: '#ff3b3b', fontWeight: 700 }}>-{cmd.solSold.toFixed(3)} SOL</span>}
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: cmd.tradeCount > 0 ? '#00ff6a' : '#3a5555', fontWeight: 700 }}>
                  {cmd.tradeCount.toString().padStart(3, '0')}
                </span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {cmd.tradeEvents.length === 0
                ? <EmptyRow label="AWAITING TRADES" />
                : cmd.tradeEvents.slice(0, 30).map((e, i) => (
                    <EventRow key={e.id} fresh={i === 0}>
                      <Cell w={36} color={e.side === 'buy' ? '#00ff6a' : '#ff3b3b'}>{e.side.toUpperCase()}</Cell>
                      <Cell w={60} color={e.side === 'buy' ? '#00ff6a' : '#ff3b3b'}>{e.sol.toFixed(4)}</Cell>
                      <Cell flex color="#5a7a7a" mono>{e.mint.slice(0, 8)}…{e.mint.slice(-4)}</Cell>
                      <Cell w={50} color="#3a5555" mono>{reltime(e.ts)}</Cell>
                    </EventRow>
                  ))
              }
            </div>
          </div>

          {/* Errors */}
          {cmd.errorEvents.length > 0 && (
            <div className="panel" style={{ flex: '0 0 auto', maxHeight: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: 'none', borderRight: 'none' }}>
              <div className="panel-header">
                <span className="panel-title" style={{ color: '#ff3b3b' }}>ERRORS</span>
                <span style={{ fontSize: 9, color: '#ff3b3b', fontWeight: 700 }}>{cmd.errorCount.toString().padStart(3, '0')}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {cmd.errorEvents.slice(0, 10).map((e, i) => (
                  <EventRow key={e.id} fresh={i === 0}>
                    <Cell w={70} color="#ff3b3b" mono>{e.tool ?? 'unknown'}</Cell>
                    <Cell flex color="#8a6060">{e.message.slice(0, 40)}</Cell>
                    <Cell w={50} color="#3a5555" mono>{reltime(e.ts)}</Cell>
                  </EventRow>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          {cmd.invoiceEvents.length > 0 && (
            <div className="panel" style={{ flex: '0 0 auto', maxHeight: 120, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: 'none', borderRight: 'none' }}>
              <div className="panel-header">
                <span className="panel-title" style={{ color: '#ffd700' }}>INVOICES</span>
                <span style={{ fontSize: 9, color: '#ffd700', fontWeight: 700 }}>{cmd.invoiceCount.toString().padStart(3, '0')}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                {cmd.invoiceEvents.slice(0, 10).map((e, i) => (
                  <EventRow key={e.id} fresh={i === 0}>
                    <Cell w={60} color="#ffd700">{e.amount} {e.token}</Cell>
                    <Cell flex color="#5a7a7a" mono>{e.address.slice(0, 10)}…</Cell>
                    <Cell w={50} color="#3a5555" mono>{reltime(e.ts)}</Cell>
                  </EventRow>
                ))}
              </div>
            </div>
          )}

          {/* URL hits heatmap */}
          {Object.keys(cmd.urlHits).length > 0 && (
            <div className="panel" style={{ flex: '0 0 auto', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}>
              <div className="panel-header">
                <span className="panel-title">ENDPOINT HITS</span>
              </div>
              <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Object.entries(cmd.urlHits)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([url, hits]) => {
                    const maxHits = Math.max(...Object.values(cmd.urlHits))
                    const pct = (hits / maxHits) * 100
                    const host = (() => { try { return new URL(url).hostname } catch { return url.slice(0, 30) } })()
                    return (
                      <div key={url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, color: '#3a5555', fontWeight: 700, width: 24, textAlign: 'right', flexShrink: 0 }}>{hits}</span>
                        <div style={{ flex: 1, height: 2, background: 'rgba(0,255,204,0.08)', borderRadius: 1 }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#00ffcc', borderRadius: 1, transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: 9, color: '#5a7a7a', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{host}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

function reltime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div style={{ padding: '8px 10px', fontSize: 9, color: '#1a3030', letterSpacing: '0.1em', textAlign: 'center' }}>
      {label}
    </div>
  )
}

function EventRow({ children, fresh }: { children: React.ReactNode; fresh?: boolean }) {
  return (
    <div className={fresh ? 'anim-in' : ''} style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '3px 10px',
      borderBottom: '1px solid rgba(0,255,204,0.03)',
      background: fresh ? 'rgba(0,255,204,0.025)' : 'transparent',
      transition: 'background 1s ease',
    }}>
      {children}
    </div>
  )
}

function Cell({ children, w, flex, color, mono }: { children: React.ReactNode; w?: number; flex?: boolean; color?: string; mono?: boolean }) {
  return (
    <span style={{
      ...(w ? { width: w, flexShrink: 0 } : {}),
      ...(flex ? { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
      fontSize: 10, color: color ?? '#c8d8d8',
      fontFamily: mono ? 'var(--mono)' : 'var(--mono)',
      marginRight: 6,
    }}>
      {children}
    </span>
  )
}

export default function Page() {
  return (
    <CommandProvider>
      <Dashboard />
    </CommandProvider>
  )
}
