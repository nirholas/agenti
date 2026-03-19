/**
 * Token constants and utilities for Starknet
 * Canonical token addresses for supported networks
 */

import type { StarknetNetworkId } from '../types/index.js';

/**
 * Supported token symbols
 */
export type TokenSymbol = 'ETH' | 'STRK' | 'USDC';

/**
 * ETH contract addresses by network
 * ETH uses 18 decimals on Starknet
 *
 * Note: ETH address is the same on mainnet and sepolia
 */
export const ETH_ADDRESSES: Partial<Record<StarknetNetworkId, string>> = {
  'starknet:mainnet':
    '0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7',
  'starknet:sepolia':
    '0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7',
} as const;

/**
 * STRK contract addresses by network
 * STRK uses 18 decimals on Starknet
 *
 * Note: STRK address is the same on mainnet and sepolia
 */
export const STRK_ADDRESSES: Partial<Record<StarknetNetworkId, string>> = {
  'starknet:mainnet':
    '0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D',
  'starknet:sepolia':
    '0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D',
} as const;

/**
 * USDC contract addresses by network
 * USDC uses 6 decimals on Starknet
 *
 * Note: USDC is only available on mainnet
 */
export const USDC_ADDRESSES: Partial<Record<StarknetNetworkId, string>> = {
  'starknet:mainnet':
    '0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb',
  // USDC not available on sepolia
} as const;

/**
 * Token decimals by symbol
 */
export const TOKEN_DECIMALS: Record<TokenSymbol, number> = {
  ETH: 18,
  STRK: 18,
  USDC: 6,
} as const;

/**
 * All token addresses indexed by symbol and network
 */
export const TOKEN_ADDRESSES: Record<
  TokenSymbol,
  Partial<Record<StarknetNetworkId, string>>
> = {
  ETH: ETH_ADDRESSES,
  STRK: STRK_ADDRESSES,
  USDC: USDC_ADDRESSES,
} as const;

/**
 * Get token address for a network
 *
 * @param symbol - Token symbol (ETH, STRK, USDC)
 * @param network - Network identifier
 * @returns Token contract address or undefined if not available
 *
 * @example
 * ```typescript
 * const ethAddress = getTokenAddress('ETH', 'starknet:mainnet');
 * const usdcAddress = getTokenAddress('USDC', 'starknet:mainnet');
 *
 * // Returns undefined for unsupported combinations
 * const sepoliaUsdc = getTokenAddress('USDC', 'starknet:sepolia'); // undefined
 * ```
 */
export function getTokenAddress(
  symbol: TokenSymbol,
  network: StarknetNetworkId
): string | undefined {
  return TOKEN_ADDRESSES[symbol][network];
}

/**
 * Get token decimals
 *
 * @param symbol - Token symbol
 * @returns Number of decimals for the token
 *
 * @example
 * ```typescript
 * const decimals = getTokenDecimals('USDC');
 * console.log(decimals); // 6
 * ```
 */
export function getTokenDecimals(symbol: TokenSymbol): number {
  return TOKEN_DECIMALS[symbol];
}

/**
 * Convert human-readable amount to atomic units (smallest unit)
 *
 * @param amount - Amount in human-readable units (e.g., 1.5 for 1.5 USDC)
 * @param symbol - Token symbol
 * @returns Amount in atomic units as string
 *
 * @example
 * ```typescript
 * const atomic = toAtomicUnits(1.5, 'USDC');
 * console.log(atomic); // '1500000' (1.5 * 10^6)
 *
 * const ethAtomic = toAtomicUnits(0.001, 'ETH');
 * console.log(ethAtomic); // '1000000000000000' (0.001 * 10^18)
 * ```
 */
export function toAtomicUnits(amount: number, symbol: TokenSymbol): string {
  const decimals = TOKEN_DECIMALS[symbol];
  // Use BigInt for precision with large numbers
  const multiplier = 10n ** BigInt(decimals);
  // Convert to fixed-point to avoid floating point errors
  const atomicUnits = BigInt(Math.round(amount * Number(multiplier)));
  return atomicUnits.toString();
}

/**
 * Convert atomic units to human-readable amount
 *
 * @param atomicUnits - Amount in atomic units (smallest unit)
 * @param symbol - Token symbol
 * @returns Amount in human-readable units
 *
 * @example
 * ```typescript
 * const amount = fromAtomicUnits('1500000', 'USDC');
 * console.log(amount); // 1.5
 *
 * const ethAmount = fromAtomicUnits('1000000000000000', 'ETH');
 * console.log(ethAmount); // 0.001
 * ```
 */
export function fromAtomicUnits(
  atomicUnits: string,
  symbol: TokenSymbol
): number {
  const decimals = TOKEN_DECIMALS[symbol];
  const divisor = 10 ** decimals;
  return Number(BigInt(atomicUnits)) / divisor;
}

/**
 * Identify token symbol from contract address
 *
 * @param address - Token contract address
 * @param network - Network identifier
 * @returns Token symbol or undefined if not recognized
 *
 * @example
 * ```typescript
 * const symbol = getTokenSymbol(
 *   '0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7',
 *   'starknet:mainnet'
 * );
 * console.log(symbol); // 'ETH'
 * ```
 */
export function getTokenSymbol(
  address: string,
  network: StarknetNetworkId
): TokenSymbol | undefined {
  const normalizedAddress = address.toLowerCase();

  for (const [symbol, addresses] of Object.entries(TOKEN_ADDRESSES)) {
    const networkAddress = addresses[network];
    if (networkAddress && networkAddress.toLowerCase() === normalizedAddress) {
      return symbol as TokenSymbol;
    }
  }

  return undefined;
}

/**
 * Check if a token is available on a network
 *
 * @param symbol - Token symbol
 * @param network - Network identifier
 * @returns True if the token is available on the network
 *
 * @example
 * ```typescript
 * console.log(isTokenAvailable('USDC', 'starknet:mainnet')); // true
 * console.log(isTokenAvailable('USDC', 'starknet:sepolia')); // false
 * ```
 */
export function isTokenAvailable(
  symbol: TokenSymbol,
  network: StarknetNetworkId
): boolean {
  return TOKEN_ADDRESSES[symbol][network] !== undefined;
}

/**
 * Get all available tokens for a network
 *
 * @param network - Network identifier
 * @returns Array of available token symbols
 *
 * @example
 * ```typescript
 * const mainnetTokens = getAvailableTokens('starknet:mainnet');
 * console.log(mainnetTokens); // ['ETH', 'STRK', 'USDC']
 *
 * const sepoliaTokens = getAvailableTokens('starknet:sepolia');
 * console.log(sepoliaTokens); // ['ETH', 'STRK']
 * ```
 */
export function getAvailableTokens(
  network: StarknetNetworkId
): Array<TokenSymbol> {
  const tokens: Array<TokenSymbol> = [];

  for (const symbol of ['ETH', 'STRK', 'USDC'] as const) {
    if (TOKEN_ADDRESSES[symbol][network] !== undefined) {
      tokens.push(symbol);
    }
  }

  return tokens;
}
