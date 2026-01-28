// Token lists management with caching, custom imports, and recent tokens

import { getChain, type ChainConfig } from '../chains/config';

// =============================================================================
// TYPES
// =============================================================================

export interface TokenInfo {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: {
    bridgeInfo?: Record<string, { tokenAddress: string }>;
    coingeckoId?: string;
  };
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: { major: number; minor: number; patch: number };
  tokens: TokenInfo[];
  logoURI?: string;
}

export interface CachedTokenData {
  tokens: TokenInfo[];
  timestamp: number;
  chainId: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

// Maximum recent tokens to store
const MAX_RECENT_TOKENS = 10;

// Storage keys
const STORAGE_KEYS = {
  TOKEN_CACHE: 'qrpay_token_cache',
  CUSTOM_TOKENS: 'qrpay_custom_tokens',
  RECENT_TOKENS: 'qrpay_recent_tokens',
};

// Popular token lists by chain
const TOKEN_LIST_URLS: Record<number, string[]> = {
  1: [
    'https://tokens.coingecko.com/uniswap/all.json',
    'https://tokens.uniswap.org',
  ],
  137: [
    'https://tokens.coingecko.com/polygon-pos/all.json',
    'https://unpkg.com/quickswap-default-token-list/build/quickswap-default.tokenlist.json',
  ],
  42161: [
    'https://tokens.coingecko.com/arbitrum-one/all.json',
    'https://bridge.arbitrum.io/token-list-42161.json',
  ],
  10: [
    'https://tokens.coingecko.com/optimistic-ethereum/all.json',
    'https://static.optimism.io/optimism.tokenlist.json',
  ],
  8453: [
    'https://tokens.coingecko.com/base/all.json',
  ],
  56: [
    'https://tokens.coingecko.com/binance-smart-chain/all.json',
    'https://tokens.pancakeswap.finance/pancakeswap-extended.json',
  ],
  43114: [
    'https://tokens.coingecko.com/avalanche/all.json',
    'https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/joe.tokenlist.json',
  ],
  324: [
    'https://tokens.coingecko.com/zksync/all.json',
  ],
  59144: [
    'https://tokens.coingecko.com/linea/all.json',
  ],
  534352: [
    'https://tokens.coingecko.com/scroll/all.json',
  ],
  81457: [
    'https://tokens.coingecko.com/blast/all.json',
  ],
  5000: [
    'https://tokens.coingecko.com/mantle/all.json',
  ],
};

// Native token addresses (used as 0x0 or chain-specific)
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// =============================================================================
// WELL-KNOWN TOKENS
// =============================================================================

// USDC addresses by chain
export const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Native USDC
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Native USDC
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Native USDC
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  324: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4',
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  534352: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
  81457: '0x4300000000000000000000000000000000000003', // USDB
  5000: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
  100: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  250: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
};

// USDT addresses by chain
export const USDT_ADDRESSES: Record<number, string> = {
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
  8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  56: '0x55d398326f99059fF775485246999027B3197955',
  43114: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  324: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C',
};

// WETH addresses by chain
export const WETH_ADDRESSES: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  10: '0x4200000000000000000000000000000000000006',
  8453: '0x4200000000000000000000000000000000000006',
  324: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
  59144: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
  534352: '0x5300000000000000000000000000000000000004',
  81457: '0x4300000000000000000000000000000000000004',
};

