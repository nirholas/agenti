# Phase 16: Investigate Whitelabel Volume Tracking - Research

**Researched:** 2026-01-21
**Domain:** Bug investigation, database query debugging, SQLite volume aggregation
**Confidence:** HIGH

## Summary

Investigated the reported bug where users with white-labeled facilitators see no volume tracked on rewards page. Through code analysis, identified the root cause: **facilitator owners are missing the required `reward_addresses` record with `chain_type='facilitator'`**, which is used as an enrollment marker to enable facilitator-based volume tracking.

The system architecture expects two parallel volume tracking paths:
1. Pay-to addresses (chain_type='solana'/'evm') - tracks volume sent TO specific addresses
2. Facilitator ownership (chain_type='facilitator' marker) - tracks volume processed BY owned facilitators

The volume aggregation code (`volume-aggregation.ts`) queries for facilitator markers to calculate owner volume, but these markers are never created. During Phase 3 (Solana Address Management), the decision was made to use "clean boolean logic" (`isEnrolled = hasAddresses OR isFacilitatorOwner`) instead of creating marker records, but the volume tracking engine still depends on these markers existing in the database.

**Primary recommendation:** Create missing facilitator marker records for all facilitator owners who lack them. This is a data migration issue, not a logic bug.

## Standard Stack

This is a bug investigation in an existing SQLite + Express + TypeScript codebase. No new libraries needed.

### Core Dependencies (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | Current | Synchronous SQLite database driver | Standard for Node.js SQLite, used throughout project |
| Express | Current | HTTP server | Project's existing server framework |
| TypeScript | 5.9.3 | Type safety | Project language |

### Debugging Tools Available
| Tool | Purpose | When to Use |
|------|---------|-------------|
| SQLite CLI | Query database directly, run EXPLAIN | Verify data exists, test queries |
| Console logging | Trace execution flow | Understand query results |
| TypeScript compiler | Catch type errors early | Before runtime testing |

## Architecture Patterns

### Current Volume Tracking Architecture

The system uses a dual-path architecture for volume attribution:

```
User Volume = Address-Based Volume + Facilitator-Based Volume

Address-Based:
  transactions.to_address → reward_addresses.address
  WHERE chain_type IN ('solana', 'evm')

Facilitator-Based:
  transactions.facilitator_id → facilitators.owner_address
  Requires reward_addresses record with chain_type='facilitator' as enrollment marker
```

### Volume Aggregation Flow

```typescript
// From volume-aggregation.ts getUserTotalVolume()

1. Get snapshot totals (pre-computed daily)
2. Calculate live delta since last snapshot:
   a. Address-based volume (direct payments)
   b. Facilitator-based volume (owned facilitator transactions)
3. Sum: total = snapshot + live_delta
```

### The Missing Marker Problem

**Expected database state:**
```sql
-- User owns facilitator
SELECT * FROM facilitators WHERE owner_address = 'user123';
-- Returns: id='fac1', owner_address='user123', ...

-- User has enrollment marker
SELECT * FROM reward_addresses WHERE user_id = 'user123' AND chain_type = 'facilitator';
-- SHOULD return: id='marker1', user_id='user123', chain_type='facilitator', address='FACILITATOR_OWNER'
-- ACTUALLY returns: (empty)
```

**What happens without the marker:**

```typescript
// volume-aggregation.ts:152-161
const facilitatorEnrollmentStmt = db.prepare(`
  SELECT MIN(ra.created_at) as enrollment_date
  FROM reward_addresses ra
  WHERE ra.user_id = ?
    AND ra.chain_type = 'facilitator'
    AND ra.verification_status = 'verified'
`);
// Returns NULL when no marker exists
// → liveFacilitatorVolume remains 0
// → User's facilitator volume is not counted
```

### Why This Happens

From Phase 3 Summary (03-02-SUMMARY.md):

> **D-03-02-002**: isEnrolled = hasAddresses OR isFacilitatorOwner | Clean boolean logic instead of storing marker records
>
> **Deviation**: Removed facilitator enrollment endpoint — Initially added `/enroll-facilitator` endpoint with `chain_type: facilitator` marker. Replaced with simpler boolean logic in `/status` endpoint.

The UI logic was simplified to avoid creating marker records, but the volume tracking queries still depend on them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data migration script | Custom migration system | Simple TypeScript function called via API route | One-time fix, no need for migration framework |
| Volume debugging | Manual SQL queries in production | Local database inspection + logging | Safer, reproducible |
| Transaction validation | Custom query builder | Existing volume aggregation functions | Already handles edge cases |

