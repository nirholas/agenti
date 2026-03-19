'use client';

import { Trophy, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProgressTab } from './progress-tab';
import { useAuth } from '@/components/auth/auth-provider';

export function RewardsDashboard() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            Rewards
          </h1>
          <p className="text-muted-foreground mt-2">
            Earn{' '}
            <a
              href="https://www.coingecko.com/en/coins/openfacilitator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              $OPEN
            </a>
            {' '}by processing your application's x402 payments with OpenFacilitator.
          </p>
        </div>
        {isAdmin && (
          <Link href="/rewards/admin">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Manage Campaigns
            </Button>
          </Link>
        )}
      </div>

      {/* Content */}
      <ProgressTab />
    </div>
  );
}
