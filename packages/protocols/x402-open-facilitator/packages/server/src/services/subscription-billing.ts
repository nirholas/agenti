/**
 * Subscription billing service with multi-chain fallback logic
 * Handles recurring payment processing from user wallets
 */
import { SUBSCRIPTION_PRICING } from '../db/subscriptions.js';
import { getUserPreference } from '../db/user-preferences.js';
import {
  getAllWalletsForUser,
  decryptUserPrivateKey,
  getUSDCBalance,
  getBaseUSDCBalance,
} from './wallet.js';
import { makeX402Payment, makeBaseX402Payment } from './x402-client.js';
import {
  createSubscription,
  getActiveSubscription,
  extendSubscription,
} from '../db/subscriptions.js';
import { createSubscriptionPayment } from '../db/subscription-payments.js';
import {
  createNotification,
  hasRecentNotificationOfType,
} from '../db/notifications.js';
import { getFacilitatorsByOwner } from '../db/facilitators.js';

// x402jobs payment endpoint
const X402_JOBS_PAYMENT_URL =
  process.env.X402_JOBS_PAYMENT_URL ||
  'https://api.x402.jobs/@openfacilitator/openfacilitator-payment-collector';

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  chain?: 'solana' | 'base' | 'stacks';
  error?: string;
  insufficientBothChains?: boolean;
  usedFallback?: boolean;
}

/**
 * Get the alternate chain for fallback
 */
function getAlternateChain(chain: 'solana' | 'base'): 'solana' | 'base' {
  return chain === 'solana' ? 'base' : 'solana';
}

/**
 * Process a subscription payment with multi-chain fallback
 * Tries preferred chain first, falls back to alternate if insufficient balance
 */
export async function processSubscriptionPayment(userId: string): Promise<PaymentResult> {
  console.log(`[SubscriptionBilling] Processing payment for user ${userId}`);

  // Get user's preferred chain (default to solana if none set)
  const preference = getUserPreference(userId);
  const preferredChain = preference?.preferred_chain || 'solana';
  console.log(`[SubscriptionBilling] Preferred chain: ${preferredChain}`);

  // Get all wallets
  const wallets = getAllWalletsForUser(userId);
  const preferredWallet = wallets.find((w) => w.network === preferredChain);
  const alternateWallet = wallets.find((w) => w.network === getAlternateChain(preferredChain));

  if (!preferredWallet && !alternateWallet) {
    console.error('[SubscriptionBilling] User has no wallets');
    return {
      success: false,
      error: 'No wallets found. Please create a wallet first.',
    };
  }

  // Calculate amount based on facilitator count
  const facilitators = getFacilitatorsByOwner(userId);
  const facilitatorCount = facilitators.length;

  if (facilitatorCount === 0) {
    console.log('[SubscriptionBilling] User has no facilitators, skipping billing');
    return {
      success: true, // Not an error, just nothing to bill
    };
  }

  const requiredAmount = facilitatorCount * SUBSCRIPTION_PRICING.starter;
  console.log(`[SubscriptionBilling] Required amount: ${requiredAmount} (${requiredAmount / 1e6} USDC) for ${facilitatorCount} facilitator(s)`);

  // Try preferred chain first (if wallet exists)
  if (preferredWallet) {
    console.log(`[SubscriptionBilling] Attempting payment on preferred chain: ${preferredChain}`);
    const result = await attemptPayment(userId, preferredChain, requiredAmount, false);

    // Success - return immediately
    if (result.success) {
      console.log(`[SubscriptionBilling] Payment successful on preferred chain`);
      return result;
    }

    // If not insufficient balance, it's a different error - don't try fallback
    if (!result.insufficientBalance) {
      console.log(`[SubscriptionBilling] Payment failed (not due to balance): ${result.error}`);
      return result;
    }

    console.log(`[SubscriptionBilling] Insufficient balance on preferred chain, trying fallback`);
  } else {
    console.log(`[SubscriptionBilling] No wallet on preferred chain ${preferredChain}, trying alternate`);
  }

  // Try alternate chain if available
  const alternateChain = getAlternateChain(preferredChain);
  if (alternateWallet) {
    console.log(`[SubscriptionBilling] Attempting payment on alternate chain: ${alternateChain}`);
    const result = await attemptPayment(userId, alternateChain, requiredAmount, true);

    if (result.success) {
      console.log(`[SubscriptionBilling] Payment successful on fallback chain`);
      return { ...result, usedFallback: true };
    }

    // Failed on both chains
    console.log(`[SubscriptionBilling] Payment failed on both chains`);
    return result;
  }

  // Both chains insufficient or unavailable
  // Log the failed attempt on preferred chain
  createSubscriptionPayment(
    userId,
    requiredAmount,
    preferredChain,
    'failed',
    null,
    'Insufficient balance on both chains',
    null,
    false
  );

  // Create payment failed notification
  createNotification(
    userId,
    'payment_failed',
    'Payment Failed',
    'Subscription payment failed due to insufficient funds on both chains. Please fund your wallet.',
    'error',
    { chain: preferredChain }
  );

  console.log(`[SubscriptionBilling] Insufficient balance on both chains`);
  return {
    success: false,
    error: 'Insufficient USDC balance on both Solana and Base chains',
    insufficientBothChains: true,
  };
}

