/**
 * Reward Claims Service
 *
 * Provides eligibility checking, reward calculation, and claim record management.
 * Used to determine if users can claim rewards for campaigns and how much they receive.
 */

import { getCampaignById } from '../db/campaigns.js';
import { getUserTotalVolume } from '../db/volume-aggregation.js';
import {
  getRewardClaimByUserAndCampaign,
  createRewardClaim,
} from '../db/reward-claims.js';
import { isFacilitatorOwner } from '../db/facilitators.js';
import { getTotalQualifyingVolume } from '../db/reward-claims.js';
import type { RewardClaimRecord, CampaignRecord } from '../db/types.js';

/**
 * Eligibility check result
 */
export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  claim?: RewardClaimRecord;
  calculatedReward?: {
    baseReward: string;
    finalReward: string;
    multiplier: number;
  };
}

/**
 * Reward calculation result
 */
export interface RewardCalculation {
  baseReward: string;
  finalReward: string;
  effectiveMultiplier: number;
}

/**
 * Check if a user is eligible to claim rewards for a campaign
 *
 * Eligibility criteria:
 * 1. Campaign exists and has ended (now >= ends_at)
 * 2. Within 30-day claim window (now <= ends_at + 30 days)
 * 3. User met volume threshold (volume >= threshold_amount)
 * 4. No existing completed claim
 *
 * @param userId - The user ID
 * @param campaignId - The campaign ID
 * @returns Eligibility result with reason if not eligible
 */
export function checkClaimEligibility(
  userId: string,
  campaignId: string
): EligibilityResult {
  // Get campaign
  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    return { eligible: false, reason: 'Campaign not found' };
  }

  const now = new Date();
  const endsAt = new Date(campaign.ends_at);
  const claimDeadline = new Date(endsAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after end

  // Check campaign has ended
  if (now < endsAt) {
    return { eligible: false, reason: 'Campaign has not ended yet' };
  }

  // Check claim window hasn't expired
  if (now > claimDeadline) {
    return {
      eligible: false,
      reason: 'Claim window has expired (30 days after campaign end)',
    };
  }

  // Check for existing claim
  const existingClaim = getRewardClaimByUserAndCampaign(userId, campaignId);
  if (existingClaim) {
    if (existingClaim.status === 'completed') {
      return {
        eligible: false,
        reason: 'Already claimed',
        claim: existingClaim,
      };
    }
    // Return existing pending/processing/failed claim
    return { eligible: true, claim: existingClaim };
  }

  // Get user's volume for this campaign
  const volumeData = getUserTotalVolume(userId, campaignId);
  const userVolume = BigInt(volumeData.total_volume);
  const thresholdAmount = BigInt(campaign.threshold_amount);

  // Check threshold met
  if (userVolume < thresholdAmount) {
    const remaining = thresholdAmount - userVolume;
    return {
      eligible: false,
      reason: `Volume below threshold: ${formatUSDC(remaining.toString())} more needed`,
    };
  }

  // User is eligible - calculate reward
  const isOwner = isFacilitatorOwner(userId);
  const totalPoolVolume = getTotalQualifyingVolume(campaignId);

  // Calculate reward
  const reward = calculateReward({
    userVolume: volumeData.total_volume,
    totalPoolVolume,
    poolAmount: campaign.pool_amount,
    isFacilitatorOwner: isOwner,
    multiplier: campaign.multiplier_facilitator,
  });

  return {
    eligible: true,
    calculatedReward: {
      baseReward: reward.baseReward,
      finalReward: reward.finalReward,
      multiplier: reward.effectiveMultiplier,
    },
  };
}

/**
 * Calculate user's reward based on their proportional share of the pool
 *
 * Formula: (effectiveVolume / totalPoolVolume) * poolAmount
 * Where effectiveVolume = userVolume * multiplier (if facilitator owner)
 *
 * Uses BigInt for precision - all amounts are strings representing atomic units.
 *
 * @param params - Calculation parameters
 * @returns Base reward, final reward, and effective multiplier
 */
export function calculateReward(params: {
  userVolume: string;
  totalPoolVolume: string;
  poolAmount: string;
  isFacilitatorOwner: boolean;
  multiplier: number;
}): RewardCalculation {
  const {
    userVolume,
    totalPoolVolume,
    poolAmount,
    isFacilitatorOwner,
    multiplier,
  } = params;

  // Convert to BigInt
  const userVolumeBigInt = BigInt(userVolume);
  const totalPoolVolumeBigInt = BigInt(totalPoolVolume);
  const poolAmountBigInt = BigInt(poolAmount);

  // Handle edge case: no pool volume
  if (totalPoolVolumeBigInt === 0n) {
    return {
      baseReward: '0',
      finalReward: '0',
      effectiveMultiplier: isFacilitatorOwner ? multiplier : 1,
    };
  }

  // Apply multiplier for facilitator owners
  // Use fixed-point arithmetic: multiply by 100, then divide by 100
  const effectiveMultiplier = isFacilitatorOwner ? multiplier : 1;
  const multiplierScaled = BigInt(Math.floor(effectiveMultiplier * 100));

  // Calculate effective volume with multiplier
  const effectiveVolume = (userVolumeBigInt * multiplierScaled) / 100n;

  // Calculate base reward (without multiplier): (userVolume / totalPoolVolume) * poolAmount
  // Use scaled arithmetic to avoid precision loss: (userVolume * poolAmount) / totalPoolVolume
  const baseReward = (userVolumeBigInt * poolAmountBigInt) / totalPoolVolumeBigInt;

  // Calculate final reward (with multiplier): (effectiveVolume / totalPoolVolume) * poolAmount
  // Note: totalPoolVolume should ideally include all effective volumes, but for simplicity
  // we use user's effective volume vs total raw volume (this gives facilitators bonus)
  const finalReward = (effectiveVolume * poolAmountBigInt) / totalPoolVolumeBigInt;

  return {
    baseReward: baseReward.toString(),
    finalReward: finalReward.toString(),
    effectiveMultiplier,
  };
}

/**
 * Create or get existing claim record for a user/campaign
 *
 * If claim exists, returns it. Otherwise creates new claim with calculated amounts.
 *
 * @param userId - The user ID
 * @param campaignId - The campaign ID
 * @param calculatedReward - Pre-calculated reward amounts
 * @returns The claim record (existing or newly created)
 */
export function createOrGetClaimRecord(
  userId: string,
  campaignId: string,
  calculatedReward: {
    baseReward: string;
    finalReward: string;
    multiplier: number;
  }
): RewardClaimRecord | null {
  // Check for existing claim
  const existing = getRewardClaimByUserAndCampaign(userId, campaignId);
  if (existing) {
    return existing;
  }

  // Get user's volume for the claim record
  const volumeData = getUserTotalVolume(userId, campaignId);

  // Create new claim with status='pending'
  const claim = createRewardClaim({
    user_id: userId,
    campaign_id: campaignId,
    volume_amount: volumeData.total_volume,
    base_reward_amount: calculatedReward.baseReward,
    multiplier: calculatedReward.multiplier,
    final_reward_amount: calculatedReward.finalReward,
  });

  return claim;
}

/**
 * Format USDC amount for display (atomic units to human readable)
 * USDC uses 6 decimals
 */
function formatUSDC(amount: string): string {
  const value = Number(amount) / 1_000_000;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