**Key insight:** This is a data consistency issue, not a code logic issue. Fix the data, not the algorithm.

## Common Pitfalls

### Pitfall 1: Assuming Logic Bug When It's Data Missing

**What goes wrong:** Developer sees "no volume tracked" and assumes the aggregation queries are broken

**Why it happens:** Code looks correct (it is), query logic looks correct (it is), but data assumptions are violated

**How to avoid:**
1. Verify data exists before debugging queries
2. Check for NULL results from JOIN operations
3. Trace execution with console.log to see intermediate results

**Warning signs:**
- `isFacilitatorOwner()` returns true but volume is 0
- Facilitator exists in `facilitators` table
- No matching record in `reward_addresses` with `chain_type='facilitator'`

### Pitfall 2: Backfilling Historical Volume Without Enrollment Date

**What goes wrong:** Creating markers with `created_at = NOW()` makes past transactions invisible (queries filter by `created_at >= enrollment_date`)

**Why it happens:** Forgetting that volume tracking starts from enrollment date, not all-time

**How to avoid:** When creating missing markers, use the facilitator's `created_at` as the enrollment date

**Implementation:**
```typescript
// CORRECT: Use facilitator creation date
const facilitator = getFacilitatorById(facilitatorId);
createRewardAddress({
  user_id: facilitator.owner_address,
  chain_type: 'facilitator',
  address: 'FACILITATOR_OWNER',
  created_at: facilitator.created_at, // Key: backdate to facilitator creation
});

// WRONG: Would lose historical volume
// created_at: new Date().toISOString()
```

### Pitfall 3: Not Verifying the Fix in Volume Breakdown

**What goes wrong:** Fixing total volume but not checking if breakdown displays correctly

**Why it happens:** Multiple code paths display volume (total endpoint vs breakdown endpoint)

**How to avoid:** Test both endpoints:
- `GET /api/rewards/volume?campaignId=X` - total volume
- `GET /api/rewards/volume/breakdown?campaignId=X` - per-address breakdown

**Verification checklist:**
- [ ] Total volume includes facilitator transactions
- [ ] Breakdown shows "Facilitator Ownership" entry with volume > 0
- [ ] Percentage calculation doesn't divide by zero
- [ ] UI renders facilitator badge correctly

### Pitfall 4: Race Condition Between Facilitator Creation and Marker Creation

**What goes wrong:** New facilitators created after the fix don't get markers automatically

**Why it happens:** No hook in facilitator creation flow to create the marker

**How to avoid:**
1. Add marker creation to facilitator creation endpoint
2. OR: Document that this is expected (markers created on first rewards page visit)
3. OR: Add background job to create missing markers

**Decision required:** Claude's discretion (per CONTEXT.md)

## Code Examples

### Identifying Affected Users

```typescript
// Query to find facilitator owners without markers
const db = getDatabase();

const stmt = db.prepare(`
  SELECT DISTINCT f.owner_address, f.id as facilitator_id, f.created_at
  FROM facilitators f
  LEFT JOIN reward_addresses ra
    ON ra.user_id = f.owner_address
    AND ra.chain_type = 'facilitator'
  WHERE ra.id IS NULL
  ORDER BY f.created_at DESC
`);

const affectedUsers = stmt.all();
// Returns: users who own facilitators but lack enrollment markers
```

### Creating Missing Markers

```typescript
// Based on existing createRewardAddress() function
// From: packages/server/src/db/reward-addresses.ts

import { createRewardAddress, verifyRewardAddress } from './db/reward-addresses.js';
import { getFacilitatorsByOwner } from './db/facilitators.js';

function createMissingFacilitatorMarkers(userId: string): void {
  const facilitators = getFacilitatorsByOwner(userId);

  if (facilitators.length === 0) return;

  // Check if marker already exists
  const existing = getRewardAddressesByUser(userId).find(
    addr => addr.chain_type === 'facilitator'
  );

  if (existing) return; // Already has marker

  // Use earliest facilitator creation date as enrollment date
  const earliestFacilitator = facilitators.reduce((earliest, current) =>
    current.created_at < earliest.created_at ? current : earliest
  );

  // Create marker record
  const marker = createRewardAddress({
    user_id: userId,
    chain_type: 'facilitator',
    address: 'FACILITATOR_OWNER', // Placeholder address (unique constraint)
  });

  if (marker) {
    // Manually set created_at to facilitator creation date
    // (This requires direct SQL since createRewardAddress uses NOW())
    const db = getDatabase();
    db.prepare(`
      UPDATE reward_addresses
      SET created_at = ?
      WHERE id = ?
    `).run(earliestFacilitator.created_at, marker.id);

    // Mark as verified immediately
    verifyRewardAddress(marker.id);
  }
}
```

