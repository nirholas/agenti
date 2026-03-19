import { getDatabase } from './index.js';
import { upsertVolumeSnapshot, getUserVolumeForCampaign } from './volume-snapshots.js';
import { getFacilitatorsByOwner } from './facilitators.js';
import type { RewardAddressRecord } from './types.js';

/**
 * Get volume by a specific reward address
 * Includes only settle transactions with success status for verified addresses
 * Excludes self-transfers (from_address == to_address)
 *
 * @param addressId - The reward_address ID
 * @param sinceDate - ISO date string to count volume from (typically enrollment date)
 * @returns Volume and unique payers count
 */
export function getVolumeByAddress(
  addressId: string,
  sinceDate: string
): { volume: string; unique_payers: number } {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
      COUNT(DISTINCT t.from_address) as unique_payers
    FROM transactions t
    JOIN reward_addresses ra ON ra.address = t.to_address
    WHERE ra.id = ?
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND ra.verification_status = 'verified'
      AND t.created_at >= ra.created_at
      AND t.created_at >= ?
  `);

  const result = stmt.get(addressId, sinceDate) as {
    volume: number;
    unique_payers: number;
  };

  return {
    volume: String(result.volume),
    unique_payers: result.unique_payers,
  };
}

/**
 * Get volume by facilitator ownership
 * Volume counts for users who own facilitators via facilitator_id matching
 * Includes only settle transactions with success status
 * Excludes self-transfers
 *
 * @param userId - The user ID who owns facilitators
 * @param sinceDate - ISO date string to count volume from (enrollment date)
 * @returns Volume and unique payers count
 */
export function getVolumeByFacilitatorOwnership(
  userId: string,
  sinceDate: string
): { volume: string; unique_payers: number } {
  const db = getDatabase();
  // owner_address is stored lowercase in facilitators table
  const normalizedUserId = userId.toLowerCase();

  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
      COUNT(DISTINCT t.from_address) as unique_payers
    FROM transactions t
    JOIN facilitators f ON f.id = t.facilitator_id
    WHERE f.owner_address = ?
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at >= ?
  `);

  const result = stmt.get(normalizedUserId, sinceDate) as {
    volume: number;
    unique_payers: number;
  };

  return {
    volume: String(result.volume),
    unique_payers: result.unique_payers,
  };
}

/**
 * Get user's total volume for a campaign
 * Combines:
 * 1. Snapshot volume (pre-computed daily totals)
 * 2. Live delta (transactions since last snapshot)
 *
 * Both address-based and facilitator-ownership-based volume are summed (they stack per CONTEXT.md)
 *
 * @param userId - The user ID
 * @param campaignId - The campaign ID
 * @returns Combined volume data
 */
