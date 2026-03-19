---
phase: 01-database-foundation
plan: 01
subsystem: data-layer
tags: [sqlite, crud, rewards, schema]

dependency-graph:
  requires: []
  provides: [reward-tables, reward-types, reward-crud]
  affects: [02-api-endpoints, 03-volume-indexing, 09-claim-flow]

tech-stack:
  added: []
  patterns: [crud-modules, prepared-statements, nanoid-ids]

file-tracking:
  key-files:
    created:
      - packages/server/src/db/reward-addresses.ts
      - packages/server/src/db/campaigns.ts
      - packages/server/src/db/reward-claims.ts
      - packages/server/src/db/volume-snapshots.ts
    modified:
      - packages/server/src/db/index.ts
      - packages/server/src/db/types.ts

decisions:
  - id: D-01-01-001
    decision: "Store all monetary amounts as TEXT strings to preserve precision"
    rationale: "JavaScript numbers lose precision beyond 53 bits; blockchain amounts can exceed this"
  - id: D-01-01-002
    decision: "Normalize EVM addresses to lowercase, preserve Solana base58 case"
    rationale: "EVM addresses are case-insensitive but case-checksum encoded; Solana base58 is case-sensitive"
  - id: D-01-01-003
    decision: "Use UNIQUE(user_id, campaign_id) on reward_claims to prevent duplicate claims"
    rationale: "One claim per user per campaign matches the rewards program design"

metrics:
  duration: 3m 9s
  completed: 2026-01-19
---

# Phase 01 Plan 01: Rewards Schema and CRUD Summary

**One-liner:** SQLite schema and CRUD modules for reward_addresses, campaigns, reward_claims, and volume_snapshots tables with TypeScript interfaces

## What Was Built

### Tables Created

1. **reward_addresses** - User pay-to addresses for volume tracking
   - Tracks Solana and EVM addresses per user
   - Includes verification status (pending/verified)
   - UNIQUE constraint on (user_id, address)

2. **campaigns** - Reward campaign configuration
   - Stores pool amount, threshold, multiplier settings
   - Status workflow: draft -> active -> ended
   - Timestamps for campaign duration

3. **reward_claims** - User claims against campaigns
   - Links user to campaign with volume and reward amounts
   - Status workflow: pending -> processing -> completed/failed
   - UNIQUE constraint on (user_id, campaign_id) - one claim per user per campaign

4. **volume_snapshots** - Daily volume aggregations per address
   - Tracks volume by reward_address per campaign per day
   - Supports upsert for daily recalculation
   - UNIQUE constraint on (reward_address_id, campaign_id, snapshot_date)

### TypeScript Interfaces

- `RewardAddressRecord`
- `CampaignRecord`
- `RewardClaimRecord`
- `VolumeSnapshotRecord`

### CRUD Functions

**reward-addresses.ts:**
- createRewardAddress, getRewardAddressById, getRewardAddressesByUser
- getRewardAddressByAddress, getVerifiedAddressesByUser
- verifyRewardAddress, deleteRewardAddress

**campaigns.ts:**
- createCampaign, getCampaignById, getActiveCampaign
- getAllCampaigns, updateCampaign, deleteCampaign

**reward-claims.ts:**
- createRewardClaim, getRewardClaimById, getRewardClaimsByUser
- getRewardClaimsByCampaign, getRewardClaimByUserAndCampaign
- updateRewardClaim

**volume-snapshots.ts:**
- createVolumeSnapshot, getVolumeSnapshotById, getVolumeSnapshotsByAddress
- getVolumeSnapshotsByCampaign, getVolumeSnapshotByAddressAndDate
- upsertVolumeSnapshot, getUserVolumeForCampaign

## Commits

| Hash | Message |
|------|---------|
| 84a9e7b | feat(01-01): add reward tables and type definitions |
| e1b6ac9 | feat(01-01): create CRUD modules and wire exports |

## Verification Results

- TypeScript compilation: PASSED
- Database initialization: PASSED
- Tables created: reward_addresses, campaigns, reward_claims, volume_snapshots
- All CRUD modules exported from db/index.ts

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for:**
- Phase 02: API endpoints can now use these CRUD modules
- Phase 03: Volume indexing can write to volume_snapshots table
- Phase 09: Claim flow can read/write reward_claims

**No blockers identified.**
