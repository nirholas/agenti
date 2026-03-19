import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTokenGateCache } from "../cache/memory.js";
import type { TokenGateCacheEntry, TokenGateCacheKey } from "../types.js";

describe("InMemoryTokenGateCache", () => {
  let cache: InMemoryTokenGateCache;

  const testKey: TokenGateCacheKey = {
    address: "0xUser123",
    tokenAddress: "0xToken456",
    network: "eip155:8453",
  };

  beforeEach(() => {
    cache = new InMemoryTokenGateCache();
  });

  describe("get/set", () => {
    it("returns undefined for missing entry", () => {
      const result = cache.get(testKey);
      expect(result).toBeUndefined();
    });

    it("stores and retrieves entry", () => {
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };

      cache.set(testKey, entry);
      const result = cache.get(testKey);

      expect(result).toEqual(entry);
    });

    it("normalizes address to lowercase for key", () => {
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };

      // Set with uppercase
      cache.set(
        { ...testKey, address: "0xUSER123" },
        entry
      );

      // Get with lowercase
      const result = cache.get(
        { ...testKey, address: "0xuser123" }
      );

      expect(result).toEqual(entry);
    });

    it("returns undefined for expired entry", () => {
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      cache.set(testKey, entry);
      const result = cache.get(testKey);

      expect(result).toBeUndefined();
    });
  });

  describe("isBlocked/block", () => {
    it("returns not blocked for unknown address", () => {
      const result = cache.isBlocked(testKey);
      expect(result).toEqual({ blocked: false });
    });

    it("blocks address with expiry", () => {
      const expiresAt = new Date(Date.now() + 60000);
      cache.block(testKey, expiresAt);

      const result = cache.isBlocked(testKey);

      expect(result.blocked).toBe(true);
      expect(result.expiresAt).toEqual(expiresAt);
    });

    it("returns not blocked for expired block", () => {
      const expiresAt = new Date(Date.now() - 1000); // Already expired
      cache.block(testKey, expiresAt);

      const result = cache.isBlocked(testKey);

      expect(result).toEqual({ blocked: false });
    });

    it("normalizes address to lowercase for block key", () => {
      const expiresAt = new Date(Date.now() + 60000);

      // Block with uppercase
      cache.block(
        { ...testKey, address: "0xUSER123" },
        expiresAt
      );

      // Check with lowercase
      const result = cache.isBlocked(
        { ...testKey, address: "0xuser123" }
      );

      expect(result.blocked).toBe(true);
    });
  });

  describe("clear", () => {
    it("clears all entries and blocks", () => {
      const entry: TokenGateCacheEntry = {
        address: "0xuser123",
        tokenAddress: "0xtoken456",
        network: "eip155:8453",
        balance: 100n,
        hasEnough: true,
        checkedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };

      cache.set(testKey, entry);
      cache.block(testKey, new Date(Date.now() + 60000));

      cache.clear();

      expect(cache.get(testKey)).toBeUndefined();
      expect(cache.isBlocked(testKey)).toEqual({ blocked: false });
    });
  });
});