export function getUserTotalVolume(
  userId: string,
  campaignId: string
): {
  total_volume: string;
  unique_payers: number;
  snapshot_volume: string;
  live_volume: string;
  last_snapshot_date: string | null;
} {
  const db = getDatabase();
  // owner_address is stored lowercase in facilitators table
  const normalizedUserId = userId.toLowerCase();

  // Get snapshot totals from existing function
  const snapshotData = getUserVolumeForCampaign(userId, campaignId);

  // Get the last snapshot date for this user/campaign
  const lastSnapshotStmt = db.prepare(`
    SELECT MAX(vs.snapshot_date) as last_date
    FROM volume_snapshots vs
    JOIN reward_addresses ra ON vs.reward_address_id = ra.id
    WHERE ra.user_id = ? AND vs.campaign_id = ?
  `);
  const lastSnapshotResult = lastSnapshotStmt.get(userId, campaignId) as {
    last_date: string | null;
  };
  const lastSnapshotDate = lastSnapshotResult.last_date;

  // Calculate live delta (transactions since last snapshot)
  // If no snapshot exists, we use a very old date to get all transactions
  const sinceDate = lastSnapshotDate || '1970-01-01';

  // Get live volume from verified addresses (since last snapshot)
  const liveAddressStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
      COUNT(DISTINCT t.from_address) as unique_payers
    FROM transactions t
    JOIN reward_addresses ra ON ra.address = t.to_address
    WHERE ra.user_id = ?
      AND ra.verification_status = 'verified'
      AND ra.chain_type != 'facilitator'
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at > ?
      AND t.created_at >= ra.created_at
  `);
  const liveAddressResult = liveAddressStmt.get(userId, sinceDate) as {
    volume: number;
    unique_payers: number;
  };

  // Get live volume from facilitator ownership (since last snapshot)
  // Get the facilitator enrollment date from the reward_addresses table
  const facilitatorEnrollmentStmt = db.prepare(`
    SELECT MIN(ra.created_at) as enrollment_date
    FROM reward_addresses ra
    WHERE ra.user_id = ?
      AND ra.chain_type = 'facilitator'
      AND ra.verification_status = 'verified'
  `);
  const facilitatorEnrollmentResult = facilitatorEnrollmentStmt.get(userId) as {
    enrollment_date: string | null;
  };

  let liveFacilitatorVolume = 0;
  let liveFacilitatorUniquePayers = 0;

  if (facilitatorEnrollmentResult.enrollment_date) {
    // Use later of: sinceDate or facilitator enrollment date for live delta
    const effectiveSinceDate =
      facilitatorEnrollmentResult.enrollment_date > sinceDate
        ? facilitatorEnrollmentResult.enrollment_date
        : sinceDate;

    const liveFacilitatorStmt = db.prepare(`
      SELECT
        COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
        COUNT(DISTINCT t.from_address) as unique_payers
      FROM transactions t
      JOIN facilitators f ON f.id = t.facilitator_id
      WHERE f.owner_address = ?
        AND t.type = 'settle'
        AND t.status = 'success'
        AND t.from_address != t.to_address
        AND t.created_at > ?
        AND t.created_at >= ?
    `);
    const liveFacilitatorResult = liveFacilitatorStmt.get(
      normalizedUserId,
      sinceDate,
      facilitatorEnrollmentResult.enrollment_date
    ) as {
      volume: number;
      unique_payers: number;
    };
    liveFacilitatorVolume = liveFacilitatorResult.volume;
    liveFacilitatorUniquePayers = liveFacilitatorResult.unique_payers;
  }

  // Combine live volumes (they stack)
  const liveVolume = liveAddressResult.volume + liveFacilitatorVolume;

  // Total is snapshot + live delta
  const snapshotVolumeBigInt = BigInt(snapshotData.total_volume);
  const liveVolumeBigInt = BigInt(liveVolume);
  const totalVolume = snapshotVolumeBigInt + liveVolumeBigInt;

  // Unique payers: we can't just add them (would double count), so use snapshot value
  // Live unique payers are an approximation (may overlap with snapshot)
  const totalUniquePayers =
    snapshotData.unique_payers +
    liveAddressResult.unique_payers +
    liveFacilitatorUniquePayers;

  return {
    total_volume: totalVolume.toString(),
    unique_payers: totalUniquePayers,
    snapshot_volume: snapshotData.total_volume,
    live_volume: liveVolume.toString(),
    last_snapshot_date: lastSnapshotDate,
  };
}

/**
 * Create daily volume snapshots for all verified reward addresses
 * Called by external cron scheduler
 *
 * @param campaignId - The campaign ID to create snapshots for
 * @param snapshotDate - The date for the snapshot (YYYY-MM-DD format)
 * @returns Number of snapshots created/updated
 */
export function createDailySnapshots(
  campaignId: string,
  snapshotDate: string
): number {
  const db = getDatabase();

  // Get all verified reward addresses (excluding facilitator markers)
  const addressesStmt = db.prepare(`
    SELECT ra.id, ra.user_id, ra.address, ra.chain_type, ra.created_at
    FROM reward_addresses ra
    WHERE ra.verification_status = 'verified'
      AND ra.chain_type != 'facilitator'
  `);
  const addresses = addressesStmt.all() as RewardAddressRecord[];

  let processed = 0;

  for (const addr of addresses) {
    // Calculate cumulative volume from enrollment to snapshot date
    const volumeData = getVolumeByAddress(addr.id, addr.created_at);

    // Upsert snapshot
    upsertVolumeSnapshot({
      reward_address_id: addr.id,
      campaign_id: campaignId,
      snapshot_date: snapshotDate,
      volume: volumeData.volume,
      unique_payers: volumeData.unique_payers,
    });

    processed++;
  }

  // Handle facilitator ownership snapshots separately
  // Get all users with facilitator markers
  const facilitatorMarkersStmt = db.prepare(`
    SELECT DISTINCT ra.id, ra.user_id, ra.created_at
    FROM reward_addresses ra
    WHERE ra.verification_status = 'verified'
      AND ra.chain_type = 'facilitator'
  `);
  const facilitatorMarkers = facilitatorMarkersStmt.all() as RewardAddressRecord[];

  for (const marker of facilitatorMarkers) {
    // Calculate volume via facilitator ownership
    const volumeData = getVolumeByFacilitatorOwnership(
      marker.user_id,
      marker.created_at
    );

    // Use the marker's ID as the reward_address_id for the snapshot
    upsertVolumeSnapshot({
      reward_address_id: marker.id,
      campaign_id: campaignId,
      snapshot_date: snapshotDate,
      volume: volumeData.volume,
      unique_payers: volumeData.unique_payers,
    });

    processed++;
  }

  return processed;
}

/**
 * Get volume for a specific facilitator
 * Includes only settle transactions with success status
 * Excludes self-transfers
 *
 * @param facilitatorId - The facilitator ID
 * @param sinceDate - ISO date string to count volume from (enrollment date)
 * @returns Volume and unique payers count
 */
export function getVolumeByFacilitator(
  facilitatorId: string,
  sinceDate: string
): { volume: string; unique_payers: number } {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
      COUNT(DISTINCT t.from_address) as unique_payers
    FROM transactions t
    WHERE t.facilitator_id = ?
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at >= ?
  `);

  const result = stmt.get(facilitatorId, sinceDate) as {
    volume: number;
    unique_payers: number;
  };

  return {
    volume: String(result.volume),
    unique_payers: result.unique_payers,
  };
}

