/**
 * Configuration for the x402 fetch middleware.
 */

export interface X402Config {
  /**
   * Maximum amount in USD to pay per single request.
   * Requests with a higher price are blocked.
   * Default: 1.00
   */
  maxAmountPerCall?: number;

  /**
   * Maximum total spend across all requests (lifetime budget for this instance).
   * Default: unlimited
   */
  maxTotalSpend?: number;

  /**
   * Accepted payment chains. Default: ["solana"]
   */
  acceptedChains?: string[];

  /**
   * Accepted payment tokens. Default: ["USDC"]
   */
  acceptedTokens?: string[];

  /**
   * If true, logs payment activity to console.
   * Default: false
   */
  debug?: boolean;
}

export const DEFAULT_CONFIG: Required<X402Config> = {
  maxAmountPerCall: 1.0,
  maxTotalSpend: Infinity,
  acceptedChains: ["solana"],
  acceptedTokens: ["USDC"],
  debug: false,
};
