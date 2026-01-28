import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SwapResponse, ApiResponse } from '@/types';
import { getChain } from '@/lib/chains/config';
import { verifyX402Payment } from '@/lib/x402';
import { checkRateLimit } from '@/lib/rateLimit';
import { logApiCall, logError } from '@/lib/monitoring';

// Helper function for chain support check
function isChainSupported(chainId: number): boolean {
  return getChain(chainId) !== undefined;
}

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
};

function getUsdcAddress(chainId: number): string | undefined {
  return USDC_ADDRESSES[chainId];
}

// Request validation schema
const SwapQuoteSchema = z.object({
  fromChainId: z.number().int().positive(),
  fromAssetAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toChainId: z.number().int().positive(),
  toAssetAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  inputAmountHuman: z.string().optional(),
  outputAmountHuman: z.string().optional(),
  userWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  slippage: z.number().min(0.01).max(50).optional().default(0.5),
});

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://crossfund.xyz/api';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIp, 'swap-quote');
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          statusCode: 429,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
          rateLimit: rateLimitResult.info,
        },
      }, { status: 429 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = SwapQuoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: validationResult.error.flatten(),
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    const swapRequest = validationResult.data;

    // Validate chains are supported
    if (!isChainSupported(swapRequest.fromChainId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNSUPPORTED_CHAIN',
          message: `Chain ${swapRequest.fromChainId} is not supported`,
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    if (!isChainSupported(swapRequest.toChainId)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNSUPPORTED_CHAIN',
          message: `Chain ${swapRequest.toChainId} is not supported`,
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    // Validate amount is provided
    if (!swapRequest.inputAmountHuman && !swapRequest.outputAmountHuman) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MISSING_AMOUNT',
          message: 'Either inputAmountHuman or outputAmountHuman must be provided',
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    // Verify x402 payment header (if required)
    const paymentHeader = request.headers.get('x-402-payment');
    if (process.env.REQUIRE_X402_PAYMENT === 'true') {
      const paymentValid = await verifyX402Payment(paymentHeader);
      if (!paymentValid) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'Valid x402 payment header required',
            statusCode: 402,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            latency: Date.now() - startTime,
          },
        }, { status: 402 });
      }
    }

    // Call CrossFund Global Swap API
    const crossFundResponse = await fetch(`${CROSSFUND_API_URL}/global-swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(paymentHeader && { 'x-402-payment': paymentHeader }),
      },
      body: JSON.stringify({
        fromChainId: swapRequest.fromChainId,
        fromAssetAddress: swapRequest.fromAssetAddress,
        toChainId: swapRequest.toChainId,
        toAssetAddress: swapRequest.toAssetAddress,
        inputAmountHuman: swapRequest.inputAmountHuman,
        outputAmountHuman: swapRequest.outputAmountHuman,
        userWalletAddress: swapRequest.userWalletAddress,
        recipient: swapRequest.recipient || swapRequest.userWalletAddress,
        slippage: swapRequest.slippage,
      }),
    });

    if (!crossFundResponse.ok) {
      const errorData = await crossFundResponse.json().catch(() => ({}));
      logError('CrossFund API error', {
        status: crossFundResponse.status,
        error: errorData,
        requestId,
      });

      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'SWAP_QUOTE_FAILED',
          message: errorData.message || 'Failed to get swap quote',
          details: errorData,
          statusCode: crossFundResponse.status,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: crossFundResponse.status >= 500 ? 502 : crossFundResponse.status });
    }

    const quoteData: SwapResponse = await crossFundResponse.json();

    // Log successful API call
    logApiCall({
      endpoint: '/api/swap/quote',
      method: 'POST',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      fromChainId: swapRequest.fromChainId,
      toChainId: swapRequest.toChainId,
    });

    return NextResponse.json<ApiResponse<SwapResponse>>({
      success: true,
      data: quoteData,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
        rateLimit: rateLimitResult.info,
      },
    });

  } catch (error) {
    logError('Swap quote error', { error, requestId });

    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        statusCode: 500,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    }, { status: 500 });
  }
}

// GET method for simple quote checks (less parameters)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const fromChainId = parseInt(searchParams.get('fromChainId') || '0');
  const toChainId = parseInt(searchParams.get('toChainId') || '0');
  const fromAsset = searchParams.get('fromAsset') || '';
  const toAsset = searchParams.get('toAsset') || getUsdcAddress(toChainId) || '';
  const amount = searchParams.get('amount') || '';
  const userAddress = searchParams.get('userAddress') || '';

  if (!fromChainId || !toChainId || !fromAsset || !amount || !userAddress) {
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'MISSING_PARAMS',
        message: 'Required parameters: fromChainId, toChainId, fromAsset, amount, userAddress',
        statusCode: 400,
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        latency: 0,
      },
    }, { status: 400 });
  }

  // Convert to POST request internally
  const syntheticRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({
      fromChainId,
      toChainId,
      fromAssetAddress: fromAsset,
      toAssetAddress: toAsset,
      inputAmountHuman: amount,
      userWalletAddress: userAddress,
    }),
  });

  return POST(syntheticRequest);
}
