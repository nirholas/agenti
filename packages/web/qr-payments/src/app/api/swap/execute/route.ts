import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { TxnData, SwapExecuteResult, ApiResponse } from '@/types';
import { verifyX402Payment } from '@/lib/x402';
import { checkRateLimit } from '@/lib/rateLimit';
import { logApiCall, logError } from '@/lib/monitoring';

// Request validation schema
const SwapExecuteSchema = z.object({
  transactions: z.array(z.object({
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    data: z.string(),
    value: z.string(),
    chainId: z.number().int().positive(),
    gasLimit: z.string().optional(),
    type: z.enum(['approval', 'swap', 'bridge']),
  })),
  userWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().optional(), // For permit-based approvals
});

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://crossfund.xyz/api';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Rate limiting - stricter for execute
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const walletAddress = request.headers.get('x-wallet-address');
    
    const rateLimitResult = await checkRateLimit(
      walletAddress || clientIp, 
      'swap-execute'
    );
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many swap requests. Please wait before trying again.',
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
    const validationResult = SwapExecuteSchema.safeParse(body);

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

    const { transactions, userWalletAddress, signature } = validationResult.data;

    // Verify x402 payment header (required for execute)
    const paymentHeader = request.headers.get('x-402-payment');
    if (process.env.REQUIRE_X402_PAYMENT === 'true') {
      const paymentValid = await verifyX402Payment(paymentHeader);
      if (!paymentValid) {
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: {
            code: 'PAYMENT_REQUIRED',
            message: 'Valid x402 payment header required for swap execution',
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

    // Validate transactions
    if (transactions.length === 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'NO_TRANSACTIONS',
          message: 'At least one transaction is required',
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    // Note: Actual transaction execution happens on the client side
    // This endpoint validates the transactions and can be used for:
    // 1. Logging/tracking swap attempts
    // 2. Pre-flight validation
    // 3. Server-side sponsored transactions (future feature)

    // Log the swap execution attempt
    logApiCall({
      endpoint: '/api/swap/execute',
      method: 'POST',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      userWallet: userWalletAddress,
      transactionCount: transactions.length,
    });

    // Return validated transactions with additional metadata
    const response: SwapExecuteResult = {
      success: true,
      transactions: transactions.map((tx, index) => ({
        hash: '', // Will be filled by client after submission
        chainId: tx.chainId,
        type: tx.type,
        status: 'pending',
      })),
      totalGasUsed: '0', // Will be calculated after execution
      totalGasUSD: '0',
    };

    return NextResponse.json<ApiResponse<SwapExecuteResult & { preparedTransactions: TxnData[] }>>({
      success: true,
      data: {
        ...response,
        preparedTransactions: transactions as TxnData[],
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
        rateLimit: rateLimitResult.info,
      },
    });

  } catch (error) {
    logError('Swap execute error', { error, requestId });

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

// Callback endpoint for transaction status updates
export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();
    const { transactionHash, chainId, status, gasUsed, blockNumber } = body;

    if (!transactionHash || !chainId || !status) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'transactionHash, chainId, and status are required',
          statusCode: 400,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startTime,
        },
      }, { status: 400 });
    }

    // Log transaction status update
    logApiCall({
      endpoint: '/api/swap/execute',
      method: 'PUT',
      requestId,
      latency: Date.now() - startTime,
      status: 200,
      transactionHash,
      chainId,
      txStatus: status,
    });

    // Here you would typically:
    // 1. Update database with transaction status
    // 2. Trigger webhooks for merchant notifications
    // 3. Update analytics

    return NextResponse.json<ApiResponse<{ updated: boolean }>>({
      success: true,
      data: { updated: true },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      },
    });

  } catch (error) {
    logError('Transaction status update error', { error, requestId });

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
