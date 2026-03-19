import type {
  RateLimitConfig,
  RateLimitResult,
  RateLimiter,
} from "./interface.js";

interface UsageWindow {
  minute: number;
  day: number;
  minuteStart: Date;
  dayStart: Date;
}

/**
 * In-memory rate limiter implementation
 * Tracks per-minute and per-day usage for tokens
 * WARNING: All data is lost on process restart
 */
export class InMemoryRateLimiter implements RateLimiter {
  private usage = new Map<string, UsageWindow>();

  async check(
    tokenId: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const window = this.getOrCreateWindow(tokenId, now);

    // Check per-minute limit
    if (window.minute >= config.perMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: this.getNextMinute(window.minuteStart),
        limit: config.perMinute,
      };
    }

    // Check per-day limit
    if (window.day >= config.perDay) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: this.getNextDay(window.dayStart),
        limit: config.perDay,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        config.perMinute - window.minute,
        config.perDay - window.day,
      ),
      resetAt: this.getNextMinute(window.minuteStart),
      limit: config.perMinute,
    };
  }

  async increment(tokenId: string): Promise<void> {
    const now = new Date();
    const window = this.getOrCreateWindow(tokenId, now);

    window.minute++;
    window.day++;

    this.usage.set(tokenId, window);
  }

  async getUsage(tokenId: string): Promise<{
    currentMinute: number;
    currentDay: number;
  }> {
    const now = new Date();
    const window = this.getOrCreateWindow(tokenId, now);

    return {
      currentMinute: window.minute,
      currentDay: window.day,
    };
  }

  async reset(tokenId: string): Promise<void> {
    this.usage.delete(tokenId);
  }

  private getOrCreateWindow(tokenId: string, now: Date): UsageWindow {
    const existing = this.usage.get(tokenId);

    if (!existing) {
      return {
        minute: 0,
        day: 0,
        minuteStart: now,
        dayStart: now,
      };
    }

    // Check if minute window has expired
    const minuteExpired =
      now.getTime() - existing.minuteStart.getTime() >= 60000;
    if (minuteExpired) {
      existing.minute = 0;
      existing.minuteStart = now;
    }

    // Check if day window has expired (24 hours)
    const dayExpired =
      now.getTime() - existing.dayStart.getTime() >= 86400000;
    if (dayExpired) {
      existing.day = 0;
      existing.dayStart = now;
    }

    return existing;
  }

  private getNextMinute(from: Date): Date {
    return new Date(from.getTime() + 60000);
  }

  private getNextDay(from: Date): Date {
    return new Date(from.getTime() + 86400000);
  }
}
