'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Analytics data types
interface DailyRevenue {
  date: string;
  amount: number;
}

interface TokenBreakdown {
  token: string;
  amount: number;
  percentage: number;
  color: string;
}

interface ChainBreakdown {
  chain: string;
  transactions: number;
  volume: number;
  color: string;
}

// Mock data
const MOCK_DAILY_REVENUE: DailyRevenue[] = [
  { date: 'Jan 1', amount: 4250 },
  { date: 'Jan 2', amount: 3800 },
  { date: 'Jan 3', amount: 5200 },
  { date: 'Jan 4', amount: 4800 },
  { date: 'Jan 5', amount: 6100 },
  { date: 'Jan 6', amount: 5500 },
  { date: 'Jan 7', amount: 4900 },
  { date: 'Jan 8', amount: 5800 },
  { date: 'Jan 9', amount: 6400 },
  { date: 'Jan 10', amount: 5700 },
  { date: 'Jan 11', amount: 6800 },
  { date: 'Jan 12', amount: 7200 },
  { date: 'Jan 13', amount: 6500 },
  { date: 'Jan 14', amount: 7800 },
];

const MOCK_TOKEN_BREAKDOWN: TokenBreakdown[] = [
  { token: 'ETH', amount: 45000, percentage: 35, color: '#627EEA' },
  { token: 'USDC', amount: 32000, percentage: 25, color: '#2775CA' },
  { token: 'USDT', amount: 25600, percentage: 20, color: '#50AF95' },
  { token: 'WBTC', amount: 12800, percentage: 10, color: '#F7931A' },
  { token: 'Other', amount: 12800, percentage: 10, color: '#6B7280' },
];

