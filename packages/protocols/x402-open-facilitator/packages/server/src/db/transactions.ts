import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { TransactionRecord } from './types.js';

/**
 * Create a new transaction record
 */
export function createTransaction(data: {
  facilitator_id: string;
  type: 'verify' | 'settle';
  network: string;
  from_address: string;
  to_address: string;
  amount: string;
  asset: string;
  transaction_hash?: string;
  status: 'pending' | 'success' | 'failed';
  error_message?: string;
}): TransactionRecord | null {
  const db = getDatabase();
  const id = nanoid();

  try {
    const stmt = db.prepare(`
      INSERT INTO transactions (id, facilitator_id, type, network, from_address, to_address, amount, asset, transaction_hash, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.facilitator_id,
      data.type,
      data.network,
      data.from_address.toLowerCase(),
      data.to_address.toLowerCase(),
      data.amount,
      data.asset.toLowerCase(),
      data.transaction_hash || null,
      data.status,
      data.error_message || null
    );

    return getTransactionById(id);
  } catch (error) {
    console.error('Failed to create transaction:', error);
    return null;
  }
}

/**
 * Get a transaction by ID
 */
export function getTransactionById(id: string): TransactionRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
  return (stmt.get(id) as TransactionRecord) || null;
}

/**
 * Get transactions for a facilitator
 */
export function getTransactionsByFacilitator(
  facilitatorId: string,
  limit = 50,
  offset = 0
): TransactionRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM transactions 
    WHERE facilitator_id = ? 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `);
  return stmt.all(facilitatorId, limit, offset) as TransactionRecord[];
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(
  id: string,
  status: 'pending' | 'success' | 'failed',
  transactionHash?: string,
  errorMessage?: string
): TransactionRecord | null {
  const db = getDatabase();

  const fields: string[] = ['status = ?'];
  const values: (string | null)[] = [status];

  if (transactionHash !== undefined) {
    fields.push('transaction_hash = ?');
    values.push(transactionHash);
  }
  if (errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(errorMessage);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getTransactionById(id);
}

/**
 * Get transaction statistics for a facilitator
 */
export function getTransactionStats(facilitatorId: string): {
  total: number;
  verified: number;
  settled: number;
  failed: number;
  totalAmountSettled: string;
} {
  const db = getDatabase();

  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE facilitator_id = ?');
  const total = (totalStmt.get(facilitatorId) as { count: number }).count;

  const verifiedStmt = db.prepare(
    "SELECT COUNT(*) as count FROM transactions WHERE facilitator_id = ? AND type = 'verify' AND status = 'success'"
  );
  const verified = (verifiedStmt.get(facilitatorId) as { count: number }).count;

  const settledStmt = db.prepare(
    "SELECT COUNT(*) as count FROM transactions WHERE facilitator_id = ? AND type = 'settle' AND status = 'success'"
  );
  const settled = (settledStmt.get(facilitatorId) as { count: number }).count;

  const failedStmt = db.prepare(
    "SELECT COUNT(*) as count FROM transactions WHERE facilitator_id = ? AND status = 'failed'"
  );
  const failed = (failedStmt.get(facilitatorId) as { count: number }).count;

  // Calculate total amount settled (amounts are stored as atomic units, e.g., 50000 = $0.05 USDC)
  const amountStmt = db.prepare(
    "SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) as total FROM transactions WHERE facilitator_id = ? AND type = 'settle' AND status = 'success'"
  );
  const totalAtomicUnits = (amountStmt.get(facilitatorId) as { total: number }).total;
  // Convert from atomic units (6 decimals for USDC) to dollars
  const totalAmountSettled = (totalAtomicUnits / 1_000_000).toFixed(2);

  return { total, verified, settled, failed, totalAmountSettled };
}

/**
 * Get daily aggregated stats for a facilitator (for charts)
 */
export function getDailyStats(
  facilitatorId: string,
  days: number = 30
): Array<{
  date: string;
  settlements: number;
  verifications: number;
  amount: number;
}> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      DATE(created_at) as date,
      SUM(CASE WHEN type = 'settle' AND status = 'success' THEN 1 ELSE 0 END) as settlements,
      SUM(CASE WHEN type = 'verify' AND status = 'success' THEN 1 ELSE 0 END) as verifications,
      COALESCE(SUM(CASE WHEN type = 'settle' AND status = 'success' THEN CAST(amount AS INTEGER) ELSE 0 END), 0) as amount_atomic
    FROM transactions
    WHERE facilitator_id = ?
      AND created_at >= datetime('now', ?)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  const results = stmt.all(facilitatorId, `-${days} days`) as Array<{
    date: string;
    settlements: number;
    verifications: number;
    amount_atomic: number;
  }>;

  return results.map((row) => ({
    date: row.date,
    settlements: row.settlements,
    verifications: row.verifications,
    amount: row.amount_atomic / 1_000_000, // Convert atomic units to dollars
  }));
}

/**
 * Get global transaction statistics across all facilitators
 */
export function getGlobalStats(): {
  global: {
    totalTransactionsAllTime: number;
    totalTransactions24h: number;
    volumeUsdAllTime: string;
    volumeUsd24h: string;
    uniqueWallets: number;
  };
  paymentLinks: {
    totalSellers: number;
    totalLinks: number;
    totalPayments: number;
    volumeUsd: string;
  };
  facilitators: Array<{
    id: string;
    name: string;
    subdomain: string;
    transactionCount: number;
    volumeUsd: string;
    uniqueWallets: number;
    totalSellers: number;
    totalLinks: number;
  }>;
} {
  const db = getDatabase();

  // Total settled transactions all time
  const totalAllTime = db
    .prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE type = 'settle' AND status = 'success'"
    )
    .get() as { count: number };

  // Total settled transactions 24h
  const total24h = db
    .prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE type = 'settle' AND status = 'success' AND created_at > datetime('now', '-24 hours')"
    )
    .get() as { count: number };

  // Volume all time (sum of settled amounts in atomic units)
  const volumeAllTime = db
    .prepare(
      "SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) as total FROM transactions WHERE type = 'settle' AND status = 'success'"
    )
    .get() as { total: number };

  // Volume 24h
  const volume24h = db
    .prepare(
      "SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) as total FROM transactions WHERE type = 'settle' AND status = 'success' AND created_at > datetime('now', '-24 hours')"
    )
    .get() as { total: number };

  // Unique wallets (distinct payers)
  const uniqueWallets = db
    .prepare(
      "SELECT COUNT(DISTINCT from_address) as count FROM transactions WHERE type = 'settle' AND status = 'success'"
    )
    .get() as { count: number };

  // Payment links stats (sellers = unique pay_to_address)
  const paymentLinksStats = db
    .prepare(
      `
      SELECT
        COUNT(DISTINCT pl.pay_to_address) as total_sellers,
        COUNT(DISTINCT pl.id) as total_links,
        COUNT(plp.id) as total_payments,
        COALESCE(SUM(CASE WHEN plp.status = 'success' THEN CAST(plp.amount AS INTEGER) ELSE 0 END), 0) as volume_atomic
      FROM products pl
      LEFT JOIN product_payments plp ON pl.id = plp.product_id
    `
    )
    .get() as {
    total_sellers: number;
    total_links: number;
    total_payments: number;
    volume_atomic: number;
  };

  // Per-facilitator breakdown (includes seller count from payment_links)
  const perFacilitator = db
    .prepare(
      `
    SELECT
      f.id,
      f.name,
      f.subdomain,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume_atomic,
      COUNT(DISTINCT t.from_address) as unique_wallets,
      (SELECT COUNT(DISTINCT pay_to_address) FROM products WHERE facilitator_id = f.id) as total_sellers,
      (SELECT COUNT(*) FROM products WHERE facilitator_id = f.id) as total_links
    FROM facilitators f
    LEFT JOIN transactions t ON f.id = t.facilitator_id
      AND t.type = 'settle'
      AND t.status = 'success'
    GROUP BY f.id, f.name, f.subdomain
    ORDER BY volume_atomic DESC
  `
    )
    .all() as Array<{
    id: string;
    name: string;
    subdomain: string;
    transaction_count: number;
    volume_atomic: number;
    unique_wallets: number;
    total_sellers: number;
    total_links: number;
  }>;

  return {
    global: {
      totalTransactionsAllTime: totalAllTime.count,
      totalTransactions24h: total24h.count,
      volumeUsdAllTime: (volumeAllTime.total / 1_000_000).toFixed(2),
      volumeUsd24h: (volume24h.total / 1_000_000).toFixed(2),
      uniqueWallets: uniqueWallets.count,
    },
    paymentLinks: {
      totalSellers: paymentLinksStats.total_sellers,
      totalLinks: paymentLinksStats.total_links,
      totalPayments: paymentLinksStats.total_payments,
      volumeUsd: (paymentLinksStats.volume_atomic / 1_000_000).toFixed(2),
    },
    facilitators: perFacilitator.map((f) => ({
      id: f.id,
      name: f.name,
      subdomain: f.subdomain,
      transactionCount: f.transaction_count,
      volumeUsd: (f.volume_atomic / 1_000_000).toFixed(2),
      uniqueWallets: f.unique_wallets,
      totalSellers: f.total_sellers,
      totalLinks: f.total_links,
    })),
  };
}

