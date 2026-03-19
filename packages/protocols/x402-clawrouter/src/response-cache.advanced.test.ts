import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResponseCache } from "./response-cache.js";

describe("ResponseCache Advanced Edge Cases", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache();
  });

  describe("OpenAI API request variations", () => {
    it("should differentiate requests with different temperature", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        temperature: 0.7,
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        temperature: 0.9,
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should differentiate requests with different max_tokens", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 100,
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 200,
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should differentiate requests with different seed", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        seed: 12345,
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        seed: 67890,
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should differentiate requests with different system messages", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "hello" },
        ],
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a coding assistant" },
          { role: "user", content: "hello" },
        ],
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should differentiate requests with tools", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        tools: [{ type: "function", function: { name: "get_weather" } }],
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        tools: [{ type: "function", function: { name: "search" } }],
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should differentiate requests with response_format", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        response_format: { type: "json_object" },
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        response_format: { type: "text" },
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should handle multi-turn conversations", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" },
          { role: "assistant", content: "I'm doing well!" },
          { role: "user", content: "Great!" },
        ],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle tool role messages", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "user", content: "What's the weather?" },
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_123",
                type: "function",
                function: { name: "get_weather", arguments: "{}" },
              },
            ],
          },
          { role: "tool", tool_call_id: "call_123", content: "Sunny, 72°F" },
        ],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle image content (vision API)", () => {
      const body = JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image?" },
              { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo..." } },
            ],
          },
        ],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should differentiate different images", () => {
      const body1 = JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "data:image/png;base64,ABC123" } }],
          },
        ],
      });
      const body2 = JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "data:image/png;base64,XYZ789" } }],
          },
        ],
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });
  });

  describe("timestamp stripping edge cases", () => {
    it("should strip various timestamp formats", () => {
      const timestamps = [
        "[Mon 2024-01-15 10:30 PST]",
        "[Tue 2024-12-31 23:59 UTC]",
        "[Wed 2025-06-15 00:00 EST]",
      ];

      for (const ts of timestamps) {
        const body1 = JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: `${ts} hello world` }],
        });
        const body2 = JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: "hello world" }],
        });
        expect(ResponseCache.generateKey(body1)).toBe(ResponseCache.generateKey(body2));
      }
    });

    it("should NOT strip timestamp-like text in middle of content", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Meeting at [Mon 2024-01-15 10:30 PST] confirmed" }],
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Meeting at confirmed" }],
      });
      // Should NOT be equal - only strips from beginning
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should handle content that looks like timestamp but isn't", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "[Not a timestamp] hello" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("model name variations", () => {
    it("should differentiate provider-prefixed models", () => {
      const body1 = JSON.stringify({
        model: "openai/gpt-4",
        messages: [{ role: "user", content: "hello" }],
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });

    it("should handle model with version suffix", () => {
      const body1 = JSON.stringify({
        model: "gpt-4-0125-preview",
        messages: [{ role: "user", content: "hello" }],
      });
      const body2 = JSON.stringify({
        model: "gpt-4-1106-preview",
        messages: [{ role: "user", content: "hello" }],
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });
  });

  describe("concurrent operations simulation", () => {
    it("should handle rapid interleaved operations", async () => {
      const operations: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        operations.push(
          (async () => {
            const key = `key-${i % 20}`;
            cache.set(key, {
              body: Buffer.from(`value-${i}`),
              status: 200,
              headers: {},
              model: "gpt-4",
            });
            cache.get(key);
            if (i % 10 === 0) {
              cache.getStats();
            }
          })(),
        );
      }

      await Promise.all(operations);
      expect(cache.getStats().size).toBeGreaterThan(0);
    });

    it("should handle set-get-clear cycles", () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        // Fill cache
        for (let i = 0; i < 50; i++) {
          cache.set(`cycle-${cycle}-key-${i}`, {
            body: Buffer.from(`value-${i}`),
            status: 200,
            headers: {},
            model: "gpt-4",
          });
        }

        // Read some
        for (let i = 0; i < 25; i++) {
          cache.get(`cycle-${cycle}-key-${i}`);
        }

        // Clear
        cache.clear();
        expect(cache.getStats().size).toBe(0);
      }
    });
  });

  describe("heap integrity under stress", () => {
    it("should maintain heap integrity with many expirations", () => {
      vi.useFakeTimers();

      // Add items with varying TTLs
      for (let i = 0; i < 100; i++) {
        cache.set(
          `key-${i}`,
          {
            body: Buffer.from(`value-${i}`),
            status: 200,
            headers: {},
            model: "gpt-4",
          },
          i + 1, // TTL from 1 to 100 seconds
        );
      }

      expect(cache.getStats().size).toBe(100);

      // Expire items with TTL <= 50 seconds
      // Need to advance 51 seconds because expiration check is `>` not `>=`
      vi.advanceTimersByTime(51 * 1000);

      // Items with TTL > 51 should still exist (key-51 to key-99)
      for (let i = 51; i < 100; i++) {
        expect(cache.get(`key-${i}`)).toBeDefined();
      }

      // Items with TTL <= 50 should be expired (key-0 to key-49)
      for (let i = 0; i < 50; i++) {
        expect(cache.get(`key-${i}`)).toBeUndefined();
      }

      vi.useRealTimers();
    });

    it("should handle updating same key with different TTLs", () => {
      vi.useFakeTimers();

      // Set with short TTL
      cache.set("key", { body: Buffer.from("v1"), status: 200, headers: {}, model: "gpt-4" }, 10);

      // Update with longer TTL
      cache.set("key", { body: Buffer.from("v2"), status: 200, headers: {}, model: "gpt-4" }, 100);

      // Advance past first TTL
      vi.advanceTimersByTime(50 * 1000);

      // Should still exist with new TTL
      const cached = cache.get("key");
      expect(cached).toBeDefined();
      expect(cached!.body.toString()).toBe("v2");

      vi.useRealTimers();
    });
  });

  describe("response body edge cases", () => {
    it("should handle streaming-style chunks", () => {
      // Simulating SSE data
      const sseData = `data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n`;
      cache.set("sse", {
        body: Buffer.from(sseData),
        status: 200,
        headers: { "content-type": "text/event-stream" },
        model: "gpt-4",
      });

      const cached = cache.get("sse");
      expect(cached!.body.toString()).toBe(sseData);
    });

    it("should handle gzipped response body", () => {
      // Simulated gzip data (just random bytes)
      const gzipData = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
      cache.set("gzip", {
        body: gzipData,
        status: 200,
        headers: { "content-encoding": "gzip" },
        model: "gpt-4",
      });

      expect(cache.get("gzip")!.body).toEqual(gzipData);
    });

    it("should handle response with null bytes", () => {
      const nullBytes = Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00]);
      cache.set("null-bytes", {
        body: nullBytes,
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      expect(cache.get("null-bytes")!.body).toEqual(nullBytes);
    });

    it("should handle very large JSON response", () => {
      const largeArray = Array(1000).fill({ text: "a".repeat(100) });
      const largeResponse = JSON.stringify({ data: largeArray });

      cache.set("large-json", {
        body: Buffer.from(largeResponse),
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      const cached = cache.get("large-json");
      expect(cached).toBeDefined();
      expect(JSON.parse(cached!.body.toString()).data.length).toBe(1000);
    });
  });

  describe("header edge cases", () => {
    it("should handle headers with array values (converted to string)", () => {
      cache.set("array-header", {
        body: Buffer.from("test"),
        status: 200,
        headers: { "set-cookie": "a=1; b=2" }, // Normally could be array
        model: "gpt-4",
      });

      expect(cache.get("array-header")).toBeDefined();
    });

    it("should handle empty header values", () => {
      cache.set("empty-headers", {
        body: Buffer.from("test"),
        status: 200,
        headers: { "x-empty": "", "x-null-ish": "null", "x-undefined-ish": "undefined" },
        model: "gpt-4",
      });

      const cached = cache.get("empty-headers");
      expect(cached!.headers["x-empty"]).toBe("");
    });

    it("should handle rate limit headers", () => {
      cache.set("rate-limit", {
        body: Buffer.from("test"),
        status: 200,
        headers: {
          "x-ratelimit-limit-requests": "10000",
          "x-ratelimit-remaining-requests": "9999",
          "x-ratelimit-reset-requests": "1s",
        },
        model: "gpt-4",
      });

      expect(cache.get("rate-limit")).toBeDefined();
    });
  });

  describe("shouldCache with various body formats", () => {
    it("should handle body with nested cache:false", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
        metadata: { cache: false }, // Nested - should NOT disable caching
      });
      expect(cache.shouldCache(body)).toBe(true);
    });

    it("should handle body with cache:true explicitly", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        cache: true,
      });
      expect(cache.shouldCache(body)).toBe(true);
    });

    it("should handle body with both cache and no_cache", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        cache: true,
        no_cache: true, // Conflicting - no_cache wins
      });
      expect(cache.shouldCache(body)).toBe(false);
    });

    it("should handle body with cache:0 (falsy but not false)", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        cache: 0,
      });
      // cache: 0 is falsy but !== false
      expect(cache.shouldCache(body)).toBe(true);
    });

    it("should handle body with cache:'false' (string)", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        cache: "false",
      });
      // cache: "false" is truthy string, not boolean false
      expect(cache.shouldCache(body)).toBe(true);
    });
  });

  describe("stats edge cases", () => {
    it("should handle very high hit/miss counts", () => {
      // Simulate many operations
      for (let i = 0; i < 10000; i++) {
        cache.get(`miss-${i}`); // All misses
      }

      cache.set("hit-key", {
        body: Buffer.from("test"),
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      for (let i = 0; i < 10000; i++) {
        cache.get("hit-key"); // All hits
      }

      const stats = cache.getStats();
      expect(stats.misses).toBe(10000);
      expect(stats.hits).toBe(10000);
      expect(stats.hitRate).toBe("50.0%");
    });

    it("should handle stats after clear", () => {
      cache.set("key", {
        body: Buffer.from("test"),
        status: 200,
        headers: {},
        model: "gpt-4",
      });
      cache.get("key");
      cache.get("key");

      cache.clear();

      // Stats should persist after clear
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.size).toBe(0);
    });
  });

  describe("eviction edge cases", () => {
    it("should handle eviction when all items have same TTL", () => {
      const smallCache = new ResponseCache({ maxSize: 5, defaultTTL: 600 });

      for (let i = 0; i < 10; i++) {
        smallCache.set(`key-${i}`, {
          body: Buffer.from(`value-${i}`),
          status: 200,
          headers: {},
          model: "gpt-4",
        });
      }

      // Should have evicted oldest entries
      expect(smallCache.getStats().size).toBeLessThanOrEqual(5);
      expect(smallCache.getStats().evictions).toBeGreaterThan(0);
    });

    it("should prefer evicting expired items over non-expired", () => {
      vi.useFakeTimers();

      const smallCache = new ResponseCache({ maxSize: 3 });

      // Add item with short TTL
      smallCache.set(
        "short-ttl",
        { body: Buffer.from("short"), status: 200, headers: {}, model: "gpt-4" },
        1,
      );

      // Add items with long TTL
      smallCache.set(
        "long-ttl-1",
        { body: Buffer.from("long1"), status: 200, headers: {}, model: "gpt-4" },
        600,
      );
      smallCache.set(
        "long-ttl-2",
        { body: Buffer.from("long2"), status: 200, headers: {}, model: "gpt-4" },
        600,
      );

      // Expire short TTL item
      vi.advanceTimersByTime(2000);

      // Add new item - should evict expired one first
      smallCache.set(
        "new",
        { body: Buffer.from("new"), status: 200, headers: {}, model: "gpt-4" },
        600,
      );

      // Long TTL items should still exist
      expect(smallCache.get("long-ttl-1")).toBeDefined();
      expect(smallCache.get("long-ttl-2")).toBeDefined();
      expect(smallCache.get("new")).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe("JSON parsing edge cases in generateKey", () => {
    it("should handle deeply nested objects", () => {
      let nested: Record<string, unknown> = { value: "deep" };
      for (let i = 0; i < 50; i++) {
        nested = { nested };
      }

      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
        metadata: nested,
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle arrays with mixed types", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: [1, "two", true, null, { nested: "obj" }, [1, 2, 3]] }],
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle numeric string keys", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        "123": "numeric key",
        messages: [],
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle escaped characters in strings", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: 'Line1\\nLine2\\t"quoted"' }],
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("disabled cache behavior", () => {
    it("should not store anything when disabled", () => {
      const disabled = new ResponseCache({ enabled: false });

      disabled.set("key", {
        body: Buffer.from("test"),
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      expect(disabled.get("key")).toBeUndefined();
      expect(disabled.getStats().size).toBe(0);
    });

    it("should return false for shouldCache when disabled", () => {
      const disabled = new ResponseCache({ enabled: false });
      expect(disabled.shouldCache(JSON.stringify({ model: "gpt-4" }))).toBe(false);
    });

    it("should still track stats when disabled", () => {
      const disabled = new ResponseCache({ enabled: false });

      disabled.get("miss1");
      disabled.get("miss2");

      expect(disabled.getStats().misses).toBe(2);
    });
  });
});
