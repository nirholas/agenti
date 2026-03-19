'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import type { SubscriptionStatusResponse } from '@/lib/api';

type SubscriptionState = 'active' | 'pending' | 'inactive' | 'never';

const statusConfig = {
  active: {
    icon: CheckCircle,
    label: 'Active',
    description: 'Your subscription is active',
    className: 'text-green-600 dark:text-green-400',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    description: 'Payment pending or in grace period',
    className: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  inactive: {
    icon: XCircle,
    label: 'Expired',
    description: 'Your subscription has expired',
    className: 'text-red-600 dark:text-red-400',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  never: {
    icon: AlertCircle,
    label: 'No Facilitators',
    description: 'Create a facilitator to start your subscription',
    className: 'text-gray-600 dark:text-gray-400',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

interface StatusCardProps {
  subscription: SubscriptionStatusResponse | null | undefined;
  onSubscribe?: () => void;
  isSubscribing?: boolean;
  onReactivate?: () => void;
  isReactivating?: boolean;
}

export function StatusCard({
  subscription,
  onSubscribe,
  isSubscribing,
  onReactivate,
  isReactivating
}: StatusCardProps) {
  const state = subscription?.state || 'never';
  const config = statusConfig[state];
  const Icon = config.icon;

  // Calculate urgency for grace period countdown
  const daysRemaining = subscription?.gracePeriod?.daysRemaining || 0;
  const isUrgent = daysRemaining <= 2;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Subscription Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Icon className={`w-8 h-8 ${config.className}`} />
          <div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${config.badgeClass}`}>
              {config.label}
            </span>
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
          </div>
        </div>

        {state === 'active' && subscription?.facilitatorCount && subscription.facilitatorCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {subscription.facilitatorCount} active facilitator{subscription.facilitatorCount !== 1 ? 's' : ''}
          </p>
        )}

        {state === 'active' && subscription?.expires && !subscription?.facilitatorCount && (
          <p className="text-sm text-muted-foreground">
            Expires {new Date(subscription.expires).toLocaleDateString()}
          </p>
        )}

        {state === 'pending' && subscription?.gracePeriod && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 p-3 rounded-lg ${isUrgent ? 'bg-red-50 dark:bg-red-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <div>
                <p className={`text-sm font-medium ${isUrgent ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'}`}>
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left to fund wallet
                </p>
                <p className={`text-xs ${isUrgent ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  Fund your wallet to continue service
                </p>
              </div>
            </div>
            {onReactivate && (
              <Button
                onClick={onReactivate}
                className="w-full"
                disabled={isReactivating}
                variant={isUrgent ? 'destructive' : 'default'}
              >
                {isReactivating ? 'Processing...' : 'Reactivate Now'}
              </Button>
            )}
          </div>
        )}

        {state === 'inactive' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Your subscription has expired
            </p>
            {onSubscribe && (
              <Button
                onClick={onSubscribe}
                className="w-full"
                disabled={isSubscribing}
              >
                {isSubscribing ? 'Processing...' : 'Subscribe'}
              </Button>
            )}
          </div>
        )}

        {state === 'never' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Each facilitator you create is a $5/month subscription
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