// Popular tokens for quick select
export const POPULAR_TOKENS: Record<number, TokenInfo[]> = {
  1: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      chainId: 1,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
    },
    {
      address: USDC_ADDRESSES[1],
      chainId: 1,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: USDT_ADDRESSES[1],
      chainId: 1,
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
    },
    {
      address: WETH_ADDRESSES[1],
      chainId: 1,
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      logoURI: '/tokens/weth.svg',
    },
    {
      address: '0x6B175474E89094C44Da98b954EesdfD0a4e9E',
      chainId: 1,
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      logoURI: '/tokens/dai.svg',
    },
  ],
  8453: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      chainId: 8453,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
    },
    {
      address: USDC_ADDRESSES[8453],
      chainId: 8453,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      chainId: 8453,
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      logoURI: '/tokens/dai.svg',
    },
    {
      address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
      chainId: 8453,
      name: 'Coinbase Wrapped Staked ETH',
      symbol: 'cbETH',
      decimals: 18,
      logoURI: '/tokens/cbeth.svg',
    },
  ],
  137: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
      logoURI: '/tokens/matic.svg',
    },
    {
      address: USDC_ADDRESSES[137],
      chainId: 137,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: USDT_ADDRESSES[137],
      chainId: 137,
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
    },
    {
      address: WETH_ADDRESSES[137],
      chainId: 137,
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      logoURI: '/tokens/weth.svg',
    },
  ],
  42161: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      chainId: 42161,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
    },
    {
      address: USDC_ADDRESSES[42161],
      chainId: 42161,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: USDT_ADDRESSES[42161],
      chainId: 42161,
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      logoURI: '/tokens/usdt.svg',
    },
    {
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      chainId: 42161,
      name: 'Arbitrum',
      symbol: 'ARB',
      decimals: 18,
      logoURI: '/tokens/arb.svg',
    },
  ],
  10: [
    {
      address: NATIVE_TOKEN_ADDRESS,
      chainId: 10,
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '/tokens/eth.svg',
    },
    {
      address: USDC_ADDRESSES[10],
      chainId: 10,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI: '/tokens/usdc.svg',
    },
    {
      address: '0x4200000000000000000000000000000000000042',
      chainId: 10,
      name: 'Optimism',
      symbol: 'OP',
      decimals: 18,
      logoURI: '/tokens/op.svg',
    },
  ],
};

// =============================================================================
// TOKEN CACHE
// =============================================================================

class TokenCache {
  private cache: Map<number, CachedTokenData> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TOKEN_CACHE);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, CachedTokenData>;
        Object.entries(parsed).forEach(([chainId, data]) => {
          this.cache.set(Number(chainId), data);
        });
      }
    } catch (error) {
      console.error('Failed to load token cache from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const obj: Record<string, CachedTokenData> = {};
      this.cache.forEach((data, chainId) => {
        obj[chainId.toString()] = data;
      });
      localStorage.setItem(STORAGE_KEYS.TOKEN_CACHE, JSON.stringify(obj));
    } catch (error) {
      console.error('Failed to save token cache to storage:', error);
    }
  }

  get(chainId: number): TokenInfo[] | null {
    const cached = this.cache.get(chainId);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      this.cache.delete(chainId);
      this.saveToStorage();
      return null;
    }

    return cached.tokens;
  }

  set(chainId: number, tokens: TokenInfo[]): void {
    this.cache.set(chainId, {
      tokens,
      timestamp: Date.now(),
      chainId,
    });
    this.saveToStorage();
  }

  clear(chainId?: number): void {
    if (chainId) {
      this.cache.delete(chainId);
    } else {
      this.cache.clear();
    }
    this.saveToStorage();
  }
}

const tokenCache = new TokenCache();

// =============================================================================
// CUSTOM TOKENS
// =============================================================================

class CustomTokenStore {
  private tokens: Map<string, TokenInfo> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private getKey(chainId: number, address: string): string {
    return `${chainId}:${address.toLowerCase()}`;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CUSTOM_TOKENS);
      if (stored) {
        const parsed = JSON.parse(stored) as TokenInfo[];
        parsed.forEach((token) => {
          this.tokens.set(this.getKey(token.chainId, token.address), token);
        });
      }
    } catch (error) {
      console.error('Failed to load custom tokens from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const tokens = Array.from(this.tokens.values());
      localStorage.setItem(STORAGE_KEYS.CUSTOM_TOKENS, JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to save custom tokens to storage:', error);
    }
  }

  add(token: TokenInfo): void {
    this.tokens.set(this.getKey(token.chainId, token.address), token);
    this.saveToStorage();
  }

  remove(chainId: number, address: string): void {
    this.tokens.delete(this.getKey(chainId, address));
    this.saveToStorage();
  }

  get(chainId: number, address: string): TokenInfo | undefined {
    return this.tokens.get(this.getKey(chainId, address));
  }

  getAll(chainId?: number): TokenInfo[] {
    const tokens = Array.from(this.tokens.values());
    if (chainId) {
      return tokens.filter((t) => t.chainId === chainId);
    }
    return tokens;
  }

  has(chainId: number, address: string): boolean {
    return this.tokens.has(this.getKey(chainId, address));
  }
}

const customTokenStore = new CustomTokenStore();

// =============================================================================
// RECENT TOKENS
// =============================================================================

