'use client';

import { useQuery } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';
import { Clock, Trophy, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/rewards/progress-bar';
import { api } from '@/lib/api';

interface FacilitatorRewardsSectionProps {
  facilitatorId: string;
}

function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function FacilitatorRewardsSection({ facilitatorId }: FacilitatorRewardsSectionProps) {
  // Fetch active campaign
  const { data: campaignData, isLoading: campaignLoading } = useQuery({
    queryKey: ['activeCampaign'],
    queryFn: () => api.getActiveCampaign(),
  });

  // Fetch this facilitator's volume
  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ['facilitatorVolume', facilitatorId, campaignData?.campaign?.id],
    queryFn: () => api.getFacilitatorVolume(facilitatorId, campaignData!.campaign!.id),
    enabled: !!campaignData?.campaign?.id,
  });

  // Loading state
  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No active campaign
  if (!campaignData?.campaign) {
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

  const campaign = campaignData.campaign;
  const totalPoolVolume = campaignData.totalVolume;

  const now = new Date();
  const endsAt = new Date(campaign.ends_at);
  const hasEnded = now >= endsAt;
  const daysRemaining = Math.max(0, differenceInDays(endsAt, now));

  const facilitatorVolume = volumeData?.volume ?? '0';
  const facilitatorVolumeNum = Number(facilitatorVolume) / 1_000_000;
  const thresholdNum = Number(campaign.threshold_amount) / 1_000_000;
  const poolAmountNum = Number(campaign.pool_amount) / 1_000_000;
  const totalVolumeNum = Number(totalPoolVolume) / 1_000_000;

  // Facilitators always get 2x multiplier
  const multiplier = campaign.multiplier_facilitator;
  const effectiveVolume = facilitatorVolumeNum * multiplier;
  const metThreshold = facilitatorVolumeNum >= thresholdNum;
  const remainingToThreshold = Math.max(0, thresholdNum - facilitatorVolumeNum);

  // Calculate estimated reward (capped at 10% of pool)
  const userShare = totalVolumeNum > 0 ? effectiveVolume / totalVolumeNum : 0;
  const maxReward = poolAmountNum / 10;
  const estimatedReward = Math.min(userShare * poolAmountNum, maxReward);
  const formattedReward = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(estimatedReward));

  // Campaign ended state
  if (hasEnded) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Campaign Ended</h3>
          <p className="text-muted-foreground">
            This facilitator processed {formatUSDC(facilitatorVolume)} during the campaign.
          </p>
          {metThreshold ? (
            <p className="text-green-600 dark:text-green-400 font-medium mt-2">
              Threshold was met! Rewards can be claimed on the Rewards page.
            </p>
          ) : (
            <p className="text-muted-foreground mt-2">
              Did not meet the {formatUSDC(campaign.threshold_amount)} volume threshold.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Volume Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Rewards Progress
            </CardTitle>
            <Badge variant="secondary" className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              {multiplier}x multiplier
            </Badge>
          </div>
          <CardDescription>
            Track this facilitator's volume toward the rewards threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {volumeLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ProgressBar
                current={facilitatorVolume}
                threshold={campaign.threshold_amount}
              />

              {/* Threshold Status Message */}
              <div
                className={`rounded-lg p-4 ${
                  metThreshold
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {metThreshold ? (
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Threshold reached! This facilitator is eligible for rewards.
                  </p>
                ) : (
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    {formatUSDC((remainingToThreshold * 1_000_000).toString())} more volume needed to qualify
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Estimated Reward Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimated Reward</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">
              ~{formattedReward} $OPEN
            </span>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              {multiplier}x applied
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            *based on current volume ({formatUSDC(facilitatorVolume)} × {multiplier} = {formatUSDC((facilitatorVolumeNum * multiplier * 1_000_000).toString())} effective)
          </p>
          {!metThreshold && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Must meet threshold to be eligible
            </p>
          )}
        </CardContent>
      </Card>

      {/* Campaign Info Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
