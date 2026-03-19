'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type SubscriptionWallet } from '@/lib/api';
import { WalletCard } from './wallet-card';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

// Re-export for page-level usage
export { ChainPreferenceToggle } from './chain-preference-toggle';
export { useChainPreference } from './hooks/use-chain-preference';

export function WalletCards() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshingChain, setRefreshingChain] = useState<'solana' | 'base' | null>(null);

  // Fetch all wallets
  const { data: wallets, isLoading } = useQuery({
    queryKey: ['subscriptionWallets'],
    queryFn: () => api.getSubscriptionWallets(),
  });

  // Create wallet mutation
  const createMutation = useMutation({
    mutationFn: (chain: 'solana' | 'base') => api.createSubscriptionWallet(chain),
    onSuccess: (result, chain) => {
      toast({
        title: 'Wallet created!',
        description: `Your ${chain === 'solana' ? 'Solana' : 'Base'} wallet is ready.`,
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptionWallets'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create wallet',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Refresh balance for specific chain
  const handleRefresh = async (chain: 'solana' | 'base') => {
    setRefreshingChain(chain);
    try {
      await api.refreshWalletBalance(chain);
      await queryClient.invalidateQueries({ queryKey: ['subscriptionWallets'] });
    } catch (error) {
      toast({
        title: 'Failed to refresh balance',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingChain(null);
    }
  };

  // Find wallets by network
  const solanaWallet = wallets?.find((w: SubscriptionWallet) => w.network === 'solana');
  const baseWallet = wallets?.find((w: SubscriptionWallet) => w.network === 'base');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <WalletCard
        network="base"
        address={baseWallet?.address || null}
        balance={baseWallet?.balance || '0.00'}
        isLoading={isLoading}
        isRefreshing={refreshingChain === 'base'}
        onRefresh={() => handleRefresh('base')}
        onCreate={() => createMutation.mutate('base')}
        isCreating={createMutation.isPending && createMutation.variables === 'base'}
      />
      <WalletCard
        network="solana"
        address={solanaWallet?.address || null}
        balance={solanaWallet?.balance || '0.00'}
        isLoading={isLoading}
        isRefreshing={refreshingChain === 'solana'}
        onRefresh={() => handleRefresh('solana')}
        onCreate={() => createMutation.mutate('solana')}
        isCreating={createMutation.isPending && createMutation.variables === 'solana'}
      />
    </div>
  );
}
