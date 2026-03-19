import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { RewardAddressRecord } from './types.js';

export function createRewardAddress(data: {
  user_id: string;
  chain_type: 'solana' | 'evm' | 'facilitator';
  address: string;
}): RewardAddressRecord | null {
  const db = getDatabase();
  const id = nanoid();

  // Normalize: lowercase for EVM, preserve case for Solana (base58)
  const normalizedAddress = data.chain_type === 'evm'
    ? data.address.toLowerCase()
    : data.address;

  try {
    const stmt = db.prepare(`
      INSERT INTO reward_addresses (id, user_id, chain_type, address)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, data.user_id, data.chain_type, normalizedAddress);
    return getRewardAddressById(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}

export function getRewardAddressById(id: string): RewardAddressRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM reward_addresses WHERE id = ?');
  return (stmt.get(id) as RewardAddressRecord) || null;
}

export function getRewardAddressesByUser(userId: string): RewardAddressRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM reward_addresses WHERE user_id = ? ORDER BY created_at DESC');
  return stmt.all(userId) as RewardAddressRecord[];
}

export function getRewardAddressByAddress(address: string, chainType: 'solana' | 'evm'): RewardAddressRecord | null {
  const db = getDatabase();
  const normalizedAddress = chainType === 'evm' ? address.toLowerCase() : address;
  const stmt = db.prepare('SELECT * FROM reward_addresses WHERE address = ? AND chain_type = ?');
  return (stmt.get(normalizedAddress, chainType) as RewardAddressRecord) || null;
}

export function getVerifiedAddressesByUser(userId: string): RewardAddressRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM reward_addresses
    WHERE user_id = ? AND verification_status = 'verified'
    ORDER BY created_at DESC
  `);
  return stmt.all(userId) as RewardAddressRecord[];
}

export function verifyRewardAddress(id: string): RewardAddressRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE reward_addresses
    SET verification_status = 'verified', verified_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(id);
  if (result.changes === 0) return null;
  return getRewardAddressById(id);
}

export function deleteRewardAddress(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM reward_addresses WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Check if a user is enrolled in rewards (has at least one reward address)
 * @param userId - The user ID to check
 * @returns true if user has reward addresses, false otherwise
 */
export function isUserEnrolledInRewards(userId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('SELECT 1 FROM reward_addresses WHERE user_id = ? LIMIT 1');
  return stmt.get(userId) !== undefined;
}

/**
 * Create a facilitator enrollment marker for volume tracking
 * This creates a special reward_address with chain_type='facilitator' that acts
 * as an enrollment marker for volume aggregation.
 *
 * @param userId - The facilitator owner's user ID
 * @param enrollmentDate - The date to backdate the marker to (facilitator's created_at)
 * @returns The created marker record, or null if marker already exists
 */
export function createFacilitatorMarker(
  userId: string,
  enrollmentDate: string
): RewardAddressRecord | null {
  const db = getDatabase();
  const id = nanoid();

  // Use deterministic address to satisfy UNIQUE constraint (one per user)
  const address = `FACILITATOR_OWNER:${userId}`;

  try {
    // Insert the marker
    const insertStmt = db.prepare(`
      INSERT INTO reward_addresses (id, user_id, chain_type, address, verification_status, verified_at)
      VALUES (?, ?, 'facilitator', ?, 'verified', datetime('now'))
    `);
    insertStmt.run(id, userId, address);

    // Backdate created_at to the enrollmentDate (critical for historical volume)
    const updateStmt = db.prepare(`
      UPDATE reward_addresses
      SET created_at = ?
      WHERE id = ?
    `);
    updateStmt.run(enrollmentDate, id);

    return getRewardAddressById(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      // Marker already exists, return null silently (idempotent)
      return null;
    }
    throw error;
  }
}
