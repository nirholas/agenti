/**
 * GET /api/merchant/transactions
 * Transaction history for the merchant
 */

import { NextRequest, NextResponse } from 'next/server';

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://payments.crossfund.xyz';
const CROSSFUND_API_KEY = process.env.CROSSFUND_API_KEY || '';
const CROSSFUND_MERCHANT_ID = process.env.CROSSFUND_MERCHANT_ID || '';

export interface Transaction {
  transactionId: string;
  invoiceId: string;
  type: 'payment' | 'refund' | 'conversion';
  status: 'pending' | 'confirmed' | 'failed';
  amount: string;
  currency: string;
  chainId: number;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  tokenAddress?: string;
  fee?: string;
  feeCurrency?: string;
  confirmations: number;
  createdAt: string;
  confirmedAt?: string;
  metadata?: Record<string, any>;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const type = searchParams.get('type'); // payment, refund, conversion
    const status = searchParams.get('status'); // pending, confirmed, failed
    const chainId = searchParams.get('chainId');
    const invoiceId = searchParams.get('invoiceId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Build query params
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (type) queryParams.append('type', type);
    if (status) queryParams.append('status', status);
    if (chainId) queryParams.append('chainId', chainId);
    if (invoiceId) queryParams.append('invoiceId', invoiceId);
    if (startDateStr) queryParams.append('startDate', startDateStr);
    if (endDateStr) queryParams.append('endDate', endDateStr);

    // Fetch from CrossFund API
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/transactions?${queryParams.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch transactions' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      transactions: data.transactions || [],
      pagination: {
        page: data.page || page,
        limit: data.limit || limit,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / (data.limit || limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
