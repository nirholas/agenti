'use client';

import { ExternalLink, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RewardClaim } from '@/lib/api';

interface ClaimHistoryProps {
  claims: Array<RewardClaim & { campaign_name: string }>;
}

function formatTokenAmount(amount: string): string {
  // $OPEN has 9 decimals (standard SPL token)
  const value = Number(amount) / 1_000_000_000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'processing':
      return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />;
    case 'failed':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${styles[status as keyof typeof styles] || styles.pending}`}>
      {status}
    </span>
  );
}

export function ClaimHistory({ claims }: ClaimHistoryProps) {
  if (claims.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No claims yet. Participate in campaigns to earn rewards!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Claims</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {claims.map(claim => (
            <div
              key={claim.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-4">
                <StatusIcon status={claim.status} />
                <div>
                  <p className="font-medium">{claim.campaign_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground">
                      {claim.claimed_at
                        ? formatDate(claim.claimed_at)
                        : formatDate(claim.created_at)}
                    </p>
                    <StatusBadge status={claim.status} />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">
                  {formatTokenAmount(claim.final_reward_amount)} $OPEN
                </p>
                {claim.multiplier > 1 && (
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {claim.multiplier}x multiplier applied
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1 justify-end">
                  {claim.claim_wallet && (
                    <a
                      href={`https://solscan.io/account/${claim.claim_wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary"
                    >
                      {truncateAddress(claim.claim_wallet)}
                    </a>
                  )}
                  {claim.tx_signature && (
                    <a
                      href={`https://solscan.io/tx/${claim.tx_signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
