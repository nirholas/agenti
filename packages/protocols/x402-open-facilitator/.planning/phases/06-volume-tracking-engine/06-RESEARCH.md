# Phase 6: Volume Tracking Engine - Research

**Researched:** 2026-01-20
**Domain:** Transaction volume aggregation, price conversion, batch processing
**Confidence:** HIGH

## Summary

Phase 6 implements volume tracking for the rewards program. The system must aggregate transaction volumes from the existing `transactions` table, filter for qualifying transactions (settle only, success only, verified addresses), exclude self-transfers, and track unique payers per address. The implementation uses daily batch snapshots with a live delta calculation pattern.

Key insights from research:
1. **USD conversion is simplified** because the system only uses USDC (1:1 to USD) - no price API needed for current tokens
2. **Existing schema is well-suited** - the `volume_snapshots` table already exists with the right structure
3. **The "snapshot + live delta" pattern** is standard for balancing accuracy and performance

**Primary recommendation:** Implement volume calculation as SQL aggregations against the `transactions` table, using the existing `volume_snapshots` table for daily batch results. The daily job endpoint should be a simple HTTP POST that external schedulers (Railway cron, Vercel cron, etc.) can call.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | (existing) | Database operations | Already in use, synchronous API perfect for batch jobs |
| express | (existing) | HTTP endpoint for cron job trigger | Already in use |
| nanoid | (existing) | ID generation | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (existing) | Request validation | For cron job endpoint input validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| External cron trigger | node-cron in-process | External is better for serverless/Railway; in-process requires persistent server |
| Daily batch only | Real-time incremental | Batch is simpler, matches CONTEXT.md decision |
| Price API (CoinGecko) | Hard-coded rates | USDC is 1:1, no external API needed currently |

**Installation:** No new packages required - all dependencies already exist in the project.

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/
  db/
    volume-snapshots.ts      # (exists) CRUD for volume_snapshots table
    volume-aggregation.ts    # NEW: aggregation queries
  routes/
    rewards.ts               # (exists) add volume endpoints
  services/
    volume-service.ts        # NEW: volume calculation business logic
```

### Pattern 1: Snapshot + Live Delta
**What:** Store daily aggregated totals in snapshots, calculate live delta from transactions since last snapshot
**When to use:** When you need both historical accuracy and real-time visibility
**Example:**
```typescript
// Get user's total volume for a campaign
function getUserVolume(userId: string, campaignId: string): VolumeResult {
  // 1. Get snapshot total (fast, pre-computed)
  const snapshotTotal = getSnapshotVolume(userId, campaignId);

  // 2. Get live delta (query transactions since last snapshot)
  const lastSnapshotDate = getLastSnapshotDate(userId, campaignId);
  const liveDelta = getLiveVolumeSince(userId, campaignId, lastSnapshotDate);

  return {
    total: BigInt(snapshotTotal) + BigInt(liveDelta),
    snapshotVolume: snapshotTotal,
    liveVolume: liveDelta,
    lastSnapshotDate
  };
}
```

### Pattern 2: Dual Attribution (Address + Facilitator Ownership)
**What:** Volume counts both for verified addresses AND for facilitator owners
**When to use:** Per CONTEXT.md - both attribution paths are valid, and they stack (2x if user has verified address that is also their facilitator's pay-to)
**Example:**
```typescript
// Volume attribution SQL
// 1. Address-based: transaction.to_address matches user's verified reward_address
// 2. Ownership-based: transaction.facilitator_id matches facilitator owned by user

const volumeByAddress = `
  SELECT SUM(CAST(t.amount AS INTEGER)) as volume
  FROM transactions t
  JOIN reward_addresses ra ON ra.address = t.to_address
  WHERE ra.user_id = ?
    AND t.type = 'settle'
    AND t.status = 'success'
    AND t.from_address != t.to_address  -- exclude self-transfers
    AND t.created_at >= ra.created_at    -- only after enrollment
`;

