/**
 * HTTP utilities with rate limiting + retry for API calls.
 */

import { RateLimiter, type RateLimitConfig } from '../security';
import { retry, type RetryConfig } from '../infra/retry';
import { logger } from './logger';

export interface HttpRetryConfig {
  enabled?: boolean;
  maxAttempts?: number;
  minDelay?: number;
  maxDelay?: number;
  jitter?: number;
  backoffMultiplier?: number;
  methods?: string[];
}

export interface HttpRateLimitConfig {
  enabled?: boolean;
  defaultRateLimit?: RateLimitConfig;
  perHost?: Record<string, RateLimitConfig>;
  retry?: HttpRetryConfig;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
};

const DEFAULT_RETRY: Required<HttpRetryConfig> = {
  enabled: true,
  maxAttempts: 3,
  minDelay: 500,
  maxDelay: 30_000,
  jitter: 0.1,
  backoffMultiplier: 2,
  methods: ['GET', 'HEAD', 'OPTIONS'],
};

/** Default per-request timeout (30 seconds) to prevent hanging requests */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

type FetchInput = string | URL | Request;

let originalFetch: typeof fetch | null = null;
let httpConfig: HttpRateLimitConfig = {
  enabled: true,
  defaultRateLimit: DEFAULT_RATE_LIMIT,
  perHost: {},
  retry: DEFAULT_RETRY,
};

const hostLimiters = new Map<string, RateLimiter>();
const hostCooldowns = new Map<string, number>();
const MAX_HOST_ENTRIES = 500;

function normalizeMethod(method?: string): string {
  return (method || 'GET').toUpperCase();
}

function getHostKey(input: FetchInput): string | null {
  const urlText = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const parsed = new URL(urlText);
    return parsed.host;
  } catch {
    return null;
  }
}

function resolveRateLimit(host: string): RateLimitConfig | null {
  if (httpConfig.enabled === false) return null;
  return httpConfig.perHost?.[host] || httpConfig.defaultRateLimit || null;
}

function getLimiter(host: string, config: RateLimitConfig): RateLimiter {
  const existing = hostLimiters.get(host);
  if (existing) return existing;
  // Evict oldest entries if over limit to prevent memory leaks
  if (hostLimiters.size >= MAX_HOST_ENTRIES) {
    const firstKey = hostLimiters.keys().next().value;
    if (firstKey) hostLimiters.delete(firstKey);
  }
  const limiter = new RateLimiter(config);
  hostLimiters.set(host, limiter);
  return limiter;
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const parsed = Date.parse(headerValue);
  if (!Number.isNaN(parsed)) {
    const delta = parsed - Date.now();
    return delta > 0 ? delta : null;
  }
  return null;
}

function shouldRetryMethod(method: string, config?: HttpRetryConfig): boolean {
  const retryConfig = config || DEFAULT_RETRY;
  if (retryConfig.enabled === false) return false;
  const methods = retryConfig.methods?.length ? retryConfig.methods : DEFAULT_RETRY.methods;
  return methods.includes(method);
}

async function waitForCooldown(host: string): Promise<void> {
  const until = hostCooldowns.get(host);
  if (!until) return;
  const now = Date.now();
  if (until <= now) {
    hostCooldowns.delete(host);
    return;
  }
  const delay = until - now;
  logger.warn({ host, delay }, 'HTTP cooldown active; waiting');
  await retry.sleep(delay);
}

async function applyRateLimit(host: string): Promise<void> {
  const config = resolveRateLimit(host);
  if (!config) return;
  const limiter = getLimiter(host, config);
  const result = limiter.check(host);
  if (!result.allowed) {
    const waitMs = Math.max(0, result.resetIn);
    logger.warn({ host, waitMs }, 'HTTP rate limit hit; waiting');
    await retry.sleep(waitMs);
  }
}

async function fetchWithControl(
  input: FetchInput,
  init?: RequestInit
): Promise<Response> {
  if (!originalFetch) {
    return fetch(input, init);
  }

  const host = getHostKey(input);
  if (!host) {
    return originalFetch(input, init);
  }

  await waitForCooldown(host);
  await applyRateLimit(host);

  const method = normalizeMethod(init?.method || (input instanceof Request ? input.method : undefined));
  const retryConfig = httpConfig.retry || DEFAULT_RETRY;
  const allowRetry = shouldRetryMethod(method, retryConfig);
  const maxAttempts = allowRetry ? (retryConfig.maxAttempts ?? DEFAULT_RETRY.maxAttempts) : 1;
  const minDelay = retryConfig.minDelay ?? DEFAULT_RETRY.minDelay;
  const maxDelay = retryConfig.maxDelay ?? DEFAULT_RETRY.maxDelay;
  const jitter = retryConfig.jitter ?? DEFAULT_RETRY.jitter;
  const backoffMultiplier = retryConfig.backoffMultiplier ?? DEFAULT_RETRY.backoffMultiplier;

  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Add default timeout if caller hasn't provided an AbortSignal
      const fetchInit = (init?.signal) ? init : {
        ...init,
        signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
      };
      const response = await originalFetch(input, fetchInit);
      lastResponse = response;
      if (!allowRetry) return response;

      if (response.status === 429 || response.status >= 500) {
        if (attempt >= maxAttempts) return response;
        const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
        if (retryAfter) {
          hostCooldowns.set(host, Date.now() + retryAfter);
        }
        const delay = retryAfter ?? retry.calculateDelay(attempt, {
          minDelay,
          maxDelay,
          jitter,
          backoffMultiplier,
        });
        logger.warn({ host, status: response.status, delay }, 'HTTP retry scheduled');
        await retry.sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (!allowRetry || attempt >= maxAttempts) {
        throw error;
      }
      const delay = retry.calculateDelay(attempt, {
        minDelay,
        maxDelay,
        jitter,
        backoffMultiplier,
      });
      logger.warn({ host, delay, error }, 'HTTP request failed; retrying');
      await retry.sleep(delay);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError;
}

export function configureHttpClient(config?: HttpRateLimitConfig): void {
  if (!config) return;
  httpConfig = {
    ...httpConfig,
    ...config,
    perHost: { ...(httpConfig.perHost || {}), ...(config.perHost || {}) },
    retry: { ...(httpConfig.retry || {}), ...(config.retry || {}) },
  };
  hostLimiters.clear();
}

export function installHttpClient(config?: HttpRateLimitConfig): void {
  if (!originalFetch) {
    originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = fetchWithControl;
  }
  if (config) configureHttpClient(config);
}

export function getHttpClientConfig(): HttpRateLimitConfig {
  return httpConfig;
}
