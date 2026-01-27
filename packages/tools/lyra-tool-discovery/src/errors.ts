// Custom error classes for lyra-tool-discovery

/**
 * Base error class for all Lyra errors
 */
export class LyraError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'LyraError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when an API key is missing or invalid
 */
export class APIKeyError extends LyraError {
  constructor(provider: 'openai' | 'anthropic', message?: string) {
    super(
      message || `Missing or invalid API key for ${provider}. Set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} environment variable.`,
      'API_KEY_ERROR'
    );
    this.name = 'APIKeyError';
  }
}

/**
 * Thrown when rate limited by an API
 */
export class RateLimitError extends LyraError {
  constructor(
    public readonly provider: 'github' | 'npm' | 'openai' | 'anthropic',
    public readonly retryAfter?: number,
    cause?: Error
  ) {
    super(
      `Rate limited by ${provider}${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT_ERROR',
      cause
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Thrown when a network request fails
 */
export class NetworkError extends LyraError {
  constructor(
    public readonly url: string,
    public readonly status?: number,
    cause?: Error
  ) {
    super(
      `Network request failed: ${url}${status ? ` (status: ${status})` : ''}`,
      'NETWORK_ERROR',
      cause
    );
    this.name = 'NetworkError';
  }
}

/**
 * Thrown when AI analysis fails
 */
export class AnalysisError extends LyraError {
  constructor(
    public readonly toolName: string,
    message?: string,
    cause?: Error
  ) {
    super(
      message || `Failed to analyze tool: ${toolName}`,
      'ANALYSIS_ERROR',
      cause
    );
    this.name = 'AnalysisError';
  }
}

/**
 * Thrown when AI returns invalid/unparseable response
 */
export class AIResponseError extends LyraError {
  constructor(
    public readonly provider: 'openai' | 'anthropic',
    public readonly rawResponse?: string,
    cause?: Error
  ) {
    super(
      `Invalid response from ${provider} AI`,
      'AI_RESPONSE_ERROR',
      cause
    );
    this.name = 'AIResponseError';
  }
}

/**
 * Thrown when validation fails (e.g., zod schema)
 */
export class ValidationError extends LyraError {
  constructor(
    message: string,
    public readonly field?: string,
    cause?: Error
  ) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof NetworkError) return true;
  return false;
}

/**
 * Extract retry-after from response headers
 */
export function getRetryAfter(response: Response): number | undefined {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds;
  }
  
  // GitHub uses x-ratelimit-reset (Unix timestamp)
  const resetAt = response.headers.get('x-ratelimit-reset');
  if (resetAt) {
    const resetTime = parseInt(resetAt, 10) * 1000;
    const now = Date.now();
    if (resetTime > now) {
      return Math.ceil((resetTime - now) / 1000);
    }
  }
  
  return undefined;
}
