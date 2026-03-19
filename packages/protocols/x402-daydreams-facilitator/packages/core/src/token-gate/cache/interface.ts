import type {
  TokenGateCacheEntry,
  TokenGateCacheKey,
  MaybePromise,
} from "../types.js";

export interface TokenGateCache {
  /**
   * Get cached entry for wallet+token+network
   * Returns undefined if not cached or expired
   */
  get(key: TokenGateCacheKey): MaybePromise<TokenGateCacheEntry | undefined>;

  /**
   * Store cache entry with TTL based on entry.expiresAt
   */
  set(key: TokenGateCacheKey, entry: TokenGateCacheEntry): MaybePromise<void>;

  /**
   * Check if wallet is in blocked list (insufficient balance)
   */
  isBlocked(
    key: TokenGateCacheKey
  ): MaybePromise<{ blocked: boolean; expiresAt?: Date }>;

  /**
   * Add wallet to blocked list
   */
  block(key: TokenGateCacheKey, expiresAt: Date): MaybePromise<void>;

  /**
   * Clear all entries (for testing)
   */
  clear(): MaybePromise<void>;
}
