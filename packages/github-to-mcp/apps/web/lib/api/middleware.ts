/**
 * API Middleware Utilities
 *
 * Shared middleware functions for rate limiting, CORS, and request handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { RateLimitHeaders } from './types';

// ============================================================================
// Request ID Tracking
// ============================================================================

/**
 * Gets or generates a request ID for tracking
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || randomUUID();
}

/**
 * Creates headers with request ID
 */
export function withRequestId(
  headers: HeadersInit = {},
  requestId: string
): HeadersInit {
  return {
    ...headers,
    'X-Request-ID': requestId,
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Global rate limit storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 60,
  windowMs: 60 * 1000, // 1 minute
};

export const RELAXED_RATE_LIMIT: RateLimitConfig = {
  limit: 300,
  windowMs: 60 * 1000,
};

export const STRICT_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60 * 1000,
};

export const NO_RATE_LIMIT: RateLimitConfig = {
  limit: 999999,
  windowMs: 60 * 1000,
};

/**
 * Gets the client identifier for rate limiting
 */
export function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return ip;
}

/**
 * Checks rate limit and returns result
 */
export function checkRateLimit(
  clientId: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): {
  allowed: boolean;
  headers: RateLimitHeaders;
  retryAfter?: number;
} {
  cleanupExpiredEntries();

  const now = Date.now();
  const key = config.keyPrefix ? `${config.keyPrefix}:${clientId}` : clientId;

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, config.limit - entry.count);
  const resetIn = Math.ceil((entry.resetAt - now) / 1000);

  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': String(config.limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetIn),
  };

  if (entry.count > config.limit) {
    return {
      allowed: false,
      headers,
      retryAfter: resetIn,
    };
  }

  return {
    allowed: true,
    headers,
  };
}

/**
 * Creates a rate limit exceeded response
 */
export function rateLimitResponse(
  headers: RateLimitHeaders,
  retryAfter: number,
  requestId: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
        retryAfter,
      },
    },
    {
      status: 429,
      headers: {
        ...headers,
        'Retry-After': String(retryAfter),
        'X-Request-ID': requestId,
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

// ============================================================================
// CORS
// ============================================================================

export interface CorsConfig {
  origin?: string;
  methods?: string[];
  headers?: string[];
  maxAge?: number;
}

export const DEFAULT_CORS: CorsConfig = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
};

/**
 * Creates CORS headers
 */
export function corsHeaders(config: CorsConfig = DEFAULT_CORS): HeadersInit {
  return {
    'Access-Control-Allow-Origin': config.origin || '*',
    'Access-Control-Allow-Methods': config.methods?.join(', ') || 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': config.headers?.join(', ') || 'Content-Type',
    'Access-Control-Max-Age': String(config.maxAge || 86400),
  };
}

/**
 * Creates an OPTIONS response for CORS preflight
 */
export function corsPreflightResponse(
  config: CorsConfig = DEFAULT_CORS
): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(config),
  });
}

// ============================================================================
// Request Body Handling
// ============================================================================

export interface BodyParseOptions {
  /** Maximum body size in bytes */
  maxSize?: number;
}

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * Safely parses JSON body with size limit
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest,
  options: BodyParseOptions = {}
): Promise<T> {
  const maxSize = options.maxSize ?? DEFAULT_MAX_BODY_SIZE;

  // Check content-length header first
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new BodyTooLargeError(maxSize);
  }

  // Read body with size limit
  const reader = request.body?.getReader();
  if (!reader) {
    return {} as T;
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxSize) {
        throw new BodyTooLargeError(maxSize);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  const body = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  const text = new TextDecoder().decode(body);
  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

export class BodyTooLargeError extends Error {
  readonly statusCode = 413;
  readonly code = 'BODY_TOO_LARGE';

  constructor(maxSize: number) {
    super(`Request body exceeds maximum size of ${maxSize} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

export class InvalidJsonError extends Error {
  readonly statusCode = 400;
  readonly code = 'INVALID_JSON';

  constructor() {
    super('Request body is not valid JSON');
    this.name = 'InvalidJsonError';
  }
}

// ============================================================================
// Combined Middleware Helper
// ============================================================================

export interface ApiMiddlewareConfig {
  rateLimit?: RateLimitConfig;
  cors?: CorsConfig;
  maxBodySize?: number;
}

export interface ApiContext {
  requestId: string;
  clientId: string;
  rateLimitHeaders: RateLimitHeaders;
}

/**
 * Applies common middleware and returns context
 * Returns null if rate limited (response already sent)
 */
export async function applyMiddleware(
  request: NextRequest,
  config: ApiMiddlewareConfig = {}
): Promise<{ context: ApiContext } | { response: NextResponse }> {
  const requestId = getRequestId(request);
  const clientId = getClientId(request);

  // Check rate limit
  const rateLimit = checkRateLimit(clientId, config.rateLimit);
  if (!rateLimit.allowed) {
    return {
      response: rateLimitResponse(
        rateLimit.headers,
        rateLimit.retryAfter!,
        requestId
      ),
    };
  }

  return {
    context: {
      requestId,
      clientId,
      rateLimitHeaders: rateLimit.headers,
    },
  };
}
