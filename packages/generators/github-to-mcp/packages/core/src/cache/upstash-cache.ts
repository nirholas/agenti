/**
 * @fileoverview Upstash Redis cache implementation for serverless environments
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
import { defaultSerializer } from './cache-interface';

/**
 * Upstash REST API response
 */
interface UpstashResponse<T = unknown> {
  result: T;
  error?: string;
}

/**
 * Upstash cache configuration
 */
export interface UpstashCacheConfig extends CacheConfig {
  /** Upstash REST URL */
  url: string;
  /** Upstash REST token */
  token: string;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Upstash Redis cache implementation
 * Uses REST API for serverless/edge compatibility
 */
export class UpstashCache implements CacheInterface {
  private url: string;
  private token: string;
  private config: UpstashCacheConfig;
  private serializer: CacheSerializer;
  private stats: { hits: number; misses: number };

  constructor(config: UpstashCacheConfig) {
    this.url = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.config = {
      keyPrefix: 'mcp-cache',
      defaultTTL: 3600,
      timeout: 5000,
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
   * Execute Upstash command via REST API
   */
  private async execute<T>(command: string[]): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.url}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(command),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Upstash API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as UpstashResponse<T>;

      if (data.error) {
        throw new Error(`Upstash error: ${data.error}`);
      }

      return data.result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute pipeline of commands
   */
  private async pipeline<T>(commands: string[][]): Promise<T[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commands),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Upstash API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as UpstashResponse<T>[];
      return data.map(d => d.result);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const prefixedKey = this.prefixKey(key);

    try {
      const value = await this.execute<string | null>(['GET', prefixedKey]);

      if (!value) {
        this.stats.misses++;
        return null;
      }

      const entry = this.serializer.deserialize<CacheEntry<T>>(value);

      // Check if entry is expired
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        this.stats.misses++;
        // Delete expired entry asynchronously
        this.delete(key).catch(() => {});
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

    // Calculate expiration time
    const expirationSeconds = this.config.staleWhileRevalidate
      ? Math.ceil(entry.ttl * (this.config.staleTolerance || 2))
      : entry.ttl;

    if (expirationSeconds > 0) {
      await this.execute(['SET', prefixedKey, serialized, 'EX', String(expirationSeconds)]);
    } else {
      await this.execute(['SET', prefixedKey, serialized]);
    }
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    await this.execute(['DEL', prefixedKey]);
  }

  /**
   * Clear all cached values with the prefix
   */
  async clear(): Promise<void> {
    const pattern = this.config.keyPrefix ? `${this.config.keyPrefix}:*` : '*';

    // Get all keys matching the pattern
    const keys = await this.execute<string[]>(['KEYS', pattern]);

    if (keys && keys.length > 0) {
      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await this.execute(['DEL', ...batch]);
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
    const exists = await this.execute<number>(['EXISTS', prefixedKey]);
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
    const values = await this.execute<(string | null)[]>(['MGET', ...prefixedKeys]);

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

    // Use pipeline for efficiency
    const commands: string[][] = [];

    entries.forEach((entry, key) => {
      const prefixedKey = this.prefixKey(key);
      const serialized = this.serializer.serialize(entry);

      const expirationSeconds = this.config.staleWhileRevalidate
        ? Math.ceil(entry.ttl * (this.config.staleTolerance || 2))
        : entry.ttl;

      if (expirationSeconds > 0) {
        commands.push(['SET', prefixedKey, serialized, 'EX', String(expirationSeconds)]);
      } else {
        commands.push(['SET', prefixedKey, serialized]);
      }
    });

    await this.pipeline(commands);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    let size = 0;

    try {
      const dbSize = await this.execute<number>(['DBSIZE']);
      size = dbSize || 0;
    } catch {
      // Ignore stats errors
    }

    const total = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size,
      hitRatio: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Close method (no-op for REST-based client)
   */
  async close(): Promise<void> {
    // No connection to close for REST API
  }

  /**
   * Increment a counter (useful for rate limiting)
   */
  async incr(key: string, ttl?: number): Promise<number> {
    const prefixedKey = this.prefixKey(key);

    if (ttl) {
      // Use pipeline to set expiration atomically
      const results = await this.pipeline<number>([
        ['INCR', prefixedKey],
        ['EXPIRE', prefixedKey, String(ttl)]
      ]);
      return results[0];
    }

    return this.execute<number>(['INCR', prefixedKey]);
  }

  /**
   * Set with NX (only if not exists) - useful for distributed locks
   */
  async setNX(key: string, value: string, ttl?: number): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);

    if (ttl) {
      const result = await this.execute<string | null>(['SET', prefixedKey, value, 'NX', 'EX', String(ttl)]);
      return result === 'OK';
    }

    const result = await this.execute<number>(['SETNX', prefixedKey, value]);
    return result === 1;
  }
}

/**
 * Create an Upstash cache instance
 */
export function createUpstashCache(config: UpstashCacheConfig): UpstashCache {
  return new UpstashCache(config);
}

/**
 * Create Upstash cache from environment variables
 */
export function createUpstashCacheFromEnv(options?: Omit<UpstashCacheConfig, 'url' | 'token'>): UpstashCache {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing Upstash environment variables. ' +
      'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  return new UpstashCache({
    url,
    token,
    ...options
  });
}
