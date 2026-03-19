import cron from 'node-cron';
import {
  getDueSubscriptions,
  getSubscriptionsExpiringInDays,
  isInGracePeriod,
} from '../db/subscriptions.js';
import {
  createNotification,
  hasRecentNotificationOfType,
} from '../db/notifications.js';
import { processSubscriptionPayment } from './subscription-billing.js';

/**
 * Initialize the billing cron job
 * Runs daily at midnight UTC to process subscription renewals
 */
export function initializeBillingCron(): void {
  // Run at midnight UTC every day
  cron.schedule('0 0 * * *', async () => {
    console.log('[Billing Cron] Starting daily billing process');
    try {
      await runBillingCycle();
    } catch (error) {
      console.error('[Billing Cron] CRITICAL: Billing cycle failed with unhandled error:', error);
      // Don't rethrow - prevent crashing the server
    }
  }, {
    timezone: 'UTC',
  });

  console.log('📅 Billing cron initialized (runs daily at midnight UTC)');
}

/**
 * Run the billing cycle - can be called manually or by cron
 */
export async function runBillingCycle(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  insufficientFunds: number;
}> {
  const startTime = Date.now();

  // Send 3-day expiration reminders
  const expiringIn3Days = getSubscriptionsExpiringInDays(3);
  console.log(`[Billing Cron] Found ${expiringIn3Days.length} subscriptions expiring in 3 days`);

  for (const sub of expiringIn3Days) {
    // Skip if already in grace period (shouldn't happen but be safe)
    if (!isInGracePeriod(sub.user_id)) {
      // Only create if no recent expiration_reminder in last 72h
      if (!hasRecentNotificationOfType(sub.user_id, 'expiration_reminder', 72)) {
        createNotification(
          sub.user_id,
          'expiration_reminder',
          'Subscription Expiring Soon',
          'Your subscription will expire in 3 days. Ensure your wallet is funded to avoid interruption.',
          'warning',
          { expiresAt: sub.expires_at }
        );
        console.log(`[Billing Cron] Sent expiration reminder to user ${sub.user_id}`);
      }
    }
  }

  // Get all subscriptions that are due for billing
  const dueSubscriptions = getDueSubscriptions();
  console.log(`[Billing Cron] Found ${dueSubscriptions.length} due subscriptions`);

  let succeeded = 0;
  let failed = 0;
  let insufficientFunds = 0;

  // Process each due subscription
  for (const subscription of dueSubscriptions) {
    console.log(`[Billing Cron] Processing subscription ${subscription.id} for user ${subscription.user_id}`);

    try {
      const result = await processSubscriptionPayment(subscription.user_id);

      if (result.success) {
        succeeded++;
        console.log(`[Billing Cron] ✓ Payment successful for user ${subscription.user_id}`);
      } else if (result.insufficientBothChains) {
        insufficientFunds++;
        console.log(`[Billing Cron] ⚠ Insufficient balance for user ${subscription.user_id}`);
      } else {
        failed++;
        console.error(`[Billing Cron] ✗ Payment failed for user ${subscription.user_id}:`, result.error);
      }
    } catch (error) {
      failed++;
      console.error(`[Billing Cron] ✗ Error processing subscription for user ${subscription.user_id}:`, error);
    }
  }

  const duration = Date.now() - startTime;
  const summary = {
    processed: dueSubscriptions.length,
    succeeded,
    failed,
    insufficientFunds,
  };

  console.log(`[Billing Cron] Daily billing complete in ${duration}ms:`, summary);

  return summary;
}
