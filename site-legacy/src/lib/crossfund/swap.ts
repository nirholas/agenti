/**
 * CrossFund Swap Engine
 * Real DEX aggregator integration for 0x, 1inch, ParaSwap, and more
 */

import type { SwapQuote, SwapRequest, SwapResponse, AggregatorName } from './types';
export type { SwapQuote, SwapRequest, SwapResponse, AggregatorName } from './types';

// Aggregator API endpoints - REAL production endpoints
const AGGREGATOR_ENDPOINTS: Record<AggregatorName, { quote: string; swap: string }> = {
  '0x': {
    quote: 'https://api.0x.org/swap/v1/quote',
    swap: 'https://api.0x.org/swap/v1/quote',
  },
  '1inch': {
    quote: 'https://api.1inch.dev/swap/v6.0/{chainId}/quote',
    swap: 'https://api.1inch.dev/swap/v6.0/{chainId}/swap',
  },
  paraswap: {
    quote: 'https://apiv5.paraswap.io/prices',
    swap: 'https://apiv5.paraswap.io/transactions/{chainId}',
  },
  odos: {
    quote: 'https://api.odos.xyz/sor/quote/v2',
    swap: 'https://api.odos.xyz/sor/assemble',
  },
  kyberswap: {
    quote: 'https://aggregator-api.kyberswap.com/{chain}/api/v1/routes',
    swap: 'https://aggregator-api.kyberswap.com/{chain}/api/v1/route/build',
  },
};

// Chains supported by each aggregator
const AGGREGATOR_CHAINS: Record<AggregatorName, number[]> = {
  '0x': [1, 137, 42161, 10, 8453, 56, 43114],
  '1inch': [1, 137, 42161, 10, 8453, 56, 43114, 100, 250],
  paraswap: [1, 137, 42161, 10, 56, 43114, 250],
  odos: [1, 137, 42161, 10, 8453, 56, 43114, 324, 59144],
  kyberswap: [1, 137, 42161, 10, 8453, 56, 43114, 324, 59144, 534352],
};

// Chain name mapping for KyberSwap
const KYBER_CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  56: 'bsc',
  43114: 'avalanche',
  324: 'zksync',
  59144: 'linea',
  534352: 'scroll',
};

/**
 * Get available aggregators for a chain
 */
export function getAggregatorsForChain(chainId: number): AggregatorName[] {
  return (Object.entries(AGGREGATOR_CHAINS) as [AggregatorName, number[]][])
    .filter(([_, chains]) => chains.includes(chainId))
    .map(([name]) => name);
}

/**
 * Get quote from 0x API
 */
