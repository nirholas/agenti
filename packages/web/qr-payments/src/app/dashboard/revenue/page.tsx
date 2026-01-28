'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ============================================================================
// Type Definitions
// ============================================================================

interface RevenueStats {
  totalEarnings: number;
  creatorEarnings: number;
  platformEarnings: number;
  pendingPayout: number;
  transactionCount: number;
}

interface ServerRevenue {
  serverId: string;
  serverName: string;
  totalEarnings: number;
  creatorEarnings: number;
  transactionCount: number;
  topTools: ToolRevenue[];
}

interface ToolRevenue {
  toolId: string;
  toolName: string;
  earnings: number;
  callCount: number;
}

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
  chain: number;
  chainName: string;
  status: 'pending' | 'confirmed' | 'paid_out';
  createdAt: string;
}

interface ChartDataPoint {
  date: string;
  earnings: number;
  transactions: number;
}

type Period = 'day' | 'week' | 'month' | 'all';

// ============================================================================
// Mock Data (Replace with API calls in production)
// ============================================================================

const MOCK_REVENUE_STATS: RevenueStats = {
  totalEarnings: 1247.85,
  creatorEarnings: 1060.67,
  platformEarnings: 187.18,
  pendingPayout: 342.50,
  transactionCount: 3847,
};

const MOCK_SERVER_REVENUE: ServerRevenue[] = [
  {
    serverId: 'srv_001',
    serverName: 'DeFi Analytics Pro',
    totalEarnings: 625.40,
    creatorEarnings: 531.59,
    transactionCount: 2134,
    topTools: [
      { toolId: 'tool_001', toolName: 'security_audit_token', earnings: 215.30, callCount: 756 },
      { toolId: 'tool_002', toolName: 'whale_tracking', earnings: 178.45, callCount: 632 },
      { toolId: 'tool_003', toolName: 'ai_price_prediction', earnings: 137.84, callCount: 486 },
    ],
  },
  {
    serverId: 'srv_002',
    serverName: 'NFT Intelligence',
    totalEarnings: 412.25,
    creatorEarnings: 350.41,
    transactionCount: 1245,
    topTools: [
      { toolId: 'tool_004', toolName: 'nft_rarity_check', earnings: 156.20, callCount: 534 },
      { toolId: 'tool_005', toolName: 'collection_analytics', earnings: 124.65, callCount: 412 },
      { toolId: 'tool_006', toolName: 'floor_price_tracker', earnings: 69.56, callCount: 299 },
    ],
  },
  {
    serverId: 'srv_003',
    serverName: 'Smart Contract Auditor',
    totalEarnings: 210.20,
    creatorEarnings: 178.67,
    transactionCount: 468,
    topTools: [
      { toolId: 'tool_007', toolName: 'full_security_report', earnings: 125.40, callCount: 125 },
      { toolId: 'tool_008', toolName: 'detect_honeypot', earnings: 52.30, callCount: 185 },
      { toolId: 'tool_009', toolName: 'analyze_contract', earnings: 32.50, callCount: 158 },
    ],
  },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'pay_001',
    serverId: 'srv_001',
    serverName: 'DeFi Analytics Pro',
    toolId: 'tool_001',
    toolName: 'security_audit_token',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    amount: '0.01',
    amountUSD: 0.01,
    creatorAmount: 0.0085,
    chain: 8453,
    chainName: 'Base',
    status: 'confirmed',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'pay_002',
    serverId: 'srv_002',
    serverName: 'NFT Intelligence',
    toolId: 'tool_004',
    toolName: 'nft_rarity_check',
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    amount: '0.005',
    amountUSD: 0.005,
    creatorAmount: 0.00425,
    chain: 42161,
    chainName: 'Arbitrum',
    status: 'confirmed',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'pay_003',
    serverId: 'srv_001',
    serverName: 'DeFi Analytics Pro',
    toolId: 'tool_003',
    toolName: 'ai_price_prediction',
    txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    amount: '0.05',
    amountUSD: 0.05,
    creatorAmount: 0.0425,
    chain: 1,
    chainName: 'Ethereum',
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'pay_004',
    serverId: 'srv_003',
    serverName: 'Smart Contract Auditor',
    toolId: 'tool_007',
    toolName: 'full_security_report',
    txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    amount: '0.10',
    amountUSD: 0.10,
    creatorAmount: 0.085,
    chain: 8453,
    chainName: 'Base',
    status: 'paid_out',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'pay_005',
    serverId: 'srv_002',
    serverName: 'NFT Intelligence',
    toolId: 'tool_005',
    toolName: 'collection_analytics',
    txHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
    amount: '0.005',
    amountUSD: 0.005,
    creatorAmount: 0.00425,
    chain: 8453,
    chainName: 'Base',
    status: 'confirmed',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const MOCK_CHART_DATA: ChartDataPoint[] = [
  { date: '2026-01-22', earnings: 142.30, transactions: 456 },
  { date: '2026-01-23', earnings: 178.45, transactions: 534 },
  { date: '2026-01-24', earnings: 156.20, transactions: 489 },
  { date: '2026-01-25', earnings: 201.60, transactions: 612 },
  { date: '2026-01-26', earnings: 189.35, transactions: 578 },
  { date: '2026-01-27', earnings: 167.80, transactions: 523 },
  { date: '2026-01-28', earnings: 212.15, transactions: 655 },
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function getStatusColor(status: Transaction['status']): string {
  switch (status) {
    case 'confirmed':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'pending':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'paid_out':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
}

function getChainColor(chainName: string): string {
  switch (chainName.toLowerCase()) {
    case 'ethereum':
      return 'bg-blue-500/20 text-blue-400';
    case 'base':
      return 'bg-blue-600/20 text-blue-300';
    case 'arbitrum':
      return 'bg-cyan-500/20 text-cyan-400';
    default:
      return 'bg-zinc-500/20 text-zinc-400';
  }
}

// ============================================================================
// Chart Component (Simple SVG-based chart)
// ============================================================================

function EarningsChart({ data }: { data: ChartDataPoint[] }) {
  const maxEarnings = Math.max(...data.map(d => d.earnings));
  const chartHeight = 200;
  const chartWidth = 100; // percentage
  const barWidth = chartWidth / data.length;
  
  return (
    <div className="w-full h-64 relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-zinc-500">
        <span>{formatCurrency(maxEarnings)}</span>
        <span>{formatCurrency(maxEarnings * 0.5)}</span>
        <span>$0</span>
      </div>
      
      {/* Chart area */}
      <div className="ml-16 h-full flex items-end gap-2 pb-8">
        {data.map((point, index) => {
          const barHeight = (point.earnings / maxEarnings) * chartHeight;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <div
                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm hover:from-blue-500 hover:to-blue-300 transition-all cursor-pointer relative group"
                style={{ height: `${barHeight}px` }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {formatCurrency(point.earnings)}
                  <br />
                  <span className="text-zinc-400">{point.transactions} txns</span>
                </div>
              </div>
              <span className="text-xs text-zinc-500">
                {new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            {icon}
          </div>
          <div>
            <p className="text-sm text-zinc-400">{title}</p>
            <p className="text-2xl font-semibold text-white mt-1">{value}</p>
            {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={trend.positive ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
              />
            </svg>
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Server Revenue Card Component
// ============================================================================

function ServerCard({ server }: { server: ServerRevenue }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            {server.serverName.charAt(0)}
          </div>
          <div className="text-left">
            <p className="font-medium text-white">{server.serverName}</p>
            <p className="text-sm text-zinc-500">{server.transactionCount.toLocaleString()} transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold text-white">{formatCurrency(server.creatorEarnings)}</p>
            <p className="text-xs text-zinc-500">Your earnings</p>
          </div>
          <svg
            className={`w-5 h-5 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-zinc-800 p-4">
          <p className="text-sm font-medium text-zinc-400 mb-3">Top Tools</p>
          <div className="space-y-2">
            {server.topTools.map((tool) => (
              <div key={tool.toolId} className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white font-mono">{tool.toolName}</p>
                  <p className="text-xs text-zinc-500">{tool.callCount.toLocaleString()} calls</p>
                </div>
                <p className="font-medium text-emerald-400">{formatCurrency(tool.earnings)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Revenue Dashboard Component
// ============================================================================

export default function RevenueDashboard() {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const [stats, setStats] = useState<RevenueStats>(MOCK_REVENUE_STATS);
  const [servers, setServers] = useState<ServerRevenue[]>(MOCK_SERVER_REVENUE);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [chartData, setChartData] = useState<ChartDataPoint[]>(MOCK_CHART_DATA);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // In production, fetch data from API
    // fetchRevenueData(period);
  }, [period]);
  
  const handleRequestPayout = useCallback(async () => {
    if (stats.pendingPayout < 10) {
      alert('Minimum payout amount is $10');
      return;
    }
    
    setIsRequestingPayout(true);
    
    try {
      // In production, call API
      // await fetch('/api/revenue/payout', { method: 'POST' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowPayoutModal(true);
    } catch (error) {
      alert('Failed to request payout. Please try again.');
    } finally {
      setIsRequestingPayout(false);
    }
  }, [stats.pendingPayout]);
  
  if (!mounted) return null;
  
  const canRequestPayout = stats.pendingPayout >= 10;
  
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-zinc-900/50 via-black to-black pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-xl font-semibold tracking-tight">Agenti</span>
            </Link>
            <span className="text-zinc-600 mx-2">/</span>
            <span className="text-zinc-400">Revenue Dashboard</span>
          </div>
          
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/merchant" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/dashboard/revenue" className="text-white font-medium">Revenue</Link>
            <Link href="/merchant/settings" className="text-zinc-400 hover:text-white transition-colors">Settings</Link>
          </nav>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Revenue</h1>
            <p className="text-zinc-400 mt-1">Track your earnings from x402 payments</p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-lg p-1">
            {(['day', 'week', 'month', 'all'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  period === p
                    ? 'bg-blue-500 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Earnings"
            value={formatCurrency(stats.totalEarnings)}
            subtitle={`${stats.transactionCount.toLocaleString()} transactions`}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            trend={{ value: 12.5, positive: true }}
          />
          
          <StatCard
            title="Your Share (85%)"
            value={formatCurrency(stats.creatorEarnings)}
            subtitle="After platform fee"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
          
          <StatCard
            title="Platform Fee (15%)"
            value={formatCurrency(stats.platformEarnings)}
            subtitle="Supports infrastructure"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          
          <StatCard
            title="Pending Payout"
            value={formatCurrency(stats.pendingPayout)}
            subtitle={canRequestPayout ? 'Ready to withdraw' : 'Min $10 to withdraw'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
          />
        </div>
        
        {/* Chart Section */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Earnings Over Time</h2>
            <div className="text-sm text-zinc-400">
              Last 7 days
            </div>
          </div>
          <EarningsChart data={chartData} />
        </div>
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Server Breakdown */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Per-Server Breakdown</h2>
            <div className="space-y-4">
              {servers.map((server) => (
                <ServerCard key={server.serverId} server={server} />
              ))}
            </div>
          </div>
          
          {/* Recent Transactions & Payout */}
          <div className="space-y-8">
            {/* Payout Card */}
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Ready to Cash Out?</h3>
                  <p className="text-zinc-400 mt-1">
                    {canRequestPayout
                      ? `You have ${formatCurrency(stats.pendingPayout)} available`
                      : `Earn ${formatCurrency(10 - stats.pendingPayout)} more to request payout`
                    }
                  </p>
                </div>
                <button
                  onClick={handleRequestPayout}
                  disabled={!canRequestPayout || isRequestingPayout}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    canRequestPayout
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  }`}
                >
                  {isRequestingPayout ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Request Payout'
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-4">
                Minimum payout: $10 • Payouts sent in USDC on Base
              </p>
            </div>
            
            {/* Recent Transactions */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
                <Link href="/api/revenue/transactions" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  View All →
                </Link>
              </div>
              <div className="divide-y divide-zinc-800">
                {transactions.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white font-mono">{tx.toolName}</p>
                          <p className="text-xs text-zinc-500">{tx.serverName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-medium text-emerald-400">+{formatCurrency(tx.creatorAmount)}</p>
                          <p className="text-xs text-zinc-500">{formatTimestamp(tx.createdAt)}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className={`px-2 py-0.5 rounded ${getChainColor(tx.chainName)}`}>
                        {tx.chainName}
                      </span>
                      <a
                        href={`https://basescan.org/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-blue-400 transition-colors font-mono"
                      >
                        {truncateHash(tx.txHash)} ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Payout Success Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Payout Requested!</h3>
              <p className="text-zinc-400 mb-6">
                Your payout of {formatCurrency(stats.pendingPayout)} has been queued. It will be sent to your configured wallet address within 24 hours.
              </p>
              <button
                onClick={() => setShowPayoutModal(false)}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
