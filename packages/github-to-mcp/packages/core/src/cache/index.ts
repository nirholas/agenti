/**
 * @fileoverview Cache module exports
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

// Export interfaces and types
export {
  CacheInterface,
  CacheEntry,
  CacheStats,
  CacheConfig,
  CacheSerializer,
  defaultSerializer,
  isFresh,
  isStale,
  createCacheEntry,
  generateCacheKey,
  isCacheInterface
} from './cache-interface';

// Export Redis cache
export {
  RedisCache,
  RedisCacheConfig,
  RedisClientInterface,
  createRedisCache,
  createRedisCacheFromUrl
} from './redis-cache';

// Export Upstash cache
export {
  UpstashCache,
  UpstashCacheConfig,
  createUpstashCache,
  createUpstashCacheFromEnv
} from './upstash-cache';

// Re-export memory cache from parent
import { MemoryCacheAdapter, GitHubCache, DEFAULT_TTL } from '../cache';
export { MemoryCacheAdapter, GitHubCache, DEFAULT_TTL };

import type { CacheInterface, CacheConfig } from './cache-interface';
import type { RedisCacheConfig, RedisClientInterface } from './redis-cache';
import type { UpstashCacheConfig } from './upstash-cache';

/**
 * Cache backend types
 */
export type CacheBackend = 'memory' | 'redis' | 'upstash';

/**
 * Unified cache factory configuration
 */
export interface CacheFactoryConfig {
  backend: CacheBackend;
  /** Redis-specific configuration */
  redis?: {
    client: RedisClientInterface;
  } & Omit<RedisCacheConfig, 'client'>;
  /** Upstash-specific configuration */
  upstash?: {
    url: string;
    token: string;
  } & Omit<UpstashCacheConfig, 'url' | 'token'>;
  /** Common cache options */
  options?: CacheConfig;
}

/**
 * Create a cache instance based on configuration
 */
export function createCache(config: CacheFactoryConfig): CacheInterface {
  const { backend, redis, upstash, options } = config;

  switch (backend) {
    case 'memory':
      // Return memory cache wrapped as CacheInterface
      return new MemoryCacheWrapper(options);

    case 'redis':
      if (!redis?.client) {
        throw new Error('Redis client is required for redis backend');
      }
      const { createRedisCache } = require('./redis-cache');
      return createRedisCache({
        ...options,
        ...redis
      });

    case 'upstash':
      if (!upstash?.url || !upstash?.token) {
        // Try environment variables
        const url = upstash?.url || process.env.UPSTASH_REDIS_REST_URL;
        const token = upstash?.token || process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
          throw new Error('Upstash URL and token are required for upstash backend');
        }

        const { createUpstashCache } = require('./upstash-cache');
        return createUpstashCache({
          url,
          token,
          ...options,
          ...upstash
        });
      }

      const { createUpstashCache: createUpstash } = require('./upstash-cache');
      return createUpstash({
        ...options,
        ...upstash
      });

    default:
      throw new Error(`Unknown cache backend: ${backend}`);
  }
}

/**
 * Memory cache wrapper that implements CacheInterface
 */
class MemoryCacheWrapper implements CacheInterface {
  private cache: Map<string, any> = new Map();
  private config: CacheConfig;
  private stats = { hits: 0, misses: 0 };

  constructor(config?: CacheConfig) {
    this.config = {
      defaultTTL: 3600,
      maxEntries: 1000,
      ...config
    };
  }

  async get<T>(key: string): Promise<{ data: T; timestamp: number; ttl: number } | null> {
    const prefixedKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    const entry = this.cache.get(prefixedKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(prefixedKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry;
  }

  async set<T>(key: string, entry: { data: T; timestamp: number; ttl: number }): Promise<void> {
    const prefixedKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;

    // Enforce max entries
    if (this.config.maxEntries && this.cache.size >= this.config.maxEntries) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(prefixedKey, entry);
  }

  async delete(key: string): Promise<void> {
    const prefixedKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    this.cache.delete(prefixedKey);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  async has(key: string): Promise<boolean> {
    const prefixedKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    return this.cache.has(prefixedKey);
  }

  async getMany<T>(keys: string[]): Promise<Map<string, { data: T; timestamp: number; ttl: number } | null>> {
    const result = new Map();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  async setMany<T>(entries: Map<string, { data: T; timestamp: number; ttl: number }>): Promise<void> {
    for (const [key, entry] of entries) {
      await this.set(key, entry);
    }
  }

  async getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRatio: total > 0 ? this.stats.hits / total : 0
    };
  }
}
