import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { VolumeSnapshotRecord } from './types.js';

export function createVolumeSnapshot(data: {
  reward_address_id: string;
  campaign_id: string;
  snapshot_date: string;
  volume: string;
  unique_payers?: number;
}): VolumeSnapshotRecord | null {
  const db = getDatabase();
  const id = nanoid();

  try {
    const stmt = db.prepare(`
      INSERT INTO volume_snapshots (id, reward_address_id, campaign_id, snapshot_date, volume, unique_payers)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.reward_address_id,
      data.campaign_id,
      data.snapshot_date,
      data.volume,
      data.unique_payers ?? 0
    );
    return getVolumeSnapshotById(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}

export function getVolumeSnapshotById(id: string): VolumeSnapshotRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM volume_snapshots WHERE id = ?');
  return (stmt.get(id) as VolumeSnapshotRecord) || null;
}

export function getVolumeSnapshotsByAddress(rewardAddressId: string): VolumeSnapshotRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM volume_snapshots WHERE reward_address_id = ? ORDER BY snapshot_date DESC');
  return stmt.all(rewardAddressId) as VolumeSnapshotRecord[];
}

export function getVolumeSnapshotsByCampaign(campaignId: string): VolumeSnapshotRecord[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM volume_snapshots WHERE campaign_id = ? ORDER BY snapshot_date DESC');
  return stmt.all(campaignId) as VolumeSnapshotRecord[];
}

export function getVolumeSnapshotByAddressAndDate(
  rewardAddressId: string,
  campaignId: string,
  snapshotDate: string
): VolumeSnapshotRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM volume_snapshots
    WHERE reward_address_id = ? AND campaign_id = ? AND snapshot_date = ?
  `);
  return (stmt.get(rewardAddressId, campaignId, snapshotDate) as VolumeSnapshotRecord) || null;
}

export function upsertVolumeSnapshot(data: {
  reward_address_id: string;
  campaign_id: string;
  snapshot_date: string;
  volume: string;
  unique_payers?: number;
}): VolumeSnapshotRecord {
  const db = getDatabase();

  // Check if exists
  const existing = getVolumeSnapshotByAddressAndDate(
    data.reward_address_id,
    data.campaign_id,
    data.snapshot_date
  );

  if (existing) {
    // Update existing
    const stmt = db.prepare(`
      UPDATE volume_snapshots
      SET volume = ?, unique_payers = ?
      WHERE id = ?
    `);
    stmt.run(data.volume, data.unique_payers ?? 0, existing.id);
    return getVolumeSnapshotById(existing.id)!;
  } else {
    // Create new
    return createVolumeSnapshot(data)!;
  }
}

export function getUserVolumeForCampaign(userId: string, campaignId: string): {
  total_volume: string;
  unique_payers: number;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(vs.volume AS INTEGER)), 0) as total_volume,
      COALESCE(SUM(vs.unique_payers), 0) as unique_payers
    FROM volume_snapshots vs
    JOIN reward_addresses ra ON vs.reward_address_id = ra.id
    WHERE ra.user_id = ? AND vs.campaign_id = ?
  `);

  const result = stmt.get(userId, campaignId) as {
    total_volume: number;
    unique_payers: number;
  };

  return {
    total_volume: String(result.total_volume),
    unique_payers: result.unique_payers,
  };
}
