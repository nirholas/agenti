import { Connection, PublicKey } from '@solana/web3.js'
import { getCoinState } from './coin.js'

const PUMP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

export interface MigrationEvent {
  mint: string
  pool: string
  timestamp: number
}

export interface WatchOptions {
  pollIntervalMs?: number  // default 3000
  timeoutMs?: number       // optional hard stop
}

/**
 * Watch a pump.fun token for migration to the AMM (graduation).
 * Fires onMigrate once the bonding curve completes and the pool is live.
 * Returns a cleanup function — call it to stop watching.
 *
 * Uses polling by default (reliable). For faster detection in production
 * use watchMigrationLogs (WebSocket, lower latency but requires a good RPC).
 */
export function watchMigration(
  mint: string,
  onMigrate: (event: MigrationEvent) => void | Promise<void>,
  options?: WatchOptions
): () => void {
  const interval = options?.pollIntervalMs ?? 3000
  let running = true

  const deadline = options?.timeoutMs ? Date.now() + options.timeoutMs : undefined

  ;(async () => {
    while (running) {
      if (deadline && Date.now() > deadline) break
      try {
        const state = await getCoinState(mint)
        if (state.phase === 'graduated' && state.pool) {
          running = false
          await onMigrate({ mint, pool: state.pool, timestamp: Date.now() })
          return
        }
      } catch {
        // ignore transient errors — network blips, rate limits
      }
      await new Promise((r) => setTimeout(r, interval))
    }
  })()

  return () => {
    running = false
  }
}

/**
 * WebSocket-based migration watcher — lower latency than polling.
 * Subscribes to the pump.fun program account logs on-chain.
 * Requires a reliable RPC with WebSocket support (Helius, Triton, QuickNode).
 */
export function watchMigrationLogs(
  mint: string,
  connection: Connection,
  onMigrate: (event: MigrationEvent) => void | Promise<void>
): () => void {
  const mintPubkey = new PublicKey(mint)

  const subId = connection.onLogs(
    PUMP_PROGRAM,
    async (logs) => {
      // Look for migration-related log lines that mention our mint
      const relevant =
        logs.logs.some((l) => l.toLowerCase().includes('complete') || l.includes('migration')) &&
        logs.logs.some((l) => l.includes(mint) || l.includes(mintPubkey.toBase58()))

      if (!relevant) return

      // Give the indexer a moment to update
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const state = await getCoinState(mint)
        if (state.phase === 'graduated' && state.pool) {
          connection.removeOnLogsListener(subId)
          await onMigrate({ mint, pool: state.pool, timestamp: Date.now() })
        }
      } catch {}
    },
    'confirmed'
  )

  return () => connection.removeOnLogsListener(subId)
}
