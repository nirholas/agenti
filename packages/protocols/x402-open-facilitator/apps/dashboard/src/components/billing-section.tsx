'use client';

import { Wallet } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Facilitator } from '@/lib/api';

interface BillingSectionProps {
  facilitators: Facilitator[];
  walletBalance: string;
  subscription?: {
    active: boolean;
    expires: string | null;
  };
}

function getEarliestExpiry(subscription?: { expires: string | null }): Date | null {
  if (!subscription?.expires) return null;
  return new Date(subscription.expires);
}

export function BillingSection({ facilitators, walletBalance, subscription }: BillingSectionProps) {
  const totalMonthly = facilitators.length * 5;
  const nextCharge = getEarliestExpiry(subscription);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Billing Summary */}
      <div className="border border-border rounded-lg p-5 bg-card">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Billing
        </p>
        <p className="text-2xl font-bold">
          ${totalMonthly}<span className="text-sm font-normal text-muted-foreground">/month</span>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {facilitators.length} facilitator{facilitators.length !== 1 ? 's' : ''} × $5
        </p>
        {nextCharge && (
          <p className="text-sm text-muted-foreground">
            Next charge: {formatDate(nextCharge.toISOString())}
          </p>
        )}
      </div>

      {/* Billing Wallet */}
      <div className="border border-border rounded-lg p-5 bg-card">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
          Billing Wallet
        </p>
        <p className="text-2xl font-bold">${walletBalance}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <Wallet className="w-4 h-4" />
          <span>USDC on Solana</span>
        </div>
      </div>
    </div>
  );
}
