import type { NetworkInfo, NetworkType } from './types.js';

export const NETWORKS: NetworkInfo[] = [
  // EVM Mainnets
  { v1Id: 'base', v2Id: 'eip155:8453', name: 'Base', type: 'evm', chainId: 8453, testnet: false },
  { v1Id: 'polygon', v2Id: 'eip155:137', name: 'Polygon', type: 'evm', chainId: 137, testnet: false },
  { v1Id: 'avalanche', v2Id: 'eip155:43114', name: 'Avalanche', type: 'evm', chainId: 43114, testnet: false },
  { v1Id: 'sei', v2Id: 'eip155:1329', name: 'Sei', type: 'evm', chainId: 1329, testnet: false },
  { v1Id: 'iotex', v2Id: 'eip155:4689', name: 'IoTeX', type: 'evm', chainId: 4689, testnet: false },
  { v1Id: 'peaq', v2Id: 'eip155:3338', name: 'Peaq', type: 'evm', chainId: 3338, testnet: false },
  { v1Id: 'xlayer', v2Id: 'eip155:196', name: 'X Layer', type: 'evm', chainId: 196, testnet: false },

  // EVM Testnets
  { v1Id: 'base-sepolia', v2Id: 'eip155:84532', name: 'Base Sepolia', type: 'evm', chainId: 84532, testnet: true },
  { v1Id: 'polygon-amoy', v2Id: 'eip155:80002', name: 'Polygon Amoy', type: 'evm', chainId: 80002, testnet: true },
  { v1Id: 'avalanche-fuji', v2Id: 'eip155:43113', name: 'Avalanche Fuji', type: 'evm', chainId: 43113, testnet: true },
  { v1Id: 'sei-testnet', v2Id: 'eip155:1328', name: 'Sei Testnet', type: 'evm', chainId: 1328, testnet: true },
  { v1Id: 'xlayer-testnet', v2Id: 'eip155:195', name: 'X Layer Testnet', type: 'evm', chainId: 195, testnet: true },

  // Solana
  { v1Id: 'solana', v2Id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', name: 'Solana', type: 'solana', testnet: false },
  { v1Id: 'solana-devnet', v2Id: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', name: 'Solana Devnet', type: 'solana', testnet: true },

  // Stacks
  { v1Id: 'stacks', v2Id: 'stacks:1', name: 'Stacks', type: 'stacks', testnet: false },
  { v1Id: 'stacks-testnet', v2Id: 'stacks:2147483648', name: 'Stacks Testnet', type: 'stacks', testnet: true },
];

/**
 * Get network info by v1 or v2 identifier
 */
export function getNetwork(id: string): NetworkInfo | undefined {
  return NETWORKS.find(n => n.v1Id === id || n.v2Id === id);
}

/**
 * Get network type from identifier
 */
export function getNetworkType(id: string): NetworkType | undefined {
  const network = getNetwork(id);
  if (network) return network.type;

  // Fallback: parse CAIP-2 prefix
  if (id.startsWith('eip155:')) return 'evm';
  if (id.startsWith('solana:')) return 'solana';
  if (id.startsWith('stacks:')) return 'stacks';

  return undefined;
}

/**
 * Convert v1 network ID to v2 (CAIP-2)
 */
export function toV2NetworkId(id: string): string {
  const network = getNetwork(id);
  return network?.v2Id ?? id;
}

/**
 * Convert v2 network ID to v1
 */
export function toV1NetworkId(id: string): string {
  const network = getNetwork(id);
  return network?.v1Id ?? id;
}

/**
 * Check if network ID is valid
 */
export function isValidNetwork(id: string): boolean {
  return getNetwork(id) !== undefined;
}

/**
 * Get all mainnet networks
 */
export function getMainnets(): NetworkInfo[] {
  return NETWORKS.filter(n => !n.testnet);
}

/**
 * Get all testnet networks
 */
export function getTestnets(): NetworkInfo[] {
  return NETWORKS.filter(n => n.testnet);
}
