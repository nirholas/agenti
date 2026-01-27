/**
 * @fileoverview Cache interface for pluggable cache backends
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** Timestamp when the entry was created (ms since epoch) */
  timestamp: number;
  /** Time-to-live in seconds */
  ttl: number;
  /** Optional ETag for HTTP caching */
  etag?: string;
  /** Optional version for cache invalidation */
  version?: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of entries in cache */
  size: number;
  /** Total bytes used (if available) */
  bytes?: number;
  /** Cache hit ratio */
  hitRatio: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL in seconds */
  defaultTTL?: number;
  /** Maximum entries (for memory cache) */
  maxEntries?: number;
  /** Prefix for cache keys */
  keyPrefix?: string;
  /** Enable stale-while-revalidate */
  staleWhileRevalidate?: boolean;
  /** Stale tolerance (multiple of TTL) */
  staleTolerance?: number;
  /** Serializer for complex objects */
  serializer?: CacheSerializer;
}

/**
 * Custom serializer interface
 */
export interface CacheSerializer {
  serialize<T>(data: T): string;
  deserialize<T>(data: string): T;
}

/**
 * Default JSON serializer
 */
export const defaultSerializer: CacheSerializer = {
  serialize: <T>(data: T) => JSON.stringify(data),
  deserialize: <T>(data: string) => JSON.parse(data) as T
};

/**
 * Base cache interface that all cache implementations must follow
 */
export interface CacheInterface {
  /**
   * Get a cached value
   * @param key - Cache key
   * @returns The cached entry or null if not found/expired
   */
  get<T>(key: string): Promise<CacheEntry<T> | null>;

  /**
   * Set a cached value
   * @param key - Cache key
   * @param entry - The entry to cache
   */
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;

  /**
   * Delete a cached value
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cached values
   */
  clear(): Promise<void>;

  /**
   * Check if a key exists
   * @param key - Cache key
   */
  has(key: string): Promise<boolean>;

  /**
   * Get multiple values at once
   * @param keys - Array of cache keys
   */
  getMany<T>(keys: string[]): Promise<Map<string, CacheEntry<T> | null>>;

  /**
   * Set multiple values at once
   * @param entries - Map of key to entry
   */
  setMany<T>(entries: Map<string, CacheEntry<T>>): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Close the cache connection (for Redis, etc.)
   */
  close?(): Promise<void>;
}

/**
 * Helper to check if a cache entry is fresh
 */
export function isFresh(entry: CacheEntry): boolean {
  const age = Date.now() - entry.timestamp;
  return age < entry.ttl * 1000;
}

/**
 * Helper to check if a cache entry is stale but within tolerance
 */
export function isStale(entry: CacheEntry, tolerance: number = 2): boolean {
  const age = Date.now() - entry.timestamp;
  return age >= entry.ttl * 1000 && age < entry.ttl * tolerance * 1000;
}

/**
 * Helper to create a cache entry
 */
export function createCacheEntry<T>(data: T, ttl: number, etag?: string): CacheEntry<T> {
  return {
    data,
    timestamp: Date.now(),
    ttl,
    etag
  };
}

/**
 * Cache key generator helper
 */
export function generateCacheKey(parts: string[], prefix?: string): string {
  const key = parts.filter(Boolean).join(':');
  return prefix ? `${prefix}:${key}` : key;
}

/**
 * Type guard to check if an object is a CacheInterface
 */
export function isCacheInterface(obj: unknown): obj is CacheInterface {
  if (!obj || typeof obj !== 'object') return false;
  const cache = obj as CacheInterface;
  return (
    typeof cache.get === 'function' &&
    typeof cache.set === 'function' &&
    typeof cache.delete === 'function' &&
    typeof cache.clear === 'function'
  );
}
