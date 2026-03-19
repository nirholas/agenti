import { describe, test, expect, beforeEach } from "bun:test";
import { InMemoryTokenStorage } from "../../../src/auth/storage/memory.js";
import type { TokenStorage } from "../../../src/auth/storage/interface.js";

describe("InMemoryTokenStorage", () => {
  let storage: TokenStorage;

  beforeEach(() => {
    storage = new InMemoryTokenStorage();
  });

  describe("Token Creation", () => {
    test("creates token with generated token string", async () => {
      const token = await storage.createToken(
        {
          name: "Test Token",
          tier: "free",
        },
        "test",
      );

      expect(token.token).toMatch(/^fac_test_/);
      expect(token.name).toBe("Test Token");
      expect(token.tier).toBe("free");
      expect(token.isActive).toBe(true);
    });

    test("creates live environment token", async () => {
      const token = await storage.createToken({ name: "Live Token" }, "live");

      expect(token.token).toMatch(/^fac_live_/);
    });

    test("generates unique IDs for each token", async () => {
      const token1 = await storage.createToken({ name: "Token 1" }, "test");
      const token2 = await storage.createToken({ name: "Token 2" }, "test");

      expect(token1.id).not.toBe(token2.id);
    });

    test("generates unique token strings", async () => {
      const token1 = await storage.createToken({ name: "Token 1" }, "test");
      const token2 = await storage.createToken({ name: "Token 2" }, "test");

      expect(token1.token).not.toBe(token2.token);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
    });

    test("sets default rate limits", async () => {
      const token = await storage.createToken({}, "test");

      expect(token.requestsPerMinute).toBe(100);
      expect(token.requestsPerDay).toBe(10000);
    });

    test("accepts custom rate limits", async () => {
      const token = await storage.createToken(
        {
          requestsPerMinute: 500,
          requestsPerDay: 50000,
        },
        "test",
      );

      expect(token.requestsPerMinute).toBe(500);
      expect(token.requestsPerDay).toBe(50000);
    });

    test("sets timestamps correctly", async () => {
      const before = new Date();
      const token = await storage.createToken({ name: "Test" }, "test");
      const after = new Date();

      expect(token.createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(token.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(token.updatedAt).toEqual(token.createdAt);
      expect(token.lastUsedAt).toBeNull();
    });

    test("sets optional fields to null by default", async () => {
      const token = await storage.createToken({}, "test");

      expect(token.name).toBeNull();
      expect(token.userId).toBeNull();
      expect(token.expiresAt).toBeNull();
      expect(token.monthlyRequestLimit).toBeNull();
      expect(token.monthlySettlementLimit).toBeNull();
    });

    test("accepts all optional fields", async () => {
      const expiryDate = new Date(Date.now() + 86400000);
      const token = await storage.createToken(
        {
          name: "Premium Token",
          userId: "user-123",
          tier: "pro",
          monthlyRequestLimit: 100000,
          monthlySettlementLimit: 1000,
          expiresAt: expiryDate,
          metadata: { customField: "value" },
        },
        "live",
      );

      expect(token.name).toBe("Premium Token");
      expect(token.userId).toBe("user-123");
      expect(token.tier).toBe("pro");
      expect(token.monthlyRequestLimit).toBe(100000);
      expect(token.monthlySettlementLimit).toBe(1000);
      expect(token.expiresAt).toEqual(expiryDate);
      expect(token.metadata.customField).toBe("value");
    });
  });

  describe("Token Retrieval", () => {
    test("retrieves token by token string", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      const retrieved = await storage.getToken(created.token);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe("Test");
    });

    test("retrieves token by hash", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      const retrieved = await storage.getToken(created.tokenHash);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });

    test("returns null for non-existent token", async () => {
      const token = await storage.getToken("fac_test_nonexistenttoken123");
      expect(token).toBeNull();
    });

    test("returns null for revoked token", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      await storage.revokeToken(created.id);

      const retrieved = await storage.getToken(created.token);
      expect(retrieved).toBeNull();
    });

    test("returns null for inactive token", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      await storage.updateToken(created.id, { isActive: false });

      const retrieved = await storage.getToken(created.token);
      expect(retrieved).toBeNull();
    });
  });

  describe("Token Updates", () => {
    test("updates token name", async () => {
      const created = await storage.createToken(
        { name: "Original" },
        "test",
      );

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await storage.updateToken(created.id, {
        name: "Updated",
      });

      expect(updated.name).toBe("Updated");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      );
    });

    test("updates token tier", async () => {
      const created = await storage.createToken({ tier: "free" }, "test");
      const updated = await storage.updateToken(created.id, { tier: "pro" });

      expect(updated.tier).toBe("pro");
    });

    test("updates rate limits", async () => {
      const created = await storage.createToken({}, "test");
      const updated = await storage.updateToken(created.id, {
        requestsPerMinute: 1000,
        requestsPerDay: 100000,
      });

      expect(updated.requestsPerMinute).toBe(1000);
      expect(updated.requestsPerDay).toBe(100000);
    });

    test("cannot update token string", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      const originalToken = created.token;

      await storage.updateToken(created.id, {
        token: "fac_test_hackedtoken123456",
      } as any);

      const retrieved = await storage.getToken(created.token);
      expect(retrieved?.token).toBe(originalToken);
    });

    test("cannot update token hash", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      const originalHash = created.tokenHash;

      await storage.updateToken(created.id, {
        tokenHash: "hacked_hash",
      } as any);

      const retrieved = await storage.getToken(created.token);
      expect(retrieved?.tokenHash).toBe(originalHash);
    });

    test("cannot update token ID", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      const originalId = created.id;

      await storage.updateToken(created.id, { id: "new-id" } as any);

      const retrieved = await storage.getToken(created.token);
      expect(retrieved?.id).toBe(originalId);
    });

    test("throws error for non-existent token", async () => {
      expect(async () => {
        await storage.updateToken("non-existent-id", { name: "Test" });
      }).toThrow();
    });
  });

  describe("Token Revocation", () => {
    test("revokes token sets isActive to false", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      await storage.revokeToken(created.id);

      const retrieved = await storage.getToken(created.token);
      expect(retrieved).toBeNull();
    });

    test("revoked token cannot be retrieved", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      await storage.revokeToken(created.id);

      expect(await storage.getToken(created.token)).toBeNull();
      expect(await storage.getToken(created.tokenHash)).toBeNull();
    });
  });

  describe("Touch Token", () => {
    test("updates lastUsedAt timestamp", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");
      expect(created.lastUsedAt).toBeNull();

      // Wait a tiny bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      await storage.touchToken(created.id);

      const retrieved = await storage.getToken(created.token);
      expect(retrieved?.lastUsedAt).not.toBeNull();
      expect(retrieved?.lastUsedAt?.getTime()).toBeGreaterThan(
        created.createdAt.getTime(),
      );
    });

    test("updates lastUsedAt on subsequent touches", async () => {
      const created = await storage.createToken({ name: "Test" }, "test");

      await storage.touchToken(created.id);
      const firstTouch = await storage.getToken(created.token);

      await new Promise((resolve) => setTimeout(resolve, 10));
      await storage.touchToken(created.id);
      const secondTouch = await storage.getToken(created.token);

      expect(secondTouch?.lastUsedAt?.getTime()).toBeGreaterThan(
        firstTouch?.lastUsedAt?.getTime() || 0,
      );
    });
  });
});
