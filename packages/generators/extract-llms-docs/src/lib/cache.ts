/**
 * LRU Cache with TTL support for llms-forge
 * Pure TypeScript implementation with no external dependencies
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export interface CacheOptions {
  /** Time to live in milliseconds (default: 5 minutes) */
  ttl?: number
  /** Maximum cache entries (default: 100) */
  maxEntries?: number
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  evictions: number
}

/**
 * Normalize a URL for use as a cache key
 * - Removes trailing slashes
 * - Lowercases the host
 * - Removes default ports
 */
export function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url)
    // Lowercase the host
    const host = parsed.host.toLowerCase()
    // Remove trailing slashes from pathname
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    // Reconstruct URL without search params for caching purposes
    return `${parsed.protocol}//${host}${pathname}`
  } catch {
    // If URL parsing fails, just normalize basic things
    return url.toLowerCase().replace(/\/+$/, '')
  }
}

/**
 * LRU Cache implementation with TTL support
 * Thread-safe for serverless environments
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private readonly maxEntries: number
  private readonly defaultTtl: number
  private stats: CacheStats

  constructor(options: CacheOptions = {}) {
    this.cache = new Map()
    this.maxEntries = options.maxEntries ?? 100
    this.defaultTtl = options.ttl ?? 5 * 60 * 1000 // 5 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
    }
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const normalizedKey = normalizeUrlKey(key)
    const entry = this.cache.get(normalizedKey)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(normalizedKey)
      this.stats.size = this.cache.size
      this.stats.misses++
      return null
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(normalizedKey)
    this.cache.set(normalizedKey, entry)

    this.stats.hits++
    return entry.data
  }

  /**
   * Set a value in the cache with optional custom TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const normalizedKey = normalizeUrlKey(key)
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    }

    // If key exists, remove it first to update order
    if (this.cache.has(normalizedKey)) {
      this.cache.delete(normalizedKey)
    }

    // Check if we need to evict
    while (this.cache.size >= this.maxEntries) {
      // Get the oldest entry (first in Map iteration order)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
        this.stats.evictions++
      } else {
        break
      }
    }

    this.cache.set(normalizedKey, entry)
    this.stats.size = this.cache.size
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const normalizedKey = normalizeUrlKey(key)
    const entry = this.cache.get(normalizedKey)

    if (!entry) {
      return false
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(normalizedKey)
      this.stats.size = this.cache.size
      return false
    }

    return true
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    const normalizedKey = normalizeUrlKey(key)
    const deleted = this.cache.delete(normalizedKey)
    this.stats.size = this.cache.size
    return deleted
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear()
    this.stats.size = 0
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get the remaining TTL for a key in seconds
   * Returns -1 if key doesn't exist or is expired
   */
  getTtlRemaining(key: string): number {
    const normalizedKey = normalizeUrlKey(key)
    const entry = this.cache.get(normalizedKey)

    if (!entry) {
      return -1
    }

    const now = Date.now()
    const elapsed = now - entry.timestamp
    const remaining = entry.ttl - elapsed

    if (remaining <= 0) {
      return -1
    }

    return Math.ceil(remaining / 1000) // Return in seconds
  }

  /**
   * Prune expired entries (can be called periodically)
   */
  prune(): number {
    const now = Date.now()
    let pruned = 0

    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        pruned++
      }
    }

    this.stats.size = this.cache.size
    return pruned
  }

  /**
   * Get all cache keys (for debugging/monitoring)
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }
}

// Default cache instances for the application
const DEFAULT_EXTRACTION_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const DEFAULT_VALIDATION_CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// Singleton cache instance for extractions
let extractionCacheInstance: LRUCache<unknown> | null = null

/**
 * Get the singleton extraction cache instance
 */
export function getExtractionCache<T>(): LRUCache<T> {
  if (!extractionCacheInstance) {
    extractionCacheInstance = new LRUCache<T>({
      ttl: DEFAULT_EXTRACTION_CACHE_TTL,
      maxEntries: 100,
    })
  }
  return extractionCacheInstance as LRUCache<T>
}

// Singleton cache instance for validation results
let validationCacheInstance: LRUCache<unknown> | null = null

/**
 * Get the singleton validation cache instance
 */
export function getValidationCache<T>(): LRUCache<T> {
  if (!validationCacheInstance) {
    validationCacheInstance = new LRUCache<T>({
      ttl: DEFAULT_VALIDATION_CACHE_TTL,
      maxEntries: 200,
    })
  }
  return validationCacheInstance as LRUCache<T>
}

/**
 * Clear all cache instances (useful for testing or admin operations)
 */
export function clearAllCaches(): void {
  extractionCacheInstance?.clear()
  validationCacheInstance?.clear()
}

/**
 * Get combined stats from all cache instances
 */
export function getAllCacheStats(): {
  extraction: CacheStats | null
  validation: CacheStats | null
} {
  return {
    extraction: extractionCacheInstance?.getStats() ?? null,
    validation: validationCacheInstance?.getStats() ?? null,
  }
}
