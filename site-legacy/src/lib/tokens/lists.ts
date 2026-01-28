/**
 * Token List Management
 * Real token lists from CoinGecko and verified sources
 */

export interface TokenInfo {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: {
    coingeckoId?: string;
    bridgeInfo?: Record<string, { tokenAddress: string }>;
  };
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: { major: number; minor: number; patch: number };
  tokens: TokenInfo[];
  logoURI?: string;
}

/**
 * Real token list URLs from trusted sources
 */
export const TOKEN_LIST_URLS: Record<string, string> = {
  // CoinGecko lists
  coingecko: 'https://tokens.coingecko.com/uniswap/all.json',
  
  // Uniswap default list
  uniswap: 'https://tokens.uniswap.org',
  
  // 1inch token lists per chain
  '1inch-1': 'https://tokens.1inch.io/v1.2/1',
  '1inch-137': 'https://tokens.1inch.io/v1.2/137',
  '1inch-56': 'https://tokens.1inch.io/v1.2/56',
  '1inch-42161': 'https://tokens.1inch.io/v1.2/42161',
  '1inch-10': 'https://tokens.1inch.io/v1.2/10',
  '1inch-43114': 'https://tokens.1inch.io/v1.2/43114',
  
  // Sushiswap extended list
  sushi: 'https://token-list.sushi.com',
  
  // Chain-specific lists
  arbitrum: 'https://bridge.arbitrum.io/token-list-42161.json',
  optimism: 'https://static.optimism.io/optimism.tokenlist.json',
  base: 'https://static.optimism.io/optimism.tokenlist.json',
  polygon: 'https://api-polygon-tokens.polygon.technology/tokenlists/default.tokenlist.json',
};

/**
 * USDC addresses per chain - verified contract addresses
 */
export const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon (native)
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',     // BSC
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',  // Avalanche
  250: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',    // Fantom
  100: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',    // Gnosis
  324: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',    // zkSync Era
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',  // Linea
  534352: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', // Scroll
};

/**
 * USDT addresses per chain - verified contract addresses
 */
export const USDT_ADDRESSES: Record<number, string> = {
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',      // Ethereum
  10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',     // Optimism
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',    // Polygon
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',  // Arbitrum
  8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',   // Base
  56: '0x55d398326f99059fF775485246999027B3197955',     // BSC
  43114: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',  // Avalanche
  250: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',    // Fantom (fUSDT)
  324: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C',    // zkSync Era
};

/**
 * WETH addresses per chain - verified contract addresses
 */
export const WETH_ADDRESSES: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',      // Ethereum
  10: '0x4200000000000000000000000000000000000006',     // Optimism
  137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',    // Polygon
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',  // Arbitrum
  8453: '0x4200000000000000000000000000000000000006',   // Base
  56: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',     // BSC (WETH)
  43114: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',  // Avalanche (WETH.e)
  324: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',    // zkSync Era
  59144: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',  // Linea
};

/**
 * Native token (ETH) placeholder address used by aggregators
 */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/**
 * Popular tokens for quick selection
 */
export const POPULAR_TOKENS: TokenInfo[] = [
  {
    address: NATIVE_TOKEN_ADDRESS,
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  },
  {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: 1,
    name: 'Tether',
    symbol: 'USDT',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  },
  {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    chainId: 1,
    name: 'Wrapped Bitcoin',
    symbol: 'WBTC',
    decimals: 8,
    logoURI: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  },
  {
    address: '0x6B175474E89094C44Da98b954EesdeCB5BE1e108',
    chainId: 1,
    name: 'Dai',
    symbol: 'DAI',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
  },
  {
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    chainId: 1,
    name: 'Chainlink',
    symbol: 'LINK',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    chainId: 1,
    name: 'Uniswap',
    symbol: 'UNI',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  },
  {
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    chainId: 1,
    name: 'Aave',
    symbol: 'AAVE',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  },
];

