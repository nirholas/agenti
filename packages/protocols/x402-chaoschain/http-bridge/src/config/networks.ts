/**
 * Multi-Network Configuration for ChaosChain x402 Facilitator
 * 
 * This file defines all supported networks and their RPC endpoints,
 * allowing the facilitator to handle payments across multiple chains.
 */

import { createPublicClient, createWalletClient, http, type Chain } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { zeroGTestnet } from './networks/eip155-16600';
import { skaleBaseSepolia } from './networks/eip155-324705682';

// ============================================================================
// NETWORK REGISTRY
// ============================================================================

/**
 * Maps x402 network identifiers to viem Chain objects
 */
export const NETWORK_REGISTRY: Record<string, Chain> = {
  'base-sepolia': baseSepolia,
  'ethereum-sepolia': sepolia,
  '0g-testnet': zeroGTestnet,
  'skale-base-sepolia': skaleBaseSepolia
  // Future networks:
  // 'base-mainnet': base,
  // 'ethereum-mainnet': mainnet,
  // '0g-mainnet': zeroGMainnet,
  // 'polygon-mainnet': polygon,
  // 'arbitrum-mainnet': arbitrum,
};

/**
 * Maps x402 network identifiers to RPC URLs
 */
export const RPC_URLS: Record<string, string> = {
  'base-sepolia': process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  'ethereum-sepolia': process.env.ETHEREUM_SEPOLIA_RPC_URL || 'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
  '0g-testnet': process.env.ZG_TESTNET_RPC_URL || 'https://rpc-testnet.0g.ai',
  'skale-base-sepolia': process.env.SKALE_BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha',
};

// ============================================================================
// TOKEN REGISTRY
// ============================================================================

/**
 * Token addresses by network
 * Maps: token symbol → network → contract address
 * 
 * Special address '0x0000...0000' means native token (ETH, 0G, etc.)
 */
export const TOKEN_REGISTRY: Record<string, Record<string, string>> = {
  // USDC (ERC-20)
  'usdc': {
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    'skale-base-sepolia': '0x2e08028E3C4c2356572E096d8EF835cD5C6030bD',
    '0g-testnet': '0x0000000000000000000000000000000000000000', // If USDC exists on 0G
  },
  
  // 0G Native Token
  '0g': {
    '0g-testnet': '0x0000000000000000000000000000000000000000', // Native token
    // '0g-mainnet': '0x0000000000000000000000000000000000000000',
  },
  
  // ETH (Native)
  'eth': {
    'ethereum-sepolia': '0x0000000000000000000000000000000000000000',
    'base-sepolia': '0x0000000000000000000000000000000000000000',
    'skale-base-sepolia': '0x0000000000000000000000000000000000000000',
  },
};

/**
 * Token decimals by symbol
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  'usdc': 6,
  'eth': 18,
  '0g': 18,
  'credit': 18,
};

// ============================================================================
// CLIENT FACTORIES
// ============================================================================

/**
 * Creates a public client for reading blockchain state
 */
export function getPublicClient(network: string) {
  const chain = NETWORK_REGISTRY[network];
  const rpcUrl = RPC_URLS[network];
  
  if (!chain || !rpcUrl) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Creates a wallet client for signing transactions
 */
export function getWalletClient(network: string) {
  const chain = NETWORK_REGISTRY[network];
  const rpcUrl = RPC_URLS[network];
  
  if (!chain || !rpcUrl) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  if (!process.env.FACILITATOR_PRIVATE_KEY) {
    throw new Error('FACILITATOR_PRIVATE_KEY not configured');
  }
  
  const account = privateKeyToAccount(process.env.FACILITATOR_PRIVATE_KEY as `0x${string}`);
  
  return createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Gets token address for a given network and asset
 */
export function getTokenAddress(network: string, asset: string): string {
  const tokensByNetwork = TOKEN_REGISTRY[asset.toLowerCase()];
  
  if (!tokensByNetwork) {
    throw new Error(`Unsupported asset: ${asset}`);
  }
  
  const address = tokensByNetwork[network];
  
  if (!address) {
    throw new Error(`Asset ${asset} not supported on network ${network}`);
  }
  
  return address;
}

/**
 * Gets token decimals for a given asset
 */
export function getTokenDecimals(asset: string): number {
  const decimals = TOKEN_DECIMALS[asset.toLowerCase()];
  
  if (decimals === undefined) {
    throw new Error(`Unknown decimals for asset: ${asset}`);
  }
  
  return decimals;
}

/**
 * Checks if an asset is a native token (ETH, 0G, etc.)
 */
export function isNativeToken(asset: string, network: string): boolean {
  const address = getTokenAddress(network, asset);
  return address === '0x0000000000000000000000000000000000000000';
}

/**
 * Gets list of supported networks
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(NETWORK_REGISTRY);
}

/**
 * Gets list of supported assets for a given network
 */
export function getSupportedAssets(network: string): string[] {
  const assets: string[] = [];
  
  for (const [asset, networks] of Object.entries(TOKEN_REGISTRY)) {
    if (networks[network]) {
      assets.push(asset);
    }
  }
  
  return assets;
}

/**
 * Validates if a network + asset combination is supported
 */
export function isSupported(network: string, asset: string): boolean {
  try {
    getTokenAddress(network, asset);
    return true;
  } catch {
    return false;
  }
}

