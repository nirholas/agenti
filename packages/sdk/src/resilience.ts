export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitter?: boolean
}

export interface CircuitBreakerOptions extends RetryOptions {
  failureThreshold?: number
  recoveryTimeMs?: number
}

type CBState = 'closed' | 'open' | 'half-open'

interface BreakerEntry {
  state: CBState
  failures: number
  lastFailure: number
  halfOpenSuccesses: number
}

const HALF_OPEN_REQUIRED = 2

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt: number, baseMs: number, maxMs: number, jitter: boolean): number {
  const exp = Math.min(baseMs * 2 ** attempt, maxMs)
  return jitter ? exp * (0.5 + Math.random() * 0.5) : exp
}

/**
 * Resilient fetch with exponential backoff + jitter.
 * Retries on 429, 503, network errors. Respects Retry-After header.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions,
): Promise<Response> {
  const { maxRetries = 3, baseDelayMs = 500, maxDelayMs = 10_000, jitter = true } = options ?? {}

  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init)

      if (res.status === 429 || res.status === 503) {
        if (attempt < maxRetries) {
          const retryAfter = Number(res.headers.get('Retry-After') ?? '0') * 1000
          const delay = retryAfter > 0 ? retryAfter : backoffMs(attempt, baseDelayMs, maxDelayMs, jitter)
          await sleep(delay)
          continue
        }
        return res
      }

      return res
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt, baseDelayMs, maxDelayMs, jitter))
      }
    }
  }

  throw lastErr
}

/**
 * Per-host circuit breaker.
 * Tracks failures per hostname and stops calling hosts that are consistently failing.
 * Returns a fetch-compatible function.
 */
export function createCircuitBreaker(
  options?: CircuitBreakerOptions,
): (url: string, init?: RequestInit) => Promise<Response> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    jitter = true,
    failureThreshold = 5,
    recoveryTimeMs = 30_000,
  } = options ?? {}

  const breakers = new Map<string, BreakerEntry>()

  function getBreaker(host: string): BreakerEntry {
    let entry = breakers.get(host)
    if (!entry) {
      entry = { state: 'closed', failures: 0, lastFailure: 0, halfOpenSuccesses: 0 }
      breakers.set(host, entry)
    }
    if (entry.state === 'open' && Date.now() - entry.lastFailure > recoveryTimeMs) {
      entry.state = 'half-open'
      entry.halfOpenSuccesses = 0
    }
    return entry
  }

  function onSuccess(entry: BreakerEntry) {
    if (entry.state === 'half-open') {
      entry.halfOpenSuccesses++
      if (entry.halfOpenSuccesses >= HALF_OPEN_REQUIRED) {
        entry.state = 'closed'
        entry.failures = 0
      }
    } else {
      entry.failures = Math.max(0, entry.failures - 1)
    }
  }

  function onFailure(entry: BreakerEntry) {
    entry.failures++
    entry.lastFailure = Date.now()
    if (entry.failures >= failureThreshold) {
      entry.state = 'open'
    }
  }

  return async function circuitFetch(url: string, init?: RequestInit): Promise<Response> {
    const host = new URL(url).hostname
    const entry = getBreaker(host)

    if (entry.state === 'open') {
      throw new Error(`Circuit open for ${host} — too many recent failures`)
    }

    let lastErr: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, init)

        if (res.status === 429 || res.status === 503) {
          onFailure(entry)
          if (attempt < maxRetries) {
            const retryAfter = Number(res.headers.get('Retry-After') ?? '0') * 1000
            const delay = retryAfter > 0 ? retryAfter : backoffMs(attempt, baseDelayMs, maxDelayMs, jitter)
            await sleep(delay)
            continue
          }
          return res
        }

        if (!res.ok) {
          onFailure(entry)
          return res
        }

        onSuccess(entry)
        return res
      } catch (err) {
        lastErr = err
        onFailure(entry)
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt, baseDelayMs, maxDelayMs, jitter))
        }
      }
    }

    throw lastErr
  }
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
  staleAt: number
}

/**
 * Simple in-process cache with TTL and stale-while-revalidate.
 */
export class ResponseCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private maxSize: number
  private defaultTtlMs: number
  private inflight = new Map<string, Promise<unknown>>()

  constructor(options?: { maxSize?: number; defaultTtlMs?: number }) {
    this.maxSize = options?.maxSize ?? 1_000
    this.defaultTtlMs = options?.defaultTtlMs ?? 60_000
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value
      if (oldest) this.store.delete(oldest)
    }
    const ttl = ttlMs ?? this.defaultTtlMs
    const now = Date.now()
    this.store.set(key, { value, expiresAt: now + ttl, staleAt: now + ttl * 0.8 })
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined
    const now = Date.now()

    if (entry && now < entry.expiresAt) {
      if (now > entry.staleAt) {
        // Stale — revalidate in background, return stale
        void this._fetch(key, fetcher, ttlMs).catch(() => {})
      }
      return entry.value
    }

    return this._fetch(key, fetcher, ttlMs)
  }

  private async _fetch<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined
    if (existing) return existing

    const promise = fetcher()
      .then((value) => { this.set(key, value, ttlMs); return value })
      .finally(() => this.inflight.delete(key))

    this.inflight.set(key, promise)
    return promise
  }
}
