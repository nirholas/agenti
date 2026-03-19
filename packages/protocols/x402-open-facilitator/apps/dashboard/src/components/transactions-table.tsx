'use client';

import { useState } from 'react';
import { ExternalLink, ArrowUpRight, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAddress, formatDate } from '@/lib/utils';
import type { Transaction } from '@/lib/api';

function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface TransactionsTableProps {
  transactions: Transaction[];
  pageSize?: number;
}

function StatusBadge({ status }: { status: 'success' | 'failed' | 'pending' }) {
  const styles = {
    success: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

function getExplorerUrl(tx: Transaction): string | null {
  if (!tx.transactionHash) return null;
  if (tx.network === 'solana' || tx.network === 'solana-mainnet') {
    return `https://solscan.io/tx/${tx.transactionHash}`;
  }
  if (tx.network === 'solana-devnet') {
    return `https://solscan.io/tx/${tx.transactionHash}?cluster=devnet`;
  }
  if (tx.network === '8453' || tx.network === 'base') {
    return `https://basescan.org/tx/${tx.transactionHash}`;
  }
  if (tx.network === '84532' || tx.network === 'base-sepolia') {
    return `https://sepolia.basescan.org/tx/${tx.transactionHash}`;
  }
  if (tx.network === '1' || tx.network === 'ethereum') {
    return `https://etherscan.io/tx/${tx.transactionHash}`;
  }
  return null;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function TransactionsTable({ transactions, pageSize = 20 }: TransactionsTableProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(transactions.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedTransactions = transactions.slice(startIndex, startIndex + pageSize);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
          <ArrowUpRight className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No transactions yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Transactions will appear here when payments are processed.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">From / To</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Time</th>
              <th className="text-right py-3 px-4 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((tx) => {
              const explorerUrl = getExplorerUrl(tx);
              return (
                <tr
                  key={tx.id}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {tx.type === 'settle' ? (
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <ArrowUpRight className="w-3 h-3 text-blue-400" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        </div>
                      )}
                      <span className="capitalize">{tx.type}</span>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                    {formatAddress(tx.fromAddress)} → {formatAddress(tx.toAddress)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatUSDC(tx.amount)}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {formatRelativeTime(tx.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusBadge status={tx.status as 'success' | 'failed' | 'pending'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
