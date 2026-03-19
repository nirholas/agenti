import type { ServerConfig } from '../config';

export class RateLimiter {
  private static readonly MAX_KEYS = 10_000;
  private windows = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Remove expired entries with a single slice instead of repeated shift()
    const firstValid = timestamps.findIndex((t) => t >= cutoff);
    if (firstValid > 0) {
      timestamps = timestamps.slice(firstValid);
      this.windows.set(key, timestamps);
    } else if (firstValid === -1) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    if (timestamps.length >= this.maxRequests) {
      return false;
    }

    timestamps.push(now);

    if (this.windows.size > RateLimiter.MAX_KEYS) {
      this.cleanup();
      if (this.windows.size > RateLimiter.MAX_KEYS) {
        return false;
      }
    }

    return true;
  }

  /** Remove entries where all timestamps have expired */
  cleanup(): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let removed = 0;

    for (const [key, timestamps] of this.windows) {
      if (timestamps.length === 0 || timestamps.every((ts) => ts < cutoff)) {
        this.windows.delete(key);
        removed++;
      }
    }

    return removed;
  }

  reset(): void {
    this.windows.clear();
  }
}

export function createRateLimiters(config: ServerConfig['rateLimits']) {
  return {
    global: new RateLimiter(config.global, 60_000),
    perIp: new RateLimiter(config.perIp, 60_000),
    perWallet: new RateLimiter(config.perWallet, 60_000),
    settlePerWallet: new RateLimiter(config.settlePerWallet, 60_000),
  };
}
