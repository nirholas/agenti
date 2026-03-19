# Phase 1: Database Foundation - Research

**Researched:** 2026-01-19
**Domain:** SQLite schema design for rewards program
**Confidence:** HIGH

## Summary

This phase establishes the data layer for a token rewards program. The codebase already uses **better-sqlite3 v11.6.0** with a well-established pattern: plain SQL with prepared statements, TypeScript interfaces for records, and a custom migration system. The rewards schema needs to add four tables (reward_addresses, campaigns, reward_claims, volume_snapshots) that integrate with the existing `user` table from Better Auth.

Key insight: The existing codebase does NOT use an ORM like Drizzle or Prisma. It uses direct SQL with TypeScript types. All new code must follow this pattern exactly.

**Primary recommendation:** Follow the existing patterns in `packages/server/src/db/` exactly. Use the established migration system, type definitions in `types.ts`, and CRUD module pattern.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.6.0 | SQLite driver | Already in use, synchronous API, excellent performance |
| nanoid | ^5.0.9 | ID generation | Already in use for all record IDs |
| TypeScript | ^5.7.2 | Type safety | Already in use throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All dependencies already present |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain SQL | Drizzle ORM | Would require migration of entire codebase; rejected |
| Plain SQL | Kysely | Same issue; codebase is not using query builders |
| nanoid | uuid | nanoid is shorter (21 chars) and URL-safe; already standard here |

**Installation:**
```bash
# No new dependencies needed - all are already in packages/server/package.json
```

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/db/
├── index.ts                    # ADD table creation SQL here
├── types.ts                    # ADD new record interfaces here
├── migrations/
│   ├── index.ts                # REGISTER new migration
│   └── 002_rewards_tables.ts   # NEW migration file
├── reward-addresses.ts         # NEW CRUD module
├── campaigns.ts                # NEW CRUD module
├── reward-claims.ts            # NEW CRUD module
└── volume-snapshots.ts         # NEW CRUD module
```

### Pattern 1: Table Creation in index.ts

**What:** All CREATE TABLE statements go in `initializeDatabase()` function in `index.ts`
**When to use:** Always - this is how the codebase handles table creation
**Example:**
```typescript
// Source: packages/server/src/db/index.ts (existing pattern)
db.exec(`
  -- Reward addresses table (user pay-to addresses for volume tracking)
  CREATE TABLE IF NOT EXISTS reward_addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    chain_type TEXT NOT NULL CHECK (chain_type IN ('solana', 'evm')),
    address TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified')),
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, address)
  );

  CREATE INDEX IF NOT EXISTS idx_reward_addresses_user ON reward_addresses(user_id);
  CREATE INDEX IF NOT EXISTS idx_reward_addresses_address ON reward_addresses(address);
  CREATE INDEX IF NOT EXISTS idx_reward_addresses_chain ON reward_addresses(chain_type);
`);
```

### Pattern 2: Type Definitions in types.ts

**What:** All record interfaces defined in `types.ts`
**When to use:** For every table
**Example:**
```typescript
// Source: packages/server/src/db/types.ts (existing pattern)
/**
 * Reward address database record
 * Pay-to addresses tracked for volume rewards
 */
export interface RewardAddressRecord {
  id: string;
  user_id: string;
  chain_type: 'solana' | 'evm';
  address: string;
  verification_status: 'pending' | 'verified';
  verified_at: string | null;
  created_at: string;
}
```

### Pattern 3: CRUD Module Structure

**What:** Each table gets its own file with create/get/update/delete functions
**When to use:** For every table
**Example:**
```typescript
// Source: packages/server/src/db/facilitators.ts (existing pattern)
import { nanoid } from 'nanoid';
import { getDatabase } from './index.js';
import type { RewardAddressRecord } from './types.js';

