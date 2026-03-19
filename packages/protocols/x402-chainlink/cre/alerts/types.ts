/**
 * Shared Type Definitions
 * 
 * This module contains type definitions shared across the CRE workflow files.
 * Centralizing types here ensures consistency and makes maintenance easier.
 */

/**
 * Configuration type for the CRE workflow
 */
export type Config = {
  /** Cron schedule (e.g., "0 0 * * * *" for hourly) */
  schedule: string;
  /** Public key for HTTP trigger authorization */
  publicKey: string;
  /** Webhook URL (deprecated, kept for compatibility) */
  webhookUrl: string;
  /** Rule TTL in seconds (rules older than this will be skipped) */
  ruleTTL: number;
  /** EVM network configuration */
  evms: Array<{
    /** RuleRegistry contract address */
    ruleRegistryAddress: string;
    /** Chain selector name (e.g., "ethereum-testnet-sepolia-base-1") */
    chainSelectorName: string;
    /** Gas limit for on-chain writes */
    gasLimit: string;
    /** Chainlink price feed addresses */
    dataFeeds?: {
      BTC?: string;
      ETH?: string;
      LINK?: string;
    };
  }>;
};

/**
 * HTTP response type for Pushover API
 */
export type PostResponse = {
  statusCode: number;
};

/**
 * Price alert rule structure (matches RuleRegistry contract)
 * 
 * This structure matches the Rule struct defined in RuleRegistry.sol
 */
export type Rule = {
  /** Deterministic rule ID (bytes32 hash of alert data) */
  id: `0x${string}`;
  /** Cryptocurrency asset symbol (BTC, ETH, LINK) */
  asset: string;
  /** Price condition string (gt, lt, gte, lte) */
  condition: string;
  /** Target price in USD (as bigint, no decimals) */
  targetPriceUsd: bigint;
  /** UNIX timestamp when rule was created (seconds) */
  createdAt: bigint;
};

/**
 * Chainlink price feed data structure
 * 
 * This structure matches the return value of latestRoundData() from Chainlink price feeds
 */
export type PriceData = {
  /** Round ID for this price update */
  roundId: bigint;
  /** Price answer (with 8 decimals for USD pairs) */
  answer: bigint;
  /** Timestamp when the round started */
  startedAt: bigint;
  /** Timestamp when the round was updated */
  updatedAt: bigint;
  /** Round ID in which the answer was computed */
  answeredInRound: bigint;
};

