import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { CampaignAuditRecord } from './types.js';

/**
 * Create a campaign audit record
 */
export function createCampaignAudit(data: {
  campaign_id: string;
  admin_user_id: string;
  action: 'create' | 'update' | 'publish' | 'end';
  changes: Record<string, unknown>;
}): CampaignAuditRecord {
  const db = getDatabase();
  const id = nanoid();

  const stmt = db.prepare(`
    INSERT INTO campaign_audit (id, campaign_id, admin_user_id, action, changes)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.campaign_id,
    data.admin_user_id,
    data.action,
    JSON.stringify(data.changes)
  );

  return getCampaignAuditById(id)!;
}

/**
 * Get a campaign audit record by ID
 */
export function getCampaignAuditById(id: string): CampaignAuditRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM campaign_audit WHERE id = ?');
  return (stmt.get(id) as CampaignAuditRecord) || null;
}

/**
 * Get all audit history for a campaign
 */
export function getCampaignAuditHistory(campaignId: string): CampaignAuditRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM campaign_audit WHERE campaign_id = ? ORDER BY created_at DESC');
  return stmt.all(campaignId) as CampaignAuditRecord[];
}
