import { describe, test, expect, beforeEach } from "bun:test";
import { InMemoryRateLimiter } from "../../../src/auth/rate-limit/memory.js";
import type { RateLimiter } from "../../../src/auth/rate-limit/interface.js";

describe("InMemoryRateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  describe("Per-Minute Limit", () => {
    test("allows requests within per-minute limit", async () => {
      const config = { perMinute: 5, perDay: 100 };

      for (let i = 0; i < 5; i++) {
        const result = await limiter.check("token-1", config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
        await limiter.increment("token-1");
      }
    });

    test("blocks requests exceeding per-minute limit", async () => {
      const config = { perMinute: 3, perDay: 100 };

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        await limiter.increment("token-1");
      }

      // Should be blocked
      const result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test("provides accurate remaining count", async () => {
      const config = { perMinute: 10, perDay: 100 };

      await limiter.increment("token-1");
      await limiter.increment("token-1");

      const result = await limiter.check("token-1", config);
      expect(result.remaining).toBe(8); // 10 - 2
    });

    test("returns correct limit in result", async () => {
      const config = { perMinute: 50, perDay: 1000 };

      const result = await limiter.check("token-1", config);
      expect(result.limit).toBe(50);
    });

    test("returns resetAt timestamp", async () => {
      const config = { perMinute: 10, perDay: 100 };
      const before = new Date();

      const result = await limiter.check("token-1", config);

      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  describe("Per-Day Limit", () => {
    test("tracks daily usage independently from per-minute", async () => {
      const config = { perMinute: 100, perDay: 5 };

      for (let i = 0; i < 5; i++) {
        const result = await limiter.check("token-1", config);
        expect(result.allowed).toBe(true);
        await limiter.increment("token-1");
      }

      // Daily limit exceeded
      const result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(false);
    });

    test("allows up to daily limit", async () => {
      const config = { perMinute: 1000, perDay: 10 };

      for (let i = 0; i < 10; i++) {
        await limiter.increment("token-1");
      }

      const result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(false);
    });
  });

  describe("Token Isolation", () => {
    test("isolates rate limits per token", async () => {
      const config = { perMinute: 2, perDay: 100 };

      // Max out token-1
      await limiter.increment("token-1");
      await limiter.increment("token-1");

      // token-1 should be blocked
      const result1 = await limiter.check("token-1", config);
      expect(result1.allowed).toBe(false);

      // token-2 should not be affected
      const result2 = await limiter.check("token-2", config);
      expect(result2.allowed).toBe(true);
    });

    test("tracks usage separately for different tokens", async () => {
      const config = { perMinute: 10, perDay: 100 };

      await limiter.increment("token-1");
      await limiter.increment("token-1");
      await limiter.increment("token-1");

      await limiter.increment("token-2");

      const usage1 = await limiter.getUsage("token-1");
      const usage2 = await limiter.getUsage("token-2");

      expect(usage1.currentMinute).toBe(3);
      expect(usage2.currentMinute).toBe(1);
    });
  });

  describe("Usage Stats", () => {
    test("returns current minute usage", async () => {
      await limiter.increment("token-1");
      await limiter.increment("token-1");
      await limiter.increment("token-1");

      const usage = await limiter.getUsage("token-1");
      expect(usage.currentMinute).toBe(3);
    });

    test("returns current day usage", async () => {
      await limiter.increment("token-1");
      await limiter.increment("token-1");

      const usage = await limiter.getUsage("token-1");
      expect(usage.currentDay).toBe(2);
    });

    test("returns zero for unused token", async () => {
      const usage = await limiter.getUsage("unused-token");
      expect(usage.currentMinute).toBe(0);
      expect(usage.currentDay).toBe(0);
    });
  });

  describe("Reset", () => {
    test("resets rate limits for token", async () => {
      const config = { perMinute: 2, perDay: 100 };

      // Use up the limit
      await limiter.increment("token-1");
      await limiter.increment("token-1");

      // Should be blocked
      let result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(false);

      // Reset
      await limiter.reset("token-1");

      // Should be allowed again
      result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(true);
    });

    test("resets both minute and day counters", async () => {
      await limiter.increment("token-1");
      await limiter.increment("token-1");
      await limiter.increment("token-1");

      await limiter.reset("token-1");

      const usage = await limiter.getUsage("token-1");
      expect(usage.currentMinute).toBe(0);
      expect(usage.currentDay).toBe(0);
    });

    test("does not affect other tokens", async () => {
      await limiter.increment("token-1");
      await limiter.increment("token-2");

      await limiter.reset("token-1");

      const usage1 = await limiter.getUsage("token-1");
      const usage2 = await limiter.getUsage("token-2");

      expect(usage1.currentMinute).toBe(0);
      expect(usage2.currentMinute).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    test("handles zero limit", async () => {
      const config = { perMinute: 0, perDay: 100 };

      const result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test("handles very high limits", async () => {
      const config = { perMinute: 1000000, perDay: 10000000 };

      for (let i = 0; i < 100; i++) {
        await limiter.increment("token-1");
      }

      const result = await limiter.check("token-1", config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1000000 - 100);
    });

    test("increment without prior check", async () => {
      // Should not throw error
      await limiter.increment("new-token");

      const usage = await limiter.getUsage("new-token");
      expect(usage.currentMinute).toBe(1);
    });
  });
});
