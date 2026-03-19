import { type ReactNode } from 'react';

export interface FeatureCardConfig {
  id: string;
  icon: 'shield' | 'globe' | 'gift';
  headline: string;
  description: string;
  ctaText: string;
  ctaHref?: string;
  onClick?: 'createFacilitator' | 'enrollRewards';
  badge?: string;
}

interface UserState {
  hasFacilitators: boolean;
  isEnrolled: boolean;
  firstFacilitatorId?: string;
}

export function getFeatureCards(userState: UserState): FeatureCardConfig[] {
  const { hasFacilitators, isEnrolled, firstFacilitatorId } = userState;

  // Refunds card
  const refundsCard: FeatureCardConfig = {
    id: 'refunds',
    icon: 'shield',
    headline: 'Refund Protection',
    description: 'Automatically refund customers when your API fails. Build trust and reduce disputes.',
    ctaText: hasFacilitators ? 'Configure →' : 'Get Started →',
    ctaHref: hasFacilitators && firstFacilitatorId
      ? `/dashboard/${firstFacilitatorId}?tab=refunds`
      : '/refunds/setup?facilitator=pay.openfacilitator.io',
  };

  // Own Facilitator card
  const facilitatorCard: FeatureCardConfig = {
    id: 'facilitator',
    icon: 'globe',
    headline: hasFacilitators ? 'Add Another Facilitator' : 'Run Your Own Facilitator',
    description: 'Accept payments on your own domain with full control. $5/month per facilitator.',
    ctaText: hasFacilitators ? 'Create New →' : 'Create Facilitator →',
    onClick: 'createFacilitator',
  };

  // Rewards card
  const rewardsCard: FeatureCardConfig = {
    id: 'rewards',
    icon: 'gift',
    headline: isEnrolled ? 'Rewards Program' : 'Earn $OPEN Rewards',
    description: isEnrolled
      ? "You're earning $OPEN on your payment volume."
      : 'Track your payment volume and earn $OPEN tokens automatically.',
    ctaText: isEnrolled ? 'View Progress →' : 'Get Started →',
    ctaHref: isEnrolled ? '/rewards' : undefined,
    onClick: isEnrolled ? undefined : 'enrollRewards',
  };

  // Return cards in appropriate order based on user state
  // Per PRD:
  // Free user, not enrolled: Rewards, Own Facilitator, Refunds
  // Free user, enrolled: Own Facilitator, Refunds, Rewards (View Progress)
  // Paying user, not enrolled: Rewards, Refunds, Own Facilitator (Add Another)
  // Paying user, enrolled: Refunds, Own Facilitator (Add Another), Rewards (View Progress)

  if (!hasFacilitators && !isEnrolled) {
    return [rewardsCard, facilitatorCard, refundsCard];
  }

  if (!hasFacilitators && isEnrolled) {
    return [facilitatorCard, refundsCard, rewardsCard];
  }

  if (hasFacilitators && !isEnrolled) {
    return [rewardsCard, refundsCard, facilitatorCard];
  }

  // hasFacilitators && isEnrolled
  return [refundsCard, facilitatorCard, rewardsCard];
}
