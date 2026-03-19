import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { RefundConfigRecord } from './types.js';

/**
 * Create a refund config for a facilitator
 */
export function createRefundConfig(facilitatorId: string): RefundConfigRecord {
  const db = getDatabase();
  const id = nanoid();

  const stmt = db.prepare(`
    INSERT INTO refund_configs (id, facilitator_id, enabled)
    VALUES (?, ?, 0)
  `);

  stmt.run(id, facilitatorId);

  return getRefundConfigByFacilitator(facilitatorId)!;
}

/**
 * Get refund config by facilitator ID
 */
export function getRefundConfigByFacilitator(facilitatorId: string): RefundConfigRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM refund_configs WHERE facilitator_id = ?');
  return (stmt.get(facilitatorId) as RefundConfigRecord) || null;
}

/**
 * Get or create refund config for a facilitator
 */
export function getOrCreateRefundConfig(facilitatorId: string): RefundConfigRecord {
  const existing = getRefundConfigByFacilitator(facilitatorId);
  if (existing) {
    return existing;
  }
  return createRefundConfig(facilitatorId);
}

/**
 * Update refund config
 */
export function updateRefundConfig(
  facilitatorId: string,
  updates: Partial<{ enabled: number }>
): RefundConfigRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled);
  }

  if (fields.length === 0) {
    return getRefundConfigByFacilitator(facilitatorId);
  }

  fields.push("updated_at = datetime('now')");
  values.push(facilitatorId);

  const stmt = db.prepare(`UPDATE refund_configs SET ${fields.join(', ')} WHERE facilitator_id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getRefundConfigByFacilitator(facilitatorId);
}

/**
 * Delete refund config
 */
export function deleteRefundConfig(facilitatorId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM refund_configs WHERE facilitator_id = ?');
  const result = stmt.run(facilitatorId);
  return result.changes > 0;
}
