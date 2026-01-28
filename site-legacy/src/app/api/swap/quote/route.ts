import { NextRequest, NextResponse } from 'next/server';
import { getBestQuote } from '@/lib/crossfund/swap';
import type { SwapRequest } from '@/lib/crossfund/types';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();

    // Validate required fields
    const {
      fromChainId,
      fromAssetAddress,
      toChainId,
      toAssetAddress,
      inputAmountHuman,
      userWalletAddress,
      slippage = 0.5,
    } = body;

    if (!fromChainId || !fromAssetAddress || !toAssetAddress || !inputAmountHuman) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: fromChainId, fromAssetAddress, toAssetAddress, inputAmountHuman',
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    const swapRequest: SwapRequest = {
      fromChainId,
      toChainId: toChainId || fromChainId,
      fromAssetAddress,
      toAssetAddress,
      inputAmountHuman,
      userWalletAddress: userWalletAddress || '0x0000000000000000000000000000000000000000',
      slippage,
    };

    const response = await getBestQuote(swapRequest);

    return NextResponse.json({
      ...response,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('Quote API error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    }, { status: 500 });
  }
}
