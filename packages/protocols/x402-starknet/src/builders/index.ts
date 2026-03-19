/**
 * Payment builder utilities
 * Convenient helpers for constructing payment requirements
 * @module builders
 */

import type { PaymentRequirements } from '../types/payment.js';
import type { StarknetNetworkId } from '../types/network.js';
import {
  getTokenAddress,
  toAtomicUnits,
  isTokenAvailable,
  type TokenSymbol,
} from '../tokens/index.js';
import { err } from '../errors.js';

/**
 * Parameters for building payment requirements
 */
export interface PaymentRequirementsParams {
  /** Target network (CAIP-2 format) */
  network: StarknetNetworkId;
  /** Payment amount in human-readable units (e.g., 1.50 for $1.50 USDC) */
  amount: number;
  /** Token symbol (ETH, STRK, USDC) or contract address */
  asset: string;
  /** Recipient address */
  payTo: string;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
  /** Extra metadata to include */
  extra?: {
    /** Token name (auto-filled for known tokens) */
    name?: string;
    /** Token symbol (auto-filled for known tokens) */
    symbol?: string;
    /** Token decimals (auto-filled for known tokens) */
    decimals?: number;
    /** Payment contract address */
    paymentContract?: string;
  };
}

/**
 * Check if a string is a known token symbol
 */
function isTokenSymbol(value: string): value is TokenSymbol {
  return value === 'ETH' || value === 'STRK' || value === 'USDC';
}

/**
 * Get token metadata for known tokens
 */
function getTokenMetadata(symbol: TokenSymbol): {
  name: string;
  symbol: string;
  decimals: number;
} {
  switch (symbol) {
    case 'ETH':
      return { name: 'Ether', symbol: 'ETH', decimals: 18 };
    case 'STRK':
      return { name: 'Starknet Token', symbol: 'STRK', decimals: 18 };
    case 'USDC':
      return { name: 'USD Coin', symbol: 'USDC', decimals: 6 };
  }
}

/**
 * Build a PaymentRequirements object
 *
 * Automatically handles:
 * - Token address resolution for known tokens (ETH, STRK, USDC)
 * - Amount conversion to atomic units
 * - Token metadata population
 *
 * @param params - Payment requirement parameters
 * @returns Fully-formed PaymentRequirements object
 * @throws Error if token is not available on the network
 *
 * @example
 * ```typescript
 * // Using a known token symbol
 * const requirements = buildPaymentRequirements({
 *   network: 'starknet:mainnet',
 *   amount: 1.50,  // $1.50 USDC
 *   asset: 'USDC',
 *   payTo: '0x1234...',
 * });
 *
 * // Using a custom token address
 * const requirements = buildPaymentRequirements({
 *   network: 'starknet:mainnet',
 *   amount: 1000000,  // Amount in atomic units
 *   asset: '0xCustomTokenAddress...',
 *   payTo: '0x1234...',
 *   extra: {
 *     name: 'Custom Token',
 *     symbol: 'CTK',
 *     decimals: 18,
 *   },
 * });
 * ```
 */
export function buildPaymentRequirements(
  params: PaymentRequirementsParams
): PaymentRequirements {
  let assetAddress: string;
  let atomicAmount: string;
  let extra = params.extra;

  if (isTokenSymbol(params.asset)) {
    // Known token - resolve address and convert amount
    if (!isTokenAvailable(params.asset, params.network)) {
      throw err.invalid(
        `Token ${params.asset} is not available on ${params.network}`,
        { token: params.asset, network: params.network }
      );
    }

    const address = getTokenAddress(params.asset, params.network);
    if (!address) {
      throw err.invalid(
        `Token ${params.asset} is not available on ${params.network}`,
        { token: params.asset, network: params.network }
      );
    }

    assetAddress = address;
    atomicAmount = toAtomicUnits(params.amount, params.asset);

    // Auto-populate token metadata if not provided
    const metadata = getTokenMetadata(params.asset);
    extra = {
      name: params.extra?.name ?? metadata.name,
      symbol: params.extra?.symbol ?? metadata.symbol,
      decimals: params.extra?.decimals ?? metadata.decimals,
      ...(params.extra?.paymentContract && {
        paymentContract: params.extra.paymentContract,
      }),
    };
  } else {
    // Custom token address - use amount as-is (assume already in atomic units)
    assetAddress = params.asset;
    atomicAmount = String(params.amount);
  }

  return {
    scheme: 'exact',
    network: params.network,
    amount: atomicAmount,
    asset: assetAddress,
    payTo: params.payTo,
    maxTimeoutSeconds: params.maxTimeoutSeconds ?? 300,
    ...(extra && { extra }),
  };
}