/**
 * Get per-address volume breakdown for a user
 * Returns each verified address and individual facilitators with their volume
 *
 * @param userId - The user ID
 * @param campaignId - The campaign ID
 * @returns Volume breakdown per address and facilitator
 */
export function getVolumeBreakdownByUser(
  userId: string,
  campaignId: string
): {
  userId: string;
  campaignId: string;
  totalVolume: string;
  addresses: Array<{
    id: string;
    address: string;
    chain_type: 'solana' | 'evm' | 'facilitator';
    volume: string;
    uniquePayers: number;
    // Facilitator-specific fields
    facilitatorId?: string;
    facilitatorName?: string;
    facilitatorFavicon?: string | null;
    facilitatorCustomDomain?: string | null;
  }>;
} {
  const db = getDatabase();
  const normalizedUserId = userId.toLowerCase();

  // Get all verified pay-to addresses for this user (NOT facilitator markers)
  const addressesStmt = db.prepare(`
    SELECT ra.id, ra.address, ra.chain_type, ra.created_at
    FROM reward_addresses ra
    WHERE ra.user_id = ?
      AND ra.verification_status = 'verified'
      AND ra.chain_type != 'facilitator'
  `);
  const addresses = addressesStmt.all(userId) as Array<{
    id: string;
    address: string;
    chain_type: 'solana' | 'evm';
    created_at: string;
  }>;

  // Get the facilitator enrollment marker to check if enrolled
  const enrollmentStmt = db.prepare(`
    SELECT ra.created_at
    FROM reward_addresses ra
    WHERE ra.user_id = ?
      AND ra.verification_status = 'verified'
      AND ra.chain_type = 'facilitator'
    LIMIT 1
  `);
  const enrollmentMarker = enrollmentStmt.get(userId) as { created_at: string } | undefined;

  const result: Array<{
    id: string;
    address: string;
    chain_type: 'solana' | 'evm' | 'facilitator';
    volume: string;
    uniquePayers: number;
    facilitatorId?: string;
    facilitatorName?: string;
    facilitatorFavicon?: string | null;
    facilitatorCustomDomain?: string | null;
  }> = [];

  let totalVolumeBigInt = BigInt(0);

  // Add pay-to addresses
  for (const addr of addresses) {
    const volumeData = getVolumeByAddress(addr.id, addr.created_at);
    totalVolumeBigInt += BigInt(volumeData.volume);

    result.push({
      id: addr.id,
      address: addr.address,
      chain_type: addr.chain_type,
      volume: volumeData.volume,
      uniquePayers: volumeData.unique_payers,
    });
  }

  // Add individual facilitators if user is enrolled
  if (enrollmentMarker) {
    const facilitators = getFacilitatorsByOwner(normalizedUserId);

    for (const facilitator of facilitators) {
      // Use the later of: enrollment date or facilitator creation date
      const effectiveSinceDate = facilitator.created_at > enrollmentMarker.created_at
        ? facilitator.created_at
        : enrollmentMarker.created_at;

      const volumeData = getVolumeByFacilitator(facilitator.id, effectiveSinceDate);
      totalVolumeBigInt += BigInt(volumeData.volume);

      result.push({
        id: `facilitator-${facilitator.id}`,
        address: facilitator.custom_domain || facilitator.subdomain,
        chain_type: 'facilitator',
        volume: volumeData.volume,
        uniquePayers: volumeData.unique_payers,
        facilitatorId: facilitator.id,
        facilitatorName: facilitator.name,
        facilitatorFavicon: facilitator.favicon,
        facilitatorCustomDomain: facilitator.custom_domain,
      });
    }
  }

  return {
    userId,
    campaignId,
    totalVolume: totalVolumeBigInt.toString(),
    addresses: result,
  };
}

