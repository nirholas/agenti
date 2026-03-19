import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { ClaimRecord } from './types.js';

/**
 * Create a new claim
 */
export function createClaim(data: {
  resource_owner_id: string;
  server_id: string;
  original_tx_hash: string;
  user_wallet: string;
  amount: string;
  asset: string;
  network: string;
  reason?: string;
  expires_at?: string;
}): ClaimRecord {
  const db = getDatabase();
  const id = nanoid();

  // Default expiration is 30 days from now
  const expiresAt = data.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const stmt = db.prepare(`
    INSERT INTO claims (id, resource_owner_id, server_id, original_tx_hash, user_wallet, amount, asset, network, reason, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.resource_owner_id,
    data.server_id,
    data.original_tx_hash,
    data.user_wallet,
    data.amount,
    data.asset,
    data.network,
    data.reason || null,
    expiresAt
  );

  return getClaimById(id)!;
}

/**
 * Get a claim by ID
 */
export function getClaimById(id: string): ClaimRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM claims WHERE id = ?');
  return (stmt.get(id) as ClaimRecord) || null;
}

/**
 * Get a claim by original transaction hash
 */
export function getClaimByTxHash(txHash: string): ClaimRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM claims WHERE original_tx_hash = ?');
  return (stmt.get(txHash) as ClaimRecord) || null;
}

/**
 * Get claims for a resource owner with optional filters
 */
export function getClaimsByResourceOwner(
  resourceOwnerId: string,
  filters?: {
    status?: ClaimRecord['status'];
    limit?: number;
    offset?: number;
  }
): ClaimRecord[] {
  const db = getDatabase();

  let query = 'SELECT * FROM claims WHERE resource_owner_id = ?';
  const params: (string | number)[] = [resourceOwnerId];

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY reported_at DESC';

  if (filters?.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  const stmt = db.prepare(query);
  return stmt.all(...params) as ClaimRecord[];
}

/**
 * Get claims by user wallet
 */
export function getClaimsByUserWallet(
  wallet: string,
  resourceOwnerId?: string
): ClaimRecord[] {
  const db = getDatabase();

  let query = 'SELECT * FROM claims WHERE user_wallet = ?';
  const params: string[] = [wallet];

  if (resourceOwnerId) {
    query += ' AND resource_owner_id = ?';
    params.push(resourceOwnerId);
  }

  query += ' ORDER BY reported_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as ClaimRecord[];
}

/**
 * Get claimable (pending or approved) claims for a user
 */
export function getClaimableByUserWallet(
  wallet: string,
  resourceOwnerId?: string
): ClaimRecord[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM claims
    WHERE user_wallet = ?
    AND status IN ('pending', 'approved')
    AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
  `;
  const params: string[] = [wallet];

  if (resourceOwnerId) {
    query += ' AND resource_owner_id = ?';
    params.push(resourceOwnerId);
  }

  query += ' ORDER BY reported_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as ClaimRecord[];
}

/**
 * Update claim status
 */
export function updateClaimStatus(
  id: string,
  status: ClaimRecord['status'],
  payoutTxHash?: string
): ClaimRecord | null {
  const db = getDatabase();

  let query = 'UPDATE claims SET status = ?';
  const params: (string | null)[] = [status];

  if (payoutTxHash) {
    query += ', payout_tx_hash = ?';
    params.push(payoutTxHash);
  }

  if (status === 'paid') {
    query += ", paid_at = datetime('now')";
  }

  query += ' WHERE id = ?';
  params.push(id);

  const stmt = db.prepare(query);
  const result = stmt.run(...params);

  if (result.changes === 0) {
    return null;
  }

  return getClaimById(id);
}

/**
 * Get claim statistics for a resource owner
 */
export function getClaimStats(resourceOwnerId: string): {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  paidClaims: number;
  rejectedClaims: number;
  expiredClaims: number;
  totalPaidAmount: string;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total_claims,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_claims,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_claims,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_claims,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_claims,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN CAST(amount AS REAL) ELSE 0 END), 0) as total_paid_amount
    FROM claims
    WHERE resource_owner_id = ?
  `);

  const result = stmt.get(resourceOwnerId) as {
    total_claims: number;
    pending_claims: number;
    approved_claims: number;
    paid_claims: number;
    rejected_claims: number;
    expired_claims: number;
    total_paid_amount: number;
  };

  // Convert total_paid_amount from atomic units to formatted string (assuming 6 decimals for USDC)
  const totalPaidFormatted = (result.total_paid_amount / 1_000_000).toFixed(2);

  return {
    totalClaims: result.total_claims || 0,
    pendingClaims: result.pending_claims || 0,
    approvedClaims: result.approved_claims || 0,
    paidClaims: result.paid_claims || 0,
    rejectedClaims: result.rejected_claims || 0,
    expiredClaims: result.expired_claims || 0,
    totalPaidAmount: totalPaidFormatted,
  };
}

/**
 * Expire old claims (run periodically)
 */
export function expireOldClaims(): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE claims
    SET status = 'expired'
    WHERE status IN ('pending', 'approved')
    AND expires_at IS NOT NULL
    AND datetime(expires_at) < datetime('now')
  `);

  const result = stmt.run();
  return result.changes;
}

/**
 * Check if a claim with the given transaction hash already exists
 */
export function claimExistsForTxHash(txHash: string): boolean {
  const claim = getClaimByTxHash(txHash);
  return claim !== null;
}

// Legacy aliases for backwards compatibility
/** @deprecated Use getClaimsByResourceOwner */
export const getClaimsByFacilitator = getClaimsByResourceOwner;
