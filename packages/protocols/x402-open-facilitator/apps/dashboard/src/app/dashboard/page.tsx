'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type Facilitator } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { Navbar } from '@/components/navbar';
import { useToast } from '@/hooks/use-toast';
import { FacilitatorCard } from '@/components/facilitator-card';
import { CreateFacilitatorCard } from '@/components/create-facilitator-card';
import { CreateFacilitatorModal } from '@/components/create-facilitator-modal';
import { BillingSection } from '@/components/billing-section';
import { EmptyState } from '@/components/empty-state';
import { RewardsInfoBanner } from '@/components/rewards-info-banner';
import { FeaturesSpotlight } from '@/components/dashboard/FeaturesSpotlight';

const FREE_ENDPOINT = 'https://pay.openfacilitator.io';

// Free Endpoint Section
function FreeEndpointSection() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(FREE_ENDPOINT);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Free endpoint URL copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-2 border-dashed border-border rounded-lg p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1">Don't need your own domain?</p>
          <p className="font-mono">{FREE_ENDPOINT}</p>
          <p className="text-sm text-muted-foreground">Just use ours · No setup needed</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy URL
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, isEnrolled } = useAuth();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  const { data: facilitators, isLoading } = useQuery({
    queryKey: ['facilitators'],
    queryFn: () => api.getFacilitators(),
    enabled: isAuthenticated,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.getSubscriptionStatus(),
    enabled: isAuthenticated,
  });

  const { data: billingWallet } = useQuery({
    queryKey: ['billingWallet'],
    queryFn: () => api.getBillingWallet(),
    enabled: isAuthenticated,
  });

  const handleCreateSuccess = (facilitator: Facilitator) => {
    queryClient.invalidateQueries({ queryKey: ['facilitators'] });
    // Navigate directly to detail page where DNS banner will show if needed
    router.push(`/dashboard/${facilitator.id}`);
  };

  const handleManageClick = (facilitator: Facilitator) => {
    // Always navigate to detail page - DNS status shown as banner there
    router.push(`/dashboard/${facilitator.id}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const hasFacilitators = facilitators && facilitators.length > 0;
  const walletBalance = billingWallet?.hasWallet ? billingWallet.balance : '0.00';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Your Facilitators</h1>
            {hasFacilitators && (
              <p className="text-muted-foreground mt-1">
                {facilitators.length} facilitator{facilitators.length !== 1 ? 's' : ''} · ${facilitators.length * 5}/month
              </p>
            )}
          </div>
          {hasFacilitators && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Facilitator
            </Button>
          )}
        </div>

        {/* Rewards Info Banner */}
        <RewardsInfoBanner />

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border rounded-lg p-5 animate-pulse">
                <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2 mb-4" />
                <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                <div className="h-8 bg-muted rounded w-1/3 mt-4" />
              </div>
            ))}
          </div>
        ) : hasFacilitators ? (
          /* Facilitator Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {facilitators.map((facilitator) => (
              <FacilitatorCard
                key={facilitator.id}
                facilitator={facilitator}
                onManageClick={() => handleManageClick(facilitator)}
              />
            ))}
            <CreateFacilitatorCard onClick={() => setIsCreateOpen(true)} />
          </div>
        ) : (
          /* Empty State */
          <div className="mb-12">
            <EmptyState onCreateClick={() => setIsCreateOpen(true)} />
          </div>
        )}

        {/* Features Spotlight */}
        <FeaturesSpotlight
          hasFacilitators={!!hasFacilitators}
          isEnrolled={isEnrolled}
          firstFacilitatorId={facilitators?.[0]?.id}
          onCreateFacilitator={() => setIsCreateOpen(true)}
        />

        {/* Shared Facilitator Option */}
        <div className="mb-12">
          <FreeEndpointSection />
        </div>

        {/* Billing Section (only show if has facilitators) */}
        {hasFacilitators && (
          <div className="mb-12">
            <BillingSection
              facilitators={facilitators}
              walletBalance={walletBalance}
              subscription={subscription}
            />
          </div>
        )}

        {/* Docs Link */}
        <div className="text-center">
          <Link
            href="/docs"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View Documentation →
          </Link>
        </div>
      </main>

      {/* Create Facilitator Modal */}
      <CreateFacilitatorModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={handleCreateSuccess}
        walletBalance={walletBalance}
      />
    </div>
  );
}
