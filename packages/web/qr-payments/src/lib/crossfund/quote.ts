/**
 * CrossFund Quote System
 * 
 * Real-time price fetching, gas estimation, route optimization
 */

import {
  Token,
  QuoteRequest,
  SwapQuote,
  QuoteComparison,
  GasEstimate,
  GasPrices,
  SwapRoute,
  RouteStep,
  CrossFundConfig,
  DEFAULT_CONFIG,
} from './types';
import { CrossFundError, SwapErrors, withRetry } from './errors';

// ============= SUPPORTED CHAINS & TOKENS =============

export const SUPPORTED_CHAINS: Record<number, {
  name: string;
  nativeCurrency: string;
  nativeDecimals: number;
  avgBlockTime: number;
  supportsEIP1559: boolean;
}> = {
  1: { name: 'Ethereum', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 12, supportsEIP1559: true },
  10: { name: 'Optimism', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 2, supportsEIP1559: true },
  56: { name: 'BNB Chain', nativeCurrency: 'BNB', nativeDecimals: 18, avgBlockTime: 3, supportsEIP1559: false },
  137: { name: 'Polygon', nativeCurrency: 'MATIC', nativeDecimals: 18, avgBlockTime: 2, supportsEIP1559: true },
  8453: { name: 'Base', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 2, supportsEIP1559: true },
  42161: { name: 'Arbitrum', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 0.25, supportsEIP1559: true },
  43114: { name: 'Avalanche', nativeCurrency: 'AVAX', nativeDecimals: 18, avgBlockTime: 2, supportsEIP1559: true },
  324: { name: 'zkSync Era', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 1, supportsEIP1559: true },
  250: { name: 'Fantom', nativeCurrency: 'FTM', nativeDecimals: 18, avgBlockTime: 1, supportsEIP1559: false },
  59144: { name: 'Linea', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 2, supportsEIP1559: true },
  534352: { name: 'Scroll', nativeCurrency: 'ETH', nativeDecimals: 18, avgBlockTime: 3, supportsEIP1559: true },
};

export const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  324: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
  250: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  534352: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
};

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// ============= AGGREGATOR ENDPOINTS =============

interface AggregatorEndpoint {
  name: string;
  type: 'dex-aggregator' | 'bridge-aggregator';
  getQuoteUrl: (chainId: number) => string;
  chains: number[];
  apiKeyHeader?: string;
  apiKeyEnv?: string;
  rateLimit: number; // requests per second
}

const AGGREGATOR_ENDPOINTS: AggregatorEndpoint[] = [
  {
    name: '0x',
    type: 'dex-aggregator',
    getQuoteUrl: (chainId) => {
      const hosts: Record<number, string> = {
        1: 'https://api.0x.org',
        10: 'https://optimism.api.0x.org',
        56: 'https://bsc.api.0x.org',
        137: 'https://polygon.api.0x.org',
        8453: 'https://base.api.0x.org',
        42161: 'https://arbitrum.api.0x.org',
        43114: 'https://avalanche.api.0x.org',
      };
      return hosts[chainId] ? `${hosts[chainId]}/swap/v1/quote` : '';
    },
    chains: [1, 10, 56, 137, 8453, 42161, 43114],
    apiKeyHeader: '0x-api-key',
    apiKeyEnv: 'ZEROX_API_KEY',
    rateLimit: 5,
  },
  {
    name: '1inch',
    type: 'dex-aggregator',
    getQuoteUrl: (chainId) => `https://api.1inch.dev/swap/v6.0/${chainId}/quote`,
    chains: [1, 10, 56, 137, 8453, 42161, 43114, 324, 250, 59144, 534352],
    apiKeyHeader: 'Authorization',
    apiKeyEnv: 'ONEINCH_API_KEY',
    rateLimit: 3,
  },
  {
    name: 'Paraswap',
    type: 'dex-aggregator',
    getQuoteUrl: () => 'https://apiv5.paraswap.io/prices',
    chains: [1, 10, 56, 137, 8453, 42161, 43114, 250],
    rateLimit: 5,
  },
  {
    name: 'Odos',
    type: 'dex-aggregator',
    getQuoteUrl: () => 'https://api.odos.xyz/sor/quote/v2',
    chains: [1, 10, 56, 137, 8453, 42161, 43114, 324, 250, 59144, 534352],
    rateLimit: 5,
  },
  {
    name: 'KyberSwap',
    type: 'dex-aggregator',
    getQuoteUrl: (chainId) => {
      const slugs: Record<number, string> = {
        1: 'ethereum',
        10: 'optimism',
        56: 'bsc',
        137: 'polygon',
        8453: 'base',
        42161: 'arbitrum',
        43114: 'avalanche',
      };
      return slugs[chainId] ? `https://aggregator-api.kyberswap.com/${slugs[chainId]}/api/v1/routes` : '';
    },
    chains: [1, 10, 56, 137, 8453, 42161, 43114],
    rateLimit: 5,
  },
  {
    name: 'Socket',
    type: 'bridge-aggregator',
    getQuoteUrl: () => 'https://api.socket.tech/v2/quote',
    chains: [1, 10, 56, 137, 8453, 42161, 43114, 324, 250, 59144, 534352],
    apiKeyHeader: 'API-KEY',
    apiKeyEnv: 'SOCKET_API_KEY',
    rateLimit: 5,
  },
  {
    name: 'LiFi',
    type: 'bridge-aggregator',
    getQuoteUrl: () => 'https://li.quest/v1/quote',
    chains: [1, 10, 56, 137, 8453, 42161, 43114, 324, 250, 59144],
    apiKeyHeader: 'x-lifi-api-key',
    apiKeyEnv: 'LIFI_API_KEY',
    rateLimit: 3,
  },
];

