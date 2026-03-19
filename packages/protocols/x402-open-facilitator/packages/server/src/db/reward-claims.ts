import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { RewardClaimRecord } from './types.js';

export function createRewardClaim(data: {
  user_id: string;
  campaign_id: string;
  volume_amount: string;
  base_reward_amount: string;
  multiplier?: number;
  final_reward_amount: string;
  claim_wallet?: string;
}): RewardClaimRecord | null {
  const db = getDatabase();
  const id = nanoid();

  try {
    const stmt = db.prepare(`
      INSERT INTO reward_claims (id, user_id, campaign_id, volume_amount, base_reward_amount, multiplier, final_reward_amount, claim_wallet)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.user_id,
      data.campaign_id,
      data.volume_amount,
      data.base_reward_amount,
      data.multiplier ?? 1.0,
      data.final_reward_amount,
      data.claim_wallet || null
    );
    return getRewardClaimById(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}

export function getRewardClaimById(id: string): RewardClaimRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM reward_claims WHERE id = ?');
  return (stmt.get(id) as RewardClaimRecord) || null;
}

export function getRewardClaimsByUser(userId: string): RewardClaimRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM reward_claims WHERE user_id = ? ORDER BY created_at DESC');
  return stmt.all(userId) as RewardClaimRecord[];
}

export function getRewardClaimsByCampaign(campaignId: string): RewardClaimRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM reward_claims WHERE campaign_id = ? ORDER BY created_at DESC');
  return stmt.all(campaignId) as RewardClaimRecord[];
}

export function getRewardClaimByUserAndCampaign(userId: string, campaignId: string): RewardClaimRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM reward_claims WHERE user_id = ? AND campaign_id = ?');
  return (stmt.get(userId, campaignId) as RewardClaimRecord) || null;
}

export function updateRewardClaim(
  id: string,
  updates: Partial<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    claim_wallet: string;
    tx_signature: string;
    claimed_at: string;
  }>
): RewardClaimRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.claim_wallet !== undefined) {
    fields.push('claim_wallet = ?');
    values.push(updates.claim_wallet);
  }
  if (updates.tx_signature !== undefined) {
    fields.push('tx_signature = ?');
    values.push(updates.tx_signature);
  }
  if (updates.claimed_at !== undefined) {
    fields.push('claimed_at = ?');
    values.push(updates.claimed_at);
  }

  if (fields.length === 0) {
    return getRewardClaimById(id);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE reward_claims SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) return null;
  return getRewardClaimById(id);
}

/**
 * Get total qualifying volume for a campaign
 *
 * Returns the sum of all users' volumes from snapshots for proportional reward calculation.
 * This represents the total pool volume that rewards will be distributed across.
 *
 * @param campaignId - The campaign ID
 * @returns Total volume as a string (atomic units)
 */
export function getTotalQualifyingVolume(campaignId: string): string {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT COALESCE(SUM(CAST(vs.volume AS INTEGER)), 0) as total_volume
    FROM volume_snapshots vs
    WHERE vs.campaign_id = ?
  `);

  const result = stmt.get(campaignId) as { total_volume: number };
  return String(result.total_volume);
}
