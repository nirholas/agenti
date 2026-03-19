'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, DollarSign } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { SubscriptionStatusResponse } from '@/lib/api';

interface BillingCardProps {
  subscription: SubscriptionStatusResponse | null | undefined;
}

export function BillingCard({ subscription }: BillingCardProps) {
  const hasSubscription = subscription?.tier !== null && subscription?.tier !== undefined;
  const nextBillingDate = subscription?.expires
    ? formatDate(subscription.expires)
    : null;

  const facilitatorCount = subscription?.facilitatorCount || 0;
  const monthlyCost = subscription?.monthlyCost || 0;
  const costPerFacilitator = 5; // $5 per facilitator

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Billing Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription Cost */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Subscription Cost</p>
            <p className="text-lg font-semibold">
              ${monthlyCost > 0 ? monthlyCost : costPerFacilitator}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
            {facilitatorCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {facilitatorCount} facilitator{facilitatorCount !== 1 ? 's' : ''} × ${costPerFacilitator}
              </p>
            )}
          </div>
        </div>

        {/* Next Billing Date */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Next Billing Date</p>
            <p className="text-lg font-semibold">
              {nextBillingDate
                ? nextBillingDate
                : <span className="text-muted-foreground font-normal">—</span>
              }
            </p>
            {facilitatorCount > 0 && (
              <p className="text-xs text-muted-foreground">Billed monthly per facilitator</p>
            )}
          </div>
        </div>

        {/* Payment Method Note */}
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Payments are processed from your subscription wallets in USDC.
        </p>
      </CardContent>
    </Card>
  );
}
