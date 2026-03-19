'use client';

import { ExternalLink, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { SubscriptionPaymentAttempt } from '@/lib/api';

function truncateTxHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function getExplorerUrl(txHash: string, chain: string): string {
  // Currently only Solana supported - Phase 18 adds Base
  if (chain === 'base') {
    return `https://basescan.org/tx/${txHash}`;
  }
  return `https://solscan.io/tx/${txHash}`;
}

interface PaymentHistoryProps {
  payments: SubscriptionPaymentAttempt[];
  isLoading?: boolean;
}

function getStatusBadge(status: 'success' | 'failed' | 'pending') {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="w-3 h-3" />
          Success
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
  }
}

function exportToCsv(payments: SubscriptionPaymentAttempt[]) {
  // Generate CSV content
  const headers = ['Date', 'Amount', 'Chain', 'Status', 'Transaction Hash', 'Fallback'];
  const rows = payments.map(p => [
    new Date(p.date).toLocaleString(),
    `$${p.amount}`,
    p.chain,
    p.status,
    p.txHash || '-',
    p.isFallback ? 'Yes' : 'No',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `subscription-payments-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function PaymentHistory({ payments, isLoading }: PaymentHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">Payment History</CardTitle>
        {payments.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCsv(payments)}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No payment history yet.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Chain</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      {formatDate(payment.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      ${payment.amount}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="capitalize">{payment.chain}</span>
                        {payment.isFallback && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            fallback
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(payment.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {payment.txHash ? (
                        <a
                          href={getExplorerUrl(payment.txHash, payment.chain)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <code className="font-mono text-xs">
                            {truncateTxHash(payment.txHash)}
                          </code>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
