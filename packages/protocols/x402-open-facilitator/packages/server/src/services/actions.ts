/**
 * Action Executor Service
 *
 * Executes business logic actions when webhooks are triggered.
 * Actions are defined by the action_type field on webhooks.
 */

import {
  createSubscription,
  getActiveSubscription,
  extendSubscription,
  type SubscriptionTier,
} from '../db/subscriptions.js';
import { getUserWalletByAddress } from '../db/user-wallets.js';
import { getDatabase } from '../db/index.js';

export interface ActionContext {
  payerAddress: string;
  productId: string;
  amount: string;
  asset: string;
  network: string;
  transactionHash: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

type ActionHandler = (context: ActionContext) => Promise<ActionResult>;

/**
 * Action handlers registry
 */
const actionHandlers: Record<string, ActionHandler> = {
  activate_subscription: handleActivateSubscription,
};

/**
 * Execute an action by type
 */
export async function executeAction(
  actionType: string,
  context: ActionContext
): Promise<ActionResult> {
  const handler = actionHandlers[actionType];

  if (!handler) {
    console.warn(`[Actions] Unknown action type: ${actionType}`);
    return {
      success: false,
      message: `Unknown action type: ${actionType}`,
    };
  }

  try {
    console.log(`[Actions] Executing action: ${actionType} for payer ${context.payerAddress}`);
    const result = await handler(context);
    console.log(`[Actions] Action ${actionType} result:`, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Actions] Action ${actionType} failed:`, error);
    return {
      success: false,
      message: `Action failed: ${message}`,
    };
  }
}

/**
 * Check if an action type is valid
 */
export function isValidActionType(actionType: string): boolean {
  return actionType in actionHandlers;
}

/**
 * Get available action types
 */
export function getAvailableActionTypes(): string[] {
  return Object.keys(actionHandlers);
}

// =============================================================================
// Action Handlers
// =============================================================================

/**
 * Activate Subscription Action
 *
 * Finds the user by their wallet address and creates/extends their subscription.
 * The payer must use their OpenFacilitator billing wallet address.
 */
async function handleActivateSubscription(context: ActionContext): Promise<ActionResult> {
  const { payerAddress, amount, transactionHash } = context;

  // Look up user by billing wallet address
  const userWallet = getUserWalletByAddress(payerAddress);

  if (!userWallet) {
    // Try case-insensitive search for EVM addresses
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM user_wallets WHERE LOWER(wallet_address) = LOWER(?)');
    const wallet = stmt.get(payerAddress) as { user_id: string } | undefined;

    if (!wallet) {
      return {
        success: false,
        message: `No user found with billing wallet ${payerAddress}. User must pay from their OpenFacilitator billing wallet.`,
      };
    }

    return activateSubscriptionForUser(wallet.user_id, amount, transactionHash);
  }

  return activateSubscriptionForUser(userWallet.user_id, amount, transactionHash);
}

/**
 * Helper to activate/extend subscription for a user
 */
function activateSubscriptionForUser(
  userId: string,
  amount: string,
  transactionHash: string
): ActionResult {
  const tier: SubscriptionTier = 'starter';
  const daysToAdd = 30; // 30-day subscription

  // Check if user has an active subscription
  const existingSubscription = getActiveSubscription(userId);

  if (existingSubscription) {
    // Extend existing subscription
    const extended = extendSubscription(existingSubscription.id, daysToAdd, tier, transactionHash);
    if (!extended) {
      return {
        success: false,
        message: 'Failed to extend subscription',
      };
    }

    return {
      success: true,
      message: `Subscription extended by ${daysToAdd} days`,
      data: {
        subscriptionId: extended.id,
        userId,
        tier: extended.tier,
        expiresAt: extended.expires_at,
        action: 'extended',
      },
    };
  }

  // Create new subscription
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysToAdd);

  const subscription = createSubscription(
    userId,
    tier,
    expiresAt,
    transactionHash,
    parseInt(amount, 10)
  );

  return {
    success: true,
    message: `Subscription activated for ${daysToAdd} days`,
    data: {
      subscriptionId: subscription.id,
      userId,
      tier: subscription.tier,
      expiresAt: subscription.expires_at,
      action: 'created',
    },
  };
}