class RecentTokenStore {
  private tokens: TokenInfo[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TOKENS);
      if (stored) {
        this.tokens = JSON.parse(stored) as TokenInfo[];
      }
    } catch (error) {
      console.error('Failed to load recent tokens from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEYS.RECENT_TOKENS, JSON.stringify(this.tokens));
    } catch (error) {
      console.error('Failed to save recent tokens to storage:', error);
    }
  }

  add(token: TokenInfo): void {
    // Remove if already exists
    this.tokens = this.tokens.filter(
      (t) =>
        !(t.chainId === token.chainId && t.address.toLowerCase() === token.address.toLowerCase())
    );

    // Add to front
    this.tokens.unshift(token);

    // Trim to max
    if (this.tokens.length > MAX_RECENT_TOKENS) {
      this.tokens = this.tokens.slice(0, MAX_RECENT_TOKENS);
    }

    this.saveToStorage();
  }

  getAll(): TokenInfo[] {
    return this.tokens;
  }

  getByChain(chainId: number): TokenInfo[] {
    return this.tokens.filter((t) => t.chainId === chainId);
  }

  clear(): void {
    this.tokens = [];
    this.saveToStorage();
  }
}

const recentTokenStore = new RecentTokenStore();

// =============================================================================
// TOKEN FETCHING
// =============================================================================

/**
 * Fetch token list from URL
 */
async function fetchTokenList(url: string): Promise<TokenInfo[]> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Handle both direct token arrays and token list format
    if (Array.isArray(data)) {
      return data;
    }
    
    return data.tokens || [];
  } catch (error) {
    console.error(`Failed to fetch token list from ${url}:`, error);
    return [];
  }
}

/**
 * Fetch tokens for a chain from multiple sources
 */
export async function fetchTokensForChain(chainId: number): Promise<TokenInfo[]> {
  // Check cache first
  const cached = tokenCache.get(chainId);
  if (cached) {
    return cached;
  }

  const urls = TOKEN_LIST_URLS[chainId] || [];
  const allTokens: TokenInfo[] = [];
  const seen = new Set<string>();

  // Fetch from all sources
  const results = await Promise.allSettled(urls.map(fetchTokenList));

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const token of result.value) {
        // Filter by chain ID and dedupe
        if (token.chainId === chainId) {
          const key = token.address.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allTokens.push(token);
          }
        }
      }
    }
  }

  // Add popular tokens if not already present
  const popularTokens = POPULAR_TOKENS[chainId] || [];
  for (const token of popularTokens) {
    const key = token.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allTokens.unshift(token); // Add popular tokens at the beginning
    }
  }

  // Add custom tokens
  const customTokens = customTokenStore.getAll(chainId);
  for (const token of customTokens) {
    const key = token.address.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      allTokens.push(token);
    }
  }

  // Cache the result
  if (allTokens.length > 0) {
    tokenCache.set(chainId, allTokens);
  }

  return allTokens;
}

/**
 * Get token info from on-chain (for custom token imports)
 */
export async function fetchTokenFromChain(
  chainId: number,
  address: string,
  rpcUrl?: string
): Promise<TokenInfo | null> {
  const chain = getChain(chainId);
  if (!chain) return null;

  const url = rpcUrl || chain.rpcUrls[0];
  if (!url) return null;

  // ERC20 function signatures
  const nameSig = '0x06fdde03';
  const symbolSig = '0x95d89b41';
  const decimalsSig = '0x313ce567';

  try {
    const [nameResult, symbolResult, decimalsResult] = await Promise.all([
      ethCall(url, address, nameSig),
      ethCall(url, address, symbolSig),
      ethCall(url, address, decimalsSig),
    ]);

    const name = decodeString(nameResult);
    const symbol = decodeString(symbolResult);
    const decimals = parseInt(decimalsResult, 16);

    if (!name || !symbol || isNaN(decimals)) {
      return null;
    }

    return {
      address,
      chainId,
      name,
      symbol,
      decimals,
    };
  } catch (error) {
    console.error('Failed to fetch token from chain:', error);
    return null;
  }
}

/**
 * Simple eth_call helper
 */
async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to, data }, 'latest'],
      id: 1,
    }),
  });

  const json = await response.json();
  return json.result || '0x';
}

/**
 * Decode ABI-encoded string
 */
