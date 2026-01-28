'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Dashboard stats
interface DashboardStats {
  totalRevenue: string;
  totalTransactions: number;
  activeInvoices: number;
  conversionRate: number;
  revenueChange: number;
  transactionChange: number;
}

// Recent transaction type
interface RecentTransaction {
  id: string;
  amount: string;
  token: string;
  status: 'confirmed' | 'pending' | 'failed';
  timestamp: Date;
  customer?: string;
}

// Mock data
const MOCK_STATS: DashboardStats = {
  totalRevenue: '125,430.00',
  totalTransactions: 1247,
  activeInvoices: 23,
  conversionRate: 94.5,
  revenueChange: 12.5,
  transactionChange: 8.3,
};

const MOCK_TRANSACTIONS: RecentTransaction[] = [
  { id: '1', amount: '250.00', token: 'USDC', status: 'confirmed', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: '2', amount: '1,500.00', token: 'USDC', status: 'confirmed', timestamp: new Date(Date.now() - 1000 * 60 * 15) },
  { id: '3', amount: '75.00', token: 'USDC', status: 'pending', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
  { id: '4', amount: '500.00', token: 'USDC', status: 'confirmed', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  { id: '5', amount: '125.00', token: 'USDC', status: 'failed', timestamp: new Date(Date.now() - 1000 * 60 * 90) },
];

const MOCK_CHART_DATA = [
  { day: 'Mon', amount: 12500 },
  { day: 'Tue', amount: 18200 },
  { day: 'Wed', amount: 15800 },
  { day: 'Thu', amount: 21400 },
  { day: 'Fri', amount: 19600 },
  { day: 'Sat', amount: 14200 },
  { day: 'Sun', amount: 16800 },
];

export default function MerchantDashboard() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
  const [transactions, setTransactions] = useState<RecentTransaction[]>(MOCK_TRANSACTIONS);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const maxChartValue = Math.max(...MOCK_CHART_DATA.map(d => d.amount));

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
            <span className="text-zinc-400">Merchant Dashboard</span>
          </div>
          
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/merchant" className="text-white font-medium">Dashboard</Link>
            <Link href="/merchant/invoices" className="text-zinc-400 hover:text-white transition-colors">Invoices</Link>
            <Link href="/merchant/analytics" className="text-zinc-400 hover:text-white transition-colors">Analytics</Link>
            <Link href="/merchant/settings" className="text-zinc-400 hover:text-white transition-colors">Settings</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
          <p className="text-zinc-500">Overview of your payment activity</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Revenue */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-500 text-sm">Total Revenue</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">${stats.totalRevenue}</p>
            <div className="flex items-center gap-1 text-sm">
              <span className={stats.revenueChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {stats.revenueChange >= 0 ? '+' : ''}{stats.revenueChange}%
              </span>
              <span className="text-zinc-600">vs last month</span>
            </div>
          </div>

          {/* Total Transactions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-500 text-sm">Transactions</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalTransactions.toLocaleString()}</p>
            <div className="flex items-center gap-1 text-sm">
              <span className={stats.transactionChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {stats.transactionChange >= 0 ? '+' : ''}{stats.transactionChange}%
              </span>
              <span className="text-zinc-600">vs last month</span>
            </div>
          </div>

          {/* Active Invoices */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-500 text-sm">Active Invoices</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.activeInvoices}</p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-zinc-500">Pending payment</span>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="text-zinc-500 text-sm">Success Rate</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.conversionRate}%</p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-zinc-500">Payment completion</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Revenue (Last 7 Days)</h3>
              <select className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            
            {/* Simple Bar Chart */}
            <div className="flex items-end justify-between gap-2 h-48">
              {MOCK_CHART_DATA.map((data, index) => (
                <div key={data.day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex-1 flex items-end">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:from-blue-500 hover:to-blue-300"
                      style={{ height: `${(data.amount / maxChartValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{data.day}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-sm">
              <span className="text-zinc-500">Total: <span className="text-white font-medium">${(MOCK_CHART_DATA.reduce((a, b) => a + b.amount, 0) / 100).toLocaleString()}</span></span>
              <span className="text-zinc-500">Avg: <span className="text-white font-medium">${(MOCK_CHART_DATA.reduce((a, b) => a + b.amount, 0) / MOCK_CHART_DATA.length / 100).toFixed(2)}</span></span>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Payments</h3>
              <Link href="/merchant/analytics" className="text-sm text-blue-400 hover:text-blue-300">
                View all
              </Link>
            </div>
            
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-xl">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.status === 'confirmed' ? 'bg-emerald-500/10' :
                    tx.status === 'pending' ? 'bg-blue-500/10' : 'bg-red-500/10'
                  }`}>
                    {tx.status === 'confirmed' && (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {tx.status === 'pending' && (
                      <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {tx.status === 'failed' && (
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">${tx.amount}</p>
                    <p className="text-sm text-zinc-500">{formatTimestamp(tx.timestamp)}</p>
                  </div>
                  <span className={`badge ${
                    tx.status === 'confirmed' ? 'badge-success' :
                    tx.status === 'pending' ? 'badge-info' : 'badge-error'
                  }`}>
                    {tx.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/merchant/invoices" className="card-interactive flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium">Create Invoice</h4>
              <p className="text-sm text-zinc-500">Generate a new payment request</p>
            </div>
          </Link>

          <Link href="/merchant/analytics" className="card-interactive flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium">View Analytics</h4>
              <p className="text-sm text-zinc-500">Detailed payment insights</p>
            </div>
          </Link>

          <Link href="/merchant/settings" className="card-interactive flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium">Settings</h4>
              <p className="text-sm text-zinc-500">Configure your account</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