export function createRewardAddress(data: {
  user_id: string;
  chain_type: 'solana' | 'evm';
  address: string;
}): RewardAddressRecord | null {
  const db = getDatabase();
  const id = nanoid();

  try {
    const stmt = db.prepare(`
      INSERT INTO reward_addresses (id, user_id, chain_type, address)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, data.user_id, data.chain_type, data.address.toLowerCase());
    return getRewardAddressById(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}
```

### Pattern 4: Migration System

**What:** Migrations use a custom system in `migrations/index.ts`
**When to use:** For schema changes to existing tables (not initial creation)
**Example:**
```typescript
// Source: packages/server/src/db/migrations/001_claims_server_id_nullable.ts
import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration: Migration = {
  name: '002_rewards_tables',

  up(db: Database.Database): void {
    // Schema changes here
    // Note: For NEW tables, add to index.ts CREATE TABLE IF NOT EXISTS
    // Migrations are for ALTERING existing tables
  },
};
```

### Anti-Patterns to Avoid
- **Using an ORM:** The codebase does not use Drizzle, Prisma, or Kysely. Do not introduce one.
- **Creating tables in migrations:** New tables go in `index.ts` with `CREATE TABLE IF NOT EXISTS`. Migrations are for altering existing tables.
- **Using auto-increment IDs:** All tables use nanoid strings for IDs.
- **Storing JSON without type annotations:** JSON columns store strings but have TypeScript types that describe the parsed structure.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation | Custom UUID logic | `nanoid()` | Already standard in codebase |
| Database connection | Manual singleton | `getDatabase()` | Already implemented, handles init |
| Timestamp formatting | Custom date strings | `datetime('now')` | SQLite built-in, consistent |
| Foreign key references | Manual integrity checks | `REFERENCES ... ON DELETE CASCADE` | SQLite enforces automatically |
| Migration tracking | Custom table | Existing `migrations` table | Already built and working |

**Key insight:** The codebase has solved these problems. Copy existing patterns exactly.

## Common Pitfalls

### Pitfall 1: Adding Rewards Tables as Migration Instead of CREATE TABLE IF NOT EXISTS
**What goes wrong:** Creating new tables via migration files
**Why it happens:** Other ORMs use migrations for all schema changes
**How to avoid:** New tables go in `index.ts` initializeDatabase() with CREATE TABLE IF NOT EXISTS
**Warning signs:** Migration file contains CREATE TABLE without ALTER

### Pitfall 2: Forgetting to Export from index.ts
**What goes wrong:** New CRUD functions aren't accessible
**Why it happens:** Missing re-export statement
**How to avoid:** Add `export * from './reward-addresses.js';` to bottom of `index.ts`
**Warning signs:** Import errors when using new functions

### Pitfall 3: Incorrect User Table Reference
**What goes wrong:** Foreign key to wrong table
**Why it happens:** Codebase has both `users` and `user` tables (Better Auth uses `user`)
**How to avoid:** Always reference `"user"` (with quotes for reserved word) for Better Auth users
**Warning signs:** Foreign key constraint failures on insert

### Pitfall 4: Missing .js Extension in Imports
**What goes wrong:** Module resolution fails
**Why it happens:** Forgetting that ES modules require explicit extensions
**How to avoid:** Always use `.js` extension in imports (even for .ts files)
**Warning signs:** Cannot find module errors

### Pitfall 5: Storing Amounts as Numbers
**What goes wrong:** Precision loss for large token amounts
**Why it happens:** JavaScript number precision limits
**How to avoid:** Store amounts as TEXT (atomic units as strings)
**Warning signs:** Amounts not matching expected values

### Pitfall 6: Not Handling Soft Deletes for Addresses
**What goes wrong:** Deleted addresses can't be re-added
**Why it happens:** UNIQUE constraint on (user_id, address) blocks reinsertion
**How to avoid:** Use hard deletes (per CONTEXT.md discretion) or add deleted_at column
**Warning signs:** "UNIQUE constraint failed" when adding previously removed address

## Code Examples

Verified patterns from the existing codebase:

### Creating a Record with Error Handling
```typescript
// Source: packages/server/src/db/facilitators.ts
export function createRewardAddress(data: {
  user_id: string;
  chain_type: 'solana' | 'evm';
  address: string;
}): RewardAddressRecord | null {
  const db = getDatabase();
  const id = nanoid();

  try {
    const stmt = db.prepare(`
      INSERT INTO reward_addresses (id, user_id, chain_type, address)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.user_id,
      data.chain_type,
      data.address.toLowerCase()  // Normalize addresses
    );

    return getRewardAddressById(id);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return null;  // Return null for duplicates, don't throw
    }
    throw error;
  }
}
```

### Getting Records with Pagination
```typescript
// Source: packages/server/src/db/transactions.ts
export function getVolumeSnapshotsByUser(
  userId: string,
  limit = 50,
  offset = 0
): VolumeSnapshotRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM volume_snapshots
    WHERE user_id = ?
    ORDER BY snapshot_date DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset) as VolumeSnapshotRecord[];
}
```

### Updating with Dynamic Fields
```typescript
// Source: packages/server/src/db/facilitators.ts
export function updateCampaign(
  id: string,
  updates: Partial<{
    name: string;
    pool_amount: string;
    threshold_amount: string;
    ends_at: string;
  }>
): CampaignRecord | null {
  const db = getDatabase();

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  // ... more fields

  if (fields.length === 0) {
    return getCampaignById(id);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getCampaignById(id);
}
```

### Aggregation Query (for volume stats)
```typescript
// Source: packages/server/src/db/transactions.ts
export function getUserVolumeStats(userId: string, campaignId: string): {
  total_volume: string;
  unique_payers: number;
} {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(volume AS INTEGER)), 0) as total_volume,
      COALESCE(SUM(unique_payers), 0) as unique_payers
    FROM volume_snapshots
    WHERE user_id = ? AND campaign_id = ?
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
```

## Schema Design

Based on requirements and CONTEXT.md decisions:

### Table: reward_addresses
Tracks pay-to addresses for volume rewards.

```sql
CREATE TABLE IF NOT EXISTS reward_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  chain_type TEXT NOT NULL CHECK (chain_type IN ('solana', 'evm')),
  address TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified')),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, address)
);

