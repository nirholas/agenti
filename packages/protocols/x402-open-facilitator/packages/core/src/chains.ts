import type { ChainConfig, ChainId } from './types.js';

/**
 * Default supported chains for x402 facilitators
 * RPC URLs can be overridden via environment variables
 */
export const defaultChains: Record<string, ChainConfig> = {
  // ===== MAINNETS =====
  
  // Avalanche C-Chain
  '43114': {
    chainId: 43114,
    name: 'Avalanche',
    network: 'avalanche',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorerUrl: 'https://snowtrace.io',
    isEVM: true,
  },
  // Base Mainnet
  '8453': {
    chainId: 8453,
    name: 'Base',
    network: 'base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorerUrl: 'https://basescan.org',
    isEVM: true,
  },
  // Ethereum Mainnet
  '1': {
    chainId: 1,
    name: 'Ethereum',
    network: 'ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    blockExplorerUrl: 'https://etherscan.io',
    isEVM: true,
  },
  // IoTeX Mainnet
  '4689': {
    chainId: 4689,
    name: 'IoTeX',
    network: 'iotex',
    rpcUrl: process.env.IOTEX_RPC_URL || 'https://babel-api.mainnet.iotex.io',
    blockExplorerUrl: 'https://iotexscan.io',
    isEVM: true,
  },
  // Peaq Mainnet
  '3338': {
    chainId: 3338,
    name: 'Peaq',
    network: 'peaq',
    rpcUrl: process.env.PEAQ_RPC_URL || 'https://peaq.api.onfinality.io/public',
    blockExplorerUrl: 'https://peaq.subscan.io',
    isEVM: true,
  },
  // Polygon Mainnet
  '137': {
    chainId: 137,
    name: 'Polygon',
    network: 'polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com',
    isEVM: true,
  },
  // Sei Mainnet (Pacific-1)
  '1329': {
    chainId: 1329,
    name: 'Sei',
    network: 'sei',
    rpcUrl: process.env.SEI_RPC_URL || 'https://evm-rpc.sei-apis.com',
    blockExplorerUrl: 'https://seitrace.com',
    isEVM: true,
  },
  // XLayer Mainnet (OKX)
  '196': {
    chainId: 196,
    name: 'XLayer',
    network: 'xlayer',
    rpcUrl: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech',
    blockExplorerUrl: 'https://www.okx.com/explorer/xlayer',
    isEVM: true,
  },
  // Solana Mainnet
  solana: {
    chainId: 'solana',
    name: 'Solana',
    network: 'solana',
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    blockExplorerUrl: 'https://solscan.io',
    isEVM: false,
  },
  // Stacks Mainnet
  stacks: {
    chainId: 'stacks',
    name: 'Stacks',
    network: 'stacks',
    rpcUrl: process.env.STACKS_RPC_URL || 'https://api.hiro.so',
    blockExplorerUrl: 'https://explorer.hiro.so',
    isEVM: false,
  },

  // ===== TESTNETS =====
  
  // Avalanche Fuji Testnet
  '43113': {
    chainId: 43113,
    name: 'Avalanche Fuji',
    network: 'avalanche-fuji',
    rpcUrl: process.env.AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    blockExplorerUrl: 'https://testnet.snowtrace.io',
    isEVM: true,
  },
  // Base Sepolia (Testnet)
  '84532': {
    chainId: 84532,
    name: 'Base Sepolia',
    network: 'base-sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    blockExplorerUrl: 'https://sepolia.basescan.org',
    isEVM: true,
  },
  // Polygon Amoy Testnet
  '80002': {
    chainId: 80002,
    name: 'Polygon Amoy',
    network: 'polygon-amoy',
    rpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
    blockExplorerUrl: 'https://amoy.polygonscan.com',
    isEVM: true,
  },
  // Sei Testnet (Atlantic-2)
  '1328': {
    chainId: 1328,
    name: 'Sei Testnet',
    network: 'sei-testnet',
    rpcUrl: process.env.SEI_TESTNET_RPC_URL || 'https://evm-rpc-testnet.sei-apis.com',
    blockExplorerUrl: 'https://testnet.seitrace.com',
    isEVM: true,
  },
  // Sepolia Testnet
  '11155111': {
    chainId: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    isEVM: true,
  },
  // XLayer Testnet
  '195': {
    chainId: 195,
    name: 'XLayer Testnet',
    network: 'xlayer-testnet',
    rpcUrl: process.env.XLAYER_TESTNET_RPC_URL || 'https://testrpc.xlayer.tech',
    blockExplorerUrl: 'https://www.okx.com/explorer/xlayer-test',
    isEVM: true,
  },
  // Solana Devnet
  'solana-devnet': {
    chainId: 'solana-devnet',
    name: 'Solana Devnet',
    network: 'solana-devnet',
    rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
    blockExplorerUrl: 'https://solscan.io/?cluster=devnet',
    isEVM: false,
  },
  // Stacks Testnet
  'stacks-testnet': {
    chainId: 'stacks-testnet',
    name: 'Stacks Testnet',
    network: 'stacks-testnet',
    rpcUrl: process.env.STACKS_TESTNET_RPC_URL || 'https://api.testnet.hiro.so',
    blockExplorerUrl: 'https://explorer.hiro.so/?chain=testnet',
    isEVM: false,
  },
};

