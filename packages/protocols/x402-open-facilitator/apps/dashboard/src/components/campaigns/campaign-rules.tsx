'use client';

import { differenceInDays, format } from 'date-fns';
import { Calendar, Clock, Gift, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Campaign } from '@/lib/api';

interface CampaignRulesProps {
  campaign: Campaign;
  userVolume: string;
  totalPoolVolume: string;
  isFacilitatorOwner: boolean;
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

function formatNumber(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function CampaignRules({
  campaign,
  userVolume,
  totalPoolVolume,
  isFacilitatorOwner,
}: CampaignRulesProps) {
  const now = new Date();
  const endsAt = new Date(campaign.ends_at);
  const startsAt = new Date(campaign.starts_at);
  const daysRemaining = differenceInDays(endsAt, now);
  const hasStarted = now >= startsAt;
  const hasEnded = now >= endsAt;

  const userVolumeNum = Number(userVolume) / 1_000_000;
  const thresholdNum = Number(campaign.threshold_amount) / 1_000_000;
  const poolAmountNum = Number(campaign.pool_amount) / 1_000_000;
  const totalVolumeNum = Number(totalPoolVolume) / 1_000_000;
  const multiplier = isFacilitatorOwner ? campaign.multiplier_facilitator : 1;

  // Apply multiplier to user volume for calculation
  const effectiveVolume = userVolumeNum * multiplier;
  const metThreshold = userVolumeNum >= thresholdNum;
  const remainingToThreshold = Math.max(0, thresholdNum - userVolumeNum);

  // Calculate user's share only if they met threshold and there's pool volume
  const userShare = metThreshold && totalVolumeNum > 0 ? effectiveVolume / totalVolumeNum : 0;
  const estimatedReward = userShare * poolAmountNum;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{campaign.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Active Rewards Campaign</p>
          </div>
          <Badge variant="default" className="bg-green-500">
            {hasEnded ? 'Ended' : hasStarted ? 'Active' : 'Upcoming'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campaign Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Gift className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{formatNumber(campaign.pool_amount)}</p>
            <p className="text-xs text-muted-foreground">$OPEN Pool</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{formatUSDC(campaign.threshold_amount)}</p>
            <p className="text-xs text-muted-foreground">Min. Volume</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{format(endsAt, 'MMM d')}</p>
            <p className="text-xs text-muted-foreground">End Date</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{hasEnded ? 'Ended' : `${daysRemaining}d`}</p>
            <p className="text-xs text-muted-foreground">{hasEnded ? 'Campaign Over' : 'Remaining'}</p>
          </div>
        </div>

        {/* 2x Multiplier Callout */}
        {campaign.multiplier_facilitator > 1 && (
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">
                  {campaign.multiplier_facilitator}x Volume Multiplier
                </p>
                <p className="text-sm text-muted-foreground">
                  {isFacilitatorOwner
                    ? 'Your volume is multiplied because you own a facilitator!'
                    : 'Facilitator owners get their volume multiplied. Create a facilitator to qualify!'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Threshold Status */}
        <div
          className={`rounded-lg p-4 ${
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
              Process {formatUSDC((remainingToThreshold * 1_000_000).toString())} more to qualify for
              rewards.
            </p>
          )}
        </div>

        {/* Worked Example */}
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-semibold">Your Estimated Reward</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your volume:</span>
              <span className="font-mono">{formatUSDC(userVolume)}</span>
            </div>
            {isFacilitatorOwner && campaign.multiplier_facilitator > 1 && (
              <div className="flex justify-between text-primary">
                <span>
                  With {campaign.multiplier_facilitator}x multiplier:
                </span>
                <span className="font-mono">
                  {formatUSDC((effectiveVolume * 1_000_000).toString())}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total pool volume:</span>
              <span className="font-mono">{formatUSDC(totalPoolVolume)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your share:</span>
              <span className="font-mono">
                {metThreshold ? `${(userShare * 100).toFixed(2)}%` : 'N/A (below threshold)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool amount:</span>
              <span className="font-mono">{formatNumber(campaign.pool_amount)} $OPEN</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between text-base font-semibold">
              <span>Estimated reward:</span>
              <span className="text-primary font-mono">
                {metThreshold
                  ? `${estimatedReward.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })} $OPEN`
                  : 'Reach threshold to qualify'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