const volumeByOwnership = `
  SELECT SUM(CAST(t.amount AS INTEGER)) as volume
  FROM transactions t
  JOIN facilitators f ON f.id = t.facilitator_id
  WHERE f.owner_address = ?
    AND t.type = 'settle'
    AND t.status = 'success'
    AND t.from_address != t.to_address
    -- Note: facilitator owners get credit from enrollment date (stored in reward_addresses with chain_type='facilitator')
`;
```

### Pattern 3: Batch Job Endpoint
**What:** HTTP endpoint that triggers daily aggregation, called by external scheduler
**When to use:** Per CONTEXT.md - daily batch job via external cron/scheduler
**Example:**
```typescript
// POST /api/admin/volume/snapshot
// Requires admin auth or shared secret for cron service
router.post('/volume/snapshot', async (req, res) => {
  // Verify cron secret
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const campaign = getActiveCampaign();
  if (!campaign) {
    return res.json({ message: 'No active campaign', processed: 0 });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const processed = await createDailySnapshots(campaign.id, today);

  res.json({ message: 'Snapshot complete', processed, date: today });
});
```

### Anti-Patterns to Avoid
- **Real-time aggregation on every request:** Query transactions table for volume on every dashboard load - use snapshots instead
- **Storing volume in user table:** Denormalizing volume into user record - makes historical tracking impossible
- **Ignoring enrollment date:** Counting transactions before user enrolled - violates CONTEXT.md "no retroactive credit"
- **Not excluding self-transfers:** Allows gaming via circular transfers

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting | Custom date string manipulation | `new Date().toISOString().split('T')[0]` | ISO format is standard, SQLite-compatible |
| BigInt arithmetic | Float-based addition for amounts | JavaScript BigInt or string-based SQL SUM | Amounts stored as TEXT for precision (D-01-01-001) |
| Unique payers count | Manual counting in JS | SQL `COUNT(DISTINCT from_address)` | Database does this efficiently |
| Address normalization | Custom lowercase logic | Existing pattern in codebase (EVM lowercase, Solana preserve case) | Decision D-01-01-002 already defined |

**Key insight:** The existing `volume-snapshots.ts` already has the right patterns - `upsertVolumeSnapshot`, `getUserVolumeForCampaign`. Extend these rather than rebuild.

## Common Pitfalls

### Pitfall 1: Floating Point Precision Loss
**What goes wrong:** Using JavaScript Number for summing large transaction amounts
**Why it happens:** Amounts are stored as TEXT strings representing atomic units (e.g., "50000000" = $50 USDC)
**How to avoid:** Use SQL SUM with CAST, keep as strings until final display
**Warning signs:** Volume totals that don't match manual addition, off-by-one cents

### Pitfall 2: Enrollment Date Filtering Omission
**What goes wrong:** Including transactions from before user enrolled
**Why it happens:** Forgetting the `t.created_at >= ra.created_at` condition
**How to avoid:** Always join with reward_addresses and filter by enrollment date
**Warning signs:** New users showing volume from historical transactions

### Pitfall 3: Self-Transfer Inclusion
**What goes wrong:** Counting transactions where from_address == to_address
**Why it happens:** Easy to forget the exclusion filter
**How to avoid:** Add `AND t.from_address != t.to_address` to all volume queries
**Warning signs:** Suspicious spikes in volume from single addresses

### Pitfall 4: Double Attribution Without Stacking
**What goes wrong:** Treating address-based and ownership-based attribution as OR instead of AND
**Why it happens:** Misreading CONTEXT.md - it says they stack (2x when both apply)
**How to avoid:** Query both attribution types and SUM them (not UNION)
**Warning signs:** Facilitator owners reporting lower volume than expected

### Pitfall 5: Missing Verified Address Filter
**What goes wrong:** Counting volume for pending (unverified) addresses
**Why it happens:** Forgetting `ra.verification_status = 'verified'` filter
**How to avoid:** Always filter to verified addresses only
**Warning signs:** Volume appearing before signature verification

### Pitfall 6: Timezone Issues in Daily Snapshots
**What goes wrong:** Snapshot boundaries inconsistent, transactions counted twice or missed
**Why it happens:** Mixing local time and UTC
**How to avoid:** Use UTC for all date calculations and snapshot_date values
**Warning signs:** Volume discrepancies at midnight boundaries

## Code Examples

Verified patterns from the existing codebase:

### Volume Aggregation Query
```typescript
// Based on existing patterns in transactions.ts
function getVolumeByAddress(
  addressId: string,
  campaignId: string,
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
```

### Daily Snapshot Creation
```typescript
// Based on existing upsertVolumeSnapshot pattern
function createDailySnapshots(campaignId: string, snapshotDate: string): number {
  const db = getDatabase();

  // Get all verified reward addresses
  const addresses = db.prepare(`
    SELECT ra.id, ra.user_id, ra.address, ra.chain_type, ra.created_at
    FROM reward_addresses ra
    WHERE ra.verification_status = 'verified'
  `).all() as RewardAddressRecord[];

  let processed = 0;

  for (const addr of addresses) {
    // Skip facilitator markers (volume tracked via facilitator_id)
    if (addr.chain_type === 'facilitator') {
      // Handle facilitator ownership attribution separately
      continue;
    }

    // Calculate volume up to and including snapshot date
    const volumeData = getVolumeByAddress(
      addr.id,
      campaignId,
      addr.created_at // from enrollment
    );

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

  return processed;
}
```

### Live Delta Calculation
```typescript
function getLiveVolumeSince(
  userId: string,
  campaignId: string,
  sinceDate: string
): string {
  const db = getDatabase();

  // Get transactions since last snapshot for user's verified addresses
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(CAST(t.amount AS INTEGER)), 0) as volume
    FROM transactions t
    JOIN reward_addresses ra ON ra.address = t.to_address
    WHERE ra.user_id = ?
      AND ra.verification_status = 'verified'
      AND t.type = 'settle'
      AND t.status = 'success'
      AND t.from_address != t.to_address
      AND t.created_at > ?
      AND t.created_at >= ra.created_at
  `);

  const result = stmt.get(userId, sinceDate) as { volume: number };
  return String(result.volume);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Price API for USDC conversion | Direct 1:1 (USDC = USD) | N/A - USDC only | No external dependency needed |
| In-process cron (node-cron) | External scheduler endpoint | Modern serverless patterns | Works with Railway, Vercel, any scheduler |
| Real-time aggregation | Snapshot + delta | Performance optimization | Faster dashboard loads |

**Deprecated/outdated:**
- node-schedule: Less flexible than external schedulers for serverless
- Storing amounts as numbers: Decision D-01-01-001 mandates TEXT for precision

## Open Questions

Things that couldn't be fully resolved:

1. **Future non-stablecoin support**
   - What we know: Current system only uses USDC (1:1 to USD)
   - What's unclear: If other tokens added, when to capture exchange rate (transaction time vs query time)
   - Recommendation: Add `usd_value` column to transactions table now for future-proofing; populate with amount for USDC

2. **Campaign date boundaries**
   - What we know: Campaigns have starts_at and ends_at
   - What's unclear: Should volume only count within campaign dates, or all-time from enrollment?
   - Recommendation: Assume per-campaign volume tracking based on table structure (volume_snapshots has campaign_id)

3. **Facilitator ownership attribution timing**
   - What we know: Facilitator owners auto-enrolled with chain_type='facilitator' marker
   - What's unclear: When did they become facilitator owners? Using created_at of that record?
   - Recommendation: Use the reward_address created_at for the facilitator marker as the enrollment date

## Index Optimization Recommendations

Based on research on SQLite aggregation performance:

```sql
-- Recommended indexes for volume queries
CREATE INDEX IF NOT EXISTS idx_transactions_volume_query
  ON transactions(to_address, type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_facilitator_volume
  ON transactions(facilitator_id, type, status, created_at);

CREATE INDEX IF NOT EXISTS idx_reward_addresses_verified
  ON reward_addresses(verification_status, address);
```

These indexes support:
1. Address-based volume aggregation (to_address lookup, filtered by type/status)
2. Facilitator ownership volume aggregation
3. Verified address lookup

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/packages/server/src/db/transactions.ts` - Volume aggregation patterns
- Existing codebase: `/packages/server/src/db/volume-snapshots.ts` - Snapshot CRUD operations
- Existing codebase: `/packages/server/src/db/types.ts` - Schema definitions
- CONTEXT.md: Phase 6 decisions (attribution, timing, anti-gaming)

### Secondary (MEDIUM confidence)
- [SQLite Built-in Aggregate Functions](https://sqlite.org/lang_aggfunc.html) - SUM behavior with TEXT
- [SQLite Query Optimizer](https://sqlite.org/optoverview.html) - Index optimization for GROUP BY
- [Use the Index, Luke - Indexed GROUP BY](https://use-the-index-luke.com/sql/sorting-grouping/indexed-group-by) - Aggregation index patterns

### Tertiary (LOW confidence)
- CoinGecko API documentation - For future price API needs (not needed for USDC)
- External cron patterns from Vercel/Railway docs - Endpoint trigger pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use
- Architecture: HIGH - Based on existing patterns in codebase
- Pitfalls: HIGH - Derived from CONTEXT.md requirements and SQL best practices
- Index optimization: MEDIUM - Standard SQLite patterns, may need tuning

**Research date:** 2026-01-20
**Valid until:** 90 days (stable domain, no external API dependencies)
