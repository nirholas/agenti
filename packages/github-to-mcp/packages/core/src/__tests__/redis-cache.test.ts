/**
 * @fileoverview Unit tests for Redis cache implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RedisCache, createRedisCache, RedisClientInterface } from '../cache/redis-cache';
import { createCacheEntry } from '../cache/cache-interface';

// Mock Redis client
function createMockRedisClient(): RedisClientInterface {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      let count = 0;
      for (const k of keys) {
        if (store.delete(k)) count++;
      }
      return count;
    }),
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(store.keys()).filter(k => regex.test(k));
    }),
    exists: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      return keys.filter(k => store.has(k)).length;
    }),
    mget: vi.fn(async (...keys: string[]) => keys.map(k => store.get(k) || null)),
    mset: vi.fn(async (...keysAndValues: string[]) => {
      for (let i = 0; i < keysAndValues.length; i += 2) {
        store.set(keysAndValues[i], keysAndValues[i + 1]);
      }
      return 'OK';
    }),
    quit: vi.fn(async () => 'OK'),
    dbsize: vi.fn(async () => store.size),
    info: vi.fn(async () => 'used_memory:1024')
  };
}

describe('RedisCache', () => {
  let mockClient: RedisClientInterface;
  let cache: RedisCache;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockRedisClient();
    cache = new RedisCache({
      client: mockClient,
      keyPrefix: 'test-cache',
      defaultTTL: 3600
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should return cached value', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);
      await cache.set('test-key', entry);

      const result = await cache.get<{ name: string }>('test-key');

      expect(result).not.toBeNull();
      expect(result?.data.name).toBe('test');
    });

    it('should return null for expired entries', async () => {
      const expiredEntry = {
        data: { name: 'expired' },
        timestamp: Date.now() - 10000000, // 10000 seconds ago
        ttl: 1 // 1 second TTL
      };

      // Manually set expired entry
      await mockClient.set('test-cache:expired-key', JSON.stringify(expiredEntry));

      const result = await cache.get('expired-key');

      expect(result).toBeNull();
    });

    it('should track cache misses', async () => {
      await cache.get('miss1');
      await cache.get('miss2');

      const stats = await cache.getStats();

      expect(stats.misses).toBe(2);
    });

    it('should track cache hits', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);
      await cache.set('test-key', entry);

      await cache.get('test-key');
      await cache.get('test-key');

      const stats = await cache.getStats();

      expect(stats.hits).toBe(2);
    });
  });

  describe('set', () => {
    it('should store value with TTL', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);

      await cache.set('test-key', entry);

      expect(mockClient.set).toHaveBeenCalledWith(
        'test-cache:test-key',
        expect.any(String),
        'EX',
        expect.any(Number)
      );
    });

    it('should apply stale-while-revalidate tolerance', async () => {
      const cacheWithSWR = new RedisCache({
        client: mockClient,
        keyPrefix: 'swr-cache',
        staleWhileRevalidate: true,
        staleTolerance: 3
      });

      const entry = createCacheEntry({ name: 'test' }, 100);
      await cacheWithSWR.set('test-key', entry);

      // TTL should be 100 * 3 = 300 seconds
      expect(mockClient.set).toHaveBeenCalledWith(
        'swr-cache:test-key',
        expect.any(String),
        'EX',
        300
      );
    });
  });

  describe('delete', () => {
    it('should delete cached value', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);
      await cache.set('test-key', entry);

      await cache.delete('test-key');

      expect(mockClient.del).toHaveBeenCalledWith('test-cache:test-key');
    });
  });

  describe('clear', () => {
    it('should clear all values with prefix', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);
      await cache.set('key1', entry);
      await cache.set('key2', entry);
      await cache.set('key3', entry);

      await cache.clear();

      expect(mockClient.keys).toHaveBeenCalledWith('test-cache:*');
    });

    it('should reset stats on clear', async () => {
      await cache.get('miss'); // Create a miss
      await cache.clear();

      const stats = await cache.getStats();

      expect(stats.misses).toBe(0);
      expect(stats.hits).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);
      await cache.set('test-key', entry);

      const exists = await cache.has('test-key');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await cache.has('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('getMany', () => {
    it('should get multiple values at once', async () => {
      const entry1 = createCacheEntry({ name: 'test1' }, 3600);
      const entry2 = createCacheEntry({ name: 'test2' }, 3600);

      await cache.set('key1', entry1);
      await cache.set('key2', entry2);

      const results = await cache.getMany<{ name: string }>(['key1', 'key2', 'key3']);

      expect(results.size).toBe(3);
      expect(results.get('key1')?.data.name).toBe('test1');
      expect(results.get('key2')?.data.name).toBe('test2');
      expect(results.get('key3')).toBeNull();
    });

    it('should handle empty keys array', async () => {
      const results = await cache.getMany([]);

      expect(results.size).toBe(0);
    });
  });

  describe('setMany', () => {
    it('should set multiple values at once', async () => {
      const entries = new Map([
        ['key1', createCacheEntry({ name: 'test1' }, 3600)],
        ['key2', createCacheEntry({ name: 'test2' }, 3600)]
      ]);

      await cache.setMany(entries);

      const result1 = await cache.get<{ name: string }>('key1');
      const result2 = await cache.get<{ name: string }>('key2');

      expect(result1?.data.name).toBe('test1');
      expect(result2?.data.name).toBe('test2');
    });

    it('should handle empty entries map', async () => {
      await cache.setMany(new Map());

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const entry = createCacheEntry({ name: 'test' }, 3600);
      await cache.set('key1', entry);

      await cache.get('key1'); // Hit
      await cache.get('key2'); // Miss

      const stats = await cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRatio).toBe(0.5);
    });

    it('should return size from dbsize', async () => {
      const stats = await cache.getStats();

      expect(mockClient.dbsize).toHaveBeenCalled();
    });

    it('should return bytes from info', async () => {
      const stats = await cache.getStats();

      expect(stats.bytes).toBe(1024);
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      await cache.close();

      expect(mockClient.quit).toHaveBeenCalled();
    });
  });
});

describe('createRedisCache', () => {
  it('should create a RedisCache instance', () => {
    const mockClient = createMockRedisClient();
    const cache = createRedisCache({ client: mockClient });

    expect(cache).toBeInstanceOf(RedisCache);
  });

  it('should accept configuration options', () => {
    const mockClient = createMockRedisClient();
    const cache = createRedisCache({
      client: mockClient,
      keyPrefix: 'custom-prefix',
      defaultTTL: 7200
    });

    expect(cache).toBeInstanceOf(RedisCache);
  });
});
