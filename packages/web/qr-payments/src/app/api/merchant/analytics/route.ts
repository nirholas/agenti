/**
 * GET /api/merchant/analytics
 * Revenue analytics for the merchant
 */

import { NextRequest, NextResponse } from 'next/server';

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://payments.crossfund.xyz';
const CROSSFUND_API_KEY = process.env.CROSSFUND_API_KEY || '';
const CROSSFUND_MERCHANT_ID = process.env.CROSSFUND_MERCHANT_ID || '';

export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
}

export interface RevenueMetrics {
  totalRevenue: string;
  currency: string;
  transactionCount: number;
  averageTransactionValue: string;
  conversionRate: number; // percentage of successful payments
}

export interface ChainBreakdown {
  chainId: number;
  chainName: string;
  revenue: string;
  transactionCount: number;
  percentage: number;
}

export interface TokenBreakdown {
  tokenSymbol: string;
  tokenAddress?: string;
  revenue: string;
  transactionCount: number;
  percentage: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  revenue: string;
  transactionCount: number;
}

export interface AnalyticsResponse {
  success: boolean;
  period: AnalyticsPeriod;
  metrics: RevenueMetrics;
  comparison?: {
    previousPeriod: RevenueMetrics;
    revenueChange: number; // percentage
    transactionCountChange: number; // percentage
  };
  chainBreakdown: ChainBreakdown[];
  tokenBreakdown: TokenBreakdown[];
  timeSeries: TimeSeriesDataPoint[];
  topInvoices: {
    invoiceId: string;
    amount: string;
    currency: string;
    paidAt: string;
  }[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 365d, custom
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const currency = searchParams.get('currency') || 'USD';
    const granularity = searchParams.get('granularity') || 'day'; // hour, day, week, month
    const includeComparison = searchParams.get('comparison') !== 'false';

    // Calculate date range
    let startDate: Date;
    let endDate: Date = new Date();

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
    } else {
      // Calculate based on period
      startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '365d':
          startDate.setDate(startDate.getDate() - 365);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }
    }

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date range' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Build query params
    const queryParams = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      currency,
      granularity,
      comparison: includeComparison.toString(),
    });

    // Fetch from CrossFund API
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/analytics?${queryParams.toString()}`,
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
        { error: errorData.message || 'Failed to fetch analytics' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      metrics: data.metrics || {
        totalRevenue: '0',
        currency,
        transactionCount: 0,
        averageTransactionValue: '0',
        conversionRate: 0,
      },
      comparison: data.comparison,
      chainBreakdown: data.chainBreakdown || [],
      tokenBreakdown: data.tokenBreakdown || [],
      timeSeries: data.timeSeries || [],
      topInvoices: data.topInvoices || [],
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