/**
 * Get chain configuration by chain ID or network name
 */
export function getChainConfig(chainIdOrNetwork: number | string): ChainConfig | undefined {
  const key = String(chainIdOrNetwork);
  return defaultChains[key] || Object.values(defaultChains).find(c => c.network === key);
}

/**
 * Get all supported chain IDs/networks
 */
export function getSupportedChains(): (number | string)[] {
  return Object.values(defaultChains).map(c => c.chainId);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainIdOrNetwork: number | string): boolean {
  return !!getChainConfig(chainIdOrNetwork);
}

/**
 * Network name to chain ID mapping
 */
export const networkToChainId: Record<string, number | string> = {
  // Mainnets
  avalanche: 43114,
  base: 8453,
  ethereum: 1,
  iotex: 4689,
  peaq: 3338,
  polygon: 137,
  sei: 1329,
  xlayer: 196,
  solana: 'solana',
  'solana-mainnet': 'solana', // Alias for compatibility
  stacks: 'stacks',
  // Testnets
  'avalanche-fuji': 43113,
  'base-sepolia': 84532,
  'polygon-amoy': 80002,
  'sei-testnet': 1328,
  sepolia: 11155111,
  'xlayer-testnet': 195,
  'solana-devnet': 'solana-devnet',
  'stacks-testnet': 'stacks-testnet',
};

/**
 * Chain ID to network name mapping
 */
export const chainIdToNetwork: Record<string | number, string> = {
  // Mainnets
  43114: 'avalanche',
  8453: 'base',
  1: 'ethereum',
  4689: 'iotex',
  3338: 'peaq',
  137: 'polygon',
  1329: 'sei',
  196: 'xlayer',
  solana: 'solana',
  'solana-mainnet': 'solana', // Alias
  stacks: 'stacks',
  // Testnets
  43113: 'avalanche-fuji',
  84532: 'base-sepolia',
  80002: 'polygon-amoy',
  1328: 'sei-testnet',
  11155111: 'sepolia',
  195: 'xlayer-testnet',
  'solana-devnet': 'solana-devnet',
  'stacks-testnet': 'stacks-testnet',
};

/**
 * Get chain ID from network name (supports both v1 human-readable and v2 CAIP-2 formats)
 */
export function getChainIdFromNetwork(network: string): number | string | undefined {
  // First try direct lookup (v1 human-readable format)
  const direct = networkToChainId[network.toLowerCase()];
  if (direct !== undefined) return direct;

  // Try CAIP-2 format - parse and extract chain ID
  if (network.startsWith('eip155:')) {
    const chainIdStr = network.slice(7); // Remove 'eip155:' prefix
    const chainId = parseInt(chainIdStr, 10);
    if (!isNaN(chainId) && chainIdToNetwork[chainId]) {
      return chainId;
    }
  }

  // Try Solana CAIP-2 format
  if (network.startsWith('solana:')) {
    const genesisHash = network.slice(7); // Remove 'solana:' prefix
    // Check known genesis hashes
    if (genesisHash === '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp') {
      return 'solana';
    }
    if (genesisHash === 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1') {
      return 'solana-devnet';
    }
  }

  // Try Stacks CAIP-2 format
  if (network.startsWith('stacks:')) {
    const chainRef = network.slice(7); // Remove 'stacks:' prefix
    if (chainRef === stacksChainRefs.mainnet) {
      return 'stacks';
    }
    if (chainRef === stacksChainRefs.testnet) {
      return 'stacks-testnet';
    }
  }

  return undefined;
}

/**
 * Get network name from chain ID
 */
export function getNetworkFromChainId(chainId: number | string): string | undefined {
  return chainIdToNetwork[chainId];
}

/**
 * Production chains (mainnet only)
 */
export const productionChains = [
  43114, // Avalanche
  8453,  // Base
  1,     // Ethereum
  4689,  // IoTeX
  3338,  // Peaq
  137,   // Polygon
  1329,  // Sei
  196,   // XLayer
  'solana',
  'stacks',
] as const;

