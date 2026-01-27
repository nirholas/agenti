import createDebug from 'debug';
import { RateLimitError, NetworkError, isRetryableError, getRetryAfter } from '../errors.js';

const debug = createDebug('lyra:retry');

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  const delay = Math.min(exponentialDelay + jitter, maxDelayMs);
  return Math.floor(delay);
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry if error is not retryable
      if (!isRetryableError(error)) {
        debug('Non-retryable error, throwing immediately: %s', lastError.message);
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= opts.maxRetries) {
        debug('Max retries reached (%d), throwing', opts.maxRetries);
        break;
      }

      // Calculate delay
      let delayMs: number;
      if (error instanceof RateLimitError && error.retryAfter) {
        delayMs = error.retryAfter * 1000;
      } else {
        delayMs = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
      }

      debug('Retry attempt %d/%d after %dms: %s', attempt + 1, opts.maxRetries, delayMs, lastError.message);
      
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, lastError, delayMs);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Fetch with automatic retry and rate limit handling
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    debug('Fetching: %s', url);
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = getRetryAfter(response);
      throw new RateLimitError('github', retryAfter);
    }

    if (response.status === 403) {
      // GitHub returns 403 when rate limited
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        const retryAfter = getRetryAfter(response);
        throw new RateLimitError('github', retryAfter);
      }
    }

    if (!response.ok && response.status >= 500) {
      throw new NetworkError(url, response.status);
    }

    return response;
  }, retryOptions);
}
