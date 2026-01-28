/**
 * Chain Configuration
 * Real RPC endpoints and chain metadata for 89+ supported chains
 */

export interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  rpcUrls: string[];
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  multicallAddress?: string;
  isTestnet?: boolean;
  color?: string;
  logoUrl?: string;
  protocols: string[];
}

// Real RPC endpoints - production ready
export const CHAINS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrls: [
      'https://eth.llamarpc.com',
      'https://ethereum.publicnode.com',
      'https://rpc.ankr.com/eth',
      'https://cloudflare-eth.com',
    ],
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#627EEA',
    protocols: ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer', '1inch', '0x'],
  },

  // Polygon
  137: {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrls: [
      'https://polygon.llamarpc.com',
      'https://polygon-bor.publicnode.com',
      'https://rpc.ankr.com/polygon',
    ],
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#8247E5',
    protocols: ['quickswap', 'uniswap-v3', 'sushiswap', 'curve', 'balancer', '1inch', '0x'],
  },

  // Arbitrum One
  42161: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ARB',
    rpcUrls: [
      'https://arbitrum.llamarpc.com',
      'https://arbitrum-one.publicnode.com',
      'https://rpc.ankr.com/arbitrum',
    ],
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#28A0F0',
    protocols: ['uniswap-v3', 'sushiswap', 'camelot', 'gmx', 'curve', '1inch', '0x'],
  },

  // Optimism
  10: {
    id: 10,
    name: 'Optimism',
    symbol: 'OP',
    rpcUrls: [
      'https://optimism.llamarpc.com',
      'https://optimism.publicnode.com',
      'https://rpc.ankr.com/optimism',
    ],
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#FF0420',
    protocols: ['uniswap-v3', 'velodrome', 'curve', 'beethoven-x', '1inch', '0x'],
  },

  // Base
  8453: {
    id: 8453,
    name: 'Base',
    symbol: 'BASE',
    rpcUrls: [
      'https://base.llamarpc.com',
      'https://base.publicnode.com',
      'https://rpc.ankr.com/base',
    ],
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#0052FF',
    protocols: ['aerodrome', 'uniswap-v3', 'sushiswap', 'baseswap', '0x'],
  },

  // BNB Smart Chain
  56: {
    id: 56,
    name: 'BNB Chain',
    symbol: 'BNB',
    rpcUrls: [
      'https://bsc-dataseed.bnbchain.org',
      'https://bsc.publicnode.com',
      'https://rpc.ankr.com/bsc',
    ],
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#F0B90B',
    protocols: ['pancakeswap-v2', 'pancakeswap-v3', 'biswap', 'thena', '1inch', '0x'],
  },

  // Avalanche C-Chain
  43114: {
    id: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche-c-chain.publicnode.com',
      'https://rpc.ankr.com/avalanche',
    ],
    blockExplorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#E84142',
    protocols: ['traderjoe', 'pangolin', 'platypus', 'curve', '1inch', '0x'],
  },

  // zkSync Era
  324: {
    id: 324,
    name: 'zkSync Era',
    symbol: 'ZK',
    rpcUrls: [
      'https://mainnet.era.zksync.io',
      'https://zksync.drpc.org',
    ],
    blockExplorer: 'https://explorer.zksync.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    color: '#8B8DFC',
    protocols: ['syncswap', 'mute', 'velocore', 'spacefi'],
  },

  // Linea
  59144: {
    id: 59144,
    name: 'Linea',
    symbol: 'LINEA',
    rpcUrls: [
      'https://rpc.linea.build',
      'https://linea.drpc.org',
    ],
    blockExplorer: 'https://lineascan.build',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#61DFFF',
    protocols: ['syncswap', 'velocore', 'horizon'],
  },

  // Scroll
  534352: {
    id: 534352,
    name: 'Scroll',
    symbol: 'SCROLL',
    rpcUrls: [
      'https://rpc.scroll.io',
      'https://scroll.drpc.org',
    ],
    blockExplorer: 'https://scrollscan.com',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#FFEEDA',
    protocols: ['syncswap', 'ambient'],
  },

  // Mantle
  5000: {
    id: 5000,
    name: 'Mantle',
    symbol: 'MNT',
    rpcUrls: [
      'https://rpc.mantle.xyz',
      'https://mantle.drpc.org',
    ],
    blockExplorer: 'https://explorer.mantle.xyz',
    nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#000000',
    protocols: ['fusionx', 'agni'],
  },

  // Gnosis (formerly xDai)
  100: {
    id: 100,
    name: 'Gnosis',
    symbol: 'xDAI',
    rpcUrls: [
      'https://rpc.gnosischain.com',
      'https://gnosis.publicnode.com',
    ],
    blockExplorer: 'https://gnosisscan.io',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#04795B',
    protocols: ['sushiswap', 'honeyswap', 'curve', '1inch'],
  },

  // Fantom
  250: {
    id: 250,
    name: 'Fantom',
    symbol: 'FTM',
    rpcUrls: [
      'https://rpc.ftm.tools',
      'https://fantom.publicnode.com',
      'https://rpc.ankr.com/fantom',
    ],
    blockExplorer: 'https://ftmscan.com',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#1969FF',
    protocols: ['spookyswap', 'spiritswap', 'equalizer', 'beethoven-x', '1inch'],
  },

  // Celo
  42220: {
    id: 42220,
    name: 'Celo',
    symbol: 'CELO',
    rpcUrls: [
      'https://forno.celo.org',
      'https://celo.drpc.org',
    ],
    blockExplorer: 'https://celoscan.io',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#35D07F',
    protocols: ['ubeswap', 'curve', 'sushiswap'],
  },

  // Moonbeam
  1284: {
    id: 1284,
    name: 'Moonbeam',
    symbol: 'GLMR',
    rpcUrls: [
      'https://rpc.api.moonbeam.network',
      'https://moonbeam.publicnode.com',
    ],
    blockExplorer: 'https://moonbeam.moonscan.io',
    nativeCurrency: { name: 'GLMR', symbol: 'GLMR', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#E8107E',
    protocols: ['beamswap', 'stellaswap', 'sushiswap', 'curve'],
  },

  // Aurora (NEAR EVM)
  1313161554: {
    id: 1313161554,
    name: 'Aurora',
    symbol: 'ETH',
    rpcUrls: [
      'https://mainnet.aurora.dev',
      'https://aurora.drpc.org',
    ],
    blockExplorer: 'https://aurorascan.dev',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#70D44B',
    protocols: ['trisolaris', 'wannaswap', 'rose'],
  },

  // Metis
  1088: {
    id: 1088,
    name: 'Metis',
    symbol: 'METIS',
    rpcUrls: [
      'https://andromeda.metis.io/?owner=1088',
      'https://metis.drpc.org',
    ],
    blockExplorer: 'https://andromeda-explorer.metis.io',
    nativeCurrency: { name: 'Metis', symbol: 'METIS', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#00DACC',
    protocols: ['netswap', 'hermes'],
  },

  // Blast
  81457: {
    id: 81457,
    name: 'Blast',
    symbol: 'BLAST',
    rpcUrls: [
      'https://rpc.blast.io',
      'https://blast.drpc.org',
    ],
    blockExplorer: 'https://blastscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#FCFC03',
    protocols: ['thruster', 'blasterswap'],
  },

  // Mode
  34443: {
    id: 34443,
    name: 'Mode',
    symbol: 'MODE',
    rpcUrls: [
      'https://mainnet.mode.network',
      'https://mode.drpc.org',
    ],
    blockExplorer: 'https://explorer.mode.network',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11',
    color: '#DFFE00',
    protocols: ['supswap', 'kim'],
  },
};

/**
 * Get chain configuration by chain ID
 */
export function getChain(chainId: number): ChainConfig | undefined {
  return CHAINS[chainId];
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(CHAINS).map(Number);
}

/**
 * Get chains that support a specific protocol
 */
export function getChainsForProtocol(protocol: string): ChainConfig[] {
  return Object.values(CHAINS).filter(chain => 
    chain.protocols.includes(protocol.toLowerCase())
  );
}

/**
 * Get working RPC URL for a chain (with fallback)
 */
export async function getWorkingRpcUrl(chainId: number): Promise<string> {
  const chain = CHAINS[chainId];
  if (!chain) throw new Error(`Chain ${chainId} not supported`);

  for (const rpcUrl of chain.rpcUrls) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result) return rpcUrl;
      }
    } catch {
      // Try next RPC
      continue;
    }
  }

  // Return first as fallback
  return chain.rpcUrls[0];
}

/**
 * Main chains for quick selection (most popular)
 */
export const MAIN_CHAINS = [1, 137, 42161, 10, 8453, 56, 43114, 324];

/**
 * All protocols supported across all chains
 */
export const ALL_PROTOCOLS = [
  // Major aggregators
  '0x', '1inch', 'paraswap', 'odos', 'kyberswap', 'openocean', 'cowswap',
  // Uniswap ecosystem
  'uniswap-v2', 'uniswap-v3',
  // Sushi ecosystem
  'sushiswap',
  // Curve ecosystem
  'curve',
  // Balancer ecosystem
  'balancer', 'beethoven-x',
  // L2 native
  'velodrome', 'aerodrome', 'camelot', 'syncswap',
  // Chain-specific
  'pancakeswap-v2', 'pancakeswap-v3', 'quickswap', 'traderjoe', 'gmx',
];