### Testing the Fix Locally

```typescript
// Add to rewards route or create test endpoint
router.post('/debug/fix-facilitator-markers', requireAuth, async (req, res) => {
  if (!isAdmin(req.user!.id)) {
    return res.status(403).json({ error: 'Admin only' });
  }

  const affectedUsers = /* query from above */;
  const results = [];

  for (const user of affectedUsers) {
    try {
      createMissingFacilitatorMarkers(user.owner_address);
      results.push({ userId: user.owner_address, status: 'fixed' });
    } catch (error) {
      results.push({
        userId: user.owner_address,
        status: 'error',
        error: error.message
      });
    }
  }

  res.json({
    total: affectedUsers.length,
    results
  });
});
```

## Investigation Methodology

### Step 1: Reproduce the Issue

1. Identify a user with white-labeled facilitator who reports missing volume
2. Query database to verify:
   ```sql
   -- User owns facilitator?
   SELECT * FROM facilitators WHERE owner_address = 'USER_ID';

   -- Facilitator has transactions?
   SELECT COUNT(*), SUM(CAST(amount AS INTEGER))
   FROM transactions
   WHERE facilitator_id = 'FACILITATOR_ID'
     AND type = 'settle'
     AND status = 'success';

   -- User has facilitator marker?
   SELECT * FROM reward_addresses
   WHERE user_id = 'USER_ID'
     AND chain_type = 'facilitator';
   ```

### Step 2: Trace Volume Aggregation

Add logging to `getUserTotalVolume()` to see where volume calculation fails:

```typescript
console.log('Snapshot volume:', snapshotData.total_volume);
console.log('Facilitator enrollment:', facilitatorEnrollmentResult);
console.log('Live facilitator volume:', liveFacilitatorVolume);
console.log('Total volume:', totalVolume.toString());
```

### Step 3: Verify Root Cause

Confirm the hypothesis by manually creating a marker for test user:

```sql
INSERT INTO reward_addresses (id, user_id, chain_type, address, verification_status, created_at)
VALUES ('test-marker', 'USER_ID', 'facilitator', 'TEST_FACILITATOR_OWNER', 'verified', 'FACILITATOR_CREATED_AT');
```

Then check if volume appears on rewards page.

### Step 4: Implement Fix

Based on findings, create markers for all affected users (see Code Examples).

### Step 5: Verify in Production

After deployment:
1. Check specific user who reported the issue
2. Verify volume breakdown shows "Facilitator Ownership"
3. Confirm total volume matches expected value
4. Check that future facilitator owners get markers automatically (if implemented)

## Open Questions

### 1. Should markers be created automatically going forward?

**What we know:** Currently no code creates facilitator markers when facilitators are created

**What's unclear:** Should we add this to the facilitator creation flow, or rely on migration/manual creation?

**Recommendation:** Add marker creation to facilitator creation endpoint for consistency. Future facilitator owners should get markers automatically.

**Implementation approach:**
```typescript
// In packages/server/src/routes/facilitator.ts (hypothetical location)
// After creating facilitator:
createRewardAddress({
  user_id: ownerAddress,
  chain_type: 'facilitator',
  address: 'FACILITATOR_OWNER',
});
verifyRewardAddress(/* marker id */);
```

### 2. What about users who create multiple facilitators?

**What we know:** One marker per user (UNIQUE constraint on user_id + address)

**What's unclear:** Does a user with multiple facilitators need multiple markers, or just one?

**Recommendation:** One marker per user is sufficient. Volume aggregation queries by `owner_address`, not by individual facilitator. The marker just signals "this user owns facilitators, start tracking."

### 3. Should we notify affected users?

**What we know:** Fix applies retroactively (uses facilitator created_at), so historical volume will appear

**What's unclear:** Do users need to know their data was migrated?

