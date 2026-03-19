import { baseSepolia, base, mainnet } from 'viem/chains';
import type { SupportedChain, ChainConfig } from '../types';

export const SUPPORTED_CHAINS: SupportedChain[] = ['base-sepolia', 'base', 'ethereum'];

// USDC contract addresses for different chains
export const USDC_ADDRESSES: Record<SupportedChain, string> = {
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'base': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    'ethereum': '0xa0b86a33e6351b7b08a42f7d3df22b61d6b00e0b', // USDC on mainnet
};

// Chain configurations for viem
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
    'base-sepolia': {
        chain: baseSepolia,
        rpc: 'https://base-sepolia.g.alchemy.com/v2/m8uZ16oNz2KOgSqu-9Pv6E1fkc69n8Xf'
    },
    'base': {
        chain: base,
        rpc: 'https://base-mainnet.g.alchemy.com/v2/m8uZ16oNz2KOgSqu-9Pv6E1fkc69n8Xf'
    },
    'ethereum': {
        chain: mainnet,
        rpc: 'https://eth-mainnet.g.alchemy.com/v2/m8uZ16oNz2KOgSqu-9Pv6E1fkc69n8Xf'
    },
};