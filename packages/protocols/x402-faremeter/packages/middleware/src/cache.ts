/**
 * Configuration options for the AgedLRUCache.
 */
export type AgedLRUCacheOpts = {
  /** Maximum number of entries. Defaults to 256. */
  capacity?: number;
  /** Maximum age in milliseconds before entries expire. Defaults to 30000. */
  maxAge?: number;
  /** Custom time function for testing. Defaults to Date.now. */
  now?: () => number;
};

/**
 * An LRU cache with time-based expiration.
 *
 * Entries are evicted when they exceed maxAge or when the cache reaches
 * capacity (least recently used entries are removed first).
 */
export class AgedLRUCache<K, V> {
  private maxAge: number;
  private capacity: number;
  private cache: Map<K, { birth: number; value: V }>;
  private now: () => number;

  constructor(opts: AgedLRUCacheOpts = {}) {
    this.capacity = opts.capacity ?? 256;
    this.maxAge = opts.maxAge ?? 30 * 1000;
    this.now = opts.now ?? Date.now;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);

    if (value === undefined) {
      return undefined;
    }

    this.cache.delete(key);

    if (this.now() - value.birth >= this.maxAge) {
      return undefined;
    }

    this.cache.set(key, value);
    return value.value;
  }

  put(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }
    this.cache.set(key, { birth: this.now(), value });
  }

  public get size() {
    return this.cache.size;
  }
}
