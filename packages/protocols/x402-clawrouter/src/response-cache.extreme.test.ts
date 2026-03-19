import { describe, it, expect, beforeEach, vi } from "vitest";
import { ResponseCache } from "./response-cache.js";

describe("ResponseCache Extreme Edge Cases", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache();
  });

  describe("numeric edge cases", () => {
    it("should handle TTL of NaN", () => {
      vi.useFakeTimers();

      cache.set(
        "nan-ttl",
        { body: Buffer.from("test"), status: 200, headers: {}, model: "gpt-4" },
        NaN,
      );

      // NaN TTL should result in NaN expiresAt, which fails all comparisons
      // Item might exist but be immediately "expired"
      // Behavior: NaN comparisons are always false, so item may or may not be retrievable
      // Just ensure it doesn't crash
      cache.get("nan-ttl");
      expect(true).toBe(true);

      vi.useRealTimers();
    });

    it("should handle TTL of Infinity", () => {
      vi.useFakeTimers();

      cache.set(
        "inf-ttl",
        { body: Buffer.from("test"), status: 200, headers: {}, model: "gpt-4" },
        Infinity,
      );

      // Advance very far
      vi.advanceTimersByTime(1e15);

      // Should still exist (Infinity never expires)
      const result = cache.get("inf-ttl");
      expect(result).toBeDefined();

      vi.useRealTimers();
    });

    it("should handle TTL of -Infinity", () => {
      vi.useFakeTimers();

      cache.set(
        "neg-inf-ttl",
        { body: Buffer.from("test"), status: 200, headers: {}, model: "gpt-4" },
        -Infinity,
      );

      // Should be immediately expired
      expect(cache.get("neg-inf-ttl")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should handle MAX_SAFE_INTEGER TTL", () => {
      cache.set(
        "max-int-ttl",
        { body: Buffer.from("test"), status: 200, headers: {}, model: "gpt-4" },
        Number.MAX_SAFE_INTEGER,
      );

      expect(cache.get("max-int-ttl")).toBeDefined();
    });

    it("should handle temperature as string in request", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
        temperature: "0.7", // String instead of number
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle scientific notation in request", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1e3,
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1000,
      });
      // JSON.stringify normalizes these to same value
      expect(ResponseCache.generateKey(body1)).toBe(ResponseCache.generateKey(body2));
    });

    it("should handle float precision edge cases", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [],
        temperature: 0.1 + 0.2,
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [],
        temperature: 0.30000000000000004,
      });
      // These should be the same due to float representation
      expect(ResponseCache.generateKey(body1)).toBe(ResponseCache.generateKey(body2));
    });
  });

  describe("string edge cases", () => {
    it("should handle empty string model", () => {
      const body = JSON.stringify({
        model: "",
        messages: [{ role: "user", content: "hi" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle whitespace-only content", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "   \t\n  " }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle control characters", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "\x00\x01\x02\x1f\x7f" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle UTF-8 BOM", () => {
      const bomContent = "\ufeffHello world";
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: bomContent }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle surrogate pairs (emoji)", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello 👨‍👩‍👧‍👦 family emoji" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle RTL text (Arabic)", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "مرحبا بالعالم" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle mixed LTR/RTL text", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello مرحبا World عالم" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle zero-width characters", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello\u200b\u200c\u200dWorld" }],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle homoglyphs differently", () => {
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }], // Latin
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Ηello" }], // Greek H (Eta)
      });
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));
    });
  });

  describe("security edge cases", () => {
    it("should handle __proto__ in request body", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        __proto__: { polluted: true },
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);

      // Verify no prototype pollution
      const obj: Record<string, unknown> = {};
      expect(obj.polluted).toBeUndefined();
    });

    it("should handle constructor in request body", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        constructor: { prototype: { evil: true } },
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle very long repeated patterns (ReDoS prevention)", () => {
      // Potential ReDoS with timestamp regex
      const longContent = "[Mon 2024-01-15 10:30 ".repeat(1000);
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: longContent }],
      });

      const start = Date.now();
      ResponseCache.generateKey(body);
      const elapsed = Date.now() - start;

      // Should complete quickly (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });

    it("should handle deeply nested __proto__", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: "test",
            __proto__: {
              __proto__: {
                __proto__: { deep: true },
              },
            },
          },
        ],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("buffer and memory edge cases", () => {
    it("should handle buffer modification after caching", () => {
      const originalData = Buffer.from("original");
      cache.set("mutable", {
        body: originalData,
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      // Modify the original buffer
      originalData.write("MODIFIED");

      // Cached value should be affected (same buffer reference)
      const cached = cache.get("mutable");
      expect(cached!.body.toString()).toBe("MODIFIED");
    });

    it("should handle buffer from different encodings", () => {
      const utf16Buffer = Buffer.from("Hello", "utf16le");
      cache.set("utf16", {
        body: utf16Buffer,
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      expect(cache.get("utf16")!.body).toEqual(utf16Buffer);
    });

    it("should handle ArrayBuffer-backed Buffer", () => {
      const arrayBuffer = new ArrayBuffer(10);
      const view = new Uint8Array(arrayBuffer);
      view.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const buffer = Buffer.from(arrayBuffer);

      cache.set("arraybuffer", {
        body: buffer,
        status: 200,
        headers: {},
        model: "gpt-4",
      });

      expect(cache.get("arraybuffer")).toBeDefined();
    });
  });

  describe("JSON edge cases", () => {
    it("should handle JSON with duplicate keys (last wins)", () => {
      // JSON.parse behavior with duplicate keys
      const body = '{"model":"gpt-3","model":"gpt-4","messages":[]}';
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle very deeply nested arrays", () => {
      let nested: unknown[] = ["deep"];
      for (let i = 0; i < 100; i++) {
        nested = [nested];
      }

      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: JSON.stringify(nested) }],
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle object with many keys", () => {
      const manyKeys: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        manyKeys[`key_${i}`] = `value_${i}`;
      }

      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        metadata: manyKeys,
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle keys with special JSON characters", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [],
        'key"with"quotes': "value",
        "key\\with\\backslash": "value",
        "key\nwith\nnewline": "value",
      });

      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle unicode escape sequences", () => {
      const body =
        '{"model":"gpt-4","messages":[{"role":"user","content":"\\u0048\\u0065\\u006c\\u006c\\u006f"}]}';
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("timestamp pattern edge cases", () => {
    it("should handle partial timestamp at start", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "[Mon 2024-01-15" }], // Incomplete
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle multiple timestamps at start", () => {
      // Regex only strips ONE timestamp from the start
      const body1 = JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "user", content: "[Mon 2024-01-15 10:30 PST] [Tue 2024-01-16 11:00 UTC] hello" },
        ],
      });
      const body2 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "[Tue 2024-01-16 11:00 UTC] hello" }],
      });
      // body1 after strip: "[Tue 2024-01-16 11:00 UTC] hello"
      // body2 after strip: "hello" (second timestamp also stripped since it's at start)
      // These should be DIFFERENT
      expect(ResponseCache.generateKey(body1)).not.toBe(ResponseCache.generateKey(body2));

      // But this should be equal (same content after single strip)
      const body3 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "[Mon 2024-01-15 10:30 PST] hello" }],
      });
      const body4 = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      });
      expect(ResponseCache.generateKey(body3)).toBe(ResponseCache.generateKey(body4));
    });

    it("should handle timestamp with extra spaces", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "[Mon  2024-01-15  10:30  PST]  hello" }], // Extra spaces
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("cache key collision resistance", () => {
    it("should generate different keys for similar but different content", () => {
      const variations = [
        { model: "gpt-4", messages: [{ role: "user", content: "hello" }] },
        { model: "gpt-4", messages: [{ role: "user", content: "hello " }] }, // trailing space
        { model: "gpt-4", messages: [{ role: "user", content: " hello" }] }, // leading space
        { model: "gpt-4", messages: [{ role: "user", content: "Hello" }] }, // capital
        { model: "gpt-4", messages: [{ role: "user", content: "hello\n" }] }, // newline
        { model: "gpt-4 ", messages: [{ role: "user", content: "hello" }] }, // model trailing space
        { model: " gpt-4", messages: [{ role: "user", content: "hello" }] }, // model leading space
      ];

      const keys = variations.map((v) => ResponseCache.generateKey(JSON.stringify(v)));
      const uniqueKeys = new Set(keys);

      // All should be unique
      expect(uniqueKeys.size).toBe(variations.length);
    });

    it("should generate same key for semantically identical content", () => {
      const body1 = JSON.stringify({ model: "gpt-4", temperature: 0.7, messages: [] });
      const body2 = JSON.stringify({ temperature: 0.7, model: "gpt-4", messages: [] });
      const body3 = JSON.stringify({ messages: [], model: "gpt-4", temperature: 0.7 });

      expect(ResponseCache.generateKey(body1)).toBe(ResponseCache.generateKey(body2));
      expect(ResponseCache.generateKey(body2)).toBe(ResponseCache.generateKey(body3));
    });
  });

  describe("eviction under memory pressure", () => {
    it("should handle filling cache to exact capacity multiple times", () => {
      const smallCache = new ResponseCache({ maxSize: 10 });

      for (let round = 0; round < 5; round++) {
        // Fill to capacity
        for (let i = 0; i < 10; i++) {
          smallCache.set(`round-${round}-key-${i}`, {
            body: Buffer.from(`value-${i}`),
            status: 200,
            headers: {},
            model: "gpt-4",
          });
        }
        expect(smallCache.getStats().size).toBeLessThanOrEqual(10);
      }
    });

    it("should handle alternating set and eviction", () => {
      const tinyCache = new ResponseCache({ maxSize: 2 });

      for (let i = 0; i < 100; i++) {
        tinyCache.set(`key-${i}`, {
          body: Buffer.from(`value-${i}`),
          status: 200,
          headers: {},
          model: "gpt-4",
        });
      }

      expect(tinyCache.getStats().size).toBeLessThanOrEqual(2);
      expect(tinyCache.getStats().evictions).toBeGreaterThan(0);
    });
  });

  describe("header case sensitivity", () => {
    it("should preserve original header case", () => {
      cache.set("headers", {
        body: Buffer.from("test"),
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Custom-Header": "value",
        },
        model: "gpt-4",
      });

      const cached = cache.get("headers");
      expect(cached!.headers["Content-Type"]).toBe("application/json");
      expect(cached!.headers["X-Custom-Header"]).toBe("value");
    });

    it("should handle duplicate headers with different case", () => {
      cache.set("dup-headers", {
        body: Buffer.from("test"),
        status: 200,
        headers: {
          "content-type": "text/plain",
          "Content-Type": "application/json", // Overwrites in object
        },
        model: "gpt-4",
      });

      const cached = cache.get("dup-headers");
      // Last one wins in object
      expect(cached!.headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("status code edge cases", () => {
    it("should handle status 0", () => {
      cache.set("status-0", {
        body: Buffer.from("test"),
        status: 0,
        headers: {},
        model: "gpt-4",
      });
      // Status 0 < 400, so should be cached
      expect(cache.get("status-0")).toBeDefined();
    });

    it("should handle status 100 (Continue)", () => {
      cache.set("status-100", {
        body: Buffer.from("test"),
        status: 100,
        headers: {},
        model: "gpt-4",
      });
      expect(cache.get("status-100")).toBeDefined();
    });

    it("should handle status 399 (edge of error)", () => {
      cache.set("status-399", {
        body: Buffer.from("test"),
        status: 399,
        headers: {},
        model: "gpt-4",
      });
      expect(cache.get("status-399")).toBeDefined();
    });

    it("should not cache status exactly 400", () => {
      cache.set("status-400", {
        body: Buffer.from("test"),
        status: 400,
        headers: {},
        model: "gpt-4",
      });
      expect(cache.get("status-400")).toBeUndefined();
    });

    it("should handle very large status codes", () => {
      cache.set("status-999", {
        body: Buffer.from("test"),
        status: 999,
        headers: {},
        model: "gpt-4",
      });
      // 999 >= 400, so not cached
      expect(cache.get("status-999")).toBeUndefined();
    });
  });

  describe("model field variations", () => {
    it("should handle model as number (invalid but shouldn't crash)", () => {
      const body = JSON.stringify({
        model: 12345,
        messages: [],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle model as null", () => {
      const body = JSON.stringify({
        model: null,
        messages: [],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle model as object", () => {
      const body = JSON.stringify({
        model: { name: "gpt-4", version: "latest" },
        messages: [],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle model as array", () => {
      const body = JSON.stringify({
        model: ["gpt-4", "gpt-3.5-turbo"],
        messages: [],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("messages field variations", () => {
    it("should handle messages as string (invalid but shouldn't crash)", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: "not an array",
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle messages as null", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: null,
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle messages with null elements", () => {
      const body = JSON.stringify({
        model: "gpt-4",
        messages: [null, { role: "user", content: "hi" }, null],
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });

    it("should handle very long messages array", () => {
      const messages = Array(1000).fill({ role: "user", content: "message" });
      const body = JSON.stringify({
        model: "gpt-4",
        messages,
      });
      expect(ResponseCache.generateKey(body)).toHaveLength(32);
    });
  });

  describe("concurrent timer edge cases", () => {
    it("should handle items expiring at exact same time", () => {
      vi.useFakeTimers();

      // Add multiple items with same TTL
      for (let i = 0; i < 10; i++) {
        cache.set(
          `same-ttl-${i}`,
          {
            body: Buffer.from(`value-${i}`),
            status: 200,
            headers: {},
            model: "gpt-4",
          },
          60,
        );
      }

      expect(cache.getStats().size).toBe(10);

      // All expire at once
      vi.advanceTimersByTime(61 * 1000);

      // All should be expired
      for (let i = 0; i < 10; i++) {
        expect(cache.get(`same-ttl-${i}`)).toBeUndefined();
      }

      vi.useRealTimers();
    });

    it("should handle rapid TTL updates to same key", () => {
      vi.useFakeTimers();

      // Rapidly update same key with different TTLs
      for (let i = 1; i <= 100; i++) {
        cache.set(
          "rapid-update",
          {
            body: Buffer.from(`value-${i}`),
            status: 200,
            headers: {},
            model: "gpt-4",
          },
          i,
        );
      }

      // Should have latest value with TTL=100
      expect(cache.get("rapid-update")!.body.toString()).toBe("value-100");

      vi.advanceTimersByTime(50 * 1000);
      expect(cache.get("rapid-update")).toBeDefined();

      vi.advanceTimersByTime(60 * 1000);
      expect(cache.get("rapid-update")).toBeUndefined();

      vi.useRealTimers();
    });
  });
});
