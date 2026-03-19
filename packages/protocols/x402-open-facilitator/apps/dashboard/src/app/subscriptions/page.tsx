'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { StatusCard } from '@/components/subscriptions/status-card';
import { BillingCard } from '@/components/subscriptions/billing-card';
import { PaymentHistory } from '@/components/subscriptions/payment-history';
import { WalletCards, ChainPreferenceToggle, useChainPreference } from '@/components/subscriptions/wallet-cards';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

export default function SubscriptionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { preference, isLoading: preferenceLoading, updatePreference, isUpdating } = useChainPreference();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch subscription status
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscriptionStatus(),
    enabled: isAuthenticated,
  });

  // Fetch payment history (old endpoint - subscription records)
  const { data: historyData } = useQuery({
    queryKey: ['subscriptionHistory'],
    queryFn: () => api.getSubscriptionHistory(),
    enabled: isAuthenticated,
  });

  // Fetch payment attempts (new endpoint - detailed payment attempts)
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['subscriptionPayments'],
    queryFn: () => api.getSubscriptionPayments(),
    enabled: isAuthenticated,
  });

  // Purchase subscription mutation
  const purchaseMutation = useMutation({
    mutationFn: () => api.purchaseSubscription(),
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Subscription activated!',
          description: 'Your subscription is now active.',
        });
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptionHistory'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptionPayments'] });
        queryClient.invalidateQueries({ queryKey: ['billingWallet'] });
      } else if (result.insufficientBalance) {
        toast({
          title: 'Insufficient balance',
          description: `You need $${result.required} but only have $${result.available}. Please fund your wallet.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Purchase failed',
          description: result.error || 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Purchase failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  // Reactivate subscription mutation
  const reactivateMutation = useMutation({
    mutationFn: () => api.reactivateSubscription(),
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Subscription reactivated!',
          description: 'Your subscription is now active.',
        });
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['subscriptionPayments'] });
      } else {
        toast({
          title: 'Reactivation failed',
          description: result.error || 'Please fund your wallet and try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Reactivation failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage your subscription and view payment history.
          </p>
        </div>

        {/* Status and Billing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <StatusCard
            subscription={subscription}
            onSubscribe={() => purchaseMutation.mutate()}
            isSubscribing={purchaseMutation.isPending}
            onReactivate={() => reactivateMutation.mutate()}
            isReactivating={reactivateMutation.isPending}
          />
          <BillingCard subscription={subscription} />
        </div>

        {/* Wallet Cards Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Subscription Wallets</h2>
              <p className="text-sm text-muted-foreground">
                Fund these wallets with USDC to pay for your subscription.
              </p>
            </div>
            {!preferenceLoading && (
              <div className="flex flex-col items-end gap-1">
                <ChainPreferenceToggle
                  preference={preference}
                  onChange={updatePreference}
                  disabled={isUpdating}
                  compact
                />
                <span className="text-xs text-muted-foreground">
                  Payment source
                </span>
              </div>
            )}
          </div>
          <WalletCards />
        </div>

        {/* Payment History */}
        <PaymentHistory
          payments={paymentsData?.payments || []}
          isLoading={paymentsLoading}
        />
      </main>
    </div>
  );
}