/**
 * Test chains
 */
export const testChains = [
  43113,    // Avalanche Fuji
  84532,    // Base Sepolia
  80002,    // Polygon Amoy
  1328,     // Sei Testnet
  11155111, // Sepolia
  195,      // XLayer Testnet
  'solana-devnet',
  'stacks-testnet',
] as const;

// ===== CAIP-2 Network Identifiers =====
// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md

/**
 * Solana genesis hash prefixes for CAIP-2
 */
export const solanaGenesisHashes = {
  mainnet: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  testnet: '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
} as const;

/**
 * Stacks chain references for CAIP-2
 * CAIP-2 format: stacks:{chainId}
 * Mainnet = 1, Testnet = 2147483648 (0x80000000)
 */
export const stacksChainRefs = {
  mainnet: '1',
  testnet: '2147483648',
} as const;

/**
 * Network name to CAIP-2 identifier mapping
 */
export const networkToCaip2: Record<string, string> = {
  // EVM Mainnets
  avalanche: 'eip155:43114',
  base: 'eip155:8453',
  ethereum: 'eip155:1',
  iotex: 'eip155:4689',
  peaq: 'eip155:3338',
  polygon: 'eip155:137',
  sei: 'eip155:1329',
  xlayer: 'eip155:196',
  // Solana
  solana: `solana:${solanaGenesisHashes.mainnet}`,
  // Stacks
  stacks: `stacks:${stacksChainRefs.mainnet}`,
  // EVM Testnets
  'avalanche-fuji': 'eip155:43113',
  'base-sepolia': 'eip155:84532',
  'polygon-amoy': 'eip155:80002',
  'sei-testnet': 'eip155:1328',
  sepolia: 'eip155:11155111',
  'xlayer-testnet': 'eip155:195',
  'solana-devnet': `solana:${solanaGenesisHashes.devnet}`,
  'stacks-testnet': `stacks:${stacksChainRefs.testnet}`,
};

/**
 * CAIP-2 identifier to network name mapping
 */
export const caip2ToNetwork: Record<string, string> = {
  // EVM Mainnets
  'eip155:43114': 'avalanche',
  'eip155:8453': 'base',
  'eip155:1': 'ethereum',
  'eip155:4689': 'iotex',
  'eip155:3338': 'peaq',
  'eip155:137': 'polygon',
  'eip155:1329': 'sei',
  'eip155:196': 'xlayer',
  // Solana
  [`solana:${solanaGenesisHashes.mainnet}`]: 'solana',
  // Stacks
  [`stacks:${stacksChainRefs.mainnet}`]: 'stacks',
  // EVM Testnets
  'eip155:43113': 'avalanche-fuji',
  'eip155:84532': 'base-sepolia',
  'eip155:80002': 'polygon-amoy',
  'eip155:1328': 'sei-testnet',
  'eip155:11155111': 'sepolia',
  'eip155:195': 'xlayer-testnet',
  [`solana:${solanaGenesisHashes.devnet}`]: 'solana-devnet',
  [`stacks:${stacksChainRefs.testnet}`]: 'stacks-testnet',
};

/**
 * Get CAIP-2 identifier from network name
 */
export function getCaip2FromNetwork(network: string): string | undefined {
  return networkToCaip2[network.toLowerCase()];
}

/**
 * Get network name from CAIP-2 identifier
 */
export function getNetworkFromCaip2(caip2: string): string | undefined {
  return caip2ToNetwork[caip2];
}

/**
 * Get CAIP-2 namespace prefix from network (e.g., "eip155:*" or "solana:*")
 */
export function getCaip2Namespace(network: string): string {
  const config = getChainConfig(network);
  if (!config) return 'eip155:*';
  if (config.isEVM) return 'eip155:*';
  if (isStacksChain(config.chainId)) return 'stacks:*';
  // Non-EVM, non-Stacks assumed Solana
  return 'solana:*';
}

/**
 * Check if a network identifier is CAIP-2 format
 */
export function isCaip2Format(identifier: string): boolean {
  return identifier.includes(':') && (identifier.startsWith('eip155:') || identifier.startsWith('solana:') || identifier.startsWith('stacks:'));
}

/**
 * Check if a chain ID belongs to a Stacks chain
 */
export function isStacksChain(chainId: ChainId): boolean {
  return chainId === 'stacks' || chainId === 'stacks-testnet';
}

/**
 * Check if a network identifier refers to Stacks
 */
export function isStacksNetwork(network: string): boolean {
  const lower = network.toLowerCase();
  return lower === 'stacks' || lower === 'stacks-testnet' || lower.startsWith('stacks:');
}