const MOCK_CHAIN_BREAKDOWN: ChainBreakdown[] = [
  { chain: 'Ethereum', transactions: 450, volume: 52000, color: '#627EEA' },
  { chain: 'Base', transactions: 380, volume: 28000, color: '#0052FF' },
  { chain: 'Arbitrum', transactions: 290, volume: 22000, color: '#28A0F0' },
  { chain: 'Polygon', transactions: 180, volume: 15000, color: '#8247E5' },
  { chain: 'Optimism', transactions: 120, volume: 11000, color: '#FF0420' },
];

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const totalRevenue = MOCK_DAILY_REVENUE.reduce((a, b) => a + b.amount, 0);
  const avgDaily = totalRevenue / MOCK_DAILY_REVENUE.length;
  const maxRevenue = Math.max(...MOCK_DAILY_REVENUE.map(d => d.amount));
  const totalTransactions = MOCK_CHAIN_BREAKDOWN.reduce((a, b) => a + b.transactions, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
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
            <span className="text-zinc-400">Analytics</span>
          </div>
          
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/merchant" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/merchant/invoices" className="text-zinc-400 hover:text-white transition-colors">Invoices</Link>
            <Link href="/merchant/analytics" className="text-white font-medium">Analytics</Link>
            <Link href="/merchant/settings" className="text-zinc-400 hover:text-white transition-colors">Settings</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">Analytics</h1>
            <p className="text-zinc-500">Detailed insights into your payment activity</p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === range
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {range === '7d' && '7 Days'}
                {range === '30d' && '30 Days'}
                {range === '90d' && '90 Days'}
                {range === '1y' && '1 Year'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-zinc-500 mb-1">Total Revenue</p>
            <p className="text-3xl font-bold">${totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-emerald-400 mt-1">+12.5% vs previous</p>
          </div>
          <div className="card">
            <p className="text-sm text-zinc-500 mb-1">Total Transactions</p>
            <p className="text-3xl font-bold">{totalTransactions.toLocaleString()}</p>
            <p className="text-sm text-emerald-400 mt-1">+8.3% vs previous</p>
          </div>
          <div className="card">
            <p className="text-sm text-zinc-500 mb-1">Avg. Transaction</p>
            <p className="text-3xl font-bold">${(totalRevenue / totalTransactions).toFixed(2)}</p>
            <p className="text-sm text-zinc-500 mt-1">Per transaction</p>
          </div>
          <div className="card">
            <p className="text-sm text-zinc-500 mb-1">Daily Average</p>
            <p className="text-3xl font-bold">${avgDaily.toFixed(0)}</p>
            <p className="text-sm text-zinc-500 mt-1">Per day</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">Revenue Over Time</h3>
            
            {/* Line Chart */}
            <div className="relative h-64">
              <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={i * 50}
                    x2="400"
                    y2={i * 50}
                    stroke="#27272a"
                    strokeWidth="1"
                  />
                ))}
                
                {/* Area fill */}
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M0,${200 - (MOCK_DAILY_REVENUE[0].amount / maxRevenue) * 180} ${MOCK_DAILY_REVENUE.map((d, i) => 
                    `L${(i / (MOCK_DAILY_REVENUE.length - 1)) * 400},${200 - (d.amount / maxRevenue) * 180}`
                  ).join(' ')} L400,200 L0,200 Z`}
                  fill="url(#areaGradient)"
                />
                
                {/* Line */}
                <path
                  d={`M0,${200 - (MOCK_DAILY_REVENUE[0].amount / maxRevenue) * 180} ${MOCK_DAILY_REVENUE.map((d, i) => 
                    `L${(i / (MOCK_DAILY_REVENUE.length - 1)) * 400},${200 - (d.amount / maxRevenue) * 180}`
                  ).join(' ')}`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                
                {/* Points */}
                {MOCK_DAILY_REVENUE.map((d, i) => (
                  <circle
                    key={i}
                    cx={(i / (MOCK_DAILY_REVENUE.length - 1)) * 400}
                    cy={200 - (d.amount / maxRevenue) * 180}
                    r="4"
                    fill="#3b82f6"
                    className="hover:r-6 transition-all"
                  />
                ))}
              </svg>
            </div>
            
            {/* X-axis labels */}
            <div className="flex justify-between mt-4 text-xs text-zinc-500">
              {MOCK_DAILY_REVENUE.filter((_, i) => i % 3 === 0).map((d) => (
                <span key={d.date}>{d.date}</span>
              ))}
            </div>
          </div>

          {/* Token Breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-6">Payment Tokens</h3>
            
            {/* Donut Chart Placeholder */}
            <div className="flex items-center gap-8">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {MOCK_TOKEN_BREAKDOWN.reduce((acc, token, i) => {
                    const prevOffset = acc.offset;
                    const circumference = 2 * Math.PI * 40;
                    const dashLength = (token.percentage / 100) * circumference;
                    const dashOffset = circumference - dashLength;
                    
                    acc.elements.push(
                      <circle
                        key={token.token}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={token.color}
                        strokeWidth="16"
                        strokeDasharray={`${dashLength} ${circumference}`}
                        strokeDashoffset={-prevOffset}
                        className="transition-all duration-500"
                      />
                    );
                    
                    acc.offset += dashLength;
                    return acc;
                  }, { elements: [] as JSX.Element[], offset: 0 }).elements}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold">${(totalRevenue / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-zinc-500">Total</p>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex-1 space-y-3">
                {MOCK_TOKEN_BREAKDOWN.map((token) => (
                  <div key={token.token} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: token.color }} />
                      <span className="text-sm">{token.token}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">${(token.amount / 1000).toFixed(1)}k</span>
                      <span className="text-xs text-zinc-500 ml-2">{token.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chain Breakdown Table */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-6">Chain Activity</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-xs text-zinc-500 uppercase tracking-wider py-3 font-medium">Chain</th>
                  <th className="text-right text-xs text-zinc-500 uppercase tracking-wider py-3 font-medium">Transactions</th>
                  <th className="text-right text-xs text-zinc-500 uppercase tracking-wider py-3 font-medium">Volume</th>
                  <th className="text-right text-xs text-zinc-500 uppercase tracking-wider py-3 font-medium">Share</th>
                  <th className="text-left text-xs text-zinc-500 uppercase tracking-wider py-3 font-medium pl-4">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_CHAIN_BREAKDOWN.map((chain) => {
                  const totalVolume = MOCK_CHAIN_BREAKDOWN.reduce((a, b) => a + b.volume, 0);
                  const percentage = (chain.volume / totalVolume) * 100;
                  
                  return (
                    <tr key={chain.chain} className="border-b border-zinc-800/50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: chain.color + '20' }}>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chain.color }} />
                          </div>
                          <span className="font-medium">{chain.chain}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right text-zinc-300">{chain.transactions.toLocaleString()}</td>
                      <td className="py-4 text-right font-medium">${chain.volume.toLocaleString()}</td>
                      <td className="py-4 text-right text-zinc-400">{percentage.toFixed(1)}%</td>
                      <td className="py-4 pl-4">
                        <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%`, backgroundColor: chain.color }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Section */}
        <div className="mt-8 flex items-center justify-between p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <div>
            <h4 className="font-medium mb-1">Export Analytics Data</h4>
            <p className="text-sm text-zinc-500">Download detailed reports for your records</p>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button className="btn btn-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
