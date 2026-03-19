import { describe, test, expect, beforeEach } from "bun:test";
import { BearerTokenValidator } from "../../src/auth/validator.js";
import { InMemoryTokenStorage } from "../../src/auth/storage/memory.js";
import { InMemoryRateLimiter } from "../../src/auth/rate-limit/memory.js";
import type { TokenStorage } from "../../src/auth/storage/interface.js";
import type { RateLimiter } from "../../src/auth/rate-limit/interface.js";

describe("BearerTokenValidator", () => {
  let validator: BearerTokenValidator;
  let storage: TokenStorage;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    storage = new InMemoryTokenStorage();
    rateLimiter = new InMemoryRateLimiter();
    validator = new BearerTokenValidator(storage, rateLimiter);
  });

  describe("Valid Token", () => {
    test("validates correct bearer token", async () => {
      const token = await storage.createToken({ name: "Test" }, "test");

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(true);
      expect(result.context?.tokenId).toBe(token.id);
      expect(result.context?.tier).toBe("free");
      expect(result.error).toBeUndefined();
    });

    test("returns user context", async () => {
      const token = await storage.createToken(
        {
          name: "Test",
          userId: "user-123",
          tier: "pro",
          metadata: { customField: "value" },
        },
        "live",
      );

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.context?.userId).toBe("user-123");
      expect(result.context?.tier).toBe("pro");
      expect(result.context?.metadata.customField).toBe("value");
    });

    test("updates lastUsedAt on validation", async () => {
      const token = await storage.createToken({ name: "Test" }, "test");
      expect(token.lastUsedAt).toBeNull();

      await validator.validate(`Bearer ${token.token}`);

      const updated = await storage.getToken(token.token);
      expect(updated?.lastUsedAt).not.toBeNull();
    });

    test("accepts Bearer with different casing", async () => {
      const token = await storage.createToken({ name: "Test" }, "test");

      const result1 = await validator.validate(`Bearer ${token.token}`);
      const result2 = await validator.validate(`bearer ${token.token}`);
      const result3 = await validator.validate(`BEARER ${token.token}`);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);
    });
  });

  describe("Missing Token", () => {
    test("rejects missing authorization header", async () => {
      const result = await validator.validate(null);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("MISSING_TOKEN");
      expect(result.error?.message).toContain("Authorization header");
    });

    test("rejects undefined authorization header", async () => {
      const result = await validator.validate(undefined);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("MISSING_TOKEN");
    });

    test("rejects empty authorization header", async () => {
      const result = await validator.validate("");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("MISSING_TOKEN");
    });
  });

  describe("Invalid Token Format", () => {
    test("rejects malformed authorization header", async () => {
      const result = await validator.validate("InvalidHeader");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("rejects missing Bearer prefix", async () => {
      const result = await validator.validate("fac_test_abc123");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("rejects wrong token format", async () => {
      const result = await validator.validate("Bearer xyz_invalid_token");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("rejects token with invalid prefix", async () => {
      const result = await validator.validate(
        "Bearer wrong_test_s1xPo5F3Hbbmqyy2cEEWs3hz",
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("rejects token with invalid environment", async () => {
      const result = await validator.validate(
        "Bearer fac_prod_s1xPo5F3Hbbmqyy2cEEWs3hz",
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("rejects token with invalid length", async () => {
      const result = await validator.validate("Bearer fac_test_short");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });
  });

  describe("Non-Existent Token", () => {
    test("rejects token not in storage", async () => {
      const result = await validator.validate(
        "Bearer fac_test_s1xPo5F3Hbbmqyy2cEEWs3hz",
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("provides helpful error message", async () => {
      const result = await validator.validate(
        "Bearer fac_test_s1xPo5F3Hbbmqyy2cEEWs3hz",
      );

      expect(result.error?.message).toContain("not found");
    });
  });

  describe("Inactive Token", () => {
    test("rejects revoked token", async () => {
      const token = await storage.createToken({ name: "Test" }, "test");
      await storage.revokeToken(token.id);

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(false);
      // Note: Revoked tokens appear as INVALID_TOKEN because getToken() filters them out
      expect(result.error?.code).toBe("INVALID_TOKEN");
      expect(result.error?.message).toContain("not found or inactive");
    });

    test("rejects explicitly inactive token", async () => {
      const token = await storage.createToken({ name: "Test" }, "test");
      await storage.updateToken(token.id, { isActive: false });

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(false);
      // Note: Inactive tokens appear as INVALID_TOKEN because getToken() filters them out
      expect(result.error?.code).toBe("INVALID_TOKEN");
      expect(result.error?.message).toContain("not found or inactive");
    });
  });

  describe("Expired Token", () => {
    test("rejects expired token", async () => {
      const token = await storage.createToken(
        {
          name: "Test",
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
        "test",
      );

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXPIRED_TOKEN");
    });

    test("allows token with future expiry", async () => {
      const token = await storage.createToken(
        {
          name: "Test",
          expiresAt: new Date(Date.now() + 86400000), // Expires tomorrow
        },
        "test",
      );

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(true);
    });

    test("allows token with no expiry", async () => {
      const token = await storage.createToken(
        {
          name: "Test",
          expiresAt: null,
        },
        "test",
      );

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(true);
    });
  });

  describe("Rate Limiting", () => {
    test("enforces per-minute rate limit", async () => {
      const token = await storage.createToken(
        {
          requestsPerMinute: 2,
          requestsPerDay: 100,
        },
        "test",
      );

      // Use up the rate limit
      await rateLimiter.increment(token.id);
      await rateLimiter.increment(token.id);

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("RATE_LIMITED");
    });

    test("enforces per-day rate limit", async () => {
      const token = await storage.createToken(
        {
          requestsPerMinute: 100,
          requestsPerDay: 2,
        },
        "test",
      );

      // Use up the daily limit
      await rateLimiter.increment(token.id);
      await rateLimiter.increment(token.id);

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("RATE_LIMITED");
    });

    test("provides rate limit details in error", async () => {
      const token = await storage.createToken(
        {
          requestsPerMinute: 1,
        },
        "test",
      );

      await rateLimiter.increment(token.id);

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.error?.details).toBeDefined();
      expect(result.error?.details?.resetAt).toBeInstanceOf(Date);
      expect(result.error?.details?.remaining).toBe(0);
    });

    test("allows request within rate limits", async () => {
      const token = await storage.createToken(
        {
          requestsPerMinute: 10,
          requestsPerDay: 100,
        },
        "test",
      );

      await rateLimiter.increment(token.id);
      await rateLimiter.increment(token.id);

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    test("handles extra whitespace in header", async () => {
      const token = await storage.createToken({ name: "Test" }, "test");

      const result = await validator.validate(`  Bearer   ${token.token}  `);

      expect(result.valid).toBe(true);
    });

    test("rejects header with only Bearer", async () => {
      const result = await validator.validate("Bearer");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });

    test("rejects header with Bearer and whitespace only", async () => {
      const result = await validator.validate("Bearer   ");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_TOKEN");
    });
  });

  describe("Context Information", () => {
    test("includes all token metadata in context", async () => {
      const token = await storage.createToken(
        {
          name: "Premium Token",
          userId: "user-123",
          tier: "enterprise",
          metadata: {
            company: "ACME Inc",
            plan: "premium",
            features: ["feature1", "feature2"],
          },
        },
        "live",
      );

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.context?.tokenId).toBe(token.id);
      expect(result.context?.userId).toBe("user-123");
      expect(result.context?.tier).toBe("enterprise");
      expect(result.context?.metadata.company).toBe("ACME Inc");
      expect(result.context?.metadata.plan).toBe("premium");
      expect(result.context?.metadata.features).toEqual([
        "feature1",
        "feature2",
      ]);
    });

    test("handles null userId gracefully", async () => {
      const token = await storage.createToken(
        {
          userId: null,
        },
        "test",
      );

      const result = await validator.validate(`Bearer ${token.token}`);

      expect(result.valid).toBe(true);
      expect(result.context?.userId).toBeNull();
    });
  });
});
