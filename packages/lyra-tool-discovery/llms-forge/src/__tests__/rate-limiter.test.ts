/**
 * Rate limiter unit tests
 * Tests for sliding window rate limiting with IP tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  RateLimiter,
  getRateLimiter,
  getClientIp,
  createRateLimitResponse,
} from '@/lib/rate-limiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 })
  })

  afterEach(() => {
    limiter.destroy()
  })

  describe('basic rate limiting', () => {
    it('allows requests within limit', () => {
      const result1 = limiter.checkAndRecord('192.168.1.1')
      const result2 = limiter.checkAndRecord('192.168.1.1')
      const result3 = limiter.checkAndRecord('192.168.1.1')

      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)
      expect(result3.allowed).toBe(true)
    })

    it('blocks requests over limit', () => {
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      const result4 = limiter.checkAndRecord('192.168.1.1')

      expect(result4.allowed).toBe(false)
    })

    it('tracks remaining requests', () => {
      const result1 = limiter.checkAndRecord('192.168.1.1')
      const result2 = limiter.checkAndRecord('192.168.1.1')
      const result3 = limiter.checkAndRecord('192.168.1.1')

      expect(result1.remaining).toBe(2)
      expect(result2.remaining).toBe(1)
      expect(result3.remaining).toBe(0)
    })

    it('returns limit info', () => {
      const result = limiter.checkAndRecord('192.168.1.1')
      expect(result.limit).toBe(3)
      expect(result.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
    })
  })

  describe('window reset', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('resets after window expires', () => {
      // Use up all requests
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      
      let result = limiter.checkAndRecord('192.168.1.1')
      expect(result.allowed).toBe(false)

      // Advance time past the window
      vi.advanceTimersByTime(1100)

      // Should be allowed again
      result = limiter.checkAndRecord('192.168.1.1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })
  })

  describe('multiple IPs', () => {
    it('tracks IPs separately', () => {
      // IP 1 uses all requests
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      const blocked = limiter.checkAndRecord('192.168.1.1')

      // IP 2 should still be allowed
      const allowed = limiter.checkAndRecord('192.168.1.2')

      expect(blocked.allowed).toBe(false)
      expect(allowed.allowed).toBe(true)
      expect(allowed.remaining).toBe(2)
    })
  })

  describe('check vs record', () => {
    it('check does not increment counter', () => {
      const check1 = limiter.check('192.168.1.1')
      const check2 = limiter.check('192.168.1.1')
      const check3 = limiter.check('192.168.1.1')

      // All checks should show same result (nothing recorded)
      expect(check1.remaining).toBe(2) // Would be 2 remaining after theoretical request
      expect(check2.remaining).toBe(2)
      expect(check3.remaining).toBe(2)
    })

    it('record increments counter', () => {
      limiter.record('192.168.1.1')
      limiter.record('192.168.1.1')
      
      const check = limiter.check('192.168.1.1')
      expect(check.remaining).toBe(0) // Only 1 more allowed
    })
  })

  describe('reset and clear', () => {
    it('reset clears specific IP', () => {
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.1')
      
      limiter.reset('192.168.1.1')

      const result = limiter.checkAndRecord('192.168.1.1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })

    it('clear removes all IPs', () => {
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.2')
      
      limiter.clear()

      const stats = limiter.getStats()
      expect(stats.trackedIps).toBe(0)
    })
  })

  describe('headers', () => {
    it('generates correct rate limit headers', () => {
      const result = limiter.checkAndRecord('192.168.1.1')
      const headers = limiter.getHeaders(result)

      expect(headers['X-RateLimit-Limit']).toBe('3')
      expect(headers['X-RateLimit-Remaining']).toBe('2')
      expect(headers['X-RateLimit-Reset']).toBeDefined()
    })
  })

  describe('cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('removes expired entries', () => {
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.2')

      expect(limiter.getStats().trackedIps).toBe(2)

      // Advance past window
      vi.advanceTimersByTime(1100)

      const cleaned = limiter.cleanup()

      expect(cleaned).toBe(2)
      expect(limiter.getStats().trackedIps).toBe(0)
    })
  })

  describe('stats', () => {
    it('returns limiter configuration', () => {
      const stats = limiter.getStats()

      expect(stats.windowMs).toBe(1000)
      expect(stats.maxRequests).toBe(3)
      expect(stats.trackedIps).toBe(0)
    })

    it('tracks number of IPs', () => {
      limiter.checkAndRecord('192.168.1.1')
      limiter.checkAndRecord('192.168.1.2')
      limiter.checkAndRecord('192.168.1.3')

      expect(limiter.getStats().trackedIps).toBe(3)
    })
  })
})

describe('getClientIp', () => {
  function createMockRequest(headers: Record<string, string>): Request {
    return {
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
    } as unknown as Request
  }

  it('extracts IP from x-forwarded-for', () => {
    const request = createMockRequest({
      'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
    })
    expect(getClientIp(request)).toBe('203.0.113.195')
  })

  it('extracts IP from x-vercel-forwarded-for', () => {
    const request = createMockRequest({
      'x-vercel-forwarded-for': '203.0.113.195',
    })
    expect(getClientIp(request)).toBe('203.0.113.195')
  })

  it('extracts IP from cf-connecting-ip', () => {
    const request = createMockRequest({
      'cf-connecting-ip': '203.0.113.195',
    })
    expect(getClientIp(request)).toBe('203.0.113.195')
  })

  it('extracts IP from x-real-ip', () => {
    const request = createMockRequest({
      'x-real-ip': '203.0.113.195',
    })
    expect(getClientIp(request)).toBe('203.0.113.195')
  })

  it('falls back to 127.0.0.1', () => {
    const request = createMockRequest({})
    expect(getClientIp(request)).toBe('127.0.0.1')
  })

  it('prioritizes x-forwarded-for over other headers', () => {
    const request = createMockRequest({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    })
    expect(getClientIp(request)).toBe('1.1.1.1')
  })
})

describe('createRateLimitResponse', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 })
  })

  afterEach(() => {
    limiter.destroy()
  })

  it('creates 429 response', () => {
    const result = {
      allowed: false,
      remaining: 0,
      resetAt: Math.floor(Date.now() / 1000) + 30,
      limit: 10,
    }

    const response = createRateLimitResponse(result, limiter)

    expect(response.status).toBe(429)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Retry-After')).toBeDefined()
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})

describe('getRateLimiter singleton', () => {
  it('returns same instance', () => {
    const limiter1 = getRateLimiter()
    const limiter2 = getRateLimiter()
    expect(limiter1).toBe(limiter2)
  })
})
