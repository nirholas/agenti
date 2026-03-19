/**
 * Configuration for token requirement on a specific network
 */
export interface TokenRequirement {
  /** CAIP-2 network identifier (e.g., "eip155:8453" for Base) */
  network: string;

  /** Token contract address (ERC20 or SPL mint) */
  tokenAddress: string;

  /** Minimum balance required (in smallest unit, e.g., wei for 18 decimals) */
  minimumBalance: bigint;

  /** Human-readable name for error messages (optional) */
  tokenName?: string;

  /** Token decimals for display purposes (optional, not used for comparison) */
  decimals?: number;
}

/**
 * Cache entry for a wallet's token status
 */
export interface TokenGateCacheEntry {
  /** Wallet address (lowercase for consistency) */
  address: string;

  /** Token contract address */
  tokenAddress: string;

  /** Network identifier */
  network: string;

  /** Balance at check time */
  balance: bigint;

  /** Whether they met requirement at check time */
  hasEnough: boolean;

  /** When the check was made */
  checkedAt: Date;

  /** When this entry expires */
  expiresAt: Date;
}

/**
 * Key for cache lookups
 */
export interface TokenGateCacheKey {
  address: string;
  tokenAddress: string;
  network: string;
}

/**
 * Result from token gate check
 */
export type TokenGateResult =
  | { allowed: true; balance: bigint; fromCache: boolean }
  | {
      allowed: false;
      reason: "insufficient_balance" | "blocked" | "rpc_error";
      retryAfter?: Date;
    };

/**
 * Utility type for sync or async
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Token gate cache interface
 */
export interface TokenGateCache {
  get(key: TokenGateCacheKey): MaybePromise<TokenGateCacheEntry | undefined>;
  set(key: TokenGateCacheKey, entry: TokenGateCacheEntry): MaybePromise<void>;
  isBlocked(
    key: TokenGateCacheKey
  ): MaybePromise<{ blocked: boolean; expiresAt?: Date }>;
  block(key: TokenGateCacheKey, expiresAt: Date): MaybePromise<void>;
  clear(): MaybePromise<void>;
}

/**
 * Module configuration
 */
export interface TokenGateConfig {
  /** Token requirement */
  requirement: TokenRequirement;

  /** Cache TTL for valid wallets (ms, default: 300000 = 5 min) */
  validCacheTtlMs?: number;

  /** Cache TTL for blocked wallets (ms, default: 300000 = 5 min) */
  blockedCacheTtlMs?: number;

  /** Custom RPC URL (optional, uses network defaults) */
  rpcUrl?: string;

  /** Cache implementation (defaults to in-memory) */
  cache?: TokenGateCache;

  /** Allow requests if RPC is unavailable (default: false = fail closed) */
  allowOnRpcFailure?: boolean;
}
