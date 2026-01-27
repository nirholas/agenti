/**
 * @fileoverview GitHub API caching layer with stale-while-revalidate
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { CacheEntry, CacheAdapter } from './types';

/**
 * In-memory cache adapter for serverless environments
 */
export class MemoryCacheAdapter implements CacheAdapter {
  private cache: Map<string, CacheEntry<any>> = new Map();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return entry as CacheEntry<T>;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Default TTL values in seconds
 */
export const DEFAULT_TTL = {
  METADATA: 3600,    // 1 hour for repo metadata
  FILES: 900,        // 15 minutes for file contents
  SPECS: 1800,       // 30 minutes for API specs
  DIRECTORY: 600     // 10 minutes for directory listings
} as const;

/**
 * GitHub API Cache with stale-while-revalidate support
 */
export class GitHubCache {
  private adapter: CacheAdapter;
  private ttls: { metadata: number; files: number };
  private verbose: boolean;
  private revalidating: Set<string> = new Set();

  constructor(
    adapter?: CacheAdapter,
    ttls?: { metadata?: number; files?: number },
    verbose?: boolean
  ) {
    this.adapter = adapter || new MemoryCacheAdapter();
    this.ttls = {
      metadata: ttls?.metadata || DEFAULT_TTL.METADATA,
      files: ttls?.files || DEFAULT_TTL.FILES
    };
    this.verbose = verbose || false;
  }

  /**
   * Generate cache key from components
   */
  generateKey(owner: string, repo: string, type: string, path?: string, ref?: string): string {
    const parts = [owner, repo, type];
    if (ref) parts.push(ref);
    if (path) parts.push(path);
    return parts.join('/');
  }

  /**
   * Check if an entry is fresh (not stale)
   */
  private isFresh(entry: CacheEntry<any>): boolean {
    const age = Date.now() - entry.timestamp;
    return age < entry.ttl * 1000;
  }

  /**
   * Check if an entry is stale but usable (within 2x TTL)
   */
  private isStale(entry: CacheEntry<any>): boolean {
    const age = Date.now() - entry.timestamp;
    return age >= entry.ttl * 1000 && age < entry.ttl * 2000;
  }

  /**
   * Get cached data with stale-while-revalidate pattern
   * Returns cached data immediately if available (even if stale),
   * and triggers background revalidation if stale
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const entry = await this.adapter.get<T>(key);

    if (entry) {
      if (this.isFresh(entry)) {
        if (this.verbose) {
          console.log(`[Cache] HIT (fresh): ${key}`);
        }
        return entry.data;
      }

      if (this.isStale(entry)) {
        if (this.verbose) {
          console.log(`[Cache] HIT (stale, revalidating): ${key}`);
        }
        // Trigger background revalidation
        this.revalidateInBackground(key, fetcher, ttl || entry.ttl);
        return entry.data;
      }
    }

    // Cache miss or expired beyond stale threshold
    if (this.verbose) {
      console.log(`[Cache] MISS: ${key}`);
    }
    return this.fetchAndCache(key, fetcher, ttl || this.ttls.files);
  }

  /**
   * Fetch data and store in cache
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const data = await fetcher();
    await this.adapter.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    return data;
  }

  /**
   * Revalidate cache entry in background
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    // Prevent multiple simultaneous revalidations
    if (this.revalidating.has(key)) {
      return;
    }

    this.revalidating.add(key);
    try {
      await this.fetchAndCache(key, fetcher, ttl);
      if (this.verbose) {
        console.log(`[Cache] Revalidated: ${key}`);
      }
    } catch (error) {
      if (this.verbose) {
        console.log(`[Cache] Revalidation failed: ${key}`, error);
      }
      // Keep stale data on revalidation failure
    } finally {
      this.revalidating.delete(key);
    }
  }

  /**
   * Force refresh a cache entry
   */
  async refresh<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (this.verbose) {
      console.log(`[Cache] FORCE REFRESH: ${key}`);
    }
    return this.fetchAndCache(key, fetcher, ttl || this.ttls.files);
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(key: string): Promise<void> {
    await this.adapter.delete(key);
    if (this.verbose) {
      console.log(`[Cache] INVALIDATED: ${key}`);
    }
  }

  /**
   * Invalidate all entries for a repository
   */
  async invalidateRepo(owner: string, repo: string): Promise<void> {
    const prefix = `${owner}/${repo}/`;
    // For memory adapter, we can iterate
    if (this.adapter instanceof MemoryCacheAdapter) {
      const stats = this.adapter.getStats();
      for (const key of stats.keys) {
        if (key.startsWith(prefix)) {
          await this.adapter.delete(key);
        }
      }
    }
    if (this.verbose) {
      console.log(`[Cache] INVALIDATED REPO: ${owner}/${repo}`);
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    await this.adapter.clear();
    if (this.verbose) {
      console.log(`[Cache] CLEARED`);
    }
  }

  /**
   * Get TTL for metadata
   */
  get metadataTTL(): number {
    return this.ttls.metadata;
  }

  /**
   * Get TTL for files
   */
  get filesTTL(): number {
    return this.ttls.files;
  }
}