// ============= QUOTE CACHE =============

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class QuoteCache {
  private cache: Map<string, CacheEntry<SwapQuote[]>> = new Map();
  private priceCache: Map<string, CacheEntry<number>> = new Map();
  private gasCache: Map<number, CacheEntry<GasPrices>> = new Map();

  private readonly quoteTtl: number;
  private readonly priceTtl: number;
  private readonly gasTtl: number;

  constructor(config: CrossFundConfig = DEFAULT_CONFIG) {
    this.quoteTtl = config.cacheTtlMs;
    this.priceTtl = 60000; // 1 minute for prices
    this.gasTtl = 15000; // 15 seconds for gas
  }

  private makeKey(request: QuoteRequest): string {
    return `${request.inputToken.chainId}-${request.inputToken.address}-${request.outputToken.chainId}-${request.outputToken.address}-${request.amount}-${request.amountType}`;
  }

  getQuotes(request: QuoteRequest): SwapQuote[] | null {
    const key = this.makeKey(request);
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.quoteTtl) {
      return entry.data;
    }
    return null;
  }

  setQuotes(request: QuoteRequest, quotes: SwapQuote[]): void {
    const key = this.makeKey(request);
    this.cache.set(key, { data: quotes, timestamp: Date.now() });
  }

  getPrice(token: Token): number | null {
    const key = `${token.chainId}-${token.address}`;
    const entry = this.priceCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.priceTtl) {
      return entry.data;
    }
    return null;
  }

  setPrice(token: Token, price: number): void {
    const key = `${token.chainId}-${token.address}`;
    this.priceCache.set(key, { data: price, timestamp: Date.now() });
  }

  getGasPrices(chainId: number): GasPrices | null {
    const entry = this.gasCache.get(chainId);
    if (entry && Date.now() - entry.timestamp < this.gasTtl) {
      return entry.data;
    }
    return null;
  }

  setGasPrices(chainId: number, prices: GasPrices): void {
    this.gasCache.set(chainId, { data: prices, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
    this.priceCache.clear();
    this.gasCache.clear();
  }
}

// ============= QUOTE SERVICE =============

export class QuoteService {
  private config: CrossFundConfig;
  private cache: QuoteCache;

  constructor(config: Partial<CrossFundConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new QuoteCache(this.config);
  }

  /**
   * Get quotes from all relevant aggregators
   */
  async getQuotes(request: QuoteRequest): Promise<QuoteComparison> {
    const startTime = Date.now();

    // Validate request
    this.validateQuoteRequest(request);

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.getQuotes(request);
      if (cached) {
        return this.buildComparison(cached, startTime, [], []);
      }
    }

    const isCrossChain = request.inputToken.chainId !== request.outputToken.chainId;

    // Select relevant aggregators
    const eligibleAggregators = AGGREGATOR_ENDPOINTS.filter(agg => {
      if (isCrossChain) {
        return agg.type === 'bridge-aggregator' &&
          agg.chains.includes(request.inputToken.chainId) &&
          agg.chains.includes(request.outputToken.chainId);
      }
      return agg.chains.includes(request.inputToken.chainId);
    });

    if (eligibleAggregators.length === 0) {
      throw SwapErrors.noRouteFound(
        request.inputToken.symbol,
        request.outputToken.symbol,
        request.inputToken.chainId,
        request.outputToken.chainId
      );
    }

    // Query all aggregators in parallel
    const quotePromises = eligibleAggregators.map(agg => 
      this.queryAggregator(agg, request).catch(error => {
        console.warn(`[${agg.name}] Quote failed:`, error.message);
        return { aggregator: agg.name, error };
      })
    );

    const results = await Promise.allSettled(quotePromises);

    const quotes: SwapQuote[] = [];
    const aggregatorsQueried: string[] = [];
    const aggregatorsFailed: string[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const value = result.value;
        if ('error' in value) {
          aggregatorsFailed.push(value.aggregator);
        } else {
          quotes.push(value as SwapQuote);
          aggregatorsQueried.push((value as SwapQuote).aggregator);
        }
      }
    }

    if (quotes.length === 0) {
      throw SwapErrors.noRouteFound(
        request.inputToken.symbol,
        request.outputToken.symbol,
        request.inputToken.chainId,
        request.outputToken.chainId
      );
    }

    // Sort by net output (best first)
    quotes.sort((a, b) => b.netOutputUsd - a.netOutputUsd);

    // Cache results
    if (this.config.enableCache) {
      this.cache.setQuotes(request, quotes);
    }

    return this.buildComparison(quotes, startTime, aggregatorsQueried, aggregatorsFailed);
  }

  /**
   * Get the single best quote
   */
  async getBestQuote(request: QuoteRequest): Promise<SwapQuote> {
    const comparison = await this.getQuotes(request);
    return comparison.bestQuote;
  }

  /**
   * Get real-time token price in USD
   */
  async getTokenPrice(token: Token): Promise<number> {
    // Check cache
    const cached = this.cache.getPrice(token);
    if (cached !== null) {
      return cached;
    }

    // Use CoinGecko API for price data
    try {
      const chainSlug = this.getCoingeckoChainSlug(token.chainId);
      if (!chainSlug) {
        // Fallback: query via swap to USDC
        return this.getPriceViaSwap(token);
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/${chainSlug}?contract_addresses=${token.address}&vs_currencies=usd`,
        { headers: { accept: 'application/json' } }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const price = data[token.address.toLowerCase()]?.usd;

      if (price) {
        this.cache.setPrice(token, price);
        return price;
      }

      // Fallback to swap-based pricing
      return this.getPriceViaSwap(token);
    } catch (error) {
      console.warn('Price fetch failed, using swap fallback:', error);
      return this.getPriceViaSwap(token);
    }
  }

  /**
   * Get gas prices for a chain
   */
  async getGasPrices(chainId: number): Promise<GasPrices> {
    // Check cache
    const cached = this.cache.getGasPrices(chainId);
    if (cached) {
      return cached;
    }

    const chainConfig = SUPPORTED_CHAINS[chainId];
    if (!chainConfig) {
      throw SwapErrors.unsupportedChain(chainId);
    }

    try {
      // Use Blocknative Gas API or chain-specific endpoints
      const gasPrices = await this.fetchGasPrices(chainId);
      this.cache.setGasPrices(chainId, gasPrices);
      return gasPrices;
    } catch (error) {
      console.warn(`Gas price fetch failed for chain ${chainId}:`, error);
      // Return default gas prices
      return this.getDefaultGasPrices(chainId);
    }
  }

  /**
   * Estimate gas for a swap
   */
  async estimateGas(
    request: QuoteRequest,
    quote: SwapQuote
  ): Promise<GasEstimate> {
    const gasPrices = await this.getGasPrices(request.inputToken.chainId);
    const gasLimit = BigInt(quote.estimatedGas);
    const gasPrice = BigInt(gasPrices.standard.gasPrice);

    const estimatedCostWei = (gasLimit * gasPrice).toString();
    const chainConfig = SUPPORTED_CHAINS[request.inputToken.chainId];
    
    // Get native token price
    const nativePrice = gasPrices.nativeTokenPriceUsd;
    const estimatedCostUsd = Number(estimatedCostWei) / 1e18 * nativePrice;

    return {
      chainId: request.inputToken.chainId,
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrices.standard.gasPrice,
      maxFeePerGas: gasPrices.standard.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.standard.maxPriorityFeePerGas,
      estimatedCostWei,
      estimatedCostUsd,
      confidence: 'medium',
    };
  }

  /**
   * Calculate price impact
   */
  calculatePriceImpact(
    inputAmount: string,
    outputAmount: string,
    inputToken: Token,
    outputToken: Token,
    inputPrice: number,
    outputPrice: number
  ): number {
    const inputValue = Number(inputAmount) / Math.pow(10, inputToken.decimals) * inputPrice;
    const outputValue = Number(outputAmount) / Math.pow(10, outputToken.decimals) * outputPrice;
    
    if (inputValue === 0) return 0;
    
    const impact = ((inputValue - outputValue) / inputValue) * 100;
    return Math.max(0, impact); // Price impact should be non-negative
  }

  /**
   * Calculate minimum output with slippage
   */
  calculateMinOutput(outputAmount: string, slippageBps: number): string {
    const amount = BigInt(outputAmount);
    const minOutput = (amount * BigInt(10000 - slippageBps)) / BigInt(10000);
    return minOutput.toString();
  }

  // ============= PRIVATE METHODS =============

  private validateQuoteRequest(request: QuoteRequest): void {
    if (!request.inputToken || !request.outputToken) {
      throw SwapErrors.invalidParams('tokens', 'Input and output tokens are required');
    }

    if (!request.amount || BigInt(request.amount) <= 0n) {
      throw SwapErrors.invalidParams('amount', 'Amount must be positive');
    }

    if (!SUPPORTED_CHAINS[request.inputToken.chainId]) {
      throw SwapErrors.unsupportedChain(request.inputToken.chainId);
    }

    if (!SUPPORTED_CHAINS[request.outputToken.chainId]) {
      throw SwapErrors.unsupportedChain(request.outputToken.chainId);
    }
  }

  private async queryAggregator(
    aggregator: AggregatorEndpoint,
    request: QuoteRequest
  ): Promise<SwapQuote> {
    const url = aggregator.getQuoteUrl(request.inputToken.chainId);
    if (!url) {
      throw new Error(`Aggregator ${aggregator.name} not available for chain ${request.inputToken.chainId}`);
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (aggregator.apiKeyHeader && aggregator.apiKeyEnv) {
      const apiKey = process.env[aggregator.apiKeyEnv];
      if (apiKey) {
        if (aggregator.apiKeyHeader === 'Authorization') {
          headers[aggregator.apiKeyHeader] = `Bearer ${apiKey}`;
        } else {
          headers[aggregator.apiKeyHeader] = apiKey;
        }
      }
    }

    // Execute query based on aggregator
    return withRetry(async () => {
      switch (aggregator.name) {
        case '0x':
          return this.query0x(request, url, headers);
        case '1inch':
          return this.query1inch(request, url, headers);
        case 'Paraswap':
          return this.queryParaswap(request, url, headers);
        case 'Odos':
          return this.queryOdos(request, url, headers);
        case 'KyberSwap':
          return this.queryKyberSwap(request, url, headers);
        case 'Socket':
          return this.querySocket(request, url, headers);
        case 'LiFi':
          return this.queryLiFi(request, url, headers);
        default:
          throw new Error(`Unknown aggregator: ${aggregator.name}`);
      }
    });
  }

  private async query0x(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      sellToken: request.inputToken.address,
      buyToken: request.outputToken.address,
      sellAmount: request.amount,
      ...(request.userAddress && { takerAddress: request.userAddress }),
      slippagePercentage: ((request.slippageBps || 100) / 10000).toString(),
    });

    const response = await fetch(`${baseUrl}?${params}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();

    return this.normalizeQuote('0x', request, {
      outputAmount: data.buyAmount,
      estimatedGas: data.estimatedGas || '300000',
      priceImpact: parseFloat(data.estimatedPriceImpact || '0'),
      txData: {
        to: data.to,
        data: data.data,
        value: data.value,
        gasLimit: data.gas,
      },
    });
  }

  private async query1inch(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      src: request.inputToken.address === NATIVE_TOKEN 
        ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        : request.inputToken.address,
      dst: request.outputToken.address,
      amount: request.amount,
    });

    const response = await fetch(`${baseUrl}?${params}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();

    return this.normalizeQuote('1inch', request, {
      outputAmount: data.dstAmount,
      estimatedGas: data.estimatedGas?.toString() || '300000',
      priceImpact: 0,
    });
  }

  private async queryParaswap(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      srcToken: request.inputToken.address,
      destToken: request.outputToken.address,
      amount: request.amount,
      srcDecimals: request.inputToken.decimals.toString(),
      destDecimals: request.outputToken.decimals.toString(),
      network: request.inputToken.chainId.toString(),
    });

    const response = await fetch(`${baseUrl}?${params}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();
    const priceRoute = data.priceRoute;

    return this.normalizeQuote('Paraswap', request, {
      outputAmount: priceRoute.destAmount,
      estimatedGas: priceRoute.gasCost || '300000',
      priceImpact: parseFloat(priceRoute.srcUSD && priceRoute.destUSD 
        ? (((parseFloat(priceRoute.srcUSD) - parseFloat(priceRoute.destUSD)) / parseFloat(priceRoute.srcUSD)) * 100).toString()
        : '0'),
    });
  }

  private async queryOdos(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const body = {
      chainId: request.inputToken.chainId,
      inputTokens: [{
        tokenAddress: request.inputToken.address,
        amount: request.amount,
      }],
      outputTokens: [{
        tokenAddress: request.outputToken.address,
        proportion: 1,
      }],
      slippageLimitPercent: (request.slippageBps || 100) / 100,
      ...(request.userAddress && { userAddr: request.userAddress }),
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();

    return this.normalizeQuote('Odos', request, {
      outputAmount: data.outAmounts?.[0] || '0',
      estimatedGas: data.gasEstimate?.toString() || '300000',
      priceImpact: data.priceImpact || 0,
    });
  }

  private async queryKyberSwap(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      tokenIn: request.inputToken.address,
      tokenOut: request.outputToken.address,
      amountIn: request.amount,
    });

    const response = await fetch(`${baseUrl}?${params}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();
    const routeSummary = data.data?.routeSummary;

    return this.normalizeQuote('KyberSwap', request, {
      outputAmount: routeSummary?.amountOut || '0',
      estimatedGas: routeSummary?.gas || '300000',
      priceImpact: parseFloat(routeSummary?.priceImpact || '0'),
    });
  }

  private async querySocket(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      fromChainId: request.inputToken.chainId.toString(),
      fromTokenAddress: request.inputToken.address,
      toChainId: request.outputToken.chainId.toString(),
      toTokenAddress: request.outputToken.address,
      fromAmount: request.amount,
      userAddress: request.userAddress || '0x0000000000000000000000000000000000000000',
      uniqueRoutesPerBridge: 'true',
      sort: 'output',
    });

    const response = await fetch(`${baseUrl}?${params}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();
    const route = data.result?.routes?.[0];

    if (!route) {
      throw SwapErrors.noRouteFound(
        request.inputToken.symbol,
        request.outputToken.symbol,
        request.inputToken.chainId,
        request.outputToken.chainId
      );
    }

    return this.normalizeQuote('Socket', request, {
      outputAmount: route.toAmount,
      estimatedGas: route.totalGasFeesInUsd ? '500000' : '300000',
      priceImpact: 0,
      bridgeUsed: route.usedBridgeNames?.join(', '),
      estimatedTime: route.serviceTime || 300,
    });
  }

  private async queryLiFi(
    request: QuoteRequest,
    baseUrl: string,
    headers: Record<string, string>
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      fromChain: request.inputToken.chainId.toString(),
      toChain: request.outputToken.chainId.toString(),
      fromToken: request.inputToken.address,
      toToken: request.outputToken.address,
      fromAmount: request.amount,
      fromAddress: request.userAddress || '0x0000000000000000000000000000000000000000',
    });

    const response = await fetch(`${baseUrl}?${params}`, { headers });

    if (!response.ok) {
      const error = await response.text();
      throw SwapErrors.apiError(response.status, error);
    }

    const data = await response.json();

    return this.normalizeQuote('LiFi', request, {
      outputAmount: data.estimate?.toAmount || '0',
      estimatedGas: data.estimate?.gasCosts?.[0]?.amount || '300000',
      priceImpact: 0,
      bridgeUsed: data.toolDetails?.name,
      estimatedTime: data.estimate?.executionDuration || 300,
    });
  }

  private async normalizeQuote(
    aggregator: string,
    request: QuoteRequest,
    data: {
      outputAmount: string;
      estimatedGas: string;
      priceImpact: number;
      txData?: { to: string; data: string; value: string; gasLimit?: string };
      bridgeUsed?: string;
      estimatedTime?: number;
    }
  ): Promise<SwapQuote> {
    const now = Date.now();
    const slippageBps = request.slippageBps || this.config.defaultSlippageBps;
    const deadline = request.deadline || now + this.config.defaultDeadlineMinutes * 60 * 1000;

    // Get token prices
    const [inputPrice, outputPrice, gasPrices] = await Promise.all([
      this.getTokenPrice(request.inputToken).catch(() => 0),
      this.getTokenPrice(request.outputToken).catch(() => 1), // Default 1 for stablecoins
      this.getGasPrices(request.inputToken.chainId),
    ]);

    const inputAmountNum = Number(request.amount) / Math.pow(10, request.inputToken.decimals);
    const outputAmountNum = Number(data.outputAmount) / Math.pow(10, request.outputToken.decimals);

    const inputAmountUsd = inputAmountNum * inputPrice;
    const outputAmountUsd = outputAmountNum * outputPrice;

    // Calculate gas cost in USD
    const gasLimit = BigInt(data.estimatedGas);
    const gasPrice = BigInt(gasPrices.standard.gasPrice);
    const gasCostWei = gasLimit * gasPrice;
    const gasCostUsd = Number(gasCostWei) / 1e18 * gasPrices.nativeTokenPriceUsd;

    const isCrossChain = request.inputToken.chainId !== request.outputToken.chainId;

    return {
      id: `${aggregator}-${now}-${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      expiresAt: deadline,
      inputToken: request.inputToken,
      outputToken: request.outputToken,
      inputAmount: request.amount,
      outputAmount: data.outputAmount,
      outputAmountMin: this.calculateMinOutput(data.outputAmount, slippageBps),
      exchangeRate: (outputAmountNum / inputAmountNum).toFixed(8),
      priceImpact: data.priceImpact,
      inputAmountUsd,
      outputAmountUsd,
      route: {
        id: `route-${now}`,
        steps: [{
          protocol: aggregator,
          protocolType: isCrossChain ? 'bridge-aggregator' : 'dex-aggregator',
          action: isCrossChain ? 'bridge' : 'swap',
          fromToken: request.inputToken,
          toToken: request.outputToken,
          fromAmount: request.amount,
          toAmount: data.outputAmount,
          fromChainId: request.inputToken.chainId,
          toChainId: request.outputToken.chainId,
          estimatedGas: data.estimatedGas,
          estimatedTime: data.estimatedTime || (isCrossChain ? 300 : 30),
        }],
        totalSteps: 1,
        isCrossChain,
        bridgeUsed: data.bridgeUsed,
        estimatedTime: data.estimatedTime || (isCrossChain ? 300 : 30),
        estimatedGas: data.estimatedGas,
      },
      aggregator,
      estimatedGas: data.estimatedGas,
      gasCostUsd,
      netOutputUsd: outputAmountUsd - gasCostUsd,
      slippageBps,
      txData: data.txData ? [{
        id: `tx-${now}`,
        type: 'swap',
        chainId: request.inputToken.chainId,
        to: data.txData.to,
        from: request.userAddress || '',
        data: data.txData.data,
        value: data.txData.value,
        gasLimit: data.txData.gasLimit || data.estimatedGas,
        description: `Swap ${request.inputToken.symbol} to ${request.outputToken.symbol}`,
        estimatedGas: data.estimatedGas,
        order: 0,
      }] : undefined,
    };
  }

  private buildComparison(
    quotes: SwapQuote[],
    startTime: number,
    aggregatorsQueried: string[],
    aggregatorsFailed: string[]
  ): QuoteComparison {
    const bestQuote = quotes[0];
    const worstQuote = quotes[quotes.length - 1];
    const savings = quotes.length > 1 
      ? bestQuote.netOutputUsd - worstQuote.netOutputUsd 
      : 0;

    return {
      quotes,
      bestQuote,
      savings,
      queryTime: Date.now() - startTime,
      aggregatorsQueried,
      aggregatorsFailed,
    };
  }

  private async getPriceViaSwap(token: Token): Promise<number> {
    // Get USDC on the same chain
    const usdcAddress = USDC_ADDRESSES[token.chainId];
    if (!usdcAddress || token.address.toLowerCase() === usdcAddress.toLowerCase()) {
      return 1; // USDC = $1
    }

    try {
      const quote = await this.getBestQuote({
        inputToken: token,
        outputToken: {
          address: usdcAddress,
          symbol: 'USDC',
          decimals: 6,
          chainId: token.chainId,
        },
        amount: Math.pow(10, token.decimals).toString(), // 1 token
        amountType: 'inputAmountHuman',
      });

      const price = Number(quote.outputAmount) / Math.pow(10, 6);
      this.cache.setPrice(token, price);
      return price;
    } catch {
      return 0;
    }
  }

  private getCoingeckoChainSlug(chainId: number): string | null {
    const slugs: Record<number, string> = {
      1: 'ethereum',
      10: 'optimistic-ethereum',
      56: 'binance-smart-chain',
      137: 'polygon-pos',
      8453: 'base',
      42161: 'arbitrum-one',
      43114: 'avalanche',
      250: 'fantom',
    };
    return slugs[chainId] || null;
  }

  private async fetchGasPrices(chainId: number): Promise<GasPrices> {
    // Use Blocknative or chain RPC for real gas prices
    // For now, return realistic estimates based on chain
    return this.getDefaultGasPrices(chainId);
  }

  private getDefaultGasPrices(chainId: number): GasPrices {
    const chainConfig = SUPPORTED_CHAINS[chainId];
    
    // Gas prices in gwei, native token prices approximate
    const defaults: Record<number, { slow: number; standard: number; fast: number; nativePrice: number }> = {
      1: { slow: 15, standard: 25, fast: 40, nativePrice: 3000 },
      10: { slow: 0.001, standard: 0.002, fast: 0.005, nativePrice: 3000 },
      56: { slow: 3, standard: 5, fast: 7, nativePrice: 300 },
      137: { slow: 30, standard: 50, fast: 80, nativePrice: 0.5 },
      8453: { slow: 0.001, standard: 0.002, fast: 0.005, nativePrice: 3000 },
      42161: { slow: 0.01, standard: 0.02, fast: 0.05, nativePrice: 3000 },
      43114: { slow: 25, standard: 30, fast: 40, nativePrice: 20 },
      324: { slow: 0.25, standard: 0.25, fast: 0.25, nativePrice: 3000 },
      250: { slow: 50, standard: 100, fast: 200, nativePrice: 0.3 },
      59144: { slow: 0.1, standard: 0.2, fast: 0.3, nativePrice: 3000 },
      534352: { slow: 0.1, standard: 0.2, fast: 0.3, nativePrice: 3000 },
    };

    const d = defaults[chainId] || { slow: 10, standard: 20, fast: 30, nativePrice: 1 };
    const toWei = (gwei: number) => (BigInt(Math.floor(gwei * 1e9))).toString();

    return {
      chainId,
      timestamp: Date.now(),
      slow: {
        gasPrice: toWei(d.slow),
        maxFeePerGas: chainConfig?.supportsEIP1559 ? toWei(d.slow * 1.5) : undefined,
        maxPriorityFeePerGas: chainConfig?.supportsEIP1559 ? toWei(1) : undefined,
        estimatedTime: 120,
      },
      standard: {
        gasPrice: toWei(d.standard),
        maxFeePerGas: chainConfig?.supportsEIP1559 ? toWei(d.standard * 1.5) : undefined,
        maxPriorityFeePerGas: chainConfig?.supportsEIP1559 ? toWei(1.5) : undefined,
        estimatedTime: 30,
      },
      fast: {
        gasPrice: toWei(d.fast),
        maxFeePerGas: chainConfig?.supportsEIP1559 ? toWei(d.fast * 1.5) : undefined,
        maxPriorityFeePerGas: chainConfig?.supportsEIP1559 ? toWei(2) : undefined,
        estimatedTime: 15,
      },
      nativeTokenPriceUsd: d.nativePrice,
    };
  }
}

// ============= EXPORTS =============

export const quoteService = new QuoteService();

export async function getQuote(request: QuoteRequest): Promise<SwapQuote> {
  return quoteService.getBestQuote(request);
}

export async function getQuotes(request: QuoteRequest): Promise<QuoteComparison> {
  return quoteService.getQuotes(request);
}

export async function getTokenPrice(token: Token): Promise<number> {
  return quoteService.getTokenPrice(token);
}

export async function getGasPrices(chainId: number): Promise<GasPrices> {
  return quoteService.getGasPrices(chainId);
}
