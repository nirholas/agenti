/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  perMinute: number;
  perDay: number;
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Rate limiter interface
 * Track and enforce rate limits per token
 */
export interface RateLimiter {
  /**
   * Check if request is within rate limits
   * Does NOT increment counter
   */
  check(tokenId: string, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Increment rate limit counter
   * Call after successful request
   */
  increment(tokenId: string): Promise<void>;

  /**
   * Get current usage stats
   */
  getUsage(tokenId: string): Promise<{
    currentMinute: number;
    currentDay: number;
  }>;

  /**
   * Reset rate limits (for testing or manual override)
   */
  reset(tokenId: string): Promise<void>;
}
