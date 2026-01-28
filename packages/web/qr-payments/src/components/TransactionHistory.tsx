'use client';

import { useState } from 'react';

// Transaction type
interface Transaction {
  id: string;
  type: 'swap' | 'send' | 'receive';
  status: 'pending' | 'confirmed' | 'failed';
  fromToken: {
    symbol: string;
    amount: string;
    logoURI?: string;
  };
  toToken: {
    symbol: string;
    amount: string;
    logoURI?: string;
  };
  chainId: number;
  chainName: string;
  txHash: string;
  timestamp: Date;
  gasUsed?: string;
  gasCost?: string;
  errorMessage?: string;
}

// Mock transactions for demo
const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'swap',
    status: 'confirmed',
    fromToken: { symbol: 'ETH', amount: '0.5', logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
    toToken: { symbol: 'USDC', amount: '1,250.00', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
    chainId: 1,
    chainName: 'Ethereum',
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    gasUsed: '150000',
    gasCost: '$3.50',
  },
  {
    id: '2',
    type: 'swap',
    status: 'pending',
    fromToken: { symbol: 'MATIC', amount: '1000', logoURI: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png' },
    toToken: { symbol: 'USDC', amount: '850.00', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
    chainId: 137,
    chainName: 'Polygon',
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
  },
  {
    id: '3',
    type: 'swap',
    status: 'failed',
    fromToken: { symbol: 'WBTC', amount: '0.01', logoURI: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
    toToken: { symbol: 'USDC', amount: '420.00', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
    chainId: 42161,
    chainName: 'Arbitrum',
    txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    errorMessage: 'Slippage tolerance exceeded',
  },
  {
    id: '4',
    type: 'send',
    status: 'confirmed',
    fromToken: { symbol: 'USDC', amount: '500.00', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
    toToken: { symbol: 'USDC', amount: '500.00', logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' },
    chainId: 8453,
    chainName: 'Base',
    txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    gasUsed: '21000',
    gasCost: '$0.01',
  },
];

// Block explorer URLs
const BLOCK_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  137: 'https://polygonscan.com',
  42161: 'https://arbiscan.io',
  8453: 'https://basescan.org',
  10: 'https://optimistic.etherscan.io',
  56: 'https://bscscan.com',
};

interface TransactionHistoryProps {
  transactions?: Transaction[];
  onRetry?: (tx: Transaction) => void;
  maxItems?: number;
}

export default function TransactionHistory({ 
  transactions = MOCK_TRANSACTIONS,
  onRetry,
  maxItems = 10
}: TransactionHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'failed'>('all');

  const filteredTransactions = transactions
    .filter(tx => filter === 'all' || tx.status === filter)
    .slice(0, maxItems);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const getExplorerUrl = (chainId: number, txHash: string) => {
    const explorer = BLOCK_EXPLORERS[chainId] || 'https://etherscan.io';
    return `${explorer}/tx/${txHash}`;
  };

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="badge badge-info">
            <span className="status-dot status-dot-pending animate-pulse" />
            Pending
          </span>
        );
      case 'confirmed':
        return (
          <span className="badge badge-success">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Confirmed
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-error">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed
          </span>
        );
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transaction History</h3>
        
        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-900 rounded-lg">
          {(['all', 'pending', 'confirmed', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === status
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-zinc-500">No transactions found</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className={`p-4 rounded-xl border transition-colors ${
                tx.status === 'failed' 
                  ? 'bg-red-500/5 border-red-500/20' 
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Token Icons */}
                <div className="relative flex-shrink-0">
                  {tx.fromToken.logoURI ? (
                    <img src={tx.fromToken.logoURI} alt={tx.fromToken.symbol} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-medium">
                      {tx.fromToken.symbol.charAt(0)}
                    </div>
                  )}
                  {tx.type === 'swap' && tx.toToken.logoURI && (
                    <img 
                      src={tx.toToken.logoURI} 
                      alt={tx.toToken.symbol} 
                      className="w-6 h-6 rounded-full absolute -bottom-1 -right-1 border-2 border-zinc-900" 
                    />
                  )}
                </div>

                {/* Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {tx.type === 'swap' && `${tx.fromToken.amount} ${tx.fromToken.symbol} → ${tx.toToken.amount} ${tx.toToken.symbol}`}
                      {tx.type === 'send' && `Sent ${tx.fromToken.amount} ${tx.fromToken.symbol}`}
                      {tx.type === 'receive' && `Received ${tx.toToken.amount} ${tx.toToken.symbol}`}
                    </span>
                    {getStatusBadge(tx.status)}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span>{tx.chainName}</span>
                    <span className="text-zinc-700">•</span>
                    <span>{formatTimestamp(tx.timestamp)}</span>
                    {tx.gasCost && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span>Gas: {tx.gasCost}</span>
                      </>
                    )}
                  </div>

                  {/* Error Message */}
                  {tx.status === 'failed' && tx.errorMessage && (
                    <p className="text-sm text-red-400 mt-2">
                      {tx.errorMessage}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Block Explorer Link */}
                  <a
                    href={getExplorerUrl(tx.chainId, tx.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    title="View on Explorer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* Copy Hash */}
                  <button
                    onClick={() => navigator.clipboard.writeText(tx.txHash)}
                    className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                    title="Copy Transaction Hash"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  {/* Retry Button for Failed Transactions */}
                  {tx.status === 'failed' && onRetry && (
                    <button
                      onClick={() => onRetry(tx)}
                      className="btn btn-sm btn-secondary"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* View All Link */}
      {transactions.length > maxItems && (
        <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
          <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View all transactions →
          </button>
        </div>
      )}
    </div>
  );
}

export type { Transaction };