/**
 * Attempt payment on a specific chain
 */
async function attemptPayment(
  userId: string,
  chain: 'solana' | 'base',
  amount: number,
  isFallback: boolean
): Promise<PaymentResult & { insufficientBalance?: boolean }> {
  try {
    // Get wallet for this chain
    const wallets = getAllWalletsForUser(userId);
    const wallet = wallets.find((w) => w.network === chain);

    if (!wallet) {
      return {
        success: false,
        error: `No ${chain} wallet found`,
      };
    }

    // Check balance
    const balanceResult =
      chain === 'solana'
        ? await getUSDCBalance(wallet.address)
        : await getBaseUSDCBalance(wallet.address);

    console.log(`[SubscriptionBilling] ${chain} balance: ${balanceResult.formatted} USDC`);

    if (balanceResult.balance < BigInt(amount)) {
      // Log insufficient balance attempt
      createSubscriptionPayment(
        userId,
        amount,
        chain,
        'failed',
        null,
        `Insufficient balance: ${balanceResult.formatted} USDC`,
        null,
        isFallback
      );

      return {
        success: false,
        error: `Insufficient ${chain} USDC balance`,
        insufficientBalance: true,
      };
    }

    // Decrypt private key
    const privateKey = decryptUserPrivateKey(userId, chain);

    // Make x402 payment on the appropriate chain
    const paymentResult = chain === 'base'
      ? await makeBaseX402Payment(
          X402_JOBS_PAYMENT_URL,
          { userId }, // Payment metadata
          privateKey,
          wallet.address
        )
      : await makeX402Payment(
          X402_JOBS_PAYMENT_URL,
          { userId }, // Payment metadata
          privateKey,
          wallet.address
        );

    // Check if insufficient balance was detected during payment
    if (!paymentResult.success && paymentResult.insufficientBalance) {
      createSubscriptionPayment(
        userId,
        amount,
        chain,
        'failed',
        null,
        paymentResult.error || 'Insufficient balance',
        null,
        isFallback
      );

      return {
        success: false,
        error: paymentResult.error,
        insufficientBalance: true,
      };
    }

    // Payment failed for other reason
    if (!paymentResult.success) {
      createSubscriptionPayment(
        userId,
        amount,
        chain,
        'failed',
        null,
        paymentResult.error || 'Payment failed',
        null,
        isFallback
      );

      return {
        success: false,
        error: paymentResult.error || 'Payment failed',
      };
    }

    // Payment successful - create or extend subscription
    const activeSubscription = getActiveSubscription(userId);
    let subscriptionId: string;

    if (activeSubscription) {
      // Extend existing subscription by 30 days
      console.log(`[SubscriptionBilling] Extending subscription ${activeSubscription.id}`);
      const extended = extendSubscription(activeSubscription.id, 30, 'starter', paymentResult.txHash);
      subscriptionId = extended!.id;
    } else {
      // Create new subscription (30 days)
      console.log(`[SubscriptionBilling] Creating new subscription`);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const newSubscription = createSubscription(userId, 'starter', expiresAt, paymentResult.txHash, amount);
      subscriptionId = newSubscription.id;
    }

    // Log successful payment
    createSubscriptionPayment(
      userId,
      amount,
      chain,
      'success',
      paymentResult.txHash,
      null,
      subscriptionId,
      isFallback
    );

    // Create payment success notification
    const amountDollars = amount / 1_000_000;
    createNotification(
      userId,
      'payment_success',
      'Payment Successful',
      `Your $${amountDollars} subscription payment was processed successfully.`,
      'success',
      { txHash: paymentResult.txHash, chain, amount }
    );

    // Check balance after payment for low balance warning
    const subscriptionCost = SUBSCRIPTION_PRICING.starter;
    const lowBalanceThreshold = subscriptionCost * 2; // 2x = $10

    if (balanceResult.balance < BigInt(lowBalanceThreshold)) {
      // Only create if no recent low_balance notification in last 24h
      if (!hasRecentNotificationOfType(userId, 'low_balance', 24)) {
        createNotification(
          userId,
          'low_balance',
          'Low Balance Warning',
          `Your ${chain} wallet balance is below $10. Consider funding to avoid payment failures.`,
          'warning',
          { chain, balance: balanceResult.formatted }
        );
      }
    }

    console.log(`[SubscriptionBilling] Payment successful, tx: ${paymentResult.txHash}`);

    return {
      success: true,
      txHash: paymentResult.txHash,
      chain,
    };
  } catch (error) {
    console.error(`[SubscriptionBilling] Error during ${chain} payment:`, error);

    // Log error
    createSubscriptionPayment(
      userId,
      amount,
      chain,
      'failed',
      null,
      error instanceof Error ? error.message : 'Unknown error',
      null,
      isFallback
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
