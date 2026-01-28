import { NextRequest, NextResponse } from 'next/server';
import { getBestSwapQuote, calculatePlatformFee } from '@/lib/swap/aggregator';
import { ChainId, Token } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputToken, inputAmount, chainId, userAddress } = body;

    // Validate inputs
    if (!inputToken || !inputAmount || !chainId || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate chain
    const validChains: ChainId[] = [1, 10, 137, 42161, 8453];
    if (!validChains.includes(chainId)) {
      return NextResponse.json(
        { error: 'Unsupported chain' },
        { status: 400 }
      );
    }

    // Get swap quote
    const { quote, calldata, to, value } = await getBestSwapQuote(
      inputToken as Token,
      inputAmount,
      chainId,
      userAddress
    );

    // Calculate fees
    const platformFee = calculatePlatformFee(quote.outputAmount);
    const netOutput = (BigInt(quote.outputAmount) - BigInt(platformFee)).toString();

    return NextResponse.json({
      quote: {
        ...quote,
        netOutputAmount: netOutput,
      },
      fees: {
        platform: platformFee,
        platformBps: 30,
        estimatedGas: quote.estimatedGas,
      },
      swap: {
        calldata,
        to,
        value,
      },
    });
  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
