'use client';

import { useEffect, useState } from 'react';
import { differenceInDays } from 'date-fns';
import { Clock, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressBar } from './progress-bar';
import { RewardEstimate } from './reward-estimate';
import { AddressBreakdown } from './address-breakdown';
import { ClaimButton } from './claim-button';
import { api, type Campaign, type VolumeBreakdown, type RewardClaim } from '@/lib/api';

interface ProgressDashboardProps {
  campaign: Campaign;
  userVolume: string;
  totalPoolVolume: string;
  isFacilitatorOwner: boolean;
  volumeBreakdown: VolumeBreakdown | null;
  claim: RewardClaim | null;
  onClaimSuccess?: () => void;
  onEnrollClick?: () => void;
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

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ProgressDashboard({
  campaign,
  userVolume,
  totalPoolVolume,
  isFacilitatorOwner,
  volumeBreakdown,
  claim: initialClaim,
  onClaimSuccess,
  onEnrollClick,
}: ProgressDashboardProps) {
  const [claim, setClaim] = useState<RewardClaim | null>(initialClaim);
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const now = new Date();
  const endsAt = new Date(campaign.ends_at);
  const hasEnded = now >= endsAt;
  const daysRemaining = Math.max(0, differenceInDays(endsAt, now));

  const userVolumeNum = Number(userVolume) / 1_000_000;
  const thresholdNum = Number(campaign.threshold_amount) / 1_000_000;
  const poolAmountNum = Number(campaign.pool_amount) / 1_000_000;
  const totalVolumeNum = Number(totalPoolVolume) / 1_000_000;
  const multiplier = isFacilitatorOwner ? campaign.multiplier_facilitator : 1;

  // Apply multiplier to user volume for calculation
  const effectiveVolume = userVolumeNum * multiplier;
  const metThreshold = userVolumeNum >= thresholdNum;
  const remainingToThreshold = Math.max(0, thresholdNum - userVolumeNum);

  // Calculate user's share only if there's pool volume
  // Cap at 10% of pool - no single user can claim more than 1/10th
  const userShare = totalVolumeNum > 0 ? effectiveVolume / totalVolumeNum : 0;
  const maxReward = poolAmountNum / 10;
  const estimatedReward = Math.min(userShare * poolAmountNum, maxReward);

  // Check eligibility and create claim record when campaign has ended
  useEffect(() => {
    async function checkEligibility() {
      if (!hasEnded || claim) return;

      setCheckingEligibility(true);
      try {
        const result = await api.getClaimEligibility(campaign.id);

        if (result.eligible && result.claim) {
          setClaim(result.claim);
        } else if (!result.eligible && result.reason) {
          setEligibilityReason(result.reason);
        }
      } catch (error) {
        console.error('Failed to check eligibility:', error);
      } finally {
        setCheckingEligibility(false);
      }
    }

    checkEligibility();
  }, [hasEnded, claim, campaign.id]);

  // Update claim state when initialClaim prop changes
  useEffect(() => {
    setClaim(initialClaim);
  }, [initialClaim]);

  // Campaign ended state
  if (hasEnded) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Campaign Ended</h3>

          {/* Checking eligibility */}
          {checkingEligibility && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking eligibility...</span>
            </div>
          )}

          {/* User met threshold and has a pending claim */}
          {claim && claim.status === 'pending' && (
            <>
              <p className="text-green-600 dark:text-green-400 font-medium mb-6">
                Congratulations! You met the threshold and earned rewards.
              </p>
              <ClaimButton
                claimId={claim.id}
                rewardAmount={claim.final_reward_amount}
                onSuccess={onClaimSuccess}
              />
            </>
          )}

          {/* Claim is processing */}
          {claim && claim.status === 'processing' && (
            <>
              <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">Claim in progress...</span>
              </div>
              {claim.claim_wallet && (
                <p className="text-sm text-muted-foreground">
                  Tokens will be sent to{' '}
                  <a
                    href={`https://solscan.io/account/${claim.claim_wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {truncateAddress(claim.claim_wallet)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
            </>
          )}

          {/* Claim completed */}
          {claim && claim.status === 'completed' && (
            <>
              <p className="text-green-600 dark:text-green-400 font-medium mb-2">
                Rewards claimed successfully!
              </p>
              {claim.claim_wallet && (
                <p className="text-sm text-muted-foreground">
                  Sent to{' '}
                  <a
                    href={`https://solscan.io/account/${claim.claim_wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {truncateAddress(claim.claim_wallet)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
              {claim.tx_signature && (
                <a
                  href={`https://solscan.io/tx/${claim.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  View transaction
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          )}

          {/* Claim failed */}
          {claim && claim.status === 'failed' && (
            <p className="text-red-600 dark:text-red-400 font-medium">
              There was an issue processing your claim. Please contact support.
            </p>
          )}

          {/* Show specific reason for ineligibility */}
          {!claim && !checkingEligibility && eligibilityReason && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Not Eligible</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {eligibilityReason}
              </p>
            </div>
          )}

          {/* User did not meet threshold (fallback if eligibility API not yet called) */}
          {!claim && !checkingEligibility && !eligibilityReason && !metThreshold && (
            <p className="text-muted-foreground">
              You did not meet the volume threshold for this campaign.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Your Progress</h3>
          <ProgressBar
            current={userVolume}
            threshold={campaign.threshold_amount}
            className="mb-4"
          />

          {/* Threshold Status Message */}
          <div
            className={`rounded-lg p-4 mt-4 ${
              metThreshold
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {metThreshold ? (
              <p className="font-medium text-green-700 dark:text-green-400">
                You've reached the threshold! You're eligible for rewards.
              </p>
            ) : (
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Keep going! {formatUSDC((remainingToThreshold * 1_000_000).toString())} more to qualify for rewards.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reward Estimate */}
      <Card>
        <CardContent className="py-4">
          <RewardEstimate
            estimatedReward={estimatedReward}
            metThreshold={metThreshold}
            hasMultiplier={isFacilitatorOwner && campaign.multiplier_facilitator > 1}
            multiplier={campaign.multiplier_facilitator}
          />
        </CardContent>
      </Card>

      {/* Days Remaining */}
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

      {/* Address Breakdown */}
      {volumeBreakdown && (
        <AddressBreakdown
          addresses={volumeBreakdown.addresses}
          totalVolume={volumeBreakdown.totalVolume}
          onEnrollClick={onEnrollClick}
        />
      )}
    </div>
  );
}
