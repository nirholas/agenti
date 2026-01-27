/**
 * @fileoverview Redis cache implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type {
  CacheInterface,
  CacheEntry,
  CacheStats,
  CacheConfig,
  CacheSerializer
} from './cache-interface';
import { defaultSerializer, generateCacheKey } from './cache-interface';

/**
 * Redis client interface (compatible with ioredis and node-redis)
 */
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  exists(key: string | string[]): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  mset(...keysAndValues: string[]): Promise<any>;
  flushdb?(): Promise<any>;
  quit(): Promise<any>;
  info?(section?: string): Promise<string>;
  dbsize?(): Promise<number>;
}

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig extends CacheConfig {
  /** Redis client instance */
  client: RedisClientInterface;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Use SETEX for automatic expiration */
  useExpiration?: boolean;
}

/**
 * Redis-based cache implementation
 */
export class RedisCache implements CacheInterface {
  private client: RedisClientInterface;
  private config: RedisCacheConfig;
  private serializer: CacheSerializer;
  private stats: { hits: number; misses: number };

  constructor(config: RedisCacheConfig) {
    this.client = config.client;
    this.config = {
      keyPrefix: 'mcp-cache',
      defaultTTL: 3600,
      useExpiration: true,
      ...config
    };
    this.serializer = config.serializer || defaultSerializer;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Generate prefixed key
   */
  private prefixKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const prefixedKey = this.prefixKey(key);

    try {
      const value = await this.client.get(prefixedKey);

      if (!value) {
        this.stats.misses++;
        return null;
      }

      const entry = this.serializer.deserialize<CacheEntry<T>>(value);

      // Check if entry is expired (in case TTL wasn't set in Redis)
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        this.stats.misses++;
        // Delete expired entry
        await this.delete(key);
        return null;
      }

      this.stats.hits++;
      return entry;
    } catch (error) {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a cached value
   */
  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const serialized = this.serializer.serialize(entry);

    if (this.config.useExpiration && entry.ttl > 0) {
      // Use SETEX or SET with EX option for automatic expiration
      // Add extra time for stale-while-revalidate if enabled
      const expirationSeconds = this.config.staleWhileRevalidate
        ? Math.ceil(entry.ttl * (this.config.staleTolerance || 2))
        : entry.ttl;

      await this.client.set(prefixedKey, serialized, 'EX', expirationSeconds);
    } else {
      await this.client.set(prefixedKey, serialized);
    }
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    await this.client.del(prefixedKey);
  }

  /**
   * Clear all cached values with the prefix
   */
  async clear(): Promise<void> {
    const pattern = this.config.keyPrefix ? `${this.config.keyPrefix}:*` : '*';
    const keys = await this.client.keys(pattern);

    if (keys.length > 0) {
      // Delete in batches to avoid blocking
      const batchSize = 1000;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await this.client.del(batch);
      }
    }

    // Reset stats
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const exists = await this.client.exists(prefixedKey);
    return exists > 0;
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[]): Promise<Map<string, CacheEntry<T> | null>> {
    const result = new Map<string, CacheEntry<T> | null>();

    if (keys.length === 0) {
      return result;
    }

    const prefixedKeys = keys.map(k => this.prefixKey(k));
    const values = await this.client.mget(...prefixedKeys);

    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        try {
          const entry = this.serializer.deserialize<CacheEntry<T>>(value);
          if (Date.now() - entry.timestamp <= entry.ttl * 1000) {
            this.stats.hits++;
            result.set(key, entry);
          } else {
            this.stats.misses++;
            result.set(key, null);
          }
        } catch {
          this.stats.misses++;
          result.set(key, null);
        }
      } else {
        this.stats.misses++;
        result.set(key, null);
      }
    });

    return result;
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(entries: Map<string, CacheEntry<T>>): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    // For entries with TTL, we need to set them individually to use SETEX
    if (this.config.useExpiration) {
      const promises = Array.from(entries.entries()).map(([key, entry]) =>
        this.set(key, entry)
      );
      await Promise.all(promises);
    } else {
      // Use MSET for entries without TTL
      const args: string[] = [];
      entries.forEach((entry, key) => {
        args.push(this.prefixKey(key), this.serializer.serialize(entry));
      });
      await this.client.mset(...args);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const pattern = this.config.keyPrefix ? `${this.config.keyPrefix}:*` : '*';
    let size = 0;
    let bytes: number | undefined;

    try {
      if (this.client.dbsize) {
        size = await this.client.dbsize();
      } else {
        const keys = await this.client.keys(pattern);
        size = keys.length;
      }

      // Try to get memory usage if available
      if (this.client.info) {
        const info = await this.client.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          bytes = parseInt(match[1], 10);
        }
      }
    } catch {
      // Ignore stats errors
    }

    const total = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size,
      bytes,
      hitRatio: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * Create a Redis cache instance
 */
export function createRedisCache(config: RedisCacheConfig): RedisCache {
  return new RedisCache(config);
}

/**
 * Helper to create Redis cache from connection URL
 * Note: This is a stub - actual implementation depends on the Redis client library used
 */
export async function createRedisCacheFromUrl(
  url: string,
  options?: Omit<RedisCacheConfig, 'client'>
): Promise<RedisCache> {
  // This would need ioredis or node-redis to be installed
  throw new Error(
    'createRedisCacheFromUrl requires a Redis client library. ' +
    'Please install ioredis or redis and pass the client directly.'
  );
}
