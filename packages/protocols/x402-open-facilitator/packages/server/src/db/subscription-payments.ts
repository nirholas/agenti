import { randomUUID } from 'crypto';
import { getDatabase } from './index.js';

export interface SubscriptionPayment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  chain: 'solana' | 'base';
  status: 'success' | 'failed' | 'pending';
  tx_hash: string | null;
  error_message: string | null;
  is_fallback: boolean;
  created_at: string;
}

// Internal type for SQLite rows (is_fallback is stored as INTEGER)
interface SubscriptionPaymentRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  chain: 'solana' | 'base';
  status: 'success' | 'failed' | 'pending';
  tx_hash: string | null;
  error_message: string | null;
  is_fallback: number;
  created_at: string;
}

/**
 * Create a new subscription payment record
 */
export function createSubscriptionPayment(
  userId: string,
  amount: number,
  chain: 'solana' | 'base',
  status: 'success' | 'failed' | 'pending',
  txHash?: string | null,
  errorMessage?: string | null,
  subscriptionId?: string | null,
  isFallback?: boolean
): SubscriptionPayment {
  const db = getDatabase();
  const id = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO subscription_payments (
      id, user_id, subscription_id, amount, chain, status,
      tx_hash, error_message, is_fallback
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    userId,
    subscriptionId ?? null,
    amount,
    chain,
    status,
    txHash ?? null,
    errorMessage ?? null,
    isFallback ? 1 : 0
  );

  return getSubscriptionPaymentById(id)!;
}

/**
 * Get a subscription payment by ID
 */
export function getSubscriptionPaymentById(id: string): SubscriptionPayment | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM subscription_payments WHERE id = ?');
  const payment = stmt.get(id) as SubscriptionPaymentRow | undefined;

  if (!payment) return null;

  return {
    ...payment,
    is_fallback: Boolean(payment.is_fallback),
  };
}

/**
 * Get all subscription payments for a user
 */
export function getSubscriptionPaymentsByUser(
  userId: string,
  limit: number = 100,
  offset: number = 0
): SubscriptionPayment[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM subscription_payments
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const payments = stmt.all(userId, limit, offset) as SubscriptionPaymentRow[];

  return payments.map(p => ({
    ...p,
    is_fallback: Boolean(p.is_fallback),
  }));
}

/**
 * Get recent payment attempts for a user (for retry logic)
 */
export function getRecentPaymentAttempts(userId: string, hours: number = 24): SubscriptionPayment[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM subscription_payments
    WHERE user_id = ?
      AND created_at >= datetime('now', '-' || ? || ' hours')
    ORDER BY created_at DESC
  `);

  const payments = stmt.all(userId, hours) as SubscriptionPaymentRow[];

  return payments.map(p => ({
    ...p,
    is_fallback: Boolean(p.is_fallback),
  }));
}