function decodeString(hex: string): string {
  if (!hex || hex === '0x') return '';
  
  try {
    // Remove 0x prefix
    const data = hex.slice(2);
    
    // If it's a dynamic string, skip offset and get length
    if (data.length >= 128) {
      const offset = parseInt(data.slice(0, 64), 16) * 2;
      const length = parseInt(data.slice(offset, offset + 64), 16);
      const strHex = data.slice(offset + 64, offset + 64 + length * 2);
      return Buffer.from(strHex, 'hex').toString('utf8').trim();
    }
    
    // Try direct decode for bytes32 encoded strings
    return Buffer.from(data, 'hex').toString('utf8').replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get tokens for a chain (uses cache + fetches if needed)
 */
export async function getTokens(chainId: number): Promise<TokenInfo[]> {
  return fetchTokensForChain(chainId);
}

/**
 * Get a specific token by address
 */
export async function getToken(chainId: number, address: string): Promise<TokenInfo | null> {
  // Check custom tokens first
  const customToken = customTokenStore.get(chainId, address);
  if (customToken) return customToken;

  // Check cached tokens
  const tokens = await getTokens(chainId);
  const token = tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  if (token) return token;

  // Try fetching from chain
  return fetchTokenFromChain(chainId, address);
}

/**
 * Search tokens by symbol or name
 */
export async function searchTokens(
  chainId: number,
  query: string,
  limit = 20
): Promise<TokenInfo[]> {
  const tokens = await getTokens(chainId);
  const q = query.toLowerCase();

  return tokens
    .filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase() === q
    )
    .slice(0, limit);
}

/**
 * Add a custom token
 */
export async function addCustomToken(
  chainId: number,
  address: string
): Promise<TokenInfo | null> {
  // Check if already exists
  if (customTokenStore.has(chainId, address)) {
    return customTokenStore.get(chainId, address) || null;
  }

  // Fetch from chain
  const token = await fetchTokenFromChain(chainId, address);
  if (!token) return null;

  // Save
  customTokenStore.add(token);
  
  // Also add to recent
  recentTokenStore.add(token);

  return token;
}

/**
 * Remove a custom token
 */
export function removeCustomToken(chainId: number, address: string): void {
  customTokenStore.remove(chainId, address);
}

/**
 * Get all custom tokens
 */
export function getCustomTokens(chainId?: number): TokenInfo[] {
  return customTokenStore.getAll(chainId);
}

/**
 * Get popular tokens for a chain
 */
export function getPopularTokens(chainId: number): TokenInfo[] {
  return POPULAR_TOKENS[chainId] || [];
}

/**
 * Add to recent tokens
 */
export function addRecentToken(token: TokenInfo): void {
  recentTokenStore.add(token);
}

/**
 * Get recent tokens
 */
export function getRecentTokens(chainId?: number): TokenInfo[] {
  if (chainId) {
    return recentTokenStore.getByChain(chainId);
  }
  return recentTokenStore.getAll();
}

/**
 * Clear recent tokens
 */
export function clearRecentTokens(): void {
  recentTokenStore.clear();
}

/**
 * Get USDC address for a chain
 */
export function getUsdcAddress(chainId: number): string | undefined {
  return USDC_ADDRESSES[chainId];
}

/**
 * Get USDT address for a chain
 */
export function getUsdtAddress(chainId: number): string | undefined {
  return USDT_ADDRESSES[chainId];
}

/**
 * Get WETH address for a chain
 */
export function getWethAddress(chainId: number): string | undefined {
  return WETH_ADDRESSES[chainId];
}

/**
 * Check if an address is the native token
 */
export function isNativeToken(address: string): boolean {
  return (
    address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
    address === '0x0000000000000000000000000000000000000000'
  );
}

/**
 * Get native token info for a chain
 */
export function getNativeToken(chainId: number): TokenInfo | null {
  const chain = getChain(chainId);
  if (!chain) return null;

  return {
    address: NATIVE_TOKEN_ADDRESS,
    chainId,
    name: chain.nativeCurrency.name,
    symbol: chain.nativeCurrency.symbol,
    decimals: chain.nativeCurrency.decimals,
    logoURI: chain.iconUrl,
  };
}

/**
 * Refresh token cache for a chain
 */
export async function refreshTokenCache(chainId: number): Promise<TokenInfo[]> {
  tokenCache.clear(chainId);
  return fetchTokensForChain(chainId);
}

/**
 * Clear all token caches
 */
export function clearAllTokenCaches(): void {
  tokenCache.clear();
}

// Export stores for direct access if needed
export { tokenCache, customTokenStore, recentTokenStore };
