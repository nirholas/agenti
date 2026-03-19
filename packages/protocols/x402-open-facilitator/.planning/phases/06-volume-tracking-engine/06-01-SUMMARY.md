---
phase: 06-volume-tracking-engine
plan: 01
subsystem: api
tags: [volume-tracking, rewards, sql-aggregation, cron-jobs]

# Dependency graph
requires:
  - phase: 01-database-foundation
    provides: transactions table, reward_addresses table, volume_snapshots table
  - phase: 03-solana-address-management
    provides: reward address enrollment, facilitator owner auto-enrollment
provides:
  - Volume aggregation service with address-based and facilitator-based attribution
  - Daily snapshot job endpoint for external cron schedulers
  - User volume API endpoint returning snapshot + live delta totals
affects: [08-rewards-dashboard, 10-claims-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [snapshot-plus-live-delta, dual-attribution-stacking, cron-secret-authentication]

key-files:
  created:
    - packages/server/src/db/volume-aggregation.ts
  modified:
    - packages/server/src/db/index.ts
    - packages/server/src/routes/rewards.ts

key-decisions:
  - "D-06-01-001: Volume aggregation uses snapshot + live delta pattern for performance"
  - "D-06-01-002: Address-based and facilitator-ownership volume stack (2x when both apply)"
  - "D-06-01-003: Snapshot endpoint uses CRON_SECRET header (not auth middleware) for external scheduler access"

patterns-established:
  - "Snapshot + Live Delta: Pre-compute daily totals, query live delta since last snapshot"
  - "CRON_SECRET Authentication: x-cron-secret header for external scheduler endpoints"
  - "Dual Attribution: Address-based and facilitator-ownership volume sum (stack, not dedupe)"

# Metrics
duration: 2m 34s
completed: 2026-01-20
---

# Phase 06 Plan 01: Volume Aggregation Service Summary

**SQL-based volume aggregation with settle/success/verified filtering, self-transfer exclusion, and snapshot + live delta pattern**

## Performance

- **Duration:** 2m 34s
- **Started:** 2026-01-20T14:02:14Z
- **Completed:** 2026-01-20T14:04:48Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Volume aggregation queries filter for settle/success/verified transactions only
- Self-transfer exclusion in all volume queries (from_address != to_address)
- Unique payers tracked via COUNT(DISTINCT from_address)
- Daily snapshot job endpoint protected by CRON_SECRET header
- User volume API returns combined snapshot + live delta totals
- Dual attribution: address-based and facilitator-ownership volume stack

## Task Commits

Each task was committed atomically:

1. **Task 1: Create volume aggregation service** - `a323591` (feat)
2. **Task 2: Add snapshot job endpoint** - `48fcbbd` (feat)
3. **Task 3: Add user volume API endpoint** - `a739f5a` (feat)

## Files Created/Modified
- `packages/server/src/db/volume-aggregation.ts` - Volume calculation functions (getVolumeByAddress, getVolumeByFacilitatorOwnership, getUserTotalVolume, createDailySnapshots)
- `packages/server/src/db/index.ts` - Export volume-aggregation module
- `packages/server/src/routes/rewards.ts` - POST /snapshot and GET /volume endpoints

## Decisions Made
- **D-06-01-001:** Volume aggregation uses snapshot + live delta pattern for performance - daily batch computes totals, API adds live delta since last snapshot
- **D-06-01-002:** Address-based and facilitator-ownership volume stack (per CONTEXT.md) - if user has verified address that is also their facilitator's pay-to, volume counts 2x
- **D-06-01-003:** Snapshot endpoint uses CRON_SECRET header authentication (not requireAuth) - allows external schedulers (Railway cron, Vercel cron) to trigger without user session

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Environment variable required for snapshot endpoint:
- `CRON_SECRET` - Secret value for authenticating cron job requests to POST /api/rewards/snapshot

## Next Phase Readiness
- Volume aggregation complete, ready for rewards dashboard (Phase 8)
- Daily snapshots can be triggered by external cron once CRON_SECRET is configured
- Volume API ready for dashboard integration

---
*Phase: 06-volume-tracking-engine*
*Completed: 2026-01-20*
