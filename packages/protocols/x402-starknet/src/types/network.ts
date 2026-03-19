/**
 * Network type definitions for Starknet x402
 * Spec compliance: x402 v2 - CAIP-2 network identifiers
 */

/**
 * Supported Starknet networks (CAIP-2 format)
 * Format: "starknet:{reference}"
 * @see https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
 */
export type StarknetNetworkId =
  | 'starknet:mainnet'
  | 'starknet:sepolia'
  | 'starknet:devnet';

/**
 * Alias for StarknetNetworkId (v2 uses only CAIP-2 format)
 */
export type StarknetNetwork = StarknetNetworkId;

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  /** Network identifier (CAIP-2 format) */
  network: StarknetNetworkId;
  /** Starknet chain ID */
  chainId: string;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer URL (null for local devnet) */
  explorerUrl: string | null;
  /** Network display name */
  name: string;
}

/**
 * Starknet account configuration
 */
export interface AccountConfig {
  /** Account contract address */
  address: string;
  /** Private key for signing (optional for read-only) */
  privateKey?: string;
  /** Network the account is on */
  network: StarknetNetworkId;
}

/**
 * RPC provider options
 */
export interface ProviderOptions {
  /** Network to connect to */
  network: StarknetNetworkId;
  /** Custom RPC URL (overrides default) */
  rpcUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
}

/**
 * Valid CAIP-2 network identifiers
 */
const VALID_NETWORKS: ReadonlySet<string> = new Set([
  'starknet:mainnet',
  'starknet:sepolia',
  'starknet:devnet',
]);

/**
 * Check if a network identifier is valid (CAIP-2 format)
 * @param network - Network identifier to check
 * @returns True if the network is a valid CAIP-2 network
 */
export function isCAIP2Network(network: string): network is StarknetNetworkId {
  return VALID_NETWORKS.has(network);
}

/**
 * Validate and return a network identifier
 * @param network - Network identifier to validate
 * @returns The validated network identifier
 * @throws Error if network is not valid
 */
export function toCAIP2Network(network: StarknetNetworkId): StarknetNetworkId {
  if (!isCAIP2Network(network)) {
    throw new Error(`Invalid network: ${String(network)}`);
  }
  return network;
}

/**
 * Normalize a network identifier (validates CAIP-2 format)
 * @param network - Network identifier
 * @returns Validated network identifier
 */
export function normalizeNetwork(
  network: StarknetNetworkId
): StarknetNetworkId {
  return toCAIP2Network(network);
}

/**
 * Check if two network identifiers are equal
 * @param a - First network identifier
 * @param b - Second network identifier
 * @returns True if both are the same network
 */
export function networksEqual(
  a: StarknetNetworkId,
  b: StarknetNetworkId
): boolean {
  return a === b;
}
