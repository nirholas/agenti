/**
 * Network constants for Starknet
 * Spec compliance: x402 v2 - CAIP-2 network identifiers
 */

import type { NetworkConfig, StarknetNetworkId } from '../types/index.js';

/**
 * Supported Starknet networks in CAIP-2 format
 * Use this array to iterate over all supported networks
 *
 * @example
 * ```typescript
 * for (const network of STARKNET_NETWORKS) {
 *   console.log(network); // 'starknet:mainnet', etc.
 * }
 * ```
 */
export const STARKNET_NETWORKS = [
  'starknet:mainnet',
  'starknet:sepolia',
  'starknet:devnet',
] as const satisfies ReadonlyArray<StarknetNetworkId>;

/**
 * Starknet chain IDs
 */
export const CHAIN_IDS = {
  MAINNET: '0x534e5f4d41494e', // SN_MAIN
  SEPOLIA: '0x534e5f5345504f4c4941', // SN_SEPOLIA
  DEVNET: '0x534e5f474f45524c49', // SN_GOERLI (commonly used for devnet)
} as const;

/**
 * Default RPC URLs for Starknet networks (keyed by CAIP-2 identifier)
 */
export const DEFAULT_RPC_URLS: Record<StarknetNetworkId, string> = {
  'starknet:mainnet': 'https://starknet-mainnet.public.blastapi.io',
  'starknet:sepolia': 'https://starknet-sepolia.public.blastapi.io',
  'starknet:devnet': 'http://localhost:5050',
} as const;

/**
 * Block explorer URLs (keyed by CAIP-2 identifier)
 */
export const EXPLORER_URLS: Record<StarknetNetworkId, string | null> = {
  'starknet:mainnet': 'https://starkscan.co',
  'starknet:sepolia': 'https://sepolia.starkscan.co',
  'starknet:devnet': null,
} as const;

/**
 * Network display names (keyed by CAIP-2 identifier)
 */
export const NETWORK_NAMES: Record<StarknetNetworkId, string> = {
  'starknet:mainnet': 'Starknet Mainnet',
  'starknet:sepolia': 'Starknet Sepolia Testnet',
  'starknet:devnet': 'Starknet Devnet (Local)',
} as const;

/**
 * Network reference type (the part after "starknet:" in CAIP-2)
 */
export type NetworkReference = 'mainnet' | 'sepolia' | 'devnet';

/**
 * Network references for extracting the reference part from CAIP-2 identifiers
 * Maps CAIP-2 network identifier to its reference component
 *
 * @example
 * ```typescript
 * const ref = NETWORK_REFERENCES['starknet:mainnet'];
 * console.log(ref); // 'mainnet'
 * ```
 */
export const NETWORK_REFERENCES: Record<StarknetNetworkId, NetworkReference> = {
  'starknet:mainnet': 'mainnet',
  'starknet:sepolia': 'sepolia',
  'starknet:devnet': 'devnet',
} as const;

/**
 * Complete network configurations (keyed by CAIP-2 identifier)
 */
export const NETWORK_CONFIGS: Record<StarknetNetworkId, NetworkConfig> = {
  'starknet:mainnet': {
    network: 'starknet:mainnet',
    chainId: CHAIN_IDS.MAINNET,
    rpcUrl: DEFAULT_RPC_URLS['starknet:mainnet'],
    explorerUrl: EXPLORER_URLS['starknet:mainnet'],
    name: NETWORK_NAMES['starknet:mainnet'],
  },
  'starknet:sepolia': {
    network: 'starknet:sepolia',
    chainId: CHAIN_IDS.SEPOLIA,
    rpcUrl: DEFAULT_RPC_URLS['starknet:sepolia'],
    explorerUrl: EXPLORER_URLS['starknet:sepolia'],
    name: NETWORK_NAMES['starknet:sepolia'],
  },
  'starknet:devnet': {
    network: 'starknet:devnet',
    chainId: CHAIN_IDS.DEVNET,
    rpcUrl: DEFAULT_RPC_URLS['starknet:devnet'],
    explorerUrl: EXPLORER_URLS['starknet:devnet'],
    name: NETWORK_NAMES['starknet:devnet'],
  },
};

/**
 * Default provider timeout in milliseconds
 */
export const DEFAULT_PROVIDER_TIMEOUT = 30000;

/**
 * Default number of retry attempts for RPC calls
 */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Default backoff multiplier for retries
 */
export const DEFAULT_BACKOFF_MULTIPLIER = 2;