async function get0xQuote(request: SwapRequest, apiKey?: string): Promise<SwapQuote | null> {
  const { fromChainId, fromAssetAddress, toAssetAddress, inputAmountHuman, userWalletAddress, slippage = 0.5 } = request;

  if (!AGGREGATOR_CHAINS['0x'].includes(fromChainId)) return null;

  try {
    // 0x uses different base URLs per chain
    const chainUrls: Record<number, string> = {
      1: 'https://api.0x.org',
      137: 'https://polygon.api.0x.org',
      42161: 'https://arbitrum.api.0x.org',
      10: 'https://optimism.api.0x.org',
      8453: 'https://base.api.0x.org',
      56: 'https://bsc.api.0x.org',
      43114: 'https://avalanche.api.0x.org',
    };

    const baseUrl = chainUrls[fromChainId];
    if (!baseUrl) return null;

    const params = new URLSearchParams({
      sellToken: fromAssetAddress,
      buyToken: toAssetAddress,
      sellAmount: inputAmountHuman || '0',
      takerAddress: userWalletAddress,
      slippagePercentage: (slippage / 100).toString(),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['0x-api-key'] = apiKey;
    }

    const response = await fetch(`${baseUrl}/swap/v1/quote?${params}`, { headers });

    if (!response.ok) {
      console.error('0x API error:', response.status);
      return null;
    }

    const data = await response.json();

    return {
      aggregator: '0x',
      inputToken: fromAssetAddress,
      outputToken: toAssetAddress,
      inputAmount: data.sellAmount,
      outputAmount: data.buyAmount,
      inputAmountHuman: data.sellAmount,
      outputAmountHuman: data.buyAmount,
      priceImpact: parseFloat(data.estimatedPriceImpact || '0'),
      estimatedGas: data.estimatedGas,
      txData: {
        to: data.to,
        data: data.data,
        value: data.value,
        gasLimit: data.gas,
        chainId: fromChainId,
      },
    };
  } catch (error) {
    console.error('0x quote error:', error);
    return null;
  }
}

/**
 * Get quote from 1inch API
 */
async function get1inchQuote(request: SwapRequest, apiKey?: string): Promise<SwapQuote | null> {
  const { fromChainId, fromAssetAddress, toAssetAddress, inputAmountHuman, slippage = 0.5 } = request;

  if (!AGGREGATOR_CHAINS['1inch'].includes(fromChainId)) return null;

  try {
    const endpoint = AGGREGATOR_ENDPOINTS['1inch'].quote.replace('{chainId}', fromChainId.toString());

    const params = new URLSearchParams({
      src: fromAssetAddress,
      dst: toAssetAddress,
      amount: inputAmountHuman || '0',
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpoint}?${params}`, { headers });

    if (!response.ok) {
      console.error('1inch API error:', response.status);
      return null;
    }

    const data = await response.json();

    return {
      aggregator: '1inch',
      inputToken: fromAssetAddress,
      outputToken: toAssetAddress,
      inputAmount: data.fromTokenAmount || inputAmountHuman,
      outputAmount: data.toAmount || data.toTokenAmount,
      inputAmountHuman: inputAmountHuman || '0',
      outputAmountHuman: data.toAmount || data.toTokenAmount,
      priceImpact: 0, // 1inch doesn't return price impact in quote
      estimatedGas: data.gas?.toString() || '200000',
    };
  } catch (error) {
    console.error('1inch quote error:', error);
    return null;
  }
}

/**
 * Get quote from ParaSwap API
 */
async function getParaSwapQuote(request: SwapRequest): Promise<SwapQuote | null> {
  const { fromChainId, fromAssetAddress, toAssetAddress, inputAmountHuman, userWalletAddress } = request;

  if (!AGGREGATOR_CHAINS.paraswap.includes(fromChainId)) return null;

  try {
    const params = new URLSearchParams({
      srcToken: fromAssetAddress,
      destToken: toAssetAddress,
      amount: inputAmountHuman || '0',
      srcDecimals: '18',
      destDecimals: '18',
      network: fromChainId.toString(),
      userAddress: userWalletAddress,
    });

    const response = await fetch(`${AGGREGATOR_ENDPOINTS.paraswap.quote}?${params}`);

    if (!response.ok) {
      console.error('ParaSwap API error:', response.status);
      return null;
    }

    const data = await response.json();
    const priceRoute = data.priceRoute;

    return {
      aggregator: 'paraswap',
      inputToken: fromAssetAddress,
      outputToken: toAssetAddress,
      inputAmount: priceRoute.srcAmount,
      outputAmount: priceRoute.destAmount,
      inputAmountHuman: inputAmountHuman || '0',
      outputAmountHuman: priceRoute.destAmount,
      priceImpact: parseFloat(priceRoute.priceImpact || '0'),
      estimatedGas: priceRoute.gasCost?.toString() || '200000',
    };
  } catch (error) {
    console.error('ParaSwap quote error:', error);
    return null;
  }
}

/**
 * Get quote from KyberSwap API
 */
async function getKyberSwapQuote(request: SwapRequest): Promise<SwapQuote | null> {
  const { fromChainId, fromAssetAddress, toAssetAddress, inputAmountHuman, userWalletAddress } = request;

  if (!AGGREGATOR_CHAINS.kyberswap.includes(fromChainId)) return null;

  const chainName = KYBER_CHAIN_NAMES[fromChainId];
  if (!chainName) return null;

  try {
    const endpoint = AGGREGATOR_ENDPOINTS.kyberswap.quote.replace('{chain}', chainName);

    const params = new URLSearchParams({
      tokenIn: fromAssetAddress,
      tokenOut: toAssetAddress,
      amountIn: inputAmountHuman || '0',
      to: userWalletAddress,
    });

    const response = await fetch(`${endpoint}?${params}`);

    if (!response.ok) {
      console.error('KyberSwap API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.data?.routeSummary) return null;

    const routeSummary = data.data.routeSummary;

    return {
      aggregator: 'kyberswap',
      inputToken: fromAssetAddress,
      outputToken: toAssetAddress,
      inputAmount: routeSummary.amountIn,
      outputAmount: routeSummary.amountOut,
      inputAmountHuman: inputAmountHuman || '0',
      outputAmountHuman: routeSummary.amountOut,
      priceImpact: parseFloat(routeSummary.priceImpact || '0'),
      estimatedGas: routeSummary.gas?.toString() || '200000',
    };
  } catch (error) {
    console.error('KyberSwap quote error:', error);
    return null;
  }
}

/**
 * Get quotes from all available aggregators
 */
export async function getAllQuotes(request: SwapRequest): Promise<SwapQuote[]> {
  const aggregators = getAggregatorsForChain(request.fromChainId);

  const quotePromises = aggregators.map(async (aggregator) => {
    switch (aggregator) {
      case '0x':
        return get0xQuote(request, process.env.NEXT_PUBLIC_0X_API_KEY);
      case '1inch':
        return get1inchQuote(request, process.env.NEXT_PUBLIC_1INCH_API_KEY);
      case 'paraswap':
        return getParaSwapQuote(request);
      case 'kyberswap':
        return getKyberSwapQuote(request);
      default:
        return null;
    }
  });

  const results = await Promise.allSettled(quotePromises);

  const quotes = results
    .filter((result): result is PromiseFulfilledResult<SwapQuote | null> =>
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value as SwapQuote);

  // Sort by best output amount (highest first)
  return quotes.sort((a, b) =>
    BigInt(b.outputAmount || '0') > BigInt(a.outputAmount || '0') ? 1 : -1
  );
}

/**
 * Get best quote from all aggregators
 */
export async function getBestQuote(request: SwapRequest): Promise<SwapResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const quotes = await getAllQuotes(request);

    if (quotes.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_QUOTES',
          message: 'No quotes available for this swap',
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      };
    }

    // Best quote is first (sorted by output amount)
    const bestQuote = quotes[0];

    return {
      success: true,
      quote: bestQuote,
      quotes,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('getBestQuote error:', error);
    return {
      success: false,
      error: {
        code: 'SWAP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    };
  }
}

/**
 * Execute swap via aggregator
 */
export async function executeSwap(
  quote: SwapQuote,
  userAddress: string,
  sendTransaction: (tx: { to: string; data: string; value: string; gas?: string }) => Promise<string>
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (!quote.txData) {
    return { success: false, error: 'Quote does not contain transaction data' };
  }

  try {
    const txHash = await sendTransaction({
      to: quote.txData.to,
      data: quote.txData.data,
      value: quote.txData.value,
      gas: quote.txData.gasLimit,
    });

    return { success: true, txHash };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction failed',
    };
  }
}