**Recommendation:** No notification needed. From user perspective, volume "suddenly appears" which is the expected outcome. If asked, explain it was a backend data issue that's been resolved.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create facilitator markers via `/enroll-facilitator` endpoint | Boolean logic only (`isFacilitatorOwner` function) | Phase 3 (Jan 2026) | Simplified UI flow but broke volume tracking assumption |
| Both enrollment paths create database records | Pay-to enrollment creates records, facilitator enrollment uses pure logic | Phase 3 (Jan 2026) | Mismatch between UI state and database requirements |

**Deprecated/outdated:**
- `/enroll-facilitator` endpoint - removed in Phase 3, was correct approach for database consistency

**Current standard:**
- Facilitator ownership checked via `isFacilitatorOwner()` function
- No automatic marker creation for new facilitator owners

**Needed update:**
- Restore marker creation, but do it automatically during facilitator creation, not as separate enrollment step

## Debugging Tools Reference

### SQLite Query Debugging

From [SQLite Official Debugging Guide](https://sqlite.org/debugging.html):

**Explain Query Plan:**
```sql
EXPLAIN QUERY PLAN
SELECT /* your query */;
```

**Enable detailed tracing:**
```sql
.eqp full  -- Show execution plan for every query
.eqp trace -- Combine with VDBE tracing
```

### Node.js SQL Debugging

From better-sqlite3 documentation:

```typescript
// Enable verbose mode to see all queries
const db = new Database('data.db', { verbose: console.log });

// Or selectively log specific queries
const stmt = db.prepare('SELECT ...');
console.log('Executing:', stmt.source);
const result = stmt.all();
console.log('Result:', result);
```

### Foreign Key Validation

From [CockroachDB Foreign Key Mistakes](https://www.cockroachlabs.com/blog/common-foreign-key-mistakes/):

**Find orphaned records:**
```sql
-- Find users with no matching marker
SELECT f.owner_address, COUNT(*) as facilitator_count
FROM facilitators f
LEFT JOIN reward_addresses ra
  ON ra.user_id = f.owner_address
  AND ra.chain_type = 'facilitator'
WHERE ra.id IS NULL
GROUP BY f.owner_address;
```

**Check for missing parent records:**
```sql
-- Find transactions with invalid facilitator_id
SELECT COUNT(*)
FROM transactions t
LEFT JOIN facilitators f ON t.facilitator_id = f.id
WHERE f.id IS NULL AND t.facilitator_id IS NOT NULL;
```

## Sources

### Primary (HIGH confidence)

- Codebase analysis:
  - `packages/server/src/db/volume-aggregation.ts` - Volume calculation logic, lines 152-196
  - `packages/server/src/db/reward-addresses.ts` - Marker creation function
  - `packages/server/src/routes/rewards.ts` - Status endpoint logic, line 68
  - `.planning/phases/03-solana-address-management/03-02-SUMMARY.md` - Design decision documentation

- Database schema:
  - `packages/server/src/db/index.ts` - reward_addresses table definition
  - `packages/server/src/db/types.ts` - Line 281 comment: "chain_type 'facilitator' is used as enrollment marker"

### Secondary (MEDIUM confidence)

- [SQLite Official Debugging Guide](https://sqlite.org/debugging.html) - Query debugging techniques
- [CockroachDB - Common Foreign Key Mistakes](https://www.cockroachlabs.com/blog/common-foreign-key-mistakes/) - Orphaned record patterns
- [Node.js better-sqlite3 Debugging Wiki](https://github.com/tryghost/node-sqlite3/wiki/Debugging) - Verbose mode

### Tertiary (LOW confidence)

- [Medium - Engineer in the Dark - Foreign Key Constraints](https://medium.com/@guvencanguven965/foreign-key-constraints-saved-data-integrity-killed-write-performance-2131b86d8a0f) - Performance considerations (not relevant to this bug, but useful context)

## Metadata

**Confidence breakdown:**
- Root cause identification: HIGH - Code analysis clearly shows missing marker records
- Volume aggregation logic: HIGH - Verified in volume-aggregation.ts, matches expected behavior
- Fix approach: HIGH - Creating markers matches original design intent (Phase 3 docs confirm)
- Implementation details: MEDIUM - Need to verify UNIQUE constraint behavior with manual created_at updates

**Research date:** 2026-01-21
**Valid until:** 90 days (stable codebase, unlikely to change)

**Key finding:** This is not a bug in the volume tracking code. The code is correct and working as designed. The issue is missing data - facilitator owners lack the required enrollment marker records that the volume tracking system depends on. Fix by migrating data, not changing logic.
