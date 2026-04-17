import { Connection, type Commitment, type ConnectionConfig } from '@solana/web3.js'

export interface RpcEndpoint {
  url: string
  weight?: number
}

interface EndpointHealth {
  consecutiveFailures: number
  lastFailureAt: number
}

interface FallbackOptions {
  /** Max retries per endpoint before moving to next (default: 2) */
  maxRetriesPerEndpoint?: number
  /** Base backoff delay in ms (default: 500) */
  baseDelayMs?: number
  /** Cooldown before a failed endpoint is reconsidered, ms (default: 60_000) */
  cooldownMs?: number
}

const DEFAULTS = {
  maxRetriesPerEndpoint: 2,
  baseDelayMs: 500,
  cooldownMs: 60_000,
}

/**
 * Creates a Connection that round-robins across multiple RPC endpoints.
 * Automatically retries on timeout/429 with the next endpoint.
 */
export function createFallbackConnection(
  endpoints: RpcEndpoint[],
  commitment: Commitment = 'confirmed',
  options?: FallbackOptions,
): Connection {
  if (endpoints.length === 0) throw new Error('At least one RPC endpoint is required')

  const urls = endpoints.map((e) => e.url)
  const cfg: Required<FallbackOptions> = { ...DEFAULTS, ...options }
  const connConfig: ConnectionConfig = { commitment }

  if (urls.length === 1) return new Connection(urls[0]!, connConfig)

  const health = new Map<string, EndpointHealth>()
  for (const url of urls) health.set(url, { consecutiveFailures: 0, lastFailureAt: 0 })

  let currentIdx = 0

  function nextHealthy(): string {
    const now = Date.now()
    for (let i = 0; i < urls.length; i++) {
      const idx = (currentIdx + i) % urls.length
      const url = urls[idx]!
      const h = health.get(url)!
      if (h.consecutiveFailures === 0 || now - h.lastFailureAt >= cfg.cooldownMs) {
        currentIdx = idx
        return url
      }
    }
    // All degraded — use the one that failed longest ago
    let bestIdx = 0
    let oldestFailure = Infinity
    for (let i = 0; i < urls.length; i++) {
      const h = health.get(urls[i]!)!
      if (h.lastFailureAt < oldestFailure) {
        oldestFailure = h.lastFailureAt
        bestIdx = i
      }
    }
    currentIdx = bestIdx
    return urls[bestIdx]!
  }

  const connection = new Connection(urls[0]!, connConfig)
  const originalRpcRequest = (connection as any)._rpcRequest

  if (typeof originalRpcRequest === 'function') {
    ;(connection as any)._rpcRequest = async function (method: string, args: any[]) {
      let lastError: Error | undefined

      for (let attempt = 0; attempt < urls.length; attempt++) {
        const url = nextHealthy()
        ;(connection as any)._rpcEndpoint = url
        ;(connection as any)._rpcWsEndpoint = toWsEndpoint(url)

        for (let retry = 0; retry <= cfg.maxRetriesPerEndpoint; retry++) {
          try {
            const result = await originalRpcRequest.call(connection, method, args)
            health.get(url)!.consecutiveFailures = 0
            return result
          } catch (err: any) {
            lastError = err
            if (isNonRetryable(err)) throw err
            if (retry < cfg.maxRetriesPerEndpoint) {
              await sleep(cfg.baseDelayMs * 2 ** retry)
            }
          }
        }

        const h = health.get(url)!
        h.consecutiveFailures++
        h.lastFailureAt = Date.now()
        currentIdx = (currentIdx + 1) % urls.length
      }

      throw lastError ?? new Error('All RPC endpoints failed')
    }
  }

  return connection
}

function toWsEndpoint(httpUrl: string): string {
  try {
    const u = new URL(httpUrl)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return u.toString()
  } catch {
    return httpUrl.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'))
  }
}

function isNonRetryable(err: any): boolean {
  const msg = String(err?.message ?? '')
  return (
    msg.includes('Transaction simulation failed') ||
    msg.includes('Invalid param') ||
    msg.includes('Blockhash not found')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type PriorityLevel = 'low' | 'medium' | 'high' | 'very-high'

const HELIUS_PRIORITY_LEVEL: Record<PriorityLevel, string> = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'very-high': 'VeryHigh',
}

const FALLBACK_PERCENTILE: Record<PriorityLevel, number> = {
  'low': 0.25,
  'medium': 0.5,
  'high': 0.75,
  'very-high': 0.9,
}

/**
 * Estimate priority fee in microLamports for the given level.
 * Uses Helius getPriorityFeeEstimate if rpcUrl is a Helius endpoint,
 * otherwise falls back to getRecentPrioritizationFees percentile.
 */
export async function getPriorityFee(
  rpcUrl: string,
  level: PriorityLevel = 'medium',
  accountKeys: string[] = [],
): Promise<number> {
  if (rpcUrl.includes('helius')) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getPriorityFeeEstimate',
          params: [{ accountKeys: accountKeys.length ? accountKeys : undefined, options: { priorityLevel: HELIUS_PRIORITY_LEVEL[level] } }],
        }),
      })
      const json = (await res.json()) as { result?: { priorityFeeEstimate?: number } }
      const fee = json.result?.priorityFeeEstimate
      if (typeof fee === 'number' && fee > 0) return fee
    } catch {
      // fall through to standard method
    }
  }

  try {
    const { Connection } = await import('@solana/web3.js')
    const connection = new Connection(rpcUrl, 'confirmed')
    const fees = await connection.getRecentPrioritizationFees(
      accountKeys.length ? { lockedWritableAccounts: accountKeys.map((k) => { const { PublicKey } = require('@solana/web3.js'); return new PublicKey(k) }) } : undefined
    )
    if (!fees.length) return 1000
    const sorted = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * FALLBACK_PERCENTILE[level])
    return sorted[Math.min(idx, sorted.length - 1)] ?? 1000
  } catch {
    return 1000
  }
}
