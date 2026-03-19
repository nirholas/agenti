import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { ResourceOwnerRecord } from './types.js';

/**
 * Create a new resource owner
 */
export function createResourceOwner(data: {
  facilitator_id: string;
  user_id: string;
  refund_address?: string;
  name?: string;
}): ResourceOwnerRecord {
  const db = getDatabase();
  const id = nanoid();

  const stmt = db.prepare(`
    INSERT INTO resource_owners (id, facilitator_id, user_id, refund_address, name)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.facilitator_id,
    data.user_id,
    data.refund_address?.toLowerCase() || null,
    data.name || null
  );

  return getResourceOwnerById(id)!;
}

/**
 * Get resource owner by ID
 */
export function getResourceOwnerById(id: string): ResourceOwnerRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM resource_owners WHERE id = ?');
  return (stmt.get(id) as ResourceOwnerRecord) || null;
}

/**
 * Get resource owner by user ID for a specific facilitator
 */
export function getResourceOwnerByUserId(
  facilitatorId: string,
  userId: string
): ResourceOwnerRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT * FROM resource_owners WHERE facilitator_id = ? AND user_id = ?'
  );
  return (stmt.get(facilitatorId, userId) as ResourceOwnerRecord) || null;
}

/**
 * Get or create resource owner
 */
export function getOrCreateResourceOwner(data: {
  facilitator_id: string;
  user_id: string;
  refund_address?: string;
  name?: string;
}): ResourceOwnerRecord {
  const existing = getResourceOwnerByUserId(data.facilitator_id, data.user_id);
  if (existing) {
    return existing;
  }
  return createResourceOwner(data);
}

/**
 * Get all resource owners for a facilitator
 */
export function getResourceOwnersByFacilitator(facilitatorId: string): ResourceOwnerRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT * FROM resource_owners WHERE facilitator_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(facilitatorId) as ResourceOwnerRecord[];
}

/**
 * Get all resource owners for a user
 */
export function getResourceOwnersByUserId(userId: string): ResourceOwnerRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(
    'SELECT * FROM resource_owners WHERE user_id = ? ORDER BY created_at DESC'
  );
  return stmt.all(userId) as ResourceOwnerRecord[];
}

/**
 * Update resource owner
 */
export function updateResourceOwner(
  id: string,
  updates: Partial<{ name: string; refund_address: string }>
): ResourceOwnerRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }

  if (updates.refund_address !== undefined) {
    fields.push('refund_address = ?');
    values.push(updates.refund_address?.toLowerCase() || null);
  }

  if (fields.length === 0) {
    return getResourceOwnerById(id);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE resource_owners SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getResourceOwnerById(id);
}

/**
 * Delete resource owner (cascades to wallets, servers, claims)
 */
export function deleteResourceOwner(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM resource_owners WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get resource owner stats for a facilitator
 */
export function getResourceOwnerStats(facilitatorId: string): {
  totalOwners: number;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT COUNT(*) as total_owners
    FROM resource_owners
    WHERE facilitator_id = ?
  `);

  const result = stmt.get(facilitatorId) as { total_owners: number };

  return {
    totalOwners: result.total_owners || 0,
  };
}
