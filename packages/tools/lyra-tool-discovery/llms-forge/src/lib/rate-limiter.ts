/**
 * Rate Limiter for llms-forge
 * Sliding window algorithm with IP-based limiting
 * Pure TypeScript implementation with no external dependencies
 */

export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number
  /** Maximum requests per window (default: 30) */
  maxRequests?: number
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Remaining requests in current window */
  remaining: number
  /** Unix timestamp when the limit resets */
  resetAt: number
  /** Maximum requests allowed per window */
  limit: number
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
}

interface WindowEntry {
  count: number
  windowStart: number
}

/**
 * Sliding Window Rate Limiter
 * Uses a fixed window approach with sliding window approximation
 */
export class RateLimiter {
  private windows: Map<string, WindowEntry>
  private readonly windowMs: number
  private readonly maxRequests: number
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: RateLimitConfig = {}) {
    this.windows = new Map()
    this.windowMs = config.windowMs ?? 60 * 1000 // 1 minute default
    this.maxRequests = config.maxRequests ?? 30 // 30 requests default

    // Auto-cleanup stale entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup()
      }, 5 * 60 * 1000)
    }
  }

  /**
   * Check if a request from the given IP is allowed
   */
  check(ip: string): RateLimitResult {
    const now = Date.now()
    const entry = this.windows.get(ip)

    // If no entry exists or window has completely passed, start fresh
    if (!entry || now - entry.windowStart >= this.windowMs) {
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: Math.ceil((now + this.windowMs) / 1000),
        limit: this.maxRequests,
      }
    }

    // Calculate remaining requests
    const remaining = Math.max(0, this.maxRequests - entry.count - 1)
    const resetAt = Math.ceil((entry.windowStart + this.windowMs) / 1000)

    return {
      allowed: entry.count < this.maxRequests,
      remaining: entry.count < this.maxRequests ? remaining : 0,
      resetAt,
      limit: this.maxRequests,
    }
  }

  /**
   * Record a request from the given IP
   * Call this after check() if the request is allowed
   */
  record(ip: string): RateLimitResult {
    const now = Date.now()
    const entry = this.windows.get(ip)

    // If no entry exists or window has completely passed, start fresh
    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.windows.set(ip, {
        count: 1,
        windowStart: now,
      })
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: Math.ceil((now + this.windowMs) / 1000),
        limit: this.maxRequests,
      }
    }

    // Increment count
    entry.count++
    this.windows.set(ip, entry)

    const remaining = Math.max(0, this.maxRequests - entry.count)
    const resetAt = Math.ceil((entry.windowStart + this.windowMs) / 1000)

    return {
      allowed: entry.count <= this.maxRequests,
      remaining,
      resetAt,
      limit: this.maxRequests,
    }
  }

  /**
   * Check and record a request in one call
   * Returns the result before incrementing
   */
  checkAndRecord(ip: string): RateLimitResult {
    const checkResult = this.check(ip)
    if (checkResult.allowed) {
      return this.record(ip)
    }
    return checkResult
  }

  /**
   * Get rate limit headers for a response
   */
  getHeaders(result: RateLimitResult): RateLimitHeaders {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetAt),
    }
  }

  /**
   * Reset the limit for a specific IP (useful for testing)
   */
  reset(ip: string): void {
    this.windows.delete(ip)
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.windows.clear()
  }

  /**
   * Clean up expired window entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    const entries = Array.from(this.windows.entries())
    for (const [ip, entry] of entries) {
      if (now - entry.windowStart >= this.windowMs) {
        this.windows.delete(ip)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * Get statistics about the rate limiter
   */
  getStats(): {
    trackedIps: number
    windowMs: number
    maxRequests: number
  } {
    return {
      trackedIps: this.windows.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    }
  }

  /**
   * Destroy the rate limiter and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// Singleton rate limiter instance
let rateLimiterInstance: RateLimiter | null = null

/**
 * Get the singleton rate limiter instance
 */
export function getRateLimiter(config?: RateLimitConfig): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(config)
  }
  return rateLimiterInstance
}

/**
 * Extract client IP from request headers
 * Handles various proxy headers used by Vercel, Cloudflare, etc.
 */
export function getClientIp(request: Request): string {
  // Vercel and many reverse proxies use x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs: client, proxy1, proxy2, ...
    // The first one is the original client
    const ips = forwardedFor.split(',').map((ip) => ip.trim())
    if (ips[0]) {
      return ips[0]
    }
  }

  // Vercel specific header
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim()
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Real IP header (nginx)
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a default value for local development
  return '127.0.0.1'
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  rateLimiter: RateLimiter
): Response {
  const headers = rateLimiter.getHeaders(result)
  const retryAfter = result.resetAt - Math.floor(Date.now() / 1000)

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter)),
        ...headers,
      },
    }
  )
}