/**
 * Get total pool volume for a campaign (all enrolled users)
 * Combines:
 * 1. Snapshot volume (pre-computed daily totals)
 * 2. Live delta (transactions since last snapshot for all enrolled addresses)
 *
 * @param campaignId - The campaign ID
 * @returns Total pool volume and participant count
 */
export function getTotalPoolVolume(campaignId: string): {
  total_volume: string;
  participant_count: number;
} {
  const db = getDatabase();

  // Get snapshot totals
  const snapshotStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(vs.volume AS INTEGER)), 0) as snapshot_volume,
      COUNT(DISTINCT ra.user_id) as participant_count
    FROM volume_snapshots vs
    JOIN reward_addresses ra ON vs.reward_address_id = ra.id
    WHERE vs.campaign_id = ?
  `);
  const snapshotData = snapshotStmt.get(campaignId) as {
    snapshot_volume: number;
    participant_count: number;
  };

  // Get the most recent snapshot date for this campaign
  const lastSnapshotStmt = db.prepare(`
    SELECT MAX(snapshot_date) as last_date
    FROM volume_snapshots
    WHERE campaign_id = ?
  `);
  const lastSnapshotResult = lastSnapshotStmt.get(campaignId) as {
    last_date: string | null;
  };
  const lastSnapshotDate = lastSnapshotResult.last_date || '1970-01-01';

  // Get live volume from verified addresses (since last snapshot)
  const liveAddressStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
      COUNT(DISTINCT ra.user_id) as new_participants
    FROM transactions t
    JOIN reward_addresses ra ON ra.address = t.to_address
    WHERE ra.verification_status = 'verified'
      AND ra.chain_type != 'facilitator'
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at > ?
      AND t.created_at >= ra.created_at
  `);
  const liveAddressResult = liveAddressStmt.get(lastSnapshotDate) as {
    volume: number;
    new_participants: number;
  };

  // Get live volume from facilitator ownership (since last snapshot)
  const liveFacilitatorStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume
    FROM transactions t
    JOIN facilitators f ON f.id = t.facilitator_id
    JOIN reward_addresses ra ON LOWER(ra.user_id) = f.owner_address
    WHERE ra.verification_status = 'verified'
      AND ra.chain_type = 'facilitator'
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at > ?
      AND t.created_at >= ra.created_at
  `);
  const liveFacilitatorResult = liveFacilitatorStmt.get(lastSnapshotDate) as {
    volume: number;
  };

  // Combine totals
  const totalVolume =
    BigInt(snapshotData.snapshot_volume) +
    BigInt(liveAddressResult.volume) +
    BigInt(liveFacilitatorResult.volume);

  // Participant count: unique users from snapshots plus any new from live
  // This is an approximation (we use snapshot count as base)
  const participantCount = Math.max(
    snapshotData.participant_count,
    liveAddressResult.new_participants
  );

  return {
    total_volume: totalVolume.toString(),
    participant_count: participantCount,
  };
}

/**
 * Get total effective pool volume for a campaign (with multipliers applied)
 * This is the denominator for calculating reward shares:
 * - Non-facilitator volume counts as 1x
 * - Facilitator-owned volume counts as multiplier (e.g., 2x)
 *
 * @param campaignId - The campaign ID
 * @param facilitatorMultiplier - The multiplier for facilitator owners (from campaign)
 * @returns Total effective volume and participant count
 */
export function getTotalEffectivePoolVolume(
  campaignId: string,
  facilitatorMultiplier: number
): {
  total_effective_volume: string;
  raw_volume: string;
  participant_count: number;
} {
  const db = getDatabase();

  // Get snapshot totals split by type (facilitator vs non-facilitator)
  const snapshotStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN ra.chain_type = 'facilitator' THEN CAST(vs.volume AS INTEGER) ELSE 0 END), 0) as facilitator_volume,
      COALESCE(SUM(CASE WHEN ra.chain_type != 'facilitator' THEN CAST(vs.volume AS INTEGER) ELSE 0 END), 0) as address_volume,
      COUNT(DISTINCT ra.user_id) as participant_count
    FROM volume_snapshots vs
    JOIN reward_addresses ra ON vs.reward_address_id = ra.id
    WHERE vs.campaign_id = ?
  `);
  const snapshotData = snapshotStmt.get(campaignId) as {
    facilitator_volume: number;
    address_volume: number;
    participant_count: number;
  };

  // Get the most recent snapshot date for this campaign
  const lastSnapshotStmt = db.prepare(`
    SELECT MAX(snapshot_date) as last_date
    FROM volume_snapshots
    WHERE campaign_id = ?
  `);
  const lastSnapshotResult = lastSnapshotStmt.get(campaignId) as {
    last_date: string | null;
  };
  const lastSnapshotDate = lastSnapshotResult.last_date || '1970-01-01';

  // Get live volume from verified addresses (since last snapshot) - no multiplier
  const liveAddressStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume,
      COUNT(DISTINCT ra.user_id) as new_participants
    FROM transactions t
    JOIN reward_addresses ra ON ra.address = t.to_address
    WHERE ra.verification_status = 'verified'
      AND ra.chain_type != 'facilitator'
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at > ?
      AND t.created_at >= ra.created_at
  `);
  const liveAddressResult = liveAddressStmt.get(lastSnapshotDate) as {
    volume: number;
    new_participants: number;
  };

  // Get live volume from facilitator ownership (since last snapshot) - gets multiplier
  const liveFacilitatorStmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume
    FROM transactions t
    JOIN facilitators f ON f.id = t.facilitator_id
    JOIN reward_addresses ra ON LOWER(ra.user_id) = f.owner_address
    WHERE ra.verification_status = 'verified'
      AND ra.chain_type = 'facilitator'
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at > ?
      AND t.created_at >= ra.created_at
  `);
  const liveFacilitatorResult = liveFacilitatorStmt.get(lastSnapshotDate) as {
    volume: number;
  };

  // Calculate raw volume (for reference)
  const rawVolume =
    BigInt(snapshotData.facilitator_volume) +
    BigInt(snapshotData.address_volume) +
    BigInt(liveAddressResult.volume) +
    BigInt(liveFacilitatorResult.volume);

  // Calculate effective volume (with multiplier applied to facilitator volume)
  const totalFacilitatorVolume =
    BigInt(snapshotData.facilitator_volume) + BigInt(liveFacilitatorResult.volume);
  const totalAddressVolume =
    BigInt(snapshotData.address_volume) + BigInt(liveAddressResult.volume);

  // Apply multiplier to facilitator volume
  const effectiveFacilitatorVolume =
    (totalFacilitatorVolume * BigInt(Math.round(facilitatorMultiplier * 1000))) / BigInt(1000);

  const totalEffectiveVolume = effectiveFacilitatorVolume + totalAddressVolume;

  // Participant count
  const participantCount = Math.max(
    snapshotData.participant_count,
    liveAddressResult.new_participants
  );

  return {
    total_effective_volume: totalEffectiveVolume.toString(),
    raw_volume: rawVolume.toString(),
    participant_count: participantCount,
  };
}
