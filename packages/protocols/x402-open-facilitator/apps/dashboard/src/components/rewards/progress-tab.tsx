'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressDashboard } from './progress-dashboard';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

// Dynamic import with SSR disabled to avoid wallet context issues during hydration
const EnrollmentModal = dynamic(
  () => import('./enrollment-modal').then((mod) => mod.EnrollmentModal),
  { ssr: false }
);

export function ProgressTab() {
  const queryClient = useQueryClient();
  const { isFacilitatorOwner, refetchRewardsStatus } = useAuth();
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  // Fetch active campaign
  const { data: activeCampaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['activeCampaign'],
    queryFn: () => api.getActiveCampaign(),
  });

  // Fetch user's volume for this campaign
  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ['rewardsVolume', activeCampaign?.campaign?.id],
    queryFn: () => api.getRewardsVolume(activeCampaign!.campaign!.id),
    enabled: !!activeCampaign?.campaign?.id,
  });

  // Fetch volume breakdown by address
  const { data: breakdownData } = useQuery({
    queryKey: ['volumeBreakdown', activeCampaign?.campaign?.id],
    queryFn: () => api.getVolumeBreakdown(activeCampaign!.campaign!.id),
    enabled: !!activeCampaign?.campaign?.id,
  });

  // Fetch user's claim for this campaign
  const { data: claimData, isLoading: claimLoading } = useQuery({
    queryKey: ['myClaim', activeCampaign?.campaign?.id],
    queryFn: () => api.getMyClaim(activeCampaign!.campaign!.id),
    enabled: !!activeCampaign?.campaign?.id,
  });

  const handleClaimSuccess = () => {
    // Invalidate relevant queries after successful claim
    queryClient.invalidateQueries({ queryKey: ['myClaim', activeCampaign?.campaign?.id] });
    queryClient.invalidateQueries({ queryKey: ['claimHistory'] });
    queryClient.invalidateQueries({ queryKey: ['activeCampaign'] });
  };

  const handleEnrollmentModalClose = (open: boolean) => {
    setEnrollmentModalOpen(open);
    if (!open) {
      // Refetch when modal closes (in case address was added)
      queryClient.invalidateQueries({ queryKey: ['volumeBreakdown'] });
      queryClient.invalidateQueries({ queryKey: ['rewardsVolume'] });
      refetchRewardsStatus();
    }
  };

  // Loading state
  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No active campaign state
  if (!activeCampaign?.campaign) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Active Campaign</p>
          <p className="text-sm">
            There is no rewards campaign running at the moment. Check back later!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render progress dashboard
  return (
    <>
      <ProgressDashboard
        campaign={activeCampaign.campaign}
        userVolume={volumeLoading ? '0' : (volumeData?.totalVolume ?? '0')}
        totalPoolVolume={activeCampaign.totalVolume}
        isFacilitatorOwner={isFacilitatorOwner}
        volumeBreakdown={breakdownData ?? null}
        claim={claimLoading ? null : (claimData?.claim ?? null)}
        onClaimSuccess={handleClaimSuccess}
        onEnrollClick={() => setEnrollmentModalOpen(true)}
      />

      <EnrollmentModal
        open={enrollmentModalOpen}
        onOpenChange={handleEnrollmentModalClose}
      />
    </>
  );
}
