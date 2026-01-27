/**
 * Supported Chains Configuration
 * 
 * All 8 blockchain networks supported by Lyra:
 * - Monad (10,000 TPS, ultra-fast)
 * - Base (Coinbase L2)
 * - Solana (65k TPS)
 * - BSC (Low fees)
 * - Ethereum (Most secure)
 * - Polygon (Fast & cheap)
 * - Arbitrum (L2 scaling)
 * - Optimism (OP Stack)
 */

export const SUPPORTED_CHAINS = [
  {
    id: 'monad',
    name: 'Monad',
    symbol: 'MON',
    description: '10,000 TPS • Ultra-fast • MEV protection',
    chainId: 41454,
    rpcUrl: 'https://testnet-rpc.monad.network',
    explorer: 'https://testnet-explorer.monad.network',
    toolCount: 50,
    features: ['HFT', 'Arbitrage', 'Parallel Execution'],
  },
  {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    description: 'Coinbase L2 • Smart Wallet • Optimistic rollup',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    toolCount: 55,
    features: ['Coinbase', 'OnchainKit', 'ERC-4337'],
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    description: '65,000 TPS • Sub-second finality • Low fees',
    chainId: null, // Solana doesn't use EVM chainId
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://explorer.solana.com',
    toolCount: 65,
    features: ['Jupiter DEX', 'Metaplex NFTs', 'Staking'],
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    description: 'Low fees • High speed • EVM compatible',
    chainId: 56,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    toolCount: 45,
    features: ['PancakeSwap', 'Venus', 'Low Fees'],
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    description: 'Most secure • Largest ecosystem • Battle-tested',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    toolCount: 40,
    features: ['Uniswap', 'Aave', 'Security'],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    description: 'Fast & cheap • EVM compatible • zkEVM',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    toolCount: 35,
    features: ['Low Fees', 'Fast', 'zkEVM'],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    description: 'Ethereum L2 • Optimistic rollup • Low fees',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    toolCount: 30,
    features: ['L2', 'Fast', 'Cheap'],
  },
  {
    id: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    description: 'Ethereum L2 • OP Stack • Fast finality',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    explorer: 'https://optimistic.etherscan.io',
    toolCount: 30,
    features: ['L2', 'OP Stack', 'Fast'],
  },
] as const;

export type ChainId = typeof SUPPORTED_CHAINS[number]['id'];

export function getChainConfig(chainId: ChainId) {
  return SUPPORTED_CHAINS.find(chain => chain.id === chainId);
}

export function getChainByEvmId(evmChainId: number) {
  return SUPPORTED_CHAINS.find(chain => chain.chainId === evmChainId);
}

export function getTotalToolCount() {
  return SUPPORTED_CHAINS.reduce((sum, chain) => sum + chain.toolCount, 0);
}
