---
phase: 10-claims-engine
plan: 01
subsystem: api
tags: [rewards, claims, eligibility, bigint, proportional-share]

# Dependency graph
requires:
  - phase: 09-wallet-connection
    provides: Claim wallet connection flow
  - phase: 06-volume-tracking-engine
    provides: getUserTotalVolume function
  - phase: 07-campaign-system
    provides: Campaign CRUD and status management
provides:
  - Claim eligibility checking service
  - Proportional reward calculation with BigInt precision
  - Eligibility API endpoint with automatic claim creation
  - Frontend eligibility display with specific reasons
affects: [10-02-claim-execution, 10-03-claim-history]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BigInt for token calculations"
    - "Lazy claim record creation on eligibility check"
    - "30-day claim window enforcement"

key-files:
  created:
    - packages/server/src/services/reward-claims.ts
  modified:
    - packages/server/src/db/reward-claims.ts
    - packages/server/src/routes/rewards.ts
    - apps/dashboard/src/lib/api.ts
    - apps/dashboard/src/components/rewards/progress-dashboard.tsx

key-decisions:
  - "D-10-01-001: Claim records created lazily on first eligibility check"
  - "D-10-01-002: 30-day claim window enforced in eligibility service"
  - "D-10-01-003: Facilitator multiplier applied to effective volume for proportional share"

patterns-established:
  - "Eligibility service pattern: check criteria, calculate reward, create record"
  - "BigInt arithmetic for all token amount calculations"

# Metrics
duration: 2m 29s
completed: 2026-01-20
---

# Phase 10 Plan 01: Claim Eligibility Summary

**Claim eligibility checking with proportional reward calculation using BigInt precision, automatic claim record creation, and frontend display with specific ineligibility reasons**

## Performance

- **Duration:** 2m 29s
- **Started:** 2026-01-20T18:27:04Z
- **Completed:** 2026-01-20T18:29:33Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Eligibility service validates campaign ended, 30-day window, threshold met
- Proportional reward calculation with BigInt precision for accuracy
- Facilitator owners get 2x multiplier applied to effective volume
- Claim records created automatically when user checks eligibility and is eligible
- Frontend shows specific reasons for ineligibility (window expired, volume needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create reward claims service** - `ea6f92b` (feat)
2. **Task 2: Add eligibility API and frontend** - `3d6d54f` (feat)

## Files Created/Modified

- `packages/server/src/services/reward-claims.ts` - Eligibility checking and reward calculation service
- `packages/server/src/db/reward-claims.ts` - Added getTotalQualifyingVolume() function
- `packages/server/src/routes/rewards.ts` - Added GET /campaigns/:id/eligibility endpoint
- `apps/dashboard/src/lib/api.ts` - Added getClaimEligibility() method
- `apps/dashboard/src/components/rewards/progress-dashboard.tsx` - Auto-check eligibility on campaign end

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-10-01-001 | Claim records created lazily on first eligibility check | Avoids batch processing at campaign end; records created when user needs them |
| D-10-01-002 | 30-day claim window enforced in service layer | Consistent enforcement regardless of how eligibility is checked |
| D-10-01-003 | Facilitator multiplier applied to effective volume | Multiplier affects proportional share calculation, giving owners larger rewards |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Eligibility infrastructure ready for claim execution (Plan 02)
- Claim records have all necessary fields: volume, base reward, multiplier, final reward
- Frontend displays claim button when pending claim exists
- Ready for SPL token transfer implementation

---
*Phase: 10-claims-engine*
*Completed: 2026-01-20*
