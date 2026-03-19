import { Router, type Request, type Response, type IRouter } from 'express';
import { z } from 'zod';
import {
  createSubscription,
  getActiveSubscription,
  getSubscriptionsByUserId,
  extendSubscription,
  SUBSCRIPTION_PRICING,
  type SubscriptionTier,
  getDueSubscriptions,
  getGracePeriodInfo,
  getUserSubscriptionState,
  isInGracePeriod,
  GRACE_PERIOD_DAYS,
  getSubscriptionsExpiringInDays,
} from '../db/subscriptions.js';
import { getFacilitatorsByOwner } from '../db/facilitators.js';
import {
  createNotification,
  hasRecentNotificationOfType,
} from '../db/notifications.js';
import { getSubscriptionPaymentsByUser } from '../db/subscription-payments.js';
import { getUserWalletByUserId } from '../db/user-wallets.js';
import { decryptPrivateKey } from '../utils/crypto.js';
import { makeX402Payment } from '../services/x402-client.js';
import { requireAuth } from '../middleware/auth.js';
import { processSubscriptionPayment } from '../services/subscription-billing.js';

// x402jobs payment endpoint
const X402_JOBS_PAYMENT_URL = process.env.X402_JOBS_PAYMENT_URL || 'https://api.x402.jobs/@openfacilitator/openfacilitator-payment-collector';

const router: IRouter = Router();

/**
 * GET /api/subscriptions/status
 * Get subscription status for authenticated user
 *
 * Subscription status is derived from facilitator ownership:
 * - Each facilitator = $5/month subscription
 * - If user owns facilitators, they are subscribed
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check facilitators owned by user (facilitators store owner_address as lowercase)
    const facilitators = getFacilitatorsByOwner(userId);
    const facilitatorCount = facilitators.length;

    // If user has facilitators, they are subscribed
    if (facilitatorCount > 0) {
      // SUBSCRIPTION_PRICING.starter is in USDC decimals (5_000_000 = $5)
      // Convert to dollars for frontend display
      const monthlyCost = (facilitatorCount * SUBSCRIPTION_PRICING.starter) / 1_000_000;

      // Get the subscription record (created when facilitator was made)
      const subscription = getActiveSubscription(userId);
      const gracePeriodInfo = getGracePeriodInfo(userId);

      res.json({
        active: true,
        tier: 'starter',
        expires: subscription?.expires_at || null, // Next billing date
        state: gracePeriodInfo.inGracePeriod ? 'pending' : 'active',
        facilitatorCount,
        monthlyCost,
        ...(gracePeriodInfo.inGracePeriod && {
          gracePeriod: {
            daysRemaining: gracePeriodInfo.daysRemaining,
            expiredAt: gracePeriodInfo.expiredAt,
          },
        }),
      });
      return;
    }

    // Fall back to traditional subscription check for users without facilitators
    const subscription = getActiveSubscription(userId);
    const state = getUserSubscriptionState(userId);
    const gracePeriodInfo = getGracePeriodInfo(userId);

    if (!subscription) {
      res.json({
        active: false,
        tier: null,
        expires: null,
        state,
        facilitatorCount: 0,
        monthlyCost: 0,
        ...(gracePeriodInfo.inGracePeriod && {
          gracePeriod: {
            daysRemaining: gracePeriodInfo.daysRemaining,
            expiredAt: gracePeriodInfo.expiredAt,
          },
        }),
      });
      return;
    }

    res.json({
      active: true,
      tier: subscription.tier,
      expires: subscription.expires_at,
      state,
      facilitatorCount: 0,
      monthlyCost: SUBSCRIPTION_PRICING.starter,
      ...(gracePeriodInfo.inGracePeriod && {
        gracePeriod: {
          daysRemaining: gracePeriodInfo.daysRemaining,
          expiredAt: gracePeriodInfo.expiredAt,
        },
      }),
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/subscriptions/pricing
 * Get subscription pricing (public endpoint)
 */
router.get('/pricing', (_req: Request, res: Response) => {
  res.json({
    starter: {
      price: SUBSCRIPTION_PRICING.starter,
      priceFormatted: '$5.00',
      currency: 'USDC',
      period: '30 days',
    },
  });
});

