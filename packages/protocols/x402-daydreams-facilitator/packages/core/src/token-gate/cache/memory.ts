import type { TokenGateCache } from "./interface.js";
import type { TokenGateCacheEntry, TokenGateCacheKey } from "../types.js";

export class InMemoryTokenGateCache implements TokenGateCache {
  private cache = new Map<string, TokenGateCacheEntry>();
  private blocked = new Map<string, Date>();

  private makeKey(key: TokenGateCacheKey): string {
    return `${key.network}:${key.tokenAddress.toLowerCase()}:${key.address.toLowerCase()}`;
  }

  get(key: TokenGateCacheKey): TokenGateCacheEntry | undefined {
    const k = this.makeKey(key);
    const entry = this.cache.get(k);

    if (!entry) return undefined;

    // Check expiry
    if (entry.expiresAt < new Date()) {
      this.cache.delete(k);
      return undefined;
    }

    return entry;
  }

  set(key: TokenGateCacheKey, entry: TokenGateCacheEntry): void {
    this.cache.set(this.makeKey(key), entry);
  }

  isBlocked(key: TokenGateCacheKey): { blocked: boolean; expiresAt?: Date } {
    const k = this.makeKey(key);
    const expiresAt = this.blocked.get(k);

    if (!expiresAt) return { blocked: false };

    // Check expiry
    if (expiresAt < new Date()) {
      this.blocked.delete(k);
      return { blocked: false };
    }

    return { blocked: true, expiresAt };
  }

  block(key: TokenGateCacheKey, expiresAt: Date): void {
    this.blocked.set(this.makeKey(key), expiresAt);
  }

  clear(): void {
    this.cache.clear();
    this.blocked.clear();
  }
}
