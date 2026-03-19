import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisTokenGateCache } from "../cache/redis.js";
import type { TokenGateCacheEntry, TokenGateCacheKey } from "../types.js";

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  pttl: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

describe("RedisTokenGateCache", () => {
  let cache: RedisTokenGateCache;

  const testKey: TokenGateCacheKey = {
    address: "0xUser123",
    tokenAddress: "0xToken456",
    network: "eip155:8453",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new RedisTokenGateCache({ redis: mockRedis as any });
  });

  describe("get", () => {
    it("returns undefined when key not found", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get(testKey);

      expect(result).toBeUndefined();
      expect(mockRedis.get).toHaveBeenCalledWith(
        "tokengate:eip155:8453:0xtoken456:0xuser123"
      );
    });

    it("returns parsed entry when found", async () => {
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date("2024-01-15T12:00:00Z"),
        expiresAt: new Date("2024-01-15T12:05:00Z"),
      };

      mockRedis.get.mockResolvedValue(
        JSON.stringify(entry, (k, v) =>
          typeof v === "bigint" ? v.toString() : v
        )
      );

      const result = await cache.get(testKey);

      expect(result).toBeDefined();
      expect(result!.balance).toBe(100n);
      expect(result!.hasEnough).toBe(true);
    });

    it("normalizes address to lowercase in key", async () => {
      mockRedis.get.mockResolvedValue(null);

      await cache.get({ ...testKey, address: "0xUSER123" });

      expect(mockRedis.get).toHaveBeenCalledWith(
        "tokengate:eip155:8453:0xtoken456:0xuser123"
      );
    });
  });

  describe("set", () => {
    it("stores entry with TTL", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date(),
        expiresAt,
      };

      mockRedis.set.mockResolvedValue("OK");

      await cache.set(testKey, entry);

      expect(mockRedis.set).toHaveBeenCalled();
      const [key, value, px, ttl] = mockRedis.set.mock.calls[0];
      expect(key).toBe("tokengate:eip155:8453:0xtoken456:0xuser123");
      expect(px).toBe("PX");
      expect(ttl).toBeGreaterThan(59_000);
      expect(ttl).toBeLessThanOrEqual(60_000);
    });

    it("does not store if already expired", async () => {
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      await cache.set(testKey, entry);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe("isBlocked", () => {
    it("returns not blocked when key not found", async () => {
      mockRedis.pttl.mockResolvedValue(-2); // Key doesn't exist

      const result = await cache.isBlocked(testKey);

      expect(result).toEqual({ blocked: false });
    });

    it("returns blocked with expiresAt when key exists", async () => {
      mockRedis.pttl.mockResolvedValue(60_000); // 60 seconds remaining

      const result = await cache.isBlocked(testKey);

      expect(result.blocked).toBe(true);
      expect(result.expiresAt).toBeDefined();
      // Should be ~60 seconds in future
      const msUntilExpiry = result.expiresAt!.getTime() - Date.now();
      expect(msUntilExpiry).toBeGreaterThan(59_000);
      expect(msUntilExpiry).toBeLessThanOrEqual(60_000);
    });
  });

  describe("block", () => {
    it("stores block key with TTL", async () => {
      const expiresAt = new Date(Date.now() + 60_000);
      mockRedis.set.mockResolvedValue("OK");

      await cache.block(testKey, expiresAt);

      expect(mockRedis.set).toHaveBeenCalled();
      const [key, value, px, ttl] = mockRedis.set.mock.calls[0];
      expect(key).toBe("tokengate:blocked:eip155:8453:0xtoken456:0xuser123");
      expect(value).toBe("1");
      expect(px).toBe("PX");
      expect(ttl).toBeGreaterThan(59_000);
    });
  });

  describe("clear", () => {
    it("deletes all keys with prefix using SCAN", async () => {
      mockRedis.scan.mockResolvedValueOnce(["123", ["tokengate:key1", "tokengate:key2"]]);
      mockRedis.scan.mockResolvedValueOnce(["0", ["tokengate:key3"]]);
      mockRedis.del.mockResolvedValue(2);

      await cache.clear();

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith("tokengate:key1", "tokengate:key2");
      expect(mockRedis.del).toHaveBeenCalledWith("tokengate:key3");
    });
  });

  describe("custom key prefix", () => {
    it("uses custom prefix", async () => {
      const customCache = new RedisTokenGateCache({
        redis: mockRedis as any,
        keyPrefix: "myapp",
      });

      mockRedis.get.mockResolvedValue(null);
      await customCache.get(testKey);

      expect(mockRedis.get).toHaveBeenCalledWith(
        "myapp:eip155:8453:0xtoken456:0xuser123"
      );
    });
  });
});
