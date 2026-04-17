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
