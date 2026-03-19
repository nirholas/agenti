'use client';

import { useState } from 'react';
import { Trophy, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ProgressBar } from '@/components/rewards/progress-bar';
import { cn } from '@/lib/utils';

interface RewardsLandingPageProps {
  onEnroll: () => void;
}

export function RewardsLandingPage({ onEnroll }: RewardsLandingPageProps) {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header Section */}
      <div className="text-center mb-8">
        <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight">
          Get Rewarded for Using OpenFacilitator
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your payment volume and earn $OPEN tokens.
        </p>
      </div>

      {/* Progress Preview Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Your Reward Journey</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressBar current="500000000" threshold="1000000000" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Example: $500 of $1,000 threshold
          </p>
        </CardContent>
      </Card>

      {/* How It Works Collapsible */}
      <Collapsible
        open={isHowItWorksOpen}
        onOpenChange={setIsHowItWorksOpen}
        className="mb-6"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
          >
            <span>How are rewards calculated?</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200',
                isHowItWorksOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pt-4">
          <div className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Register your pay-to addresses</li>
              <li>Process payments through OpenFacilitator</li>
              <li>Meet the volume threshold for the campaign</li>
              <li>Claim your $OPEN tokens</li>
            </ol>
            <p className="border-l-2 border-primary pl-3">
              <strong className="text-foreground">Facilitator owners</strong> get a 2x multiplier on their effective volume.
            </p>
            <p>
              Rewards are distributed proportionally based on your share of total volume in the pool.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Get Started Button */}
      <Button onClick={onEnroll} className="w-full" size="lg">
        Get Started
      </Button>
    </div>
  );
}
