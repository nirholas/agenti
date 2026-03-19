/**
 * Network configuration and utilities for Starknet x402
 * Spec compliance: x402 v2 - CAIP-2 network identifiers
 * @module networks
 */

import type { NetworkConfig, StarknetNetworkId } from '../types/index.js';
import {
  NETWORK_CONFIGS,
  CHAIN_IDS,
  EXPLORER_URLS,
  STARKNET_NETWORKS,
  NETWORK_REFERENCES,
  type NetworkReference,
} from './constants.js';
import { err } from '../errors.js';

/**
 * Get network configuration for a given network
 * @param network - The network identifier (CAIP-2 format)
 * @returns Network configuration
 *
 * @example
 * ```typescript
 * const config = getNetworkConfig('starknet:sepolia');
 * console.log(config.rpcUrl); // https://starknet-sepolia.public.blastapi.io
 * ```
 */
export function getNetworkConfig(network: StarknetNetworkId): NetworkConfig {
  return NETWORK_CONFIGS[network];
}

/**
 * Get network identifier from chain ID
 * @param chainId - The chain ID (as hex string)
 * @returns Network identifier in CAIP-2 format
 * @throws Error if chain ID is not recognized
 *
 * @example
 * ```typescript
 * const network = getNetworkFromChainId('0x534e5f5345504f4c4941');
 * console.log(network); // 'starknet:sepolia'
 * ```
 */
export function getNetworkFromChainId(chainId: string): StarknetNetworkId {
  const normalizedChainId = chainId.toLowerCase();

  for (const [network, id] of Object.entries(CHAIN_IDS)) {
    if (id.toLowerCase() === normalizedChainId) {
      switch (network) {
        case 'MAINNET':
          return 'starknet:mainnet';
        case 'SEPOLIA':
          return 'starknet:sepolia';
        case 'DEVNET':
          return 'starknet:devnet';
      }
    }
  }

  throw err.notFound(`Network with chain ID ${chainId}`);
}

/**
 * Check if a network is a testnet
 * @param network - The network identifier
 * @returns True if the network is a testnet
 *
 * @example
 * ```typescript
 * console.log(isTestnet('starknet:sepolia')); // true
 * console.log(isTestnet('starknet:mainnet')); // false
 * ```
 */
export function isTestnet(network: StarknetNetworkId): boolean {
  return network === 'starknet:sepolia' || network === 'starknet:devnet';
}

/**
 * Check if a network is mainnet
 * @param network - The network identifier
 * @returns True if the network is mainnet
 *
 * @example
 * ```typescript
 * console.log(isMainnet('starknet:mainnet')); // true
 * console.log(isMainnet('starknet:sepolia')); // false
 * ```
 */
export function isMainnet(network: StarknetNetworkId): boolean {
  return network === 'starknet:mainnet';
}

/**
 * Get all supported networks
 * @returns Array of supported network identifiers in CAIP-2 format
 *
 * @example
 * ```typescript
 * const networks = getSupportedNetworks();
 * console.log(networks); // ['starknet:mainnet', 'starknet:sepolia', 'starknet:devnet']
 * ```
 */
export function getSupportedNetworks(): Array<StarknetNetworkId> {
  return Object.keys(NETWORK_CONFIGS) as Array<StarknetNetworkId>;
}

/**
 * Get explorer URL for a transaction
 * @param network - The network identifier
 * @param txHash - The transaction hash
 * @returns Full URL to view transaction, or null if no explorer
 *
 * @example
 * ```typescript
 * const url = getTransactionUrl('starknet:sepolia', '0x1234...');
 * console.log(url); // 'https://sepolia.starkscan.co/tx/0x1234...'
 * ```
 */
