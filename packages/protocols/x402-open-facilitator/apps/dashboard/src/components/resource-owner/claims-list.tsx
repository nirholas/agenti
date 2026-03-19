'use client';

import { useState } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn, formatAddress } from '@/lib/utils';
import type { Claim, ClaimStats } from './types';

interface ClaimsListProps {
  claims: Claim[];
  claimStats: ClaimStats | null;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onApproveClaim: (claimId: string) => Promise<void>;
  onRejectClaim: (claimId: string) => Promise<void>;
  onExecutePayout: (claimId: string) => Promise<void>;
}

export function ClaimsList({
  claims,
  claimStats,
  statusFilter,
  onStatusFilterChange,
  onApproveClaim,
  onRejectClaim,
  onExecutePayout,
}: ClaimsListProps) {
  const [processingClaims, setProcessingClaims] = useState<Set<string>>(new Set());

  const handleAction = async (claimId: string, action: () => Promise<void>) => {
    setProcessingClaims((prev) => new Set(prev).add(claimId));
    try {
      await action();
    } finally {
      setProcessingClaims((prev) => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  };

  const formatAmount = (amount: string) => {
    const value = Number(amount) / 1_000_000;
    return `$${value.toFixed(2)}`;
  };

  const getExplorerUrl = (network: string, txHash: string) => {
    const explorers: Record<string, string> = {
      base: 'https://basescan.org/tx/',
      'base-sepolia': 'https://sepolia.basescan.org/tx/',
      solana: 'https://solscan.io/tx/',
      'solana-devnet': 'https://solscan.io/tx/',
    };
    const baseUrl = explorers[network] || explorers['base'];
    const suffix = network === 'solana-devnet' ? '?cluster=devnet' : '';
    return `${baseUrl}${txHash}${suffix}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'paid':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'paid':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'expired':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Claims
            </CardTitle>
            <CardDescription>
              Review and manage refund claims from your servers.
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats row */}
        {claimStats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xl font-bold">{claimStats.totalClaims}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10">
              <p className="text-xl font-bold text-yellow-600">{claimStats.pendingClaims}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-xl font-bold text-green-600">{claimStats.paidClaims}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-xl font-bold text-green-600">${claimStats.totalPaidAmount}</p>
              <p className="text-xs text-muted-foreground">Total Paid</p>
            </div>
          </div>
        )}

        {/* Claims list */}
        {claims.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No claims found</p>
            <p className="text-sm">Claims will appear here when failures are reported.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(claim.status)}
                    <Badge
                      variant={getStatusBadgeVariant(claim.status)}
                      className={cn(
                        claim.status === 'paid' && 'bg-green-500',
                        claim.status === 'approved' && 'bg-blue-500',
                      )}
                    >
                      {claim.status}
                    </Badge>
                    <span className="font-medium">{formatAmount(claim.amount)}</span>
                    <Badge variant="outline" className="capitalize">{claim.network}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    User: <code className="font-mono">{formatAddress(claim.userWallet)}</code>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Reason: {claim.reason || 'Not specified'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
                    <a
                      href={getExplorerUrl(claim.network, claim.originalTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Original: <code className="font-mono">{formatAddress(claim.originalTxHash)}</code>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {claim.status === 'paid' && claim.payoutTxHash && (
                      <a
                        href={getExplorerUrl(claim.network, claim.payoutTxHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                      >
                        Refund: <code className="font-mono">{formatAddress(claim.payoutTxHash)}</code>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(claim.reportedAt).toLocaleDateString()}
                  </span>
                  {(claim.status === 'pending' || claim.status === 'approved') && (
                    processingClaims.has(claim.id) ? (
                      <Button variant="ghost" size="sm" disabled>
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {claim.status === 'pending' && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction(claim.id, () => onApproveClaim(claim.id))}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleAction(claim.id, () => onRejectClaim(claim.id))}
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {claim.status === 'approved' && (
                            <DropdownMenuItem onClick={() => handleAction(claim.id, () => onExecutePayout(claim.id))}>
                              <DollarSign className="h-4 w-4 mr-2 text-green-500" />
                              Execute Payout
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
