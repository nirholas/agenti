import { randomUUID } from 'crypto';
import { getDatabase } from './index.js';

export interface Subscription {
  id: string;
  user_id: string;
  tier: 'starter'; // Single paid tier - $5/month
  amount: number;
  tx_hash: string | null;
  started_at: string;
  expires_at: string;
  created_at: string;
}

// Pricing in USDC (6 decimals)
export const SUBSCRIPTION_PRICING = {
  starter: 5_000_000,  // $5 USDC
} as const;

// Subscription tier type
export type SubscriptionTier = 'starter';

// Grace period configuration
export const GRACE_PERIOD_DAYS = 7;

/**
 * Create a new subscription record
 */
export function createSubscription(
  userId: string,
  tier: SubscriptionTier,
  expiresAt: Date,
  txHash?: string | null,
  amount?: number
): Subscription {
  const db = getDatabase();
  const id = randomUUID();
  const finalAmount = amount ?? SUBSCRIPTION_PRICING[tier];

  const stmt = db.prepare(`
    INSERT INTO subscriptions (id, user_id, tier, amount, tx_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, tier, finalAmount, txHash ?? null, expiresAt.toISOString());

  return getSubscriptionById(id)!;
}

/**
 * Get a subscription by ID
 */
export function getSubscriptionById(id: string): Subscription | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE id = ?');
  const subscription = stmt.get(id) as Subscription | undefined;
  return subscription || null;
}

/**
 * Get the active subscription for a user (not expired)
 */
export function getActiveSubscription(userId: string): Subscription | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND expires_at > datetime('now')
    ORDER BY expires_at DESC
    LIMIT 1
  `);
  const subscription = stmt.get(userId) as Subscription | undefined;
  return subscription || null;
}

/**
 * Get all subscriptions for a user (including expired)
 */
export function getSubscriptionsByUserId(userId: string): Subscription[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(userId) as Subscription[];
}

/**
 * Check if a transaction hash has already been used
 */
export function getSubscriptionByTxHash(txHash: string): Subscription | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM subscriptions WHERE tx_hash = ?');
  const subscription = stmt.get(txHash) as Subscription | undefined;
  return subscription || null;
}

/**
 * Extend an existing subscription by adding days to its expiration
 */
export function extendSubscription(
  subscriptionId: string,
  additionalDays: number,
  tier: SubscriptionTier = 'starter',
  newTxHash?: string | null
): Subscription | null {
  const db = getDatabase();

  // Get current subscription
  const current = getSubscriptionById(subscriptionId);
  if (!current) return null;

  // Calculate new expiration date
  const currentExpires = new Date(current.expires_at);
  const now = new Date();

  // If subscription is already expired, extend from now
  // Otherwise, extend from current expiration date
  const baseDate = currentExpires > now ? currentExpires : now;
  const newExpires = new Date(baseDate);
  newExpires.setDate(newExpires.getDate() + additionalDays);

  const amount = SUBSCRIPTION_PRICING[tier];

  const stmt = db.prepare(`
    UPDATE subscriptions
    SET expires_at = ?, tier = ?, amount = amount + ?
    WHERE id = ?
  `);

  stmt.run(newExpires.toISOString(), tier, amount, subscriptionId);

  return getSubscriptionById(subscriptionId);
}

/**
 * Check if a user exists in the Better Auth user table
 */
export function userExists(userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT id FROM "user" WHERE id = ?');
  const user = stmt.get(userId);
  return !!user;
}

/**
 * Get all subscriptions that are due for billing (expired or expiring today)
 */
export function getDueSubscriptions(): Subscription[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM subscriptions
    WHERE expires_at <= datetime('now')
    ORDER BY expires_at ASC
  `);
  return stmt.all() as Subscription[];
}

/**
 * Get grace period information for a user
 */
export function getGracePeriodInfo(userId: string): {
  inGracePeriod: boolean;
  daysRemaining: number;
  expiredAt: string | null;
} {
  const db = getDatabase();

  // Get most recent subscription
  const stmt = db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ?
    ORDER BY expires_at DESC
    LIMIT 1
  `);
  const subscription = stmt.get(userId) as Subscription | undefined;

  // No subscription found
  if (!subscription) {
    return { inGracePeriod: false, daysRemaining: 0, expiredAt: null };
  }

  const expiresAt = new Date(subscription.expires_at);
  const now = new Date();

  // Subscription is still active
  if (expiresAt > now) {
    return { inGracePeriod: false, daysRemaining: 0, expiredAt: null };
  }

  // Calculate days since expiration
  const daysSinceExpiration = Math.floor(
    (now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check if within grace period
  if (daysSinceExpiration <= GRACE_PERIOD_DAYS) {
    return {
      inGracePeriod: true,
      daysRemaining: GRACE_PERIOD_DAYS - daysSinceExpiration,
      expiredAt: subscription.expires_at,
    };
  }

  // Grace period has ended
  return { inGracePeriod: false, daysRemaining: 0, expiredAt: subscription.expires_at };
}

/**
 * Check if a user is currently in grace period
 */
export function isInGracePeriod(userId: string): boolean {
  const info = getGracePeriodInfo(userId);
  return info.inGracePeriod;
}

/**
 * Get the subscription state for a user
 */
export function getUserSubscriptionState(
  userId: string
): 'active' | 'pending' | 'inactive' | 'never' {
  const db = getDatabase();

  // Check for active subscription
  const activeSubscription = getActiveSubscription(userId);
  if (activeSubscription) {
    return 'active';
  }

  // Check if in grace period
  if (isInGracePeriod(userId)) {
    return 'pending';
  }

  // Check if user has any subscription history
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ?
  `);
  const result = stmt.get(userId) as { count: number };

  if (result.count > 0) {
    return 'inactive';
  }

  return 'never';
}

/**
 * Get subscriptions expiring exactly N days from now
 * Used for sending expiration reminders
 */
export function getSubscriptionsExpiringInDays(days: number): Subscription[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM subscriptions
    WHERE date(expires_at) = date('now', '+' || ? || ' days')
  `);
  return stmt.all(days) as Subscription[];
}
