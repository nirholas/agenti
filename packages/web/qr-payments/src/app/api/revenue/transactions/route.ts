/**
 * Revenue Transactions API Route
 * @description Returns paginated transaction history for the current user
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Type Definitions
// ============================================================================

interface Transaction {
  id: string;
  serverId: string;
  serverName: string;
  toolId: string;
  toolName: string;
  txHash: string;
  amount: string;
  amountUSD: number;
  creatorAmount: number;
  platformAmount: number;
  chain: number;
  chainName: string;
  sender: string;
  recipient: string;
  status: 'pending' | 'confirmed' | 'paid_out';
  createdAt: string;
  confirmedAt?: string;
  paidOutAt?: string;
}

interface TransactionsResponse {
  success: boolean;
  data?: {
    transactions: Transaction[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
  error?: string;
}

// ============================================================================
// Mock Data Generator
// ============================================================================

function generateMockTransactions(
  userId: string,
  options: {
    page: number;
    pageSize: number;
    serverId?: string;
    toolId?: string;
    status?: string;
    period?: string;
  }
): TransactionsResponse['data'] {
  const { page, pageSize, serverId, toolId, status, period } = options;
  
  // Tool names and servers for realistic mock data
  const servers = [
    { id: 'srv_001', name: 'DeFi Analytics Pro' },
    { id: 'srv_002', name: 'NFT Intelligence' },
    { id: 'srv_003', name: 'Smart Contract Auditor' },
  ];
  
  const tools = [
    { id: 'tool_001', name: 'security_audit_token', price: 0.01 },
    { id: 'tool_002', name: 'whale_tracking', price: 0.01 },
    { id: 'tool_003', name: 'ai_price_prediction', price: 0.05 },
    { id: 'tool_004', name: 'nft_rarity_check', price: 0.005 },
    { id: 'tool_005', name: 'collection_analytics', price: 0.005 },
    { id: 'tool_006', name: 'floor_price_tracker', price: 0.001 },
    { id: 'tool_007', name: 'full_security_report', price: 0.10 },
    { id: 'tool_008', name: 'detect_honeypot', price: 0.01 },
    { id: 'tool_009', name: 'analyze_contract', price: 0.01 },
  ];
  
  const chains = [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' },
    { id: 42161, name: 'Arbitrum' },
  ];
  
  const statuses: Transaction['status'][] = ['pending', 'confirmed', 'paid_out'];
  
  // Generate total based on period
  const totalByPeriod: Record<string, number> = {
    day: 45,
    week: 320,
    month: 1250,
    all: 5000,
  };
  const total = totalByPeriod[period || 'month'] || 1250;
  
  // Generate mock transactions
  const transactions: Transaction[] = [];
  const startIndex = (page - 1) * pageSize;
  
  for (let i = 0; i < pageSize && startIndex + i < total; i++) {
    const index = startIndex + i;
    const server = servers[index % servers.length];
    const tool = tools[index % tools.length];
    const chain = chains[index % chains.length];
    const txStatus = statuses[index % 10 < 1 ? 0 : index % 10 < 8 ? 1 : 2];
    
    // Skip if filtering by serverId
    if (serverId && server.id !== serverId) continue;
    // Skip if filtering by toolId
    if (toolId && tool.id !== toolId) continue;
    // Skip if filtering by status
    if (status && txStatus !== status) continue;
    
    const amountUSD = tool.price;
    const creatorAmount = amountUSD * 0.85;
    const platformAmount = amountUSD * 0.15;
    
    // Generate timestamp (going back in time)
    const createdAt = new Date(Date.now() - (index * 15 * 60 * 1000) - Math.random() * 10 * 60 * 1000);
    
    const tx: Transaction = {
      id: `pay_${String(10000 - index).padStart(5, '0')}`,
      serverId: server.id,
      serverName: server.name,
      toolId: tool.id,
      toolName: tool.name,
      txHash: `0x${generateRandomHex(64)}`,
      amount: amountUSD.toFixed(6),
      amountUSD,
      creatorAmount,
      platformAmount,
      chain: chain.id,
      chainName: chain.name,
      sender: `0x${generateRandomHex(40)}`,
      recipient: `0x742d35Cc6634C0532925a3b844Bc9e7595f5bB0D`,
      status: txStatus,
      createdAt: createdAt.toISOString(),
    };
    
    if (txStatus === 'confirmed' || txStatus === 'paid_out') {
      tx.confirmedAt = new Date(createdAt.getTime() + 30000).toISOString();
    }
    
    if (txStatus === 'paid_out') {
      tx.paidOutAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    
    transactions.push(tx);
  }
  
  return {
    transactions,
    total,
    page,
    pageSize,
    hasMore: startIndex + transactions.length < total,
  };
}

function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const serverId = searchParams.get('serverId') || undefined;
    const toolId = searchParams.get('toolId') || undefined;
    const status = searchParams.get('status') || undefined;
    const period = searchParams.get('period') || 'month';
    
    // Validate status parameter
    const validStatuses = ['pending', 'confirmed', 'paid_out'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be: pending, confirmed, or paid_out' },
        { status: 400 }
      );
    }
    
    // Validate period parameter
    const validPeriods = ['day', 'week', 'month', 'all'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period. Must be: day, week, month, or all' },
        { status: 400 }
      );
    }
    
    // In production, get userId from session/auth
    const userId = 'user_mock_001';
    
    // In production, this would query the database
    // import { getTransactionHistory } from '@/hosting/revenue';
    // const data = await getTransactionHistory({
    //   userId,
    //   serverId,
    //   toolId,
    //   period: period as RevenuePeriod,
    //   status: status as PaymentRecord['status'],
    //   page,
    //   pageSize,
    // });
    
    const data = generateMockTransactions(userId, {
      page,
      pageSize,
      serverId,
      toolId,
      status,
      period,
    });
    
    return NextResponse.json({
      success: true,
      data,
    } as TransactionsResponse);
    
  } catch (error) {
    console.error('Transactions API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as TransactionsResponse,
      { status: 500 }
    );
  }
}

// ============================================================================
// Export Transaction by ID
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionIds, format = 'json' } = body;
    
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'transactionIds must be a non-empty array' },
        { status: 400 }
      );
    }
    
    if (transactionIds.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 1000 transactions per export' },
        { status: 400 }
      );
    }
    
    // In production, fetch actual transactions from database
    // For now, generate mock data for the requested IDs
    const transactions: Transaction[] = transactionIds.map((id: string, index: number) => ({
      id,
      serverId: 'srv_001',
      serverName: 'DeFi Analytics Pro',
      toolId: 'tool_001',
      toolName: 'security_audit_token',
      txHash: `0x${generateRandomHex(64)}`,
      amount: '0.010000',
      amountUSD: 0.01,
      creatorAmount: 0.0085,
      platformAmount: 0.0015,
      chain: 8453,
      chainName: 'Base',
      sender: `0x${generateRandomHex(40)}`,
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bB0D',
      status: 'confirmed' as const,
      createdAt: new Date(Date.now() - index * 60000).toISOString(),
      confirmedAt: new Date(Date.now() - index * 60000 + 30000).toISOString(),
    }));
    
    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'ID', 'Server', 'Tool', 'Amount (USD)', 'Creator Amount', 'Platform Amount',
        'Chain', 'TX Hash', 'Status', 'Created At', 'Confirmed At'
      ].join(',');
      
      const rows = transactions.map(tx => [
        tx.id,
        tx.serverName,
        tx.toolName,
        tx.amountUSD.toFixed(6),
        tx.creatorAmount.toFixed(6),
        tx.platformAmount.toFixed(6),
        tx.chainName,
        tx.txHash,
        tx.status,
        tx.createdAt,
        tx.confirmedAt || '',
      ].join(','));
      
      const csv = [headers, ...rows].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transactions-${Date.now()}.csv"`,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: { transactions },
    });
    
  } catch (error) {
    console.error('Transaction export error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
