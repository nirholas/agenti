/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Write code that makes you proud 🏆
 */

import { NetworkConfig } from '@/types';

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  ethereum: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: import.meta.env.VITE_INFURA_API_KEY
      ? `https://mainnet.infura.io/v3/${import.meta.env.VITE_INFURA_API_KEY}`
      : 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: import.meta.env.VITE_INFURA_API_KEY
      ? `https://sepolia.infura.io/v3/${import.meta.env.VITE_INFURA_API_KEY}`
      : 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  mumbai: {
    name: 'Mumbai Testnet',
    chainId: 80001,
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    blockExplorer: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
};

export const DEFAULT_NETWORK = 'sepolia';