/**
 * GET /api/subscriptions/history
 * Get subscription payment history for authenticated user
 * Returns all subscription payments (including expired subscriptions)
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const subscriptions = getSubscriptionsByUserId(userId);

    // Transform to payment history format
    const payments = subscriptions.map((sub) => ({
      id: sub.id,
      date: sub.created_at,
      amount: (sub.amount / 1_000_000).toFixed(2), // Convert from USDC decimals
      chain: 'solana', // Currently all subscriptions are on Solana
      txHash: sub.tx_hash,
      tier: sub.tier,
      expiresAt: sub.expires_at,
    }));

    res.json({ payments });
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/subscriptions/payments
 * Get detailed payment attempt history for authenticated user
 * Returns all payment attempts including failures (from subscription_payments table)
 */
router.get('/payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Parse query params
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const payments = getSubscriptionPaymentsByUser(userId, limit, offset);

    // Transform to frontend format
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      date: payment.created_at,
      amount: (payment.amount / 1_000_000).toFixed(2), // Convert from USDC decimals
      chain: payment.chain,
      status: payment.status,
      txHash: payment.tx_hash,
      isFallback: payment.is_fallback,
    }));

    // Get total count for pagination
    const total = payments.length;

    res.json({ payments: formattedPayments, total });
  } catch (error) {
    console.error('Get subscription payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validation schema for purchase endpoint (tier is optional, defaults to starter)
const purchaseSchema = z.object({
  tier: z.enum(['starter']).optional().default('starter'),
});

/**
 * POST /api/subscriptions/purchase
 * Purchase a subscription using the user's custodial wallet via x402
 *
 * This endpoint:
 * 1. Gets the user's Solana wallet
 * 2. Makes an x402 payment to x402jobs payment collector
 * 3. Creates the subscription directly with the tx hash
 * 4. Returns the subscription details
 */
router.post('/purchase', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
      return;
    }

    const subscriptionTier: SubscriptionTier = 'starter';
    const userId = req.user!.id;

    console.log(`[Purchase] User ${userId} attempting to purchase subscription`);

    // Get user's wallet
    const wallet = getUserWalletByUserId(userId);
    if (!wallet) {
      res.status(400).json({
        success: false,
        error: 'No wallet found',
        message: 'You need to create a billing wallet first. Go to your account settings.',
      });
      return;
    }

    // Decrypt private key
    let privateKey: string;
    try {
      privateKey = decryptPrivateKey(wallet.encrypted_private_key);
    } catch (error) {
      console.error('[Purchase] Failed to decrypt wallet:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to access wallet',
      });
      return;
    }

    // Get x402jobs endpoint
    const endpoint = X402_JOBS_PAYMENT_URL;
    console.log(`[Purchase] Calling x402jobs endpoint: ${endpoint}`);

    // Make x402 payment to x402jobs
    const result = await makeX402Payment(
      endpoint,
      {}, // x402jobs doesn't need a body - it's just a payment gate
      privateKey,
      wallet.wallet_address
    );

    // Clear private key from memory
    privateKey = '';

    if (!result.success) {
      console.log(`[Purchase] Payment failed:`, result.error);

      if (result.insufficientBalance) {
        res.status(402).json({
          success: false,
          error: 'Insufficient balance',
          message: `You need $${result.required} USDC but only have $${result.available}`,
          required: result.required,
          available: result.available,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: result.error || 'Payment failed',
      });
      return;
    }

    // Extract transaction signature from x402jobs response
    // Response format: { success: true, message: "...", payment: { signature, payer, amount, timestamp } }
    const responseData = result.data as Record<string, unknown> | undefined;
    const payment = responseData?.payment as Record<string, string> | undefined;
    const txHash = payment?.signature || result.txHash;

    console.log(`[Purchase] Payment successful for user ${userId}, txHash: ${txHash}`);

    // Create subscription directly with tx hash
    const SUBSCRIPTION_DAYS = 30;
    const existingSub = getActiveSubscription(userId);
    let subscription;

    if (existingSub) {
      // Extend existing subscription
      subscription = extendSubscription(existingSub.id, SUBSCRIPTION_DAYS, subscriptionTier, txHash);
      console.log(`[Purchase] Extended subscription for user ${userId}: ${subscription?.expires_at}`);
    } else {
      // Create new subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SUBSCRIPTION_DAYS);

      subscription = createSubscription(userId, subscriptionTier, expiresAt, txHash);
      console.log(`[Purchase] Created new subscription for user ${userId}: expires ${subscription.expires_at}`);
    }

    if (!subscription) {
      // Payment succeeded but subscription creation failed - this is bad
      console.error(`[Purchase] CRITICAL: Payment succeeded but subscription creation failed for user ${userId}`);
      res.status(500).json({
        success: false,
        error: 'Subscription creation failed after payment. Please contact support.',
        txHash,
      });
      return;
    }

    res.json({
      success: true,
      tier: subscription.tier,
      expires: subscription.expires_at,
      txHash,
    });
  } catch (error) {
    console.error('[Purchase] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/subscriptions/billing
 * Daily cron endpoint that processes all due subscriptions
 * Requires CRON_SECRET header for authentication
 */
router.post('/billing', async (req: Request, res: Response) => {
  try {
    // Verify cron secret
    const cronSecret = req.headers['x-cron-secret'];
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log('[Billing] Starting daily billing process');

    // Send 3-day expiration reminders
    const expiringIn3Days = getSubscriptionsExpiringInDays(3);
    console.log(`[Billing] Found ${expiringIn3Days.length} subscriptions expiring in 3 days`);

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
          console.log(`[Billing] Sent expiration reminder to user ${sub.user_id}`);
        }
      }
    }

    // Get all subscriptions that are due for billing
    const dueSubscriptions = getDueSubscriptions();
    console.log(`[Billing] Found ${dueSubscriptions.length} due subscriptions`);

    let succeeded = 0;
    let failed = 0;
    let insufficientFunds = 0;

    // Process each due subscription
    for (const subscription of dueSubscriptions) {
      console.log(`[Billing] Processing subscription ${subscription.id} for user ${subscription.user_id}`);

      try {
        const result = await processSubscriptionPayment(subscription.user_id);

        if (result.success) {
          succeeded++;
          console.log(`[Billing] ✓ Payment successful for user ${subscription.user_id}`);
        } else if (result.insufficientBothChains) {
          insufficientFunds++;
          console.log(`[Billing] ⚠ Insufficient balance for user ${subscription.user_id}`);
        } else {
          failed++;
          console.error(`[Billing] ✗ Payment failed for user ${subscription.user_id}:`, result.error);
        }
      } catch (error) {
        failed++;
        console.error(`[Billing] ✗ Error processing subscription for user ${subscription.user_id}:`, error);
      }
    }

    const summary = {
      processed: dueSubscriptions.length,
      succeeded,
      failed,
      insufficientFunds,
    };

    console.log('[Billing] Daily billing complete:', summary);

    res.json(summary);
  } catch (error) {
    console.error('[Billing] Cron error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/subscriptions/reactivate
 * Instant reactivation during grace period
 * Requires authentication
 */
router.post('/reactivate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    console.log(`[Reactivate] User ${userId} attempting reactivation`);

    // Check if user is in grace period
    if (!isInGracePeriod(userId)) {
      console.log(`[Reactivate] User ${userId} is not in grace period`);
      res.status(400).json({
        success: false,
        error: 'Not in grace period',
        message: 'You can only reactivate during the 7-day grace period after subscription expiration.',
      });
      return;
    }

    // Attempt to process payment
    const result = await processSubscriptionPayment(userId);

    if (result.success) {
      console.log(`[Reactivate] Payment successful for user ${userId}`);

      // Get updated subscription
      const subscription = getActiveSubscription(userId);

      // Create subscription restored notification
      createNotification(
        userId,
        'subscription_restored',
        'Subscription Restored',
        'Your subscription has been successfully reactivated!',
        'success',
        { tier: subscription?.tier, expires: subscription?.expires_at }
      );

      res.json({
        success: true,
        subscription: subscription
          ? {
              tier: subscription.tier,
              expires: subscription.expires_at,
            }
          : null,
      });
      return;
    }

    if (result.insufficientBothChains) {
      console.log(`[Reactivate] Insufficient balance on both chains for user ${userId}`);
      res.status(402).json({
        success: false,
        error: 'Insufficient balance',
        message: 'Insufficient USDC balance on both Solana and Base chains. Please fund your wallets.',
      });
      return;
    }

    console.error(`[Reactivate] Payment failed for user ${userId}:`, result.error);
    res.status(500).json({
      success: false,
      error: result.error || 'Payment failed',
    });
  } catch (error) {
    console.error('[Reactivate] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export { router as subscriptionsRouter };