/**
 * Parameters for ETH payment requirements
 */
export interface ETHPaymentParams {
  /** Target network (CAIP-2 format) */
  network: StarknetNetworkId;
  /** Amount in ETH (e.g., 0.001 for 0.001 ETH) */
  amount: number;
  /** Recipient address */
  payTo: string;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
}

/**
 * Build payment requirements for ETH
 *
 * @param params - ETH payment parameters
 * @returns PaymentRequirements for ETH payment
 *
 * @example
 * ```typescript
 * const requirements = buildETHPayment({
 *   network: 'starknet:mainnet',
 *   amount: 0.001,  // 0.001 ETH
 *   payTo: '0x1234...',
 * });
 * ```
 */
export function buildETHPayment(params: ETHPaymentParams): PaymentRequirements {
  return buildPaymentRequirements({
    network: params.network,
    amount: params.amount,
    asset: 'ETH',
    payTo: params.payTo,
    ...(params.maxTimeoutSeconds !== undefined && {
      maxTimeoutSeconds: params.maxTimeoutSeconds,
    }),
  });
}

/**
 * Parameters for STRK payment requirements
 */
export interface STRKPaymentParams {
  /** Target network (CAIP-2 format) */
  network: StarknetNetworkId;
  /** Amount in STRK (e.g., 1.0 for 1 STRK) */
  amount: number;
  /** Recipient address */
  payTo: string;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
}

/**
 * Build payment requirements for STRK
 *
 * @param params - STRK payment parameters
 * @returns PaymentRequirements for STRK payment
 *
 * @example
 * ```typescript
 * const requirements = buildSTRKPayment({
 *   network: 'starknet:mainnet',
 *   amount: 10,  // 10 STRK
 *   payTo: '0x1234...',
 * });
 * ```
 */
export function buildSTRKPayment(
  params: STRKPaymentParams
): PaymentRequirements {
  return buildPaymentRequirements({
    network: params.network,
    amount: params.amount,
    asset: 'STRK',
    payTo: params.payTo,
    ...(params.maxTimeoutSeconds !== undefined && {
      maxTimeoutSeconds: params.maxTimeoutSeconds,
    }),
  });
}

/**
 * Parameters for USDC payment requirements
 */
export interface USDCPaymentParams {
  /** Target network (CAIP-2 format) - Note: USDC only available on mainnet */
  network: StarknetNetworkId;
  /** Amount in USD (e.g., 1.50 for $1.50) */
  amount: number;
  /** Recipient address */
  payTo: string;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
}

/**
 * Build payment requirements for USDC
 *
 * Note: USDC is only available on mainnet. This will throw an error
 * if used with sepolia or devnet.
 *
 * @param params - USDC payment parameters
 * @returns PaymentRequirements for USDC payment
 * @throws Error if USDC is not available on the specified network
 *
 * @example
 * ```typescript
 * const requirements = buildUSDCPayment({
 *   network: 'starknet:mainnet',
 *   amount: 1.50,  // $1.50 USDC
 *   payTo: '0x1234...',
 * });
 * ```
 */
export function buildUSDCPayment(
  params: USDCPaymentParams
): PaymentRequirements {
  return buildPaymentRequirements({
    network: params.network,
    amount: params.amount,
    asset: 'USDC',
    payTo: params.payTo,
    ...(params.maxTimeoutSeconds !== undefined && {
      maxTimeoutSeconds: params.maxTimeoutSeconds,
    }),
  });
}
