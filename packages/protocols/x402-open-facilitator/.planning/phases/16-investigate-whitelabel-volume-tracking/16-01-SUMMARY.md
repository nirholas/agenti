---
phase: 16-investigate-whitelabel-volume-tracking
plan: 01
subsystem: database
tags: [sqlite, volume-tracking, rewards, facilitators]

# Dependency graph
requires:
  - phase: 10-rewards-volume-aggregation
    provides: volume aggregation queries that use reward_addresses chain_type='facilitator'
provides:
  - createFacilitatorMarker function for creating enrollment markers
  - ensureFacilitatorMarker function for idempotent marker creation
  - backfillFacilitatorMarkers function for existing facilitator owners
  - Automatic marker creation in facilitator creation flow
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Enrollment markers using reward_addresses with chain_type='facilitator'"
    - "Deterministic address format: FACILITATOR_OWNER:{userId}"
    - "Backfill on database initialization"

key-files:
  created: []
  modified:
    - packages/server/src/db/reward-addresses.ts
    - packages/server/src/db/facilitators.ts
    - packages/server/src/routes/admin.ts
    - packages/server/src/routes/internal-webhooks.ts
    - packages/server/src/db/index.ts
    - packages/server/src/index.ts
    - packages/server/src/server.test.ts

key-decisions:
  - "User existence check before marker creation prevents FK constraint errors"
  - "Backfill runs on database initialization after tables are created"
  - "initializeDatabase made async to support backfill"

patterns-established:
  - "Enrollment markers: use reward_addresses with chain_type='facilitator' for owner volume tracking"

# Metrics
duration: 5min
completed: 2026-01-21
---

# Phase 16 Plan 01: Whitelabel Volume Tracking Fix Summary

**Facilitator enrollment markers via reward_addresses chain_type='facilitator' with deterministic FACILITATOR_OWNER:{userId} addresses**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-21T20:42:14Z
- **Completed:** 2026-01-21T20:47:16Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added createFacilitatorMarker and ensureFacilitatorMarker functions for enrollment marker management
- Integrated automatic marker creation into both facilitator creation paths (admin and subscription webhook)
- Added backfill function that runs on server startup to create missing markers for existing owners
- Protected against FK constraint errors by checking user existence before marker creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add facilitator marker creation functions** - `d5a827e` (feat)
2. **Task 2: Integrate marker creation into facilitator creation flow** - `4e672d8` (feat)
3. **Task 3: Create and run backfill for existing facilitator owners** - `916a0ca` (feat)

## Files Created/Modified
- `packages/server/src/db/reward-addresses.ts` - Added createFacilitatorMarker function
- `packages/server/src/db/facilitators.ts` - Added ensureFacilitatorMarker and backfillFacilitatorMarkers functions
- `packages/server/src/routes/admin.ts` - Call ensureFacilitatorMarker after facilitator creation
- `packages/server/src/routes/internal-webhooks.ts` - Call ensureFacilitatorMarker after facilitator creation
- `packages/server/src/db/index.ts` - Run backfill on database initialization, made async
- `packages/server/src/index.ts` - Await async initializeDatabase
- `packages/server/src/server.test.ts` - Updated for async database initialization

## Decisions Made
- **User existence check:** Added check for user in "user" table before creating marker to prevent FK constraint violations (existing facilitators may have owner_address values that don't exist as users)
- **Async database initialization:** Made initializeDatabase async to properly await backfill completion
- **Backfill timing:** Run backfill after all tables are created in initializeDatabase rather than on module load

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Database not initialized error on module load**
- **Found during:** Task 3 (backfill implementation)
- **Issue:** Running backfill on module load caused "Database not initialized" error because facilitators.ts is imported before initializeDatabase is called
- **Fix:** Moved backfill call to end of initializeDatabase function instead of module load
- **Files modified:** packages/server/src/db/index.ts, packages/server/src/db/facilitators.ts
- **Verification:** Server starts without initialization errors
- **Committed in:** 916a0ca (Task 3 commit)

**2. [Rule 1 - Bug] Foreign key constraint violation on marker creation**
- **Found during:** Task 3 (backfill testing)
- **Issue:** Creating markers for facilitator owners that don't exist in "user" table caused SQLITE_CONSTRAINT_FOREIGNKEY error
- **Fix:** Added user existence check in ensureFacilitatorMarker before creating marker
- **Files modified:** packages/server/src/db/facilitators.ts
- **Verification:** Server starts without FK constraint errors
- **Committed in:** 916a0ca (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Volume tracking fix is complete
- Facilitator owners with valid user accounts will see their volume on the rewards page
- New facilitator owners automatically get enrollment markers
- Existing facilitator owners with valid user accounts get markers on server startup

---
*Phase: 16-investigate-whitelabel-volume-tracking*
*Completed: 2026-01-21*
