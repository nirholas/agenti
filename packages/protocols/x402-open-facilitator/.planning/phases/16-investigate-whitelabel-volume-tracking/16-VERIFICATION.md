---
phase: 16-investigate-whitelabel-volume-tracking
verified: 2026-01-21T21:15:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 16: Investigate Whitelabel Volume Tracking Verification Report

**Phase Goal:** Fix missing volume tracking for users with white-labeled facilitators by creating enrollment markers
**Verified:** 2026-01-21T21:15:00Z
**Status:** PASSED
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Facilitator owners with white-labeled facilitators see their volume on rewards page | VERIFIED | `createFacilitatorMarker` creates `chain_type='facilitator'` records that volume-aggregation.ts queries at lines 152-161 |
| 2 | Volume aggregation includes transactions processed by owned facilitators | VERIFIED | `getVolumeByFacilitatorOwnership` called for facilitator markers in volume-aggregation.ts:348-352 |
| 3 | New facilitator owners automatically get enrollment markers | VERIFIED | `ensureFacilitatorMarker` called in admin.ts:301 and internal-webhooks.ts:88 after facilitator creation |
| 4 | Existing facilitator owners get markers via backfill | VERIFIED | `backfillFacilitatorMarkers` called in db/index.ts:703-714 on database initialization |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/server/src/db/reward-addresses.ts` | `createFacilitatorMarker` function | VERIFIED | Lines 101-135: Creates marker with backdated `created_at`, handles UNIQUE constraint, marks as verified |
| `packages/server/src/db/facilitators.ts` | `ensureFacilitatorMarker` function | VERIFIED | Lines 240-277: Checks user exists, finds earliest facilitator, creates marker idempotently |
| `packages/server/src/db/facilitators.ts` | `backfillFacilitatorMarkers` function | VERIFIED | Lines 284-301: Iterates all unique facilitator owners and calls ensureFacilitatorMarker |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `admin.ts` | `ensureFacilitatorMarker` | import + function call | WIRED | Line 9: import, Line 301: called after `createFacilitator` with `ownerAddress` |
| `internal-webhooks.ts` | `ensureFacilitatorMarker` | import + function call | WIRED | Line 20: import, Line 88: called after facilitator creation with `pending.user_id` |
| `db/index.ts` | `backfillFacilitatorMarkers` | dynamic import + call | WIRED | Lines 703-714: Dynamic import to avoid circular deps, called after all tables created |
| `volume-aggregation.ts` | `reward_addresses` | SQL query `chain_type='facilitator'` | WIRED | Lines 152-161: Queries for facilitator enrollment date for volume calculation |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FIX-01: Create missing facilitator markers | SATISFIED | `backfillFacilitatorMarkers` creates markers for all existing owners on startup |
| FIX-02: Auto-create on new facilitators | SATISFIED | Both `admin.ts` and `internal-webhooks.ts` call `ensureFacilitatorMarker` after creation |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

Scanned files for TODO/FIXME/placeholder patterns:
- `packages/server/src/db/reward-addresses.ts`: No stubs found
- `packages/server/src/db/facilitators.ts`: No stubs found
- `packages/server/src/routes/admin.ts`: No stubs in relevant sections
- `packages/server/src/routes/internal-webhooks.ts`: No stubs found

### Build Verification

```
TypeScript compilation: SUCCESS
pnpm --filter=@openfacilitator/server build completed without errors
```

### Human Verification Required

#### 1. Volume Display on Rewards Page
**Test:** Log in as a user who owns a white-labeled facilitator, navigate to rewards page
**Expected:** Volume should display total including transactions processed by owned facilitators
**Why human:** Requires visual confirmation of UI rendering and actual database state

#### 2. Backfill Message on Server Start
**Test:** Start server with fresh database or restart existing server
**Expected:** Console shows `[Facilitator Backfill] Created N missing enrollment markers` if any owners lack markers
**Why human:** Requires server restart and log inspection

#### 3. New Facilitator Creation Flow
**Test:** Create a new facilitator via dashboard (requires subscription)
**Expected:** Facilitator owner automatically gets enrollment marker, volume tracking starts immediately
**Why human:** End-to-end flow requires payment/subscription and multiple system interactions

## Implementation Quality

### Function Analysis

**createFacilitatorMarker (reward-addresses.ts:101-135)**
- Lines: 35 (substantive)
- Exports: Yes
- Key features:
  - Deterministic address format: `FACILITATOR_OWNER:{userId}`
  - Backdates `created_at` to capture historical volume
  - Immediately marks as verified
  - Idempotent via UNIQUE constraint handling

**ensureFacilitatorMarker (facilitators.ts:240-277)**
- Lines: 38 (substantive)
- Exports: Yes
- Key features:
  - Validates user exists in `user` table (FK constraint protection)
  - Checks if marker already exists (idempotent)
  - Uses earliest facilitator's `created_at` for enrollment date
  - Normalizes userId to lowercase

**backfillFacilitatorMarkers (facilitators.ts:284-301)**
- Lines: 18 (substantive)
- Exports: Yes
- Key features:
  - Queries all unique facilitator owners
  - Calls ensureFacilitatorMarker for each (safe due to idempotency)
  - Returns count of created markers

### Wiring Quality

All key links verified as correctly wired:
1. Imports are explicit and from correct module paths (`.js` extensions)
2. Functions called with correct parameters
3. Backfill runs after database tables created (timing correct)
4. Volume aggregation queries correctly filter/include facilitator markers

## Summary

Phase 16 goal **achieved**. The implementation:

1. **Root cause addressed:** Missing `chain_type='facilitator'` enrollment markers now created via:
   - Backfill for existing owners (runs on server startup)
   - Auto-creation in both facilitator creation paths (admin + subscription webhook)

2. **Volume tracking works:** Volume aggregation queries (`volume-aggregation.ts`) correctly:
   - Query facilitator enrollment date from markers
   - Include facilitator-based volume in user totals
   - Display breakdown with `chain_type='facilitator'` entries

3. **Idempotent and safe:** All marker creation is idempotent:
   - UNIQUE constraint prevents duplicates
   - User existence check prevents FK violations
   - Backfill can run repeatedly without issues

4. **Commits verified:**
   - `d5a827e` - Task 1: Add facilitator marker creation functions
   - `4e672d8` - Task 2: Integrate marker creation into facilitator creation flow
   - `916a0ca` - Task 3: Create and run backfill for existing facilitator owners

---

*Verified: 2026-01-21T21:15:00Z*
*Verifier: Claude (gsd-verifier)*
