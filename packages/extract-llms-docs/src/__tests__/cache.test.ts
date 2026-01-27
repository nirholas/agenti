/**
 * Cache unit tests
 * Tests for LRU cache with TTL support
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  LRUCache,
  normalizeUrlKey,
  getExtractionCache,
  getValidationCache,
  clearAllCaches,
  getAllCacheStats,
} from '@/lib/cache'

describe('normalizeUrlKey', () => {
  it('lowercases the host', () => {
    expect(normalizeUrlKey('https://EXAMPLE.COM/path')).toBe('https://example.com/path')
  })

  it('removes trailing slashes', () => {
    expect(normalizeUrlKey('https://example.com/path/')).toBe('https://example.com/path')
  })

  it('preserves pathname', () => {
    expect(normalizeUrlKey('https://example.com/api/v1')).toBe('https://example.com/api/v1')
  })

  it('handles URLs without path', () => {
    expect(normalizeUrlKey('https://example.com')).toBe('https://example.com/')
  })

  it('falls back for invalid URLs', () => {
    expect(normalizeUrlKey('not-a-url')).toBe('not-a-url')
  })
})

describe('LRUCache', () => {
  let cache: LRUCache<string>

  beforeEach(() => {
    cache = new LRUCache<string>({ ttl: 1000, maxEntries: 3 })
  })

  describe('basic operations', () => {
    it('sets and gets values', () => {
      cache.set('https://example.com', 'value1')
      expect(cache.get('https://example.com')).toBe('value1')
    })

    it('returns null for missing keys', () => {
      expect(cache.get('https://nonexistent.com')).toBeNull()
    })

    it('checks if key exists', () => {
      cache.set('https://example.com', 'value')
      expect(cache.has('https://example.com')).toBe(true)
      expect(cache.has('https://nonexistent.com')).toBe(false)
    })

    it('deletes keys', () => {
      cache.set('https://example.com', 'value')
      expect(cache.delete('https://example.com')).toBe(true)
      expect(cache.get('https://example.com')).toBeNull()
    })

    it('clears all entries', () => {
      cache.set('https://a.com', 'a')
      cache.set('https://b.com', 'b')
      cache.clear()
      expect(cache.get('https://a.com')).toBeNull()
      expect(cache.get('https://b.com')).toBeNull()
    })
  })

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns value before TTL expires', () => {
      cache.set('https://example.com', 'value')
      vi.advanceTimersByTime(500) // Half the TTL
      expect(cache.get('https://example.com')).toBe('value')
    })

    it('returns null after TTL expires', () => {
      cache.set('https://example.com', 'value')
      vi.advanceTimersByTime(1100) // Past TTL
      expect(cache.get('https://example.com')).toBeNull()
    })

    it('reports false for has() after expiration', () => {
      cache.set('https://example.com', 'value')
      vi.advanceTimersByTime(1100)
      expect(cache.has('https://example.com')).toBe(false)
    })

    it('supports custom TTL per entry', () => {
      cache.set('https://short.com', 'short', 200)
      cache.set('https://long.com', 'long', 2000)

      vi.advanceTimersByTime(300)

      expect(cache.get('https://short.com')).toBeNull()
      expect(cache.get('https://long.com')).toBe('long')
    })
  })

  describe('LRU eviction', () => {
    it('evicts oldest entry when max size reached', () => {
      cache.set('https://a.com', 'a')
      cache.set('https://b.com', 'b')
      cache.set('https://c.com', 'c')
      cache.set('https://d.com', 'd') // Should evict 'a'

      expect(cache.get('https://a.com')).toBeNull()
      expect(cache.get('https://b.com')).toBe('b')
      expect(cache.get('https://c.com')).toBe('c')
      expect(cache.get('https://d.com')).toBe('d')
    })

    it('updates LRU order on get', () => {
      cache.set('https://a.com', 'a')
      cache.set('https://b.com', 'b')
      cache.set('https://c.com', 'c')

      // Access 'a' to make it recently used
      cache.get('https://a.com')

      // Add new entry, should evict 'b' (oldest not accessed)
      cache.set('https://d.com', 'd')

      expect(cache.get('https://a.com')).toBe('a')
      expect(cache.get('https://b.com')).toBeNull()
    })

    it('tracks eviction count in stats', () => {
      cache.set('https://a.com', 'a')
      cache.set('https://b.com', 'b')
      cache.set('https://c.com', 'c')
      cache.set('https://d.com', 'd') // Evicts one

      const stats = cache.getStats()
      expect(stats.evictions).toBe(1)
    })
  })

  describe('statistics', () => {
    it('tracks hits and misses', () => {
      cache.set('https://example.com', 'value')

      cache.get('https://example.com') // Hit
      cache.get('https://example.com') // Hit
      cache.get('https://nonexistent.com') // Miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
    })

    it('tracks cache size', () => {
      cache.set('https://a.com', 'a')
      cache.set('https://b.com', 'b')

      const stats = cache.getStats()
      expect(stats.size).toBe(2)
    })
  })

  describe('prune', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('removes expired entries', () => {
      cache.set('https://short.com', 'short', 100)
      cache.set('https://long.com', 'long', 2000)

      vi.advanceTimersByTime(500)

      const pruned = cache.prune()

      expect(pruned).toBe(1)
      expect(cache.has('https://short.com')).toBe(false)
      expect(cache.has('https://long.com')).toBe(true)
    })
  })

  describe('getTtlRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns remaining TTL in seconds', () => {
      cache.set('https://example.com', 'value') // TTL is 1000ms

      vi.advanceTimersByTime(500)

      const remaining = cache.getTtlRemaining('https://example.com')
      // Should be roughly 0.5 seconds remaining, rounded up
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(1)
    })

    it('returns -1 for expired entries', () => {
      cache.set('https://example.com', 'value')

      vi.advanceTimersByTime(1100)

      expect(cache.getTtlRemaining('https://example.com')).toBe(-1)
    })

    it('returns -1 for nonexistent keys', () => {
      expect(cache.getTtlRemaining('https://nonexistent.com')).toBe(-1)
    })
  })
})

describe('Singleton cache instances', () => {
  beforeEach(() => {
    clearAllCaches()
  })

  it('getExtractionCache returns same instance', () => {
    const cache1 = getExtractionCache<string>()
    const cache2 = getExtractionCache<string>()
    expect(cache1).toBe(cache2)
  })

  it('getValidationCache returns same instance', () => {
    const cache1 = getValidationCache<boolean>()
    const cache2 = getValidationCache<boolean>()
    expect(cache1).toBe(cache2)
  })

  it('clearAllCaches clears both caches', () => {
    const extractionCache = getExtractionCache<string>()
    const validationCache = getValidationCache<boolean>()

    extractionCache.set('https://a.com', 'value')
    validationCache.set('https://b.com', true)

    clearAllCaches()

    expect(extractionCache.get('https://a.com')).toBeNull()
    expect(validationCache.get('https://b.com')).toBeNull()
  })

  it('getAllCacheStats returns stats from both caches', () => {
    const extractionCache = getExtractionCache<string>()
    extractionCache.set('https://a.com', 'value')
    extractionCache.get('https://a.com')

    const stats = getAllCacheStats()

    expect(stats.extraction).toBeDefined()
    expect(stats.extraction?.hits).toBe(1)
    expect(stats.extraction?.size).toBe(1)
  })
})
