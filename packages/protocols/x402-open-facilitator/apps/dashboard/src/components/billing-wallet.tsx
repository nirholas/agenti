'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, ExternalLink, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function BillingWallet() {
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: wallet, isLoading, error } = useQuery({
    queryKey: ['billingWallet'],
    queryFn: async () => {
      try {
        return await api.getBillingWallet();
      } catch (e) {
        // If wallet doesn't exist, return null to trigger creation
        if (e instanceof Error && e.message.includes('not found')) {
          return null;
        }
        throw e;
      }
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createBillingWallet(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billingWallet'] });
    },
  });

  // Auto-create wallet if user doesn't have one
  const shouldCreateWallet = !isLoading && !wallet && !createMutation.isPending && !error;
  if (shouldCreateWallet) {
    createMutation.mutate();
  }

  const copyAddress = async () => {
    if (!wallet?.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = wallet?.address
    ? `https://solscan.io/account/${wallet.address}`
    : null;

  if (isLoading || createMutation.isPending) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Billing Wallet</CardDescription>
          <div className="h-8 bg-muted rounded w-24 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted rounded w-48 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error && !wallet) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Billing Wallet</CardDescription>
          <CardTitle className="text-lg text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load wallet</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => createMutation.mutate()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>Billing Wallet</CardDescription>
          <div className="flex items-center gap-1">
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <CardTitle className="text-3xl">
          ${wallet?.balance || '0.00'} <span className="text-lg font-normal text-muted-foreground">USDC</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 truncate">
            {wallet?.address ? truncateAddress(wallet.address) : '—'}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={copyAddress}
            title="Copy address"
          >
            {copied ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          {explorerUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              asChild
              title="View on Solscan"
            >
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Send USDC on Solana to fund your subscription
        </p>
      </CardContent>
    </Card>
  );
}
