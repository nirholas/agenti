'use client';

import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

interface RewardEstimateProps {
  estimatedReward: number;
  metThreshold: boolean;
  hasMultiplier: boolean;
  multiplier: number;
}

export function RewardEstimate({
  estimatedReward,
  metThreshold,
  hasMultiplier,
  multiplier,
}: RewardEstimateProps) {
  const formattedReward = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(estimatedReward));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {metThreshold ? 'Est. Reward:' : 'If you qualify:'}
        </span>
        <span className="text-lg font-bold text-primary">
          ~{formattedReward} $OPEN
        </span>
        {hasMultiplier && (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
            <Zap className="h-3 w-3 mr-1" />
            {multiplier}x
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        *based on current volume
      </p>
    </div>
  );
}
