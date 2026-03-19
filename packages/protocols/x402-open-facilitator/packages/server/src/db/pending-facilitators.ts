/**
 * Pending Facilitators Database Operations
 *
 * Stores facilitator creation requests that are awaiting payment.
 * After payment webhook fires, the pending facilitator is created.
 */

import { getDatabase } from './index.js';
import { nanoid } from 'nanoid';

export interface PendingFacilitator {
  id: string;
  user_id: string;
  name: string;
  custom_domain: string;
  subdomain: string;
  created_at: string;
}

/**
 * Create a pending facilitator request
 */
export function createPendingFacilitator(
  userId: string,
  name: string,
  customDomain: string,
  subdomain: string
): PendingFacilitator {
  const db = getDatabase();
  const id = nanoid();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO pending_facilitators (id, user_id, name, custom_domain, subdomain, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, name, customDomain, subdomain, now);

  return {
    id,
    user_id: userId,
    name,
    custom_domain: customDomain,
    subdomain,
    created_at: now,
  };
}

/**
 * Get pending facilitator for a user (most recent one)
 */
export function getPendingFacilitatorByUserId(userId: string): PendingFacilitator | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM pending_facilitators
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return stmt.get(userId) as PendingFacilitator | null;
}

/**
 * Get pending facilitator by ID
 */
export function getPendingFacilitatorById(id: string): PendingFacilitator | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pending_facilitators WHERE id = ?');
  return stmt.get(id) as PendingFacilitator | null;
}

/**
 * Delete a pending facilitator (after it's been created)
 */
export function deletePendingFacilitator(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pending_facilitators WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Delete all pending facilitators for a user
 */
export function deletePendingFacilitatorsForUser(userId: string): number {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pending_facilitators WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes;
}
