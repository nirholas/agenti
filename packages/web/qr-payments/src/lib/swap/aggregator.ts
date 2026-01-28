import { ChainId, SwapQuote, Token } from '../types';

// USDC addresses per chain
const USDC_ADDRESSES: Record<ChainId, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

interface AggregatorQuote {
  quote: SwapQuote;
  calldata: string;
  to: string;
  value: string;
}

/**
 * Fetches swap quotes from multiple aggregators and returns the best one
 */
export async function getBestSwapQuote(
  inputToken: Token,
  inputAmount: string,
  chainId: ChainId,
  userAddress: string
): Promise<AggregatorQuote> {
  const outputToken: Token = {
    address: USDC_ADDRESSES[chainId],
    symbol: 'USDC',
    decimals: 6,
    chainId,
  };

  // Fetch quotes from multiple aggregators in parallel
  const quotePromises = [
    get0xQuote(inputToken, outputToken, inputAmount, userAddress),
    get1inchQuote(inputToken, outputToken, inputAmount, userAddress),
  ];

  const quotes = await Promise.allSettled(quotePromises);
  
  // Filter successful quotes and find the best one
  const validQuotes = quotes
    .filter((q): q is PromiseFulfilledResult<AggregatorQuote> => 
      q.status === 'fulfilled' && q.value !== null
    )
    .map(q => q.value);

  if (validQuotes.length === 0) {
    throw new Error('No valid swap quotes available');
  }

  // Return quote with highest output amount
  return validQuotes.reduce((best, current) => 
    BigInt(current.quote.outputAmount) > BigInt(best.quote.outputAmount) 
      ? current 
      : best
  );
}

async function get0xQuote(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  userAddress: string
): Promise<AggregatorQuote> {
  const chainEndpoints: Record<ChainId, string> = {
    1: 'https://api.0x.org',
    10: 'https://optimism.api.0x.org',
    137: 'https://polygon.api.0x.org',
    42161: 'https://arbitrum.api.0x.org',
    8453: 'https://base.api.0x.org',
  };

  const endpoint = chainEndpoints[inputToken.chainId];
  const params = new URLSearchParams({
    sellToken: inputToken.address,
    buyToken: outputToken.address,
    sellAmount: inputAmount,
    takerAddress: userAddress,
  });

  const response = await fetch(`${endpoint}/swap/v1/quote?${params}`, {
    headers: {
      '0x-api-key': process.env.ZEROX_API_KEY || '',
    },
  });

  if (!response.ok) {
    throw new Error(`0x API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    quote: {
      inputToken,
      outputToken,
      inputAmount,
      outputAmount: data.buyAmount,
      route: '0x',
      priceImpact: parseFloat(data.estimatedPriceImpact || '0'),
      estimatedGas: data.estimatedGas,
      aggregator: 'zerox',
    },
    calldata: data.data,
    to: data.to,
    value: data.value,
  };
}

async function get1inchQuote(
  inputToken: Token,
  outputToken: Token,
  inputAmount: string,
  userAddress: string
): Promise<AggregatorQuote> {
  const chainIds: Record<ChainId, number> = {
    1: 1,
    10: 10,
    137: 137,
    42161: 42161,
    8453: 8453,
  };

  const response = await fetch(
    `https://api.1inch.dev/swap/v6.0/${chainIds[inputToken.chainId]}/swap?` +
    new URLSearchParams({
      src: inputToken.address,
      dst: outputToken.address,
      amount: inputAmount,
      from: userAddress,
      slippage: '0.5',
    }),
    {
      headers: {
        Authorization: `Bearer ${process.env.ONEINCH_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`1inch API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    quote: {
      inputToken,
      outputToken,
      inputAmount,
      outputAmount: data.dstAmount,
      route: '1inch',
      priceImpact: 0, // 1inch doesn't always provide this
      estimatedGas: data.tx.gas,
      aggregator: 'oneinch',
    },
    calldata: data.tx.data,
    to: data.tx.to,
    value: data.tx.value,
  };
}

/**
 * Calculate platform fee
 */
export function calculatePlatformFee(amount: string, feeBps: number = 30): string {
  const amountBigInt = BigInt(amount);
  const fee = (amountBigInt * BigInt(feeBps)) / BigInt(10000);
  return fee.toString();
}