export function getTransactionUrl(
  network: StarknetNetworkId,
  txHash: string
): string | null {
  const explorerUrl = EXPLORER_URLS[network];
  if (!explorerUrl) {
    return null;
  }
  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 * @param network - The network identifier
 * @param address - The contract or account address
 * @returns Full URL to view address, or null if no explorer
 *
 * @example
 * ```typescript
 * const url = getAddressUrl('starknet:sepolia', '0x1234...');
 * console.log(url); // 'https://sepolia.starkscan.co/contract/0x1234...'
 * ```
 */
export function getAddressUrl(
  network: StarknetNetworkId,
  address: string
): string | null {
  const explorerUrl = EXPLORER_URLS[network];
  if (!explorerUrl) {
    return null;
  }
  return `${explorerUrl}/contract/${address}`;
}

/**
 * Validate network configuration
 * @param network - The network identifier
 * @throws Error if network configuration is invalid
 */
export function validateNetworkConfig(network: StarknetNetworkId): void {
  const config = getNetworkConfig(network);

  if (!config.chainId) {
    throw err.invalid(`Network ${network} missing chain ID`, { network });
  }

  if (!config.rpcUrl) {
    throw err.invalid(`Network ${network} missing RPC URL`, { network });
  }

  try {
    new URL(config.rpcUrl);
  } catch {
    throw err.invalid(`Network ${network} has invalid RPC URL`, {
      network,
      rpcUrl: config.rpcUrl,
    });
  }
}

/**
 * Check if a string is a valid Starknet network identifier
 * @param network - String to check
 * @returns True if the string is a valid Starknet network identifier
 *
 * @example
 * ```typescript
 * if (isStarknetNetwork(userInput)) {
 *   // userInput is now typed as StarknetNetworkId
 *   const config = getNetworkConfig(userInput);
 * }
 * ```
 */
export function isStarknetNetwork(
  network: string
): network is StarknetNetworkId {
  return (STARKNET_NETWORKS as ReadonlyArray<string>).includes(network);
}

/**
 * Parse a CAIP-2 Starknet network identifier into its components
 * @param caip2 - CAIP-2 network identifier (e.g., "starknet:mainnet")
 * @returns Object with namespace ("starknet") and reference (e.g., "mainnet")
 * @throws Error if not a valid Starknet CAIP-2 identifier
 *
 * @example
 * ```typescript
 * const { namespace, reference } = parseStarknetNetwork('starknet:sepolia');
 * console.log(namespace);  // 'starknet'
 * console.log(reference);  // 'sepolia'
 * ```
 */
export function parseStarknetNetwork(caip2: string): {
  namespace: 'starknet';
  reference: NetworkReference;
} {
  if (!caip2.startsWith('starknet:')) {
    throw err.invalid(`Invalid Starknet CAIP-2 identifier: ${caip2}`, {
      caip2,
      expected: 'starknet:{reference}',
    });
  }

  const reference = caip2.slice(9); // Remove "starknet:" prefix

  if (!['mainnet', 'sepolia', 'devnet'].includes(reference)) {
    throw err.invalid(`Invalid Starknet network reference: ${reference}`, {
      caip2,
      validReferences: ['mainnet', 'sepolia', 'devnet'],
    });
  }

  return { namespace: 'starknet', reference: reference as NetworkReference };
}

/**
 * Build a CAIP-2 identifier from a Starknet network reference
 * @param reference - Network reference (e.g., "mainnet", "sepolia", "devnet")
 * @returns CAIP-2 network identifier
 *
 * @example
 * ```typescript
 * const network = buildStarknetCAIP2('sepolia');
 * console.log(network); // 'starknet:sepolia'
 * ```
 */
export function buildStarknetCAIP2(
  reference: NetworkReference
): StarknetNetworkId {
  return `starknet:${reference}` as StarknetNetworkId;
}

/**
 * Get the network reference from a CAIP-2 identifier
 * @param network - CAIP-2 network identifier
 * @returns Network reference (e.g., "mainnet", "sepolia", "devnet")
 *
 * @example
 * ```typescript
 * const ref = getNetworkReference('starknet:mainnet');
 * console.log(ref); // 'mainnet'
 * ```
 */
export function getNetworkReference(
  network: StarknetNetworkId
): NetworkReference {
  return NETWORK_REFERENCES[network];
}

/**
 * Validate a network string and return it as a typed StarknetNetworkId
 * @param network - Network string to validate
 * @returns Validated network identifier
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * try {
 *   const validNetwork = validateNetwork(userInput);
 *   // validNetwork is now typed as StarknetNetworkId
 * } catch (error) {
 *   console.error('Invalid network:', error.message);
 * }
 * ```
 */
export function validateNetwork(network: string): StarknetNetworkId {
  if (!isStarknetNetwork(network)) {
    throw err.invalid(
      `Unsupported Starknet network: ${network}. Supported: ${STARKNET_NETWORKS.join(', ')}`,
      { network, supported: STARKNET_NETWORKS }
    );
  }
  return network;
}

// Re-export network utilities
export {
  toCAIP2Network,
  normalizeNetwork,
  networksEqual,
  isCAIP2Network,
} from '../types/network.js';

// Re-export constants
export {
  STARKNET_NETWORKS,
  NETWORK_CONFIGS,
  NETWORK_REFERENCES,
  CHAIN_IDS,
  DEFAULT_RPC_URLS,
  EXPLORER_URLS,
  NETWORK_NAMES,
  DEFAULT_PROVIDER_TIMEOUT,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_BACKOFF_MULTIPLIER,
  type NetworkReference,
} from './constants.js';
