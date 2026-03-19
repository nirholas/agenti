'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { AddressList } from './address-list';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

// Dynamic import with SSR disabled to avoid wallet context issues during hydration
const EnrollmentModal = dynamic(
  () => import('./enrollment-modal').then((mod) => mod.EnrollmentModal),
  { ssr: false }
);

export function AddressesTab() {
  const queryClient = useQueryClient();
  const { refetchRewardsStatus } = useAuth();
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  // Fetch rewards status which includes addresses
  const { data: rewardsStatus, isLoading, refetch } = useQuery({
    queryKey: ['rewardsStatus'],
    queryFn: () => api.getRewardsStatus(),
  });

  const handleAddressRemoved = () => {
    // Refetch addresses and update auth context
    refetch();
    refetchRewardsStatus();
  };

  const handleModalClose = (open: boolean) => {
    setEnrollmentModalOpen(open);
    if (!open) {
      // Refetch when modal closes (in case address was added)
      refetch();
      refetchRewardsStatus();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <AddressList
        addresses={rewardsStatus?.addresses ?? []}
        onAddAddress={() => setEnrollmentModalOpen(true)}
        onAddressRemoved={handleAddressRemoved}
        onVerify={() => setEnrollmentModalOpen(true)}
      />

      <EnrollmentModal
        open={enrollmentModalOpen}
        onOpenChange={handleModalClose}
      />
    </>
  );
}
