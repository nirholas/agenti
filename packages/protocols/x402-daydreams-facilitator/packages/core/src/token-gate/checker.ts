import type {
  TokenGateConfig,
  TokenGateResult,
  TokenGateCacheEntry,
  TokenGateCacheKey,
  TokenGateCache,
} from "./types.js";
import { InMemoryTokenGateCache } from "./cache/memory.js";
import {
  checkEvmTokenBalance,
  parseEvmCaip2,
  isEvmNetwork,
} from "./networks/evm.js";
import {
  checkSplTokenBalance,
  parseSvmCaip2,
  isSvmNetwork,
} from "./networks/svm.js";
import { resolveRpcUrl, resolveSvmRpcUrl } from "../networks.js";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface TokenGateChecker {
  /**
   * Check if wallet meets token requirement
   * Uses cache, falls back to RPC on cache miss
   */
  check(wallet: string): Promise<TokenGateResult>;

  /**
   * Get the configured requirement
   */
  getRequirement(): TokenGateConfig["requirement"];
}

/**
 * Create a token gate checker for a single token requirement
 */
export function createTokenGateChecker(
  config: TokenGateConfig
): TokenGateChecker {
  const { requirement } = config;
  const cache: TokenGateCache = config.cache ?? new InMemoryTokenGateCache();
  const validTtlMs = config.validCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const blockedTtlMs = config.blockedCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  async function check(wallet: string): Promise<TokenGateResult> {
    const normalizedWallet = wallet.toLowerCase();

    const cacheKey: TokenGateCacheKey = {
      address: normalizedWallet,
      tokenAddress: requirement.tokenAddress.toLowerCase(),
      network: requirement.network,
    };

    // 1. Check if wallet is blocked (fast path for spam prevention)
    const blockStatus = await cache.isBlocked(cacheKey);
    if (blockStatus.blocked) {
      return {
        allowed: false,
        reason: "blocked",
        retryAfter: blockStatus.expiresAt,
      };
    }

    // 2. Check cache for previous valid check
    const cached = await cache.get(cacheKey);
    if (cached) {
      if (cached.hasEnough) {
        return {
          allowed: true,
          balance: cached.balance,
          fromCache: true,
        };
      }
      // Cached as insufficient - return blocked
      return {
        allowed: false,
        reason: "insufficient_balance",
        retryAfter: cached.expiresAt,
      };
    }

    // 3. Cache miss - check RPC
    try {
      const balance = await fetchBalance(
        normalizedWallet,
        requirement,
        config.rpcUrl
      );
      const hasEnough = balance >= requirement.minimumBalance;
      const now = new Date();
      const ttlMs = hasEnough ? validTtlMs : blockedTtlMs;

      // Cache the result
      const entry: TokenGateCacheEntry = {
        address: normalizedWallet,
        tokenAddress: requirement.tokenAddress.toLowerCase(),
        network: requirement.network,
        balance,
        hasEnough,
        checkedAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
      };

      await cache.set(cacheKey, entry);

      if (!hasEnough) {
        // Also add to blocked list for fast rejection
        await cache.block(cacheKey, entry.expiresAt);

        return {
          allowed: false,
          reason: "insufficient_balance",
          retryAfter: entry.expiresAt,
        };
      }

      return {
        allowed: true,
        balance,
        fromCache: false,
      };
    } catch (error) {
      console.error("[token-gate] RPC error:", error);

      if (config.allowOnRpcFailure) {
        // Fail open (allow) if configured
        return {
          allowed: true,
          balance: 0n,
          fromCache: false,
        };
      }

      // Fail closed (deny) by default
      return {
        allowed: false,
        reason: "rpc_error",
      };
    }
  }

  function getRequirement() {
    return requirement;
  }

  return { check, getRequirement };
}

/**
 * Fetch token balance from appropriate network
 */
async function fetchBalance(
  wallet: string,
  requirement: TokenGateConfig["requirement"],
  customRpcUrl?: string
): Promise<bigint> {
  const { network, tokenAddress } = requirement;

  if (isEvmNetwork(network)) {
    const internalNetwork = parseEvmCaip2(network);
    if (!internalNetwork) {
      throw new Error(`Unsupported EVM network: ${network}`);
    }

    const rpcUrl = customRpcUrl ?? resolveRpcUrl(internalNetwork);
    if (!rpcUrl) {
      throw new Error(`No RPC URL available for network: ${internalNetwork}`);
    }

    return checkEvmTokenBalance({
      network: internalNetwork,
      rpcUrl,
      tokenAddress: tokenAddress as `0x${string}`,
      walletAddress: wallet as `0x${string}`,
    });
  }

  if (isSvmNetwork(network)) {
    const internalNetwork = parseSvmCaip2(network);
    if (!internalNetwork) {
      throw new Error(`Unsupported Solana network: ${network}`);
    }

    const rpcUrl = customRpcUrl ?? resolveSvmRpcUrl(internalNetwork);
    if (!rpcUrl) {
      throw new Error(`No RPC URL available for network: ${internalNetwork}`);
    }

    return checkSplTokenBalance({
      network: internalNetwork,
      rpcUrl,
      tokenMint: tokenAddress,
      walletAddress: wallet,
    });
  }

  throw new Error(`Unsupported network type: ${network}`);
}
