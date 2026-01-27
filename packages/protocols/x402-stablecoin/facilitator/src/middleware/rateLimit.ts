/**
 * Rate Limiting Middleware
 * 
 * Configurable rate limiting for API endpoints
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from './logger.js';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Skip successful requests from rate limit */
  skipSuccessfulRequests?: boolean;
  /** Skip failed requests from rate limit */
  skipFailedRequests?: boolean;
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.maxRequests,
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skipSuccessfulRequests: finalConfig.skipSuccessfulRequests,
    skipFailedRequests: finalConfig.skipFailedRequests,
    
    // Custom key generator (use IP address)
    keyGenerator: (req: Request): string => {
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    
    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(finalConfig.windowMs / 1000),
        message: `Rate limit exceeded. Please retry after ${Math.ceil(finalConfig.windowMs / 1000)} seconds.`,
      });
    },

    // Skip rate limiting for health checks
    skip: (req: Request): boolean => {
      return req.path === '/health';
    },
  });
}

/**
 * Stricter rate limiter for settlement endpoints
 */
export function createSettlementRateLimiter() {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // Lower limit for settlements
  });
}

/**
 * Lenient rate limiter for verification endpoints
 */
export function createVerificationRateLimiter() {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // Higher limit for verifications
  });
}

/**
 * Rate limiter for quote endpoints
 */
export function createQuoteRateLimiter() {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500, // Very high limit for quotes
  });
}