// In-memory cache for token lists
const tokenListCache = new Map<string, { list: TokenList; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch token list from URL with caching
 */
export async function fetchTokenList(url: string): Promise<TokenList | null> {
  const cached = tokenListCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.list;
  }

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 600 }, // Cache for 10 minutes
    });

    if (!response.ok) {
      console.error(`Failed to fetch token list from ${url}: ${response.status}`);
      return null;
    }

    const list = await response.json() as TokenList;
    tokenListCache.set(url, { list, timestamp: Date.now() });
    return list;
  } catch (error) {
    console.error(`Error fetching token list from ${url}:`, error);
    return null;
  }
}

/**
 * Get tokens for a specific chain from multiple sources
 */
export async function getTokensForChain(chainId: number): Promise<TokenInfo[]> {
  const tokens = new Map<string, TokenInfo>();

  // Add popular tokens for this chain
  POPULAR_TOKENS
    .filter(t => t.chainId === chainId)
    .forEach(t => tokens.set(t.address.toLowerCase(), t));

  // Add native token representation
  const nativeToken: TokenInfo = {
    address: NATIVE_TOKEN_ADDRESS,
    chainId,
    name: chainId === 56 ? 'BNB' : chainId === 137 ? 'MATIC' : chainId === 43114 ? 'AVAX' : 'ETH',
    symbol: chainId === 56 ? 'BNB' : chainId === 137 ? 'MATIC' : chainId === 43114 ? 'AVAX' : 'ETH',
    decimals: 18,
    logoURI: `https://assets.coingecko.com/coins/images/${
      chainId === 56 ? '825' : chainId === 137 ? '4713' : chainId === 43114 ? '12559' : '279'
    }/small/logo.png`,
  };
  tokens.set(NATIVE_TOKEN_ADDRESS.toLowerCase(), nativeToken);

  // Try to fetch from 1inch list for this chain
  const oneInchUrl = TOKEN_LIST_URLS[`1inch-${chainId}`];
  if (oneInchUrl) {
    try {
      const response = await fetch(oneInchUrl);
      if (response.ok) {
        const data = await response.json();
        // 1inch returns { address: tokenInfo }
        Object.entries(data).forEach(([address, info]: [string, any]) => {
          if (!tokens.has(address.toLowerCase())) {
            tokens.set(address.toLowerCase(), {
              address,
              chainId,
              name: info.name,
              symbol: info.symbol,
              decimals: info.decimals,
              logoURI: info.logoURI,
            });
          }
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch 1inch tokens for chain ${chainId}`);
    }
  }

  // Add stablecoins
  if (USDC_ADDRESSES[chainId]) {
    tokens.set(USDC_ADDRESSES[chainId].toLowerCase(), {
      address: USDC_ADDRESSES[chainId],
      chainId,
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    });
  }

  if (USDT_ADDRESSES[chainId]) {
    tokens.set(USDT_ADDRESSES[chainId].toLowerCase(), {
      address: USDT_ADDRESSES[chainId],
      chainId,
      name: 'Tether',
      symbol: 'USDT',
      decimals: 6,
      logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    });
  }

  if (WETH_ADDRESSES[chainId]) {
    tokens.set(WETH_ADDRESSES[chainId].toLowerCase(), {
      address: WETH_ADDRESSES[chainId],
      chainId,
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    });
  }

  return Array.from(tokens.values());
}

/**
 * Search tokens by symbol, name, or address
 */
export function searchTokens(tokens: TokenInfo[], query: string): TokenInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return tokens.slice(0, 50); // Return top 50 if no query

  return tokens.filter(token =>
    token.symbol.toLowerCase().includes(q) ||
    token.name.toLowerCase().includes(q) ||
    token.address.toLowerCase() === q
  ).slice(0, 50);
}

/**
 * Get token by address on a specific chain
 */
export function getTokenByAddress(
  tokens: TokenInfo[],
  address: string,
  chainId: number
): TokenInfo | undefined {
  return tokens.find(
    t => t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId
  );
}
