'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Shield, Globe, Gift } from 'lucide-react';
import { FeatureCard } from './FeatureCard';
import { getFeatureCards, type FeatureCardConfig } from './featureCards';

// Dynamic import with SSR disabled to avoid wallet context issues during hydration
const EnrollmentModal = dynamic(
  () => import('@/components/rewards/enrollment-modal').then((mod) => mod.EnrollmentModal),
  { ssr: false }
);

interface FeaturesSpotlightProps {
  hasFacilitators: boolean;
  isEnrolled: boolean;
  firstFacilitatorId?: string;
  onCreateFacilitator: () => void;
}

const iconMap = {
  shield: <Shield className="w-5 h-5" />,
  globe: <Globe className="w-5 h-5" />,
  gift: <Gift className="w-5 h-5" />,
};

export function FeaturesSpotlight({
  hasFacilitators,
  isEnrolled,
  firstFacilitatorId,
  onCreateFacilitator,
}: FeaturesSpotlightProps) {
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);

  const cards = getFeatureCards({
    hasFacilitators,
    isEnrolled,
    firstFacilitatorId,
  });

  const handleCardAction = (card: FeatureCardConfig) => {
    if (card.onClick === 'createFacilitator') {
      onCreateFacilitator();
    } else if (card.onClick === 'enrollRewards') {
      setEnrollmentOpen(true);
    }
  };

  return (
    <>
      <div className="my-8">
        <div className="flex flex-col md:flex-row gap-4">
          {cards.map((card) => (
            <FeatureCard
              key={card.id}
              icon={iconMap[card.icon]}
              headline={card.headline}
              description={card.description}
              ctaText={card.ctaText}
              ctaHref={card.ctaHref}
              onClick={card.onClick ? () => handleCardAction(card) : undefined}
              badge={card.badge}
            />
          ))}
        </div>
      </div>

      <EnrollmentModal
        open={enrollmentOpen}
        onOpenChange={setEnrollmentOpen}
      />
    </>
  );
}
