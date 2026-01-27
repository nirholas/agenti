/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Your code has the power to change the world 🌍
 */

/**
 * Blockchain network configurations for 8 supported chains
 */

import { ChainConfig } from '@/types/contracts';

// =============================================================================
// CHAIN CONFIGURATIONS
// =============================================================================

/**
 * Ethereum Mainnet & Sepolia Testnet
 * The original smart contract platform
 */
export const ETHEREUM_CONFIG: ChainConfig = {
  id: 'ethereum',
  name: 'Ethereum',
  icon: '⟠',
  chainId: 1,
  rpcUrl: 'https://eth.llamarpc.com',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  testnet: {
    name: 'Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    faucetUrl: 'https://sepoliafaucet.com',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 12,
  color: '#627EEA',
  description: 'The original smart contract platform with the largest ecosystem',
  isActive: true,
};

/**
 * Base - Coinbase L2
 * Fast, low-cost Ethereum L2 built on the OP Stack
 */
export const BASE_CONFIG: ChainConfig = {
  id: 'base',
  name: 'Base',
  icon: '🔵',
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  explorerUrl: 'https://basescan.org',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  testnet: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    faucetUrl: 'https://www.coinbase.com/faucets/base-ethereum-goerli-faucet',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 2,
  color: '#0052FF',
  description: 'Coinbase L2 - secure, low-cost, developer-friendly',
  isActive: true,
};

/**
 * Avalanche C-Chain
 * High-throughput EVM-compatible blockchain
 */
export const AVALANCHE_CONFIG: ChainConfig = {
  id: 'avalanche',
  name: 'Avalanche',
  icon: '🔺',
  chainId: 43114,
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  explorerUrl: 'https://snowtrace.io',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  testnet: {
    name: 'Fuji',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    faucetUrl: 'https://faucet.avax.network/',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 2,
  color: '#E84142',
  description: 'High-throughput, eco-friendly blockchain with subnets',
  isActive: true,
};

/**
 * Monad
 * High-performance EVM with 10,000 TPS
 */
export const MONAD_CONFIG: ChainConfig = {
  id: 'monad',
  name: 'Monad',
  icon: '🟣',
  chainId: 10143, // Monad Devnet
  rpcUrl: 'https://rpc.monad.xyz',
  explorerUrl: 'https://explorer.monad.xyz',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  testnet: {
    name: 'Monad Devnet',
    chainId: 10143,
    rpcUrl: 'https://rpc.devnet.monad.xyz',
    faucetUrl: 'https://faucet.monad.xyz',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 1,
  color: '#8B5CF6',
  description: 'Ultra high-performance EVM with 10,000 TPS',
  isActive: true,
};

/**
 * BSC - Binance Smart Chain
 * EVM-compatible chain with low fees
 */
export const BSC_CONFIG: ChainConfig = {
  id: 'bsc',
  name: 'BNB Chain',
  icon: '💛',
  chainId: 56,
  rpcUrl: 'https://bsc-dataseed.binance.org',
  explorerUrl: 'https://bscscan.com',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  testnet: {
    name: 'BSC Testnet',
    chainId: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    faucetUrl: 'https://testnet.bnbchain.org/faucet-smart',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 3,
  color: '#F0B90B',
  description: 'Binance-backed chain with low fees and high throughput',
  isActive: true,
};

/**
 * Solana
 * High-performance blockchain using Rust
 */
export const SOLANA_CONFIG: ChainConfig = {
  id: 'solana',
  name: 'Solana',
  icon: '◎',
  chainId: 0, // Solana doesn't use EVM chain IDs
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  explorerUrl: 'https://explorer.solana.com',
  nativeCurrency: {
    name: 'SOL',
    symbol: 'SOL',
    decimals: 9,
  },
  testnet: {
    name: 'Devnet',
    chainId: 0,
    rpcUrl: 'https://api.devnet.solana.com',
    faucetUrl: 'https://faucet.solana.com/',
  },
  compilerVersion: 'anchor-0.29.0',
  language: 'rust',
  isEVM: false,
  blockTime: 0.4,
  color: '#9945FF',
  description: 'High-performance blockchain with Rust-based programs',
  isActive: true,
};

/**
 * Polygon PoS
 * Ethereum scaling solution with low fees
 */
export const POLYGON_CONFIG: ChainConfig = {
  id: 'polygon',
  name: 'Polygon',
  icon: '⬡',
  chainId: 137,
  rpcUrl: 'https://polygon-rpc.com',
  explorerUrl: 'https://polygonscan.com',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  testnet: {
    name: 'Amoy',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    faucetUrl: 'https://faucet.polygon.technology/',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 2,
  color: '#8247E5',
  description: 'Ethereum scaling solution with fast, low-cost transactions',
  isActive: true,
};

/**
 * Arbitrum One
 * Optimistic rollup L2 for Ethereum
 */
export const ARBITRUM_CONFIG: ChainConfig = {
  id: 'arbitrum',
  name: 'Arbitrum',
  icon: '🔷',
  chainId: 42161,
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  explorerUrl: 'https://arbiscan.io',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  testnet: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    faucetUrl: 'https://faucet.quicknode.com/arbitrum/sepolia',
  },
  compilerVersion: '0.8.24',
  language: 'solidity',
  isEVM: true,
  blockTime: 0.25,
  color: '#28A0F0',
  description: 'Leading Ethereum L2 with low fees and fast confirmations',
  isActive: true,
};

// =============================================================================
// CHAIN COLLECTIONS
// =============================================================================

/**
 * All supported chain configurations
 */
export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: ETHEREUM_CONFIG,
  base: BASE_CONFIG,
  avalanche: AVALANCHE_CONFIG,
  monad: MONAD_CONFIG,
  bsc: BSC_CONFIG,
  solana: SOLANA_CONFIG,
  polygon: POLYGON_CONFIG,
  arbitrum: ARBITRUM_CONFIG,
};

/**
 * Array of all chain configurations for iteration
 */
export const CHAINS_LIST: ChainConfig[] = Object.values(CHAIN_CONFIGS);

/**
 * EVM-compatible chains only
 */
export const EVM_CHAINS: ChainConfig[] = CHAINS_LIST.filter(chain => chain.isEVM);

/**
 * Non-EVM chains (Solana, etc.)
 */
export const NON_EVM_CHAINS: ChainConfig[] = CHAINS_LIST.filter(chain => !chain.isEVM);

/**
 * Solidity-compatible chains
 */
export const SOLIDITY_CHAINS: ChainConfig[] = CHAINS_LIST.filter(
  chain => chain.language === 'solidity'
);

/**
 * Rust-based chains (Solana)
 */
export const RUST_CHAINS: ChainConfig[] = CHAINS_LIST.filter(
  chain => chain.language === 'rust'
);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get chain configuration by ID
 * @param chainId - Chain identifier (e.g., "ethereum", "base")
 * @returns Chain configuration or undefined
 */
export function getChainConfig(chainId: string): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

/**
 * Get chain configuration by numeric chain ID
 * @param numericChainId - Numeric chain ID (e.g., 1 for Ethereum mainnet)
 * @returns Chain configuration or undefined
 */
export function getChainByNumericId(numericChainId: number): ChainConfig | undefined {
  return CHAINS_LIST.find(
    chain => chain.chainId === numericChainId || chain.testnet?.chainId === numericChainId
  );
}

/**
 * Check if a chain supports a specific template
 * @param chainId - Chain identifier
 * @param templateChains - Array of chain IDs the template supports
 * @returns Whether the chain is supported
 */
export function chainSupportsTemplate(chainId: string, templateChains: string[]): boolean {
  // 'all-evm' means all EVM chains are supported
  if (templateChains.includes('all-evm')) {
    const chain = getChainConfig(chainId);
    return chain?.isEVM ?? false;
  }
  return templateChains.includes(chainId);
}

/**
 * Get the explorer URL for a transaction
 * @param chainId - Chain identifier
 * @param txHash - Transaction hash
 * @param isTestnet - Whether to use testnet explorer
 * @returns Full explorer URL for the transaction
 */
export function getTransactionUrl(chainId: string, txHash: string, isTestnet = false): string {
  const chain = getChainConfig(chainId);
  if (!chain) return '';
  
  // For testnets, we need to construct the testnet explorer URL
  const baseUrl = isTestnet 
    ? chain.explorerUrl.replace('://', '://sepolia.').replace('.io', '-sepolia.io')
    : chain.explorerUrl;
    
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Get the explorer URL for an address
 * @param chainId - Chain identifier
 * @param address - Contract or wallet address
 * @param isTestnet - Whether to use testnet explorer
 * @returns Full explorer URL for the address
 */
export function getAddressUrl(chainId: string, address: string, isTestnet = false): string {
  const chain = getChainConfig(chainId);
  if (!chain) return '';
  
  const baseUrl = isTestnet 
    ? chain.explorerUrl.replace('://', '://sepolia.')
    : chain.explorerUrl;
    
  return `${baseUrl}/address/${address}`;
}

/**
 * Get RPC URL for a chain
 * @param chainId - Chain identifier
 * @param useTestnet - Whether to use testnet RPC
 * @returns RPC URL
 */
export function getRpcUrl(chainId: string, useTestnet = false): string {
  const chain = getChainConfig(chainId);
  if (!chain) return '';
  return useTestnet ? chain.testnet?.rpcUrl ?? '' : chain.rpcUrl;
}

/**
 * Get chains that support a specific language
 * @param language - Contract language (solidity, rust, etc.)
 * @returns Array of chain configurations
 */
export function getChainsByLanguage(language: 'solidity' | 'rust' | 'vyper' | 'move'): ChainConfig[] {
  return CHAINS_LIST.filter(chain => chain.language === language);
}

/**
 * Format chain ID for display
 * @param chainId - Chain identifier
 * @param includeIcon - Whether to include the chain icon
 * @returns Formatted chain name
 */
export function formatChainName(chainId: string, includeIcon = true): string {
  const chain = getChainConfig(chainId);
  if (!chain) return chainId;
  return includeIcon ? `${chain.icon} ${chain.name}` : chain.name;
}

/**
 * Get default chain for a language
 * @param language - Contract language
 * @returns Default chain ID for that language
 */
export function getDefaultChainForLanguage(language: 'solidity' | 'rust'): string {
  if (language === 'rust') return 'solana';
  return 'ethereum';
}

// =============================================================================
// CHAIN ID CONSTANTS
// =============================================================================

/**
 * All supported chain IDs for quick reference
 */
export const CHAIN_IDS = {
  ETHEREUM: 'ethereum',
  BASE: 'base',
  AVALANCHE: 'avalanche',
  MONAD: 'monad',
  BSC: 'bsc',
  SOLANA: 'solana',
  POLYGON: 'polygon',
  ARBITRUM: 'arbitrum',
} as const;

/**
 * Type for chain IDs
 */
export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

/**
 * Default chain for the playground
 */
export const DEFAULT_CHAIN: ChainId = 'ethereum';

/**
 * Chains recommended for beginners
 */
export const BEGINNER_CHAINS: ChainId[] = ['ethereum', 'base', 'polygon'];

/**
 * High-performance chains for advanced users
 */
export const HIGH_PERFORMANCE_CHAINS: ChainId[] = ['monad', 'arbitrum', 'avalanche'];
