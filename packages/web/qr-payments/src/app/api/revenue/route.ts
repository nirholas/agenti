/**
 * Revenue API Route
 * @description Returns revenue statistics for the current user
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Type Definitions
// ============================================================================

interface RevenueStats {
  totalEarnings: number;
  creatorEarnings: number;
  platformEarnings: number;
  pendingPayout: number;
  transactionCount: number;
  period: string;
  periodStart: string;
  periodEnd: string;
}

interface ServerRevenue {
  serverId: string;
  serverName: string;
  totalEarnings: number;
  creatorEarnings: number;
  transactionCount: number;
  topTools: Array<{
    toolId: string;
    toolName: string;
    earnings: number;
    callCount: number;
  }>;
}

interface RevenueResponse {
  success: boolean;
  data?: {
    stats: RevenueStats;
    servers: ServerRevenue[];
    chartData: Array<{
      date: string;
      earnings: number;
      transactions: number;
    }>;
  };
  error?: string;
}

// ============================================================================
// Mock Data (Replace with database queries in production)
// ============================================================================

function getMockRevenueData(userId: string, period: string): RevenueResponse['data'] {
  const now = new Date();
  let periodStart: Date;
  
  switch (period) {
    case 'day':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      periodStart = new Date(now.setDate(diff));
      break;
    case 'month':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'all':
    default:
      periodStart = new Date(0);
  }
  
  // Mock stats based on period
  const multiplier = period === 'day' ? 0.1 : period === 'week' ? 0.5 : 1;
  
  return {
    stats: {
      totalEarnings: 1247.85 * multiplier,
      creatorEarnings: 1060.67 * multiplier,
      platformEarnings: 187.18 * multiplier,
      pendingPayout: 342.50,
      transactionCount: Math.floor(3847 * multiplier),
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: new Date().toISOString(),
    },
    servers: [
      {
        serverId: 'srv_001',
        serverName: 'DeFi Analytics Pro',
        totalEarnings: 625.40 * multiplier,
        creatorEarnings: 531.59 * multiplier,
        transactionCount: Math.floor(2134 * multiplier),
        topTools: [
          { toolId: 'tool_001', toolName: 'security_audit_token', earnings: 215.30 * multiplier, callCount: Math.floor(756 * multiplier) },
          { toolId: 'tool_002', toolName: 'whale_tracking', earnings: 178.45 * multiplier, callCount: Math.floor(632 * multiplier) },
          { toolId: 'tool_003', toolName: 'ai_price_prediction', earnings: 137.84 * multiplier, callCount: Math.floor(486 * multiplier) },
        ],
      },
      {
        serverId: 'srv_002',
        serverName: 'NFT Intelligence',
        totalEarnings: 412.25 * multiplier,
        creatorEarnings: 350.41 * multiplier,
        transactionCount: Math.floor(1245 * multiplier),
        topTools: [
          { toolId: 'tool_004', toolName: 'nft_rarity_check', earnings: 156.20 * multiplier, callCount: Math.floor(534 * multiplier) },
          { toolId: 'tool_005', toolName: 'collection_analytics', earnings: 124.65 * multiplier, callCount: Math.floor(412 * multiplier) },
          { toolId: 'tool_006', toolName: 'floor_price_tracker', earnings: 69.56 * multiplier, callCount: Math.floor(299 * multiplier) },
        ],
      },
      {
        serverId: 'srv_003',
        serverName: 'Smart Contract Auditor',
        totalEarnings: 210.20 * multiplier,
        creatorEarnings: 178.67 * multiplier,
        transactionCount: Math.floor(468 * multiplier),
        topTools: [
          { toolId: 'tool_007', toolName: 'full_security_report', earnings: 125.40 * multiplier, callCount: Math.floor(125 * multiplier) },
          { toolId: 'tool_008', toolName: 'detect_honeypot', earnings: 52.30 * multiplier, callCount: Math.floor(185 * multiplier) },
          { toolId: 'tool_009', toolName: 'analyze_contract', earnings: 32.50 * multiplier, callCount: Math.floor(158 * multiplier) },
        ],
      },
    ],
    chartData: generateChartData(period),
  };
}

function generateChartData(period: string): Array<{ date: string; earnings: number; transactions: number }> {
  const data: Array<{ date: string; earnings: number; transactions: number }> = [];
  const now = new Date();
  const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 90;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate some realistic-looking random data
    const baseEarnings = 150 + Math.random() * 100;
    const baseTransactions = 400 + Math.floor(Math.random() * 300);
    
    data.push({
      date: date.toISOString().split('T')[0],
      earnings: Math.round(baseEarnings * 100) / 100,
      transactions: baseTransactions,
    });
  }
  
  return data;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    
    // In production, get userId from session/auth
    const userId = 'user_mock_001';
    
    // Validate period parameter
    const validPeriods = ['day', 'week', 'month', 'all'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Must be: day, week, month, or all' },
        { status: 400 }
      );
    }
    
    // In production, this would query the database
    // import { getUserRevenue } from '@/hosting/revenue';
    // const data = await getUserRevenue(userId, period as RevenuePeriod);
    
    const data = getMockRevenueData(userId, period);
    
    return NextResponse.json({
      success: true,
      data,
    } as RevenueResponse);
    
  } catch (error) {
    console.error('Revenue API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as RevenueResponse,
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Request Payout
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // In production, get userId from session/auth
    const userId = 'user_mock_001';
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { chain = 8453 } = body;
    
    // Validate chain
    const supportedChains = [1, 8453, 42161];
    if (!supportedChains.includes(chain)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported chain. Use 1 (Ethereum), 8453 (Base), or 42161 (Arbitrum)' },
        { status: 400 }
      );
    }
    
    // In production, check user's pending payout amount
    const pendingAmount = 342.50; // Mock value
    const minimumPayout = 10;
    
    if (pendingAmount < minimumPayout) {
      return NextResponse.json(
        {
          success: false,
          error: `Minimum payout amount is $${minimumPayout}. You have $${pendingAmount.toFixed(2)} pending.`,
        },
        { status: 400 }
      );
    }
    
    // In production, this would:
    // 1. Check user's payout address
    // 2. Queue the payout for processing
    // 3. Return a payout request ID
    
    // import { processPayouts } from '@/hosting/revenue';
    // const [result] = await processPayouts([userId], chain);
    
    return NextResponse.json({
      success: true,
      data: {
        payoutId: `payout_${Date.now()}`,
        amount: pendingAmount,
        chain,
        chainName: chain === 1 ? 'Ethereum' : chain === 8453 ? 'Base' : 'Arbitrum',
        status: 'queued',
        estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Payout request submitted. USDC will be sent within 24 hours.',
      },
    });
    
  } catch (error) {
    console.error('Payout request error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
