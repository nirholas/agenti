# Integrate: Crypto Intelligence & Anomaly Detection

status: complete

## Source repos
- https://github.com/nirholas/crypto-vision (200+ endpoints, 58 AI agents, anomaly detection)
- https://github.com/nirholas/cryptocurrency.cv (200+ news sources, 662K articles, LLM API)

## Goal
Extract two high-value patterns from crypto-vision and add them to agenti:
1. **Circuit breaker** — resilient fetch with exponential backoff + per-host failure tracking
2. **Anomaly detection** — statistical price anomaly detection (Modified Z-Score + EWMA)

These are standalone utilities with no framework deps that improve agent reliability
and give agents the ability to detect unusual market conditions.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/crypto-vision /tmp/crypto-vision
git clone https://github.com/nirholas/cryptocurrency.cv /tmp/cryptocurrency.cv
```
Read:
- `/tmp/crypto-vision/src/lib/fetcher.ts` (circuit breaker + backoff)
- `/tmp/crypto-vision/src/lib/anomaly.ts` (Modified Z-Score + EWMA)
- `/tmp/crypto-vision/src/lib/cache.ts` (two-tier LRU + stale-while-revalidate)
- `/tmp/cryptocurrency.cv/` (news API endpoint structure)

### 2. Create `packages/sdk/src/resilience.ts`

```ts
export interface RetryOptions {
  maxRetries?: number       // default: 3
  baseDelayMs?: number      // default: 500
  maxDelayMs?: number       // default: 10000
  jitter?: boolean          // default: true
}

export interface CircuitBreakerOptions extends RetryOptions {
  failureThreshold?: number    // open circuit after N failures (default: 5)
  recoveryTimeMs?: number      // half-open after N ms (default: 30000)
}

/**
 * Resilient fetch with exponential backoff + jitter.
 * Retries on 429, 503, network errors. Respects Retry-After header.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response>

/**
 * Per-host circuit breaker.
 * Tracks failures per hostname and stops calling hosts that are consistently failing.
 * Returns a fetch-compatible function.
 */
export function createCircuitBreaker(
  options?: CircuitBreakerOptions
): (url: string, init?: RequestInit) => Promise<Response>

/**
 * Simple in-process cache with TTL and stale-while-revalidate.
 * Key → { value, expiresAt, staleAt }
 */
export class ResponseCache {
  constructor(options?: { maxSize?: number; defaultTtlMs?: number })
  
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T>
}
```

### 3. Create `packages/sdk/src/anomaly.ts`

```ts
export interface PricePoint {
  timestamp: number
  price: number
  volume?: number
}

export type AnomalyType =
  | 'spike_up'      // sudden price spike upward
  | 'spike_down'    // sudden price drop
  | 'volume_surge'  // unusual volume
  | 'volatility'    // volatility exceeds normal range
  | 'trend_break'   // break from established trend

export interface Anomaly {
  type: AnomalyType
  severity: 'low' | 'medium' | 'high'
  timestamp: number
  price: number
  score: number      // deviation in standard deviations
  message: string
}

/**
 * Detect price anomalies using Modified Z-Score.
 * More robust than standard Z-Score because it uses median instead of mean.
 * Returns anomalies sorted by timestamp.
 */
export function detectAnomalies(
  prices: PricePoint[],
  options?: {
    threshold?: number     // z-score threshold, default: 3.5
    windowSize?: number    // rolling window, default: 20
    detectTypes?: AnomalyType[]
  }
): Anomaly[]

/**
 * Exponentially weighted moving average (EWMA) with configurable decay.
 * Useful for smoothing noisy price data before anomaly detection.
 */
export function ewma(values: number[], alpha?: number): number[]

/**
 * Get the current volatility (standard deviation of log returns) for a price series.
 */
export function getVolatility(prices: number[], windowSize?: number): number

/**
 * Calculate rolling Z-score for each point in the series.
 */
export function rollingZScore(values: number[], windowSize?: number): number[]
```

### 4. Add MCP tools to `packages/mcp/src/server.ts`

**`detect_price_anomalies`**
- Input: `{ coin_id: string, days?: number, threshold?: number }`
- Fetches OHLCV from CoinGecko, runs anomaly detection
- Returns list of anomalies found in the price series
- Useful for: agents monitoring for unusual market moves

**`get_market_volatility`**
- Input: `{ coin_id: string, days?: number }`
- Returns current and historical volatility metrics
- Useful for: agents deciding position sizes

**`get_crypto_news_feed`**
- Input: `{ query?: string, limit?: number, language?: string }`
- Fetches latest news from cryptocurrency.cv free API
- Returns headlines with source, timestamp, and summary
- Useful for: agents staying current on market events

### 5. Export from SDK
```ts
// packages/sdk/src/index.ts
export { fetchWithRetry, createCircuitBreaker, ResponseCache } from './resilience.js'
export { detectAnomalies, ewma, getVolatility, rollingZScore } from './anomaly.js'
export type { Anomaly, AnomalyType, PricePoint, RetryOptions, CircuitBreakerOptions } from './anomaly.js'
```

## Sensitivity check
crypto-vision is open source. Modified Z-Score is a published statistical method
(Iglewicz & Hoaglin, 1993). EWMA is a standard algorithm used everywhere.
The circuit breaker pattern is from release.it / opossum. All safe to rewrite
from first principles. The news API (cryptocurrency.cv) is a free public API.

## Output files
- `packages/sdk/src/resilience.ts`
- `packages/sdk/src/anomaly.ts`
- Updated `packages/mcp/src/server.ts` (3 new tools)
- Updated `packages/sdk/src/index.ts`

Mark this file's status as `complete` when done.
