'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Loader2,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/navbar';
import { formatAddress, cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002';

interface ClaimableItem {
  id: string;
  originalTxHash: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
  status: 'pending' | 'approved';
  reportedAt: string;
  expiresAt?: string;
}

interface ClaimHistoryItem {
  id: string;
  originalTxHash: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected' | 'expired';
  reportedAt: string;
  expiresAt?: string;
  payoutTxHash?: string;
  paidAt?: string;
}

async function getClaimable(wallet: string, facilitator?: string): Promise<{ claims: ClaimableItem[] }> {
  const params = new URLSearchParams({ wallet });
  if (facilitator) params.set('facilitator', facilitator);
  const response = await fetch(`${API_BASE}/api/claims?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch claims');
  return response.json();
}

async function getClaimHistory(wallet: string, facilitator?: string): Promise<{ claims: ClaimHistoryItem[] }> {
  const params = new URLSearchParams({ wallet });
  if (facilitator) params.set('facilitator', facilitator);
  const response = await fetch(`${API_BASE}/api/claims/history?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch claim history');
  return response.json();
}

async function executeClaim(claimId: string): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/api/claims/${claimId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
}

export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState('');
  const [facilitatorSubdomain, setFacilitatorSubdomain] = useState('');
  const [searchedWallet, setSearchedWallet] = useState('');
  const [activeTab, setActiveTab] = useState<'claimable' | 'history'>('claimable');

  const { data: claimableData, isLoading: claimableLoading, refetch: refetchClaimable } = useQuery({
    queryKey: ['claimable', searchedWallet, facilitatorSubdomain],
    queryFn: () => getClaimable(searchedWallet, facilitatorSubdomain || undefined),
    enabled: !!searchedWallet,
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['claimHistory', searchedWallet, facilitatorSubdomain],
    queryFn: () => getClaimHistory(searchedWallet, facilitatorSubdomain || undefined),
    enabled: !!searchedWallet,
  });

  const executeClaimMutation = useMutation({
    mutationFn: (claimId: string) => executeClaim(claimId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claimable'] });
      queryClient.invalidateQueries({ queryKey: ['claimHistory'] });
    },
  });

  const handleSearch = () => {
    if (walletAddress) {
      setSearchedWallet(walletAddress);
    }
  };

  const formatAmount = (amount: string) => {
    const value = Number(amount) / 1_000_000;
    return `$${value.toFixed(2)}`;
  };

  const getExplorerUrl = (txHash: string, network: string) => {
    if (network === 'solana' || network === 'solana-mainnet') {
      return `https://solscan.io/tx/${txHash}`;
    }
    if (network === 'base') {
      return `https://basescan.org/tx/${txHash}`;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Claim Refunds</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Check if you have any refunds available from x402 payments that experienced issues.
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Find Your Claims
            </CardTitle>
            <CardDescription>
              Enter your wallet address to see available refunds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="wallet">Wallet Address</Label>
                <Input
                  id="wallet"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x... or Solana address"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="facilitator">Facilitator (optional)</Label>
                <Input
                  id="facilitator"
                  value={facilitatorSubdomain}
                  onChange={(e) => setFacilitatorSubdomain(e.target.value)}
                  placeholder="e.g., my-app (leave empty to search all)"
                />
              </div>
              <Button onClick={handleSearch} disabled={!walletAddress} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Search Claims
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searchedWallet && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="border-b border-border">
              <nav className="flex gap-8">
                <button
                  onClick={() => setActiveTab('claimable')}
                  className={cn(
                    'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === 'claimable'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  Claimable ({claimableData?.claims.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={cn(
                    'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === 'history'
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  History
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    refetchClaimable();
                    refetchHistory();
                  }}
                  className="pb-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </nav>
            </div>

            {/* Claimable Tab */}
            {activeTab === 'claimable' && (
              <div>
                {claimableLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !claimableData?.claims.length ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No refunds available</p>
                      <p className="text-sm">
                        You don&apos;t have any pending refunds for this wallet.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {claimableData.claims.map((claim) => (
                      <Card key={claim.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant={claim.status === 'approved' ? 'default' : 'secondary'}
                                  className={claim.status === 'approved' ? 'bg-blue-500' : ''}
                                >
                                  {claim.status === 'approved' ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Ready to Claim
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending Review
                                    </>
                                  )}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {claim.network}
                                </Badge>
                              </div>
                              <div className="text-2xl font-bold text-green-600">
                                {formatAmount(claim.amount)} USDC
                              </div>
                              {claim.reason && (
                                <p className="text-sm text-muted-foreground">
                                  Reason: {claim.reason}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Original transaction:{' '}
                                <code className="font-mono">{formatAddress(claim.originalTxHash)}</code>
                              </p>
                              {claim.expiresAt && (
                                <p className="text-xs text-muted-foreground">
                                  Expires: {new Date(claim.expiresAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              {claim.status === 'approved' ? (
                                <Button
                                  onClick={() => executeClaimMutation.mutate(claim.id)}
                                  disabled={executeClaimMutation.isPending}
                                >
                                  {executeClaimMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <DollarSign className="h-4 w-4 mr-2" />
                                  )}
                                  Claim Refund
                                </Button>
                              ) : (
                                <Badge variant="secondary">Awaiting Approval</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !historyData?.claims.length ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No claim history</p>
                      <p className="text-sm">
                        Your claim history will appear here.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {historyData.claims.map((claim) => {
                      const explorerUrl = claim.payoutTxHash
                        ? getExplorerUrl(claim.payoutTxHash, claim.network)
                        : null;

                      return (
                        <Card key={claim.id}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant={
                                      claim.status === 'paid'
                                        ? 'default'
                                        : claim.status === 'rejected'
                                        ? 'destructive'
                                        : 'secondary'
                                    }
                                    className={claim.status === 'paid' ? 'bg-green-500' : ''}
                                  >
                                    {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                                  </Badge>
                                  <Badge variant="outline" className="capitalize">
                                    {claim.network}
                                  </Badge>
                                </div>
                                <div className="text-xl font-semibold">
                                  {formatAmount(claim.amount)} USDC
                                </div>
                                {claim.reason && (
                                  <p className="text-sm text-muted-foreground">
                                    Reason: {claim.reason}
                                  </p>
                                )}
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <p>
                                    Reported: {new Date(claim.reportedAt).toLocaleDateString()}
                                  </p>
                                  {claim.paidAt && (
                                    <p>
                                      Paid: {new Date(claim.paidAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {claim.payoutTxHash && explorerUrl && (
                                <a
                                  href={explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline flex items-center gap-1"
                                >
                                  View Tx
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
