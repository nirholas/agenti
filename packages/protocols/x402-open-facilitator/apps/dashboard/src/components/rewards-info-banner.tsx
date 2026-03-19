'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { AddressList } from '@/components/rewards/address-list';
import { api, type RewardsStatus } from '@/lib/api';
import { ChevronDown, ChevronUp, Wallet, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Dynamic import with SSR disabled to avoid wallet context issues during hydration
const EnrollmentModal = dynamic(
  () => import('@/components/rewards/enrollment-modal').then((mod) => mod.EnrollmentModal),
  { ssr: false }
);

export function RewardsInfoBanner() {
  const { isAuthenticated, isEnrolled, isFacilitatorOwner, refetchRewardsStatus } = useAuth();
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [addresses, setAddresses] = useState<RewardsStatus['addresses']>([]);
  const [expanded, setExpanded] = useState(false);

  // Fetch addresses when component mounts or enrollment changes
  useEffect(() => {
    if (isAuthenticated) {
      api.getRewardsStatus().then((status) => {
        setAddresses(status.addresses);
      }).catch(console.error);
    }
  }, [isAuthenticated, isEnrolled]);

  const handleAddressRemoved = async () => {
    // Refetch addresses after removal
    const status = await api.getRewardsStatus();
    setAddresses(status.addresses);
    await refetchRewardsStatus();
  };

  const handleEnrollmentClose = async (open: boolean) => {
    setEnrollmentOpen(open);
    if (!open) {
      // Refetch when modal closes (in case address was added)
      const status = await api.getRewardsStatus();
      setAddresses(status.addresses);
    }
  };

  // Don't show if not authenticated
  if (!isAuthenticated) return null;

  // If enrolled, show status section
  if (isEnrolled) {
    // Facilitator owners are auto-enrolled - show simplified view
    if (isFacilitatorOwner) {
      return (
        <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-primary">Rewards Program</h3>
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                Enrolled
              </span>
            </div>
            <Link
              href="/rewards"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Progress
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      );
    }

    // Free tier users see address management
    return (
      <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-primary">Rewards Program</h3>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
              Enrolled
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/rewards"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View Progress
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="ml-1">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</span>
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <AddressList
              addresses={addresses}
              onAddAddress={() => setEnrollmentOpen(true)}
              onAddressRemoved={handleAddressRemoved}
              onVerify={() => setEnrollmentOpen(true)}
            />
          </div>
        )}

        <EnrollmentModal
          open={enrollmentOpen}
          onOpenChange={handleEnrollmentClose}
        />
      </div>
    );
  }

  // Not enrolled (free tier only - facilitator owners are auto-enrolled)
  return (
    <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Wallet className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold text-primary">Earn $OPEN Rewards</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Track payment volume and earn $OPEN tokens. Connect your pay-to wallet to get started.
            </p>
          </div>
        </div>
        <Button onClick={() => setEnrollmentOpen(true)}>
          Get Started
        </Button>
      </div>

      <EnrollmentModal
        open={enrollmentOpen}
        onOpenChange={handleEnrollmentClose}
      />
    </div>
  );
}
