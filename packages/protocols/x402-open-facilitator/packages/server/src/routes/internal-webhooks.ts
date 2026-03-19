/**
 * Internal Webhook Endpoints
 *
 * These endpoints receive webhook payloads from OpenFacilitator's own
 * webhook system to trigger internal business logic like subscription activation
 * and facilitator creation.
 */

import { Router, type Request, type Response } from 'express';
import type { Router as RouterType } from 'express';
import crypto from 'crypto';
import {
  createSubscription,
  getActiveSubscription,
  extendSubscription,
  type SubscriptionTier,
} from '../db/subscriptions.js';
import { getUserWalletByAddress } from '../db/user-wallets.js';
import { getDatabase } from '../db/index.js';
import { createFacilitator, ensureFacilitatorMarker } from '../db/facilitators.js';
import {
  getPendingFacilitatorByUserId,
  getPendingFacilitatorById,
  deletePendingFacilitator,
} from '../db/pending-facilitators.js';
import { defaultTokens } from '@openfacilitator/core';
import { addCustomDomain, isRailwayConfigured } from '../services/railway.js';

const router: RouterType = Router();

/**
 * Create a facilitator from a pending request
 * Can look up by pendingId (from metadata) or by userId
 */
async function createFacilitatorFromPending(options: { pendingId?: string; userId?: string }): Promise<{
  created: boolean;
  facilitator?: {
    id: string;
    name: string;
    subdomain: string;
    customDomain: string;
  };
  error?: string;
}> {
  // Try to find pending facilitator by ID first, then by user ID
  let pending = options.pendingId ? getPendingFacilitatorById(options.pendingId) : null;
  if (!pending && options.userId) {
    pending = getPendingFacilitatorByUserId(options.userId);
  }
  if (!pending) {
    return { created: false, error: 'No pending facilitator found' };
  }

  try {
    // Default chains: Base Mainnet + Solana Mainnet
    const chains = [8453, 'solana'];
    const tokens = defaultTokens.filter((t) => chains.includes(t.chainId));

    const facilitator = createFacilitator({
      name: pending.name,
      subdomain: pending.subdomain,
      custom_domain: pending.custom_domain,
      owner_address: pending.user_id,
      supported_chains: JSON.stringify(chains),
      supported_tokens: JSON.stringify(tokens),
    });

    if (!facilitator) {
      return { created: false, error: 'Failed to create facilitator (subdomain may already exist)' };
    }

    // Register custom domain with Railway (not subdomain - we only support custom domains)
    if (pending.custom_domain && isRailwayConfigured()) {
      console.log(`[Subscription Webhook] Registering custom domain with Railway: ${pending.custom_domain}`);
      const railwayResult = await addCustomDomain(pending.custom_domain);
      if (railwayResult.success) {
        console.log(`[Subscription Webhook] Successfully registered ${pending.custom_domain} with Railway`);
      } else {
        console.error(`[Subscription Webhook] Failed to register ${pending.custom_domain}:`, railwayResult.error);
      }
    }

    // Delete the pending facilitator record
    deletePendingFacilitator(pending.id);

    // Ensure facilitator owner has enrollment marker for volume tracking
    ensureFacilitatorMarker(pending.user_id);

    console.log(`[Subscription Webhook] Created facilitator ${facilitator.id} for user ${pending.user_id}`);

    return {
      created: true,
      facilitator: {
        id: facilitator.id,
        name: facilitator.name,
        subdomain: facilitator.subdomain,
        customDomain: pending.custom_domain,
      },
    };
  } catch (error) {
    console.error('[Subscription Webhook] Error creating facilitator:', error);
    return { created: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /api/internal/webhooks/subscription
 *
 * Receives payment_link.payment webhooks and activates subscriptions.
 * The payer must use their OpenFacilitator billing wallet.
 *
 * Required headers:
 * - X-Webhook-Signature: HMAC-SHA256 signature of the payload
 *
 * Environment:
 * - SUBSCRIPTION_WEBHOOK_SECRET: The webhook secret to verify signatures
 */
router.post('/subscription', async (req: Request, res: Response) => {
  const webhookSecret = process.env.SUBSCRIPTION_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Subscription Webhook] SUBSCRIPTION_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  // Get signature from headers
  const signature = req.headers['x-webhook-signature'] as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  // Verify signature
  const rawBody = JSON.stringify(req.body);
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    console.warn('[Subscription Webhook] Invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Parse webhook payload
  const { event, payment, metadata } = req.body;

  if (event !== 'payment_link.payment' && event !== 'product.payment') {
    // Not a payment event, ignore
    res.json({ success: true, message: 'Event ignored' });
    return;
  }

  if (!payment?.payerAddress || !payment?.transactionHash) {
    res.status(400).json({ error: 'Invalid payment data' });
    return;
  }

  const { payerAddress, transactionHash, amount } = payment;
  const pendingId = metadata?.pendingId;

  console.log(`[Subscription Webhook] Processing payment from ${payerAddress}${pendingId ? ` (pendingId: ${pendingId})` : ''}`);

  // Look up user - first try by pendingId, then by billing wallet
  let userId: string | null = null;

  // If we have a pendingId, get the user from the pending facilitator
  if (pendingId) {
    const pending = getPendingFacilitatorById(pendingId);
    if (pending) {
      userId = pending.user_id;
      console.log(`[Subscription Webhook] Found user ${userId} from pendingId ${pendingId}`);
    }
  }

  // Fall back to billing wallet lookup
  if (!userId) {
    const userWallet = getUserWalletByAddress(payerAddress);
    if (userWallet) {
      userId = userWallet.user_id;
    } else {
      // Try case-insensitive search for EVM addresses
      const db = getDatabase();
      const stmt = db.prepare('SELECT user_id FROM user_wallets WHERE LOWER(wallet_address) = LOWER(?)');
      const wallet = stmt.get(payerAddress) as { user_id: string } | undefined;
      if (wallet) {
        userId = wallet.user_id;
      }
    }
  }

  if (!userId) {
    console.warn(`[Subscription Webhook] No user found for wallet ${payerAddress} or pendingId ${pendingId}`);
    res.status(200).json({
      success: false,
      error: 'User not found',
      message: `No user found. Please ensure you're logged in and try again.`,
    });
    return;
  }

  // Activate or extend subscription
  const tier: SubscriptionTier = 'starter';
  const daysToAdd = 30;

  try {
    const existingSubscription = getActiveSubscription(userId);

    if (existingSubscription) {
      // Extend existing subscription
      const extended = extendSubscription(existingSubscription.id, daysToAdd, tier, transactionHash);
      if (!extended) {
        res.status(500).json({ success: false, error: 'Failed to extend subscription' });
        return;
      }

      console.log(`[Subscription Webhook] Extended subscription for user ${userId}, expires ${extended.expires_at}`);

      // Also create pending facilitator if one exists
      const facilitatorResult = await createFacilitatorFromPending({ pendingId, userId });

      res.json({
        success: true,
        action: 'extended',
        userId,
        subscriptionId: extended.id,
        tier: extended.tier,
        expiresAt: extended.expires_at,
        facilitator: facilitatorResult.created ? facilitatorResult.facilitator : undefined,
      });
      return;
    }

    // Create new subscription
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    const subscription = createSubscription(
      userId,
      tier,
      expiresAt,
      transactionHash,
      parseInt(amount, 10) || undefined
    );

    console.log(`[Subscription Webhook] Created subscription for user ${userId}, expires ${subscription.expires_at}`);

    // Also create pending facilitator if one exists
    const facilitatorResult = await createFacilitatorFromPending({ pendingId, userId });

    res.json({
      success: true,
      action: 'created',
      userId,
      subscriptionId: subscription.id,
      tier: subscription.tier,
      expiresAt: subscription.expires_at,
      facilitator: facilitatorResult.created ? facilitatorResult.facilitator : undefined,
    });
  } catch (error) {
    console.error('[Subscription Webhook] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as internalWebhooksRouter };