CREATE INDEX IF NOT EXISTS idx_reward_addresses_user ON reward_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_addresses_address ON reward_addresses(address);
CREATE INDEX IF NOT EXISTS idx_reward_addresses_chain ON reward_addresses(chain_type);
```

**Notes:**
- Uses hard deletes (per CONTEXT.md discretion - simpler than soft deletes)
- UNIQUE on (user_id, address) prevents duplicate tracking
- Index on address for volume lookups from transactions table
- Facilitator ownership determined by JOIN against existing facilitators table (per CONTEXT.md decision)

### Table: campaigns
Reward campaign configuration.

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pool_amount TEXT NOT NULL,              -- Atomic units of $OPEN tokens
  threshold_amount TEXT NOT NULL,         -- Minimum volume in atomic units (e.g., USDC)
  multiplier_facilitator REAL NOT NULL DEFAULT 2.0,  -- 2x for facilitator owners
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(starts_at, ends_at);
```

**Notes:**
- Only one campaign active at a time (enforced at application level per CAMP-01)
- Pool amount stored as atomic units (string to avoid precision loss)
- Multiplier stored as REAL for flexibility

### Table: reward_claims
Tracks user claims against campaigns.

```sql
CREATE TABLE IF NOT EXISTS reward_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  volume_amount TEXT NOT NULL,            -- User's qualifying volume
  base_reward_amount TEXT NOT NULL,       -- Before multiplier
  multiplier REAL NOT NULL DEFAULT 1.0,   -- Applied multiplier (1.0 or 2.0)
  final_reward_amount TEXT NOT NULL,      -- After multiplier
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  claim_wallet TEXT,                      -- Solana wallet to receive tokens
  tx_signature TEXT,                      -- Solana transaction signature
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_claims_user ON reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_campaign ON reward_claims(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_claims_status ON reward_claims(status);
```

**Notes:**
- UNIQUE on (user_id, campaign_id) ensures one claim per user per campaign
- Stores both base and final amounts for audit trail
- tx_signature links to Solana explorer

### Table: volume_snapshots
Aggregated volume snapshots per address per day.

```sql
CREATE TABLE IF NOT EXISTS volume_snapshots (
  id TEXT PRIMARY KEY,
  reward_address_id TEXT NOT NULL REFERENCES reward_addresses(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,            -- DATE in YYYY-MM-DD format
  volume TEXT NOT NULL,                   -- Atomic units
  unique_payers INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reward_address_id, campaign_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_volume_snapshots_address ON volume_snapshots(reward_address_id);
CREATE INDEX IF NOT EXISTS idx_volume_snapshots_campaign ON volume_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_volume_snapshots_date ON volume_snapshots(snapshot_date);
```

**Notes:**
- Daily snapshots (per CONTEXT.md - simpler than hourly)
- UNIQUE constraint prevents duplicate snapshots
- Volume aggregated from transactions table by scheduled job (Phase 6)
- unique_payers tracked for anti-gaming metrics (VOL-03)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-increment IDs | nanoid string IDs | Established pattern | Use nanoid |
| ORM (Drizzle/Prisma) | Plain SQL | Project inception | Write raw SQL |
| Migrations for new tables | CREATE TABLE IF NOT EXISTS | Project inception | Tables in index.ts |

**Deprecated/outdated:**
- None relevant - codebase patterns are current

## Open Questions

Things that couldn't be fully resolved:

1. **Exact snapshot frequency timing**
   - What we know: Daily snapshots per CONTEXT.md
   - What's unclear: Should snapshot be at midnight UTC? End of campaign day?
   - Recommendation: Use midnight UTC, note in schema comments

2. **Address normalization for EVM vs Solana**
   - What we know: EVM addresses should be lowercased
   - What's unclear: Solana addresses are case-sensitive (base58)
   - Recommendation: Lowercase EVM, preserve case for Solana. Add chain_type-aware normalization.

## Sources

### Primary (HIGH confidence)
- `/packages/server/src/db/index.ts` - Table creation patterns
- `/packages/server/src/db/types.ts` - Type definition patterns
- `/packages/server/src/db/facilitators.ts` - CRUD patterns
- `/packages/server/src/db/migrations/index.ts` - Migration system
- `/packages/server/package.json` - Dependency versions (better-sqlite3 ^11.6.0)

### Secondary (MEDIUM confidence)
- `.planning/phases/01-database-foundation/01-CONTEXT.md` - User decisions
- `.planning/REQUIREMENTS.md` - Functional requirements
- `.planning/ROADMAP.md` - Phase dependencies and scope

### Tertiary (LOW confidence)
- None - all findings based on existing codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Directly observed in package.json and codebase
- Architecture: HIGH - Patterns extracted from existing code
- Pitfalls: HIGH - Based on codebase idioms and common SQLite issues
- Schema design: MEDIUM - Based on requirements interpretation

**Research date:** 2026-01-19
**Valid until:** Stable - patterns unlikely to change without major refactor
