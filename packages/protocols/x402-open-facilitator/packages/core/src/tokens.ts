import type { TokenConfig, ChainId } from './types.js';

/**
 * Well-known token addresses across chains
 */
export const knownTokens: Record<string, Record<ChainId, string>> = {
  // USDC addresses
  USDC: {
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet
    84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
    11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
    solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // Solana Mainnet
    'solana-devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Solana Devnet
  },
  // WETH addresses (EVM only)
  WETH: {
    8453: '0x4200000000000000000000000000000000000006', // Base
    84532: '0x4200000000000000000000000000000000000006', // Base Sepolia
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum
    11155111: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // Sepolia
  },
  // SOL (wrapped, for Solana)
  SOL: {
    solana: 'So11111111111111111111111111111111111111112', // Native SOL (wrapped)
  },
  // STX (native, Stacks)
  STX: {
    stacks: 'STX',
    'stacks-testnet': 'STX',
  },
  // sBTC on Stacks
  sBTC: {
    stacks: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    'stacks-testnet': 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token',
  },
  // USDCx on Stacks
  USDCx: {
    stacks: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
    'stacks-testnet': 'ST2Y455NJPETB2SRSD0VDZP3KJE50WNHY0BN3TWY5.usdcx',
  },
};

/**
 * Default token configurations for facilitators (production)
 */
export const defaultTokens: TokenConfig[] = [
  // USDC on Base Mainnet
  {
    address: knownTokens.USDC[8453],
    symbol: 'USDC',
    decimals: 6,
    chainId: 8453,
  },
  // USDC on Solana Mainnet
  {
    address: knownTokens.USDC['solana'],
    symbol: 'USDC',
    decimals: 6,
    chainId: 'solana',
  },
  // STX on Stacks Mainnet
  {
    address: knownTokens.STX['stacks'],
    symbol: 'STX',
    decimals: 6,
    chainId: 'stacks',
  },
  // sBTC on Stacks Mainnet
  {
    address: knownTokens.sBTC['stacks'],
    symbol: 'sBTC',
    decimals: 8,
    chainId: 'stacks',
  },
  // USDCx on Stacks Mainnet
  {
    address: knownTokens.USDCx['stacks'],
    symbol: 'USDCx',
    decimals: 6,
    chainId: 'stacks',
  },
];

/**
 * Test token configurations
 */
export const testTokens: TokenConfig[] = [
  // USDC on Base Sepolia
  {
    address: knownTokens.USDC[84532],
    symbol: 'USDC',
    decimals: 6,
    chainId: 84532,
  },
  // USDC on Solana Devnet
  {
    address: knownTokens.USDC['solana-devnet'],
    symbol: 'USDC',
    decimals: 6,
    chainId: 'solana-devnet',
  },
  // STX on Stacks Testnet
  {
    address: knownTokens.STX['stacks-testnet'],
    symbol: 'STX',
    decimals: 6,
    chainId: 'stacks-testnet',
  },
  // sBTC on Stacks Testnet
  {
    address: knownTokens.sBTC['stacks-testnet'],
    symbol: 'sBTC',
    decimals: 8,
    chainId: 'stacks-testnet',
  },
  // USDCx on Stacks Testnet
  {
    address: knownTokens.USDCx['stacks-testnet'],
    symbol: 'USDCx',
    decimals: 6,
    chainId: 'stacks-testnet',
  },
];

/**
 * All available tokens (production + test)
 */
export const allTokens: TokenConfig[] = [...defaultTokens, ...testTokens];

/**
 * Get token config for a specific chain and address
 */
export function getTokenConfig(chainId: ChainId, address: string): TokenConfig | undefined {
  return allTokens.find(
    (t) => t.chainId === chainId && t.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get all tokens for a specific chain
 */
export function getTokensForChain(chainId: ChainId): TokenConfig[] {
  return allTokens.filter((t) => t.chainId === chainId);
}

/**
 * Check if a token is supported on a chain
 */
export function isTokenSupported(chainId: ChainId, address: string): boolean {
  return allTokens.some(
    (t) => t.chainId === chainId && t.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get production tokens only
 */
export function getProductionTokens(): TokenConfig[] {
  return defaultTokens;
}

/**
 * Get test tokens only
 */
export function getTestTokens(): TokenConfig[] {
  return testTokens;
}
