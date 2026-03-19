import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { CampaignRecord } from './types.js';

export type CampaignStatus = 'draft' | 'published' | 'active' | 'ended';

export function createCampaign(data: {
  name: string;
  pool_amount: string;
  threshold_amount: string;
  multiplier_facilitator?: number;
  starts_at: string;
  ends_at: string;
  distributed_amount?: string;
}): CampaignRecord {
  const db = getDatabase();
  const id = nanoid();

  const stmt = db.prepare(`
    INSERT INTO campaigns (id, name, pool_amount, threshold_amount, multiplier_facilitator, starts_at, ends_at, distributed_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.name,
    data.pool_amount,
    data.threshold_amount,
    data.multiplier_facilitator ?? 2.0,
    data.starts_at,
    data.ends_at,
    data.distributed_amount ?? '0'
  );
  return getCampaignById(id)!;
}

export function getCampaignById(id: string): CampaignRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
  return (stmt.get(id) as CampaignRecord) || null;
}

export function getActiveCampaign(): CampaignRecord | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM campaigns WHERE status = 'active' LIMIT 1");
  return (stmt.get() as CampaignRecord) || null;
}

/**
 * Get the current published or active campaign for users
 * Returns the most recent campaign that users should see
 */
export function getPublishedCampaign(): CampaignRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM campaigns
    WHERE status IN ('published', 'active')
    ORDER BY starts_at DESC
    LIMIT 1
  `);
  return (stmt.get() as CampaignRecord) || null;
}

export function getAllCampaigns(): CampaignRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC');
  return stmt.all() as CampaignRecord[];
}

/**
 * Get campaigns filtered by status
 */
export function getCampaignsByStatus(status: CampaignStatus): CampaignRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM campaigns WHERE status = ? ORDER BY created_at DESC');
  return stmt.all(status) as CampaignRecord[];
}

/**
 * Get all completed/ended campaigns for history view
 */
export function getCompletedCampaigns(): CampaignRecord[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM campaigns WHERE status = 'ended' ORDER BY ends_at DESC");
  return stmt.all() as CampaignRecord[];
}

export function updateCampaign(
  id: string,
  updates: Partial<{
    name: string;
    pool_amount: string;
    threshold_amount: string;
    multiplier_facilitator: number;
    starts_at: string;
    ends_at: string;
    status: CampaignStatus;
    distributed_amount: string;
  }>
): CampaignRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.pool_amount !== undefined) {
    fields.push('pool_amount = ?');
    values.push(updates.pool_amount);
  }
  if (updates.threshold_amount !== undefined) {
    fields.push('threshold_amount = ?');
    values.push(updates.threshold_amount);
  }
  if (updates.multiplier_facilitator !== undefined) {
    fields.push('multiplier_facilitator = ?');
    values.push(updates.multiplier_facilitator);
  }
  if (updates.starts_at !== undefined) {
    fields.push('starts_at = ?');
    values.push(updates.starts_at);
  }
  if (updates.ends_at !== undefined) {
    fields.push('ends_at = ?');
    values.push(updates.ends_at);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.distributed_amount !== undefined) {
    fields.push('distributed_amount = ?');
    values.push(updates.distributed_amount);
  }

  if (fields.length === 0) {
    return getCampaignById(id);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) return null;
  return getCampaignById(id);
}

export function deleteCampaign(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
