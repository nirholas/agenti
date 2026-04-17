import { LRUCache } from 'lru-cache'

// keyed by `${from.lower()}:${nonce.lower()}` → expiry unix seconds
const cache = new LRUCache<string, number>({
  max: 100_000,
  ttlAutopurge: true,
})

function key(from: string, nonce: string): string {
  return `${from.toLowerCase()}:${nonce.toLowerCase()}`
}

export function hasNonce(from: string, nonce: string): boolean {
  const k = key(from, nonce)
  const expiry = cache.get(k)
  if (expiry === undefined) return false
  if (Date.now() / 1000 > expiry) {
    cache.delete(k)
    return false
  }
  return true
}

// validBefore is the authorization's expiry timestamp (unix seconds, bigint).
// We store the nonce with a 60-second buffer past that to catch late submissions.
export function markNonce(from: string, nonce: string, validBefore: bigint): void {
  const k = key(from, nonce)
  const expiresAt = Number(validBefore)
  const ttlMs = Math.max(0, (expiresAt - Date.now() / 1000 + 60) * 1000)
  cache.set(k, expiresAt, { ttl: ttlMs })
}
