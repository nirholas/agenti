// Rate Limiting Implementation for QR Pay
// Per-IP and per-wallet rate limiting with graceful degradation

// In-memory store for rate limits (use Redis in production)
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
  blockedUntil?: number;
}

// Rate limit configuration per endpoint type
interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
  blockDurationMs: number; // How long to block after exceeding
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Swap quote - generous limits
  'swap-quote': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 30,            // 30 requests per minute
    blockDurationMs: 60 * 1000, // Block for 1 minute
  },
  // Swap execute - stricter limits
  'swap-execute': {
    windowMs: 60 * 1000,         // 1 minute
    maxRequests: 10,             // 10 executions per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  },
  // Token list - very generous
  'tokens': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 100,           // 100 requests per minute
    blockDurationMs: 30 * 1000, // Block for 30 seconds
  },
  // Chain list - very generous
  'chains': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 100,           // 100 requests per minute
    blockDurationMs: 30 * 1000, // Block for 30 seconds
  },
  // Prices - moderate limits
  'prices': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 60,            // 60 requests per minute (1/sec)
    blockDurationMs: 30 * 1000, // Block for 30 seconds
  },
  // Default fallback
  'default': {
    windowMs: 60 * 1000,
    maxRequests: 50,
    blockDurationMs: 60 * 1000,
  },
};

// Rate limit info returned to client
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the window resets
}

// Result of rate limit check
export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  retryAfter?: number; // Seconds until retry is allowed
}

/**
 * Check if a request is allowed under rate limits
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS['default'];
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();

  // Get or create entry
  let entry = rateLimitStore.get(key);

  // Check if blocked
  if (entry?.blocked && entry.blockedUntil && now < entry.blockedUntil) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      info: {
        limit: config.maxRequests,
        remaining: 0,
        reset: Math.ceil(entry.blockedUntil / 1000),
      },
      retryAfter,
    };
  }

  // Reset if window expired or no entry
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = {
      count: 0,
      windowStart: now,
      blocked: false,
    };
  }

  // Increment count
  entry.count++;

  // Check if exceeding limit
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.blockedUntil = now + config.blockDurationMs;
    rateLimitStore.set(key, entry);

    const retryAfter = Math.ceil(config.blockDurationMs / 1000);
    return {
      allowed: false,
      info: {
        limit: config.maxRequests,
        remaining: 0,
        reset: Math.ceil(entry.blockedUntil / 1000),
      },
      retryAfter,
    };
  }

  // Update store
  rateLimitStore.set(key, entry);

  // Calculate remaining and reset time
  const remaining = config.maxRequests - entry.count;
  const reset = Math.ceil((entry.windowStart + config.windowMs) / 1000);

  return {
    allowed: true,
    info: {
      limit: config.maxRequests,
      remaining,
      reset,
    },
  };
}

/**
 * Check rate limit for multiple identifiers (e.g., IP + wallet)
 */
export async function checkMultipleRateLimits(
  identifiers: string[],
  endpoint: string
): Promise<RateLimitResult> {
  // Check all identifiers and return the most restrictive result
  const results = await Promise.all(
    identifiers.map(id => checkRateLimit(id, endpoint))
  );

  // If any are not allowed, return that result
  const blocked = results.find(r => !r.allowed);
  if (blocked) {
    return blocked;
  }

  // Return the result with lowest remaining
  return results.reduce((min, curr) => 
    curr.info.remaining < min.info.remaining ? curr : min
  );
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string, endpoint?: string): void {
  if (endpoint) {
    rateLimitStore.delete(`${endpoint}:${identifier}`);
  } else {
    // Reset all endpoints for this identifier
    for (const key of rateLimitStore.keys()) {
      if (key.includes(`:${identifier}`)) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  endpoint: string
): RateLimitInfo | null {
  const config = RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS['default'];
  const key = `${endpoint}:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.ceil((Date.now() + config.windowMs) / 1000),
    };
  }

  const now = Date.now();

  // Window expired
  if (now - entry.windowStart >= config.windowMs) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.ceil((now + config.windowMs) / 1000),
    };
  }

  return {
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    reset: Math.ceil((entry.windowStart + config.windowMs) / 1000),
  };
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    // Parse endpoint from key to get config
    const endpoint = key.split(':')[0];
    const config = RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS['default'];

    // Remove if window expired and not blocked
    if (now - entry.windowStart >= config.windowMs && !entry.blocked) {
      rateLimitStore.delete(key);
      cleaned++;
    }
    // Remove if block expired
    else if (entry.blocked && entry.blockedUntil && now >= entry.blockedUntil) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cleanupExpiredEntries();
    if (cleaned > 0) {
      console.log(`[RateLimit] Cleaned up ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': info.reset.toString(),
  };
}

/**
 * Middleware helper for Next.js API routes
 */
export async function withRateLimit(
  request: Request,
  endpoint: string
): Promise<RateLimitResult> {
  // Get identifiers
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const wallet = request.headers.get('x-wallet-address');

  // Check rate limits
  const identifiers = wallet ? [ip, wallet] : [ip];
  return checkMultipleRateLimits(identifiers, endpoint);
}
