import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "RateLimit" });

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: Custom identifier function (defaults to IP address) */
  identifier?: (request: Request) => string;
  /** Optional: Custom message when rate limit exceeded */
  message?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Time until window resets (ms) */
  resetMs: number;
  /** Total limit */
  limit: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval !== null) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of store.entries()) {
      if (entry.resetTime < now) {
        store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug({ cleaned, storeSize: store.size }, "Cleaned up rate limit entries");
    }
  }, 60000); // Cleanup every minute
}

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor !== null) {
    const ip = forwardedFor.split(",")[0];
    if (ip) {
      return ip.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp !== null) {
    return realIp;
  }

  const userAgent = request.headers.get("user-agent") || "unknown";
  return `ua:${hashString(userAgent)}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function checkRateLimit(request: Request, config: RateLimitConfig): RateLimitResult {
  startCleanup(); // Ensure cleanup is running

  const identifier = config.identifier ? config.identifier(request) : getClientIdentifier(request);

  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.windowMs;
    store.set(identifier, {
      count: 1,
      resetTime,
    });

    logger.debug(
      {
        identifier,
        count: 1,
        limit: config.maxRequests,
        resetTime,
      },
      "Rate limit: new window"
    );

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetMs: config.windowMs,
      limit: config.maxRequests,
    };
  }

  if (entry.count >= config.maxRequests) {
    const resetMs = entry.resetTime - now;

    logger.warn(
      {
        identifier,
        count: entry.count,
        limit: config.maxRequests,
        resetMs,
      },
      "Rate limit exceeded"
    );

    return {
      allowed: false,
      remaining: 0,
      resetMs,
      limit: config.maxRequests,
    };
  }

  entry.count++;
  store.set(identifier, entry);

  logger.debug(
    {
      identifier,
      count: entry.count,
      limit: config.maxRequests,
    },
    "Rate limit: incremented"
  );

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetMs: entry.resetTime - now,
    limit: config.maxRequests,
  };
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async function rateLimit(request: Request): Promise<RateLimitResult> {
    return checkRateLimit(request, config);
  };
}

export function createRateLimitResponse(result: RateLimitResult, message?: string): Response {
  const body = {
    error: "Too Many Requests",
    code: "rate_limit_exceeded",
    message: message || "You have exceeded the rate limit. Please try again later.",
    limit: result.limit,
    remaining: result.remaining,
    resetIn: Math.ceil(result.resetMs / 1000), // seconds
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": result.limit.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": new Date(Date.now() + result.resetMs).toISOString(),
      "Retry-After": Math.ceil(result.resetMs / 1000).toString(),
    },
  });
}

export function addRateLimitHeaders(response: Response, result: RateLimitResult): Response {
  const newResponse = new Response(response.body, response);

  newResponse.headers.set("X-RateLimit-Limit", result.limit.toString());
  newResponse.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  newResponse.headers.set("X-RateLimit-Reset", new Date(Date.now() + result.resetMs).toISOString());

  return newResponse;
}

export function clearRateLimit(identifier: string): void {
  store.delete(identifier);
  logger.info({ identifier }, "Rate limit cleared");
}

export function getRateLimitStatus(identifier: string): RateLimitEntry | null {
  return store.get(identifier) || null;
}

export function clearAllRateLimits(): void {
  const size = store.size;
  store.clear();
  logger.info({ cleared: size }, "All rate limits cleared");
}
