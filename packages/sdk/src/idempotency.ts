/**
 * idempotency.ts — reuse one signed authorization across a caller's retries.
 *
 * Every call to `pay()` signs a fresh EIP-3009 authorization with its own
 * random nonce. That is correct for distinct purchases, but it makes a retried
 * purchase indistinguishable from a new one: nonce-based replay protection
 * admits the second attempt because it genuinely is a different authorization,
 * so a caller who wraps `pay()` in retry logic (or simply calls it again after
 * an ambiguous timeout) can settle twice.
 *
 * Attaching an `Idempotency-Key` header marks several attempts as one logical
 * purchase. The first attempt signs and caches the payment header; later
 * attempts under the same key replay that exact authorization, so the
 * facilitator's own nonce guard collapses them into a single settlement. The
 * header is also forwarded upstream, so a resource server that dedupes by
 * idempotency key can recognise the retry before it settles at all.
 */

/** Identifies which payment requirements a cached authorization was signed for. */
export interface PaymentIdentity {
  network: string
  asset: string
  payTo: string
  amount: string
}

interface CacheEntry {
  /** The base64 payment header that was signed for this key. */
  header: string
  /** Unix seconds after which the underlying authorization is no longer valid. */
  expiresAt: number
}

const MAX_ENTRIES = 1000

const cache = new Map<string, CacheEntry>()

function cacheKey(idempotencyKey: string, identity: PaymentIdentity): string {
  // The requirements are part of the key so that reusing an idempotency key
  // against a different resource, price or chain signs a new authorization
  // rather than replaying one that would fail verification anyway.
  return [
    idempotencyKey,
    identity.network,
    identity.asset.toLowerCase(),
    identity.payTo.toLowerCase(),
    identity.amount,
  ].join('|')
}

function prune(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  // Bound the cache even when every entry is still live. Map preserves
  // insertion order, so this drops the oldest keys first.
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

/**
 * Returns the payment header previously signed under this idempotency key for
 * these exact requirements, or undefined if there is none or it has expired.
 */
export function getCachedPayment(
  idempotencyKey: string,
  identity: PaymentIdentity,
): string | undefined {
  const now = Math.floor(Date.now() / 1000)
  const key = cacheKey(idempotencyKey, identity)
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= now) {
    cache.delete(key)
    return undefined
  }
  return entry.header
}

/** Records a signed payment header so a retry under the same key replays it. */
export function cachePayment(
  idempotencyKey: string,
  identity: PaymentIdentity,
  header: string,
  expiresAt: number,
): void {
  const now = Math.floor(Date.now() / 1000)
  prune(now)
  cache.set(cacheKey(idempotencyKey, identity), { header, expiresAt })
}

/**
 * Reads the `Idempotency-Key` header from a RequestInit, whatever shape the
 * caller used for headers. Header names are case-insensitive, so this matches
 * `idempotency-key` in any casing.
 */
export function readIdempotencyKey(headers: RequestInit['headers']): string | undefined {
  if (!headers) return undefined

  const wanted = 'idempotency-key'

  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(wanted) ?? undefined
  }

  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (pair[0]?.toLowerCase() === wanted) return pair[1]
    }
    return undefined
  }

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === wanted) return typeof value === 'string' ? value : undefined
  }
  return undefined
}

/** Clears the cache. Exported for tests and for long-lived processes. */
export function clearIdempotencyCache(): void {
  cache.clear()
}
