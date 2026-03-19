import type { TokenGateCache } from "./interface.js";
import type { TokenGateCacheEntry, TokenGateCacheKey } from "../types.js";

/**
 * Minimal Redis client interface
 * Compatible with ioredis and similar clients
 */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(...args: any[]): Promise<string | null>;
  pttl(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  scan(
    ...args: any[]
  ): Promise<[string, string[]]>;
}

export interface RedisTokenGateCacheOptions {
  /** Redis client instance (ioredis or compatible) */
  redis: RedisClientLike;

  /** Key prefix (default: "tokengate") */
  keyPrefix?: string;
}

export class RedisTokenGateCache implements TokenGateCache {
  private redis: RedisClientLike;
  private keyPrefix: string;

  constructor(options: RedisTokenGateCacheOptions) {
    this.redis = options.redis;
    this.keyPrefix = options.keyPrefix ?? "tokengate";
  }

  private makeKey(key: TokenGateCacheKey): string {
    return `${this.keyPrefix}:${key.network}:${key.tokenAddress.toLowerCase()}:${key.address.toLowerCase()}`;
  }

  private blockKey(key: TokenGateCacheKey): string {
    return `${this.keyPrefix}:blocked:${key.network}:${key.tokenAddress.toLowerCase()}:${key.address.toLowerCase()}`;
  }

  async get(key: TokenGateCacheKey): Promise<TokenGateCacheEntry | undefined> {
    const data = await this.redis.get(this.makeKey(key));
    if (!data) return undefined;

    return JSON.parse(data, (k, v) => {
      // Restore bigint
      if (k === "balance") return BigInt(v);
      // Restore dates
      if (k === "checkedAt" || k === "expiresAt") return new Date(v);
      return v;
    });
  }

  async set(key: TokenGateCacheKey, entry: TokenGateCacheEntry): Promise<void> {
    const ttlMs = entry.expiresAt.getTime() - Date.now();
    if (ttlMs <= 0) return;

    const data = JSON.stringify(entry, (k, v) => {
      // Serialize bigint as string
      if (typeof v === "bigint") return v.toString();
      return v;
    });

    await this.redis.set(this.makeKey(key), data, "PX", ttlMs);
  }

  async isBlocked(
    key: TokenGateCacheKey
  ): Promise<{ blocked: boolean; expiresAt?: Date }> {
    const ttl = await this.redis.pttl(this.blockKey(key));

    // PTTL returns -2 if key doesn't exist, -1 if no TTL
    if (ttl <= 0) return { blocked: false };

    return {
      blocked: true,
      expiresAt: new Date(Date.now() + ttl),
    };
  }

  async block(key: TokenGateCacheKey, expiresAt: Date): Promise<void> {
    const ttlMs = expiresAt.getTime() - Date.now();
    if (ttlMs <= 0) return;

    // Just store "1" as value, TTL is what matters
    await this.redis.set(this.blockKey(key), "1", "PX", ttlMs);
  }

  async clear(): Promise<void> {
    // Use SCAN to avoid blocking on large datasets
    let cursor = "0";
    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        `${this.keyPrefix}:*`,
        "COUNT",
        100
      );
      cursor = newCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== "0");
  }
}
