# Architecture Research: Token Rewards Program

**Domain:** Crypto token rewards / loyalty program for payment facilitator
**Researched:** 2026-01-19
**Confidence:** HIGH (based on existing codebase analysis + industry patterns)

## Executive Summary

Token rewards programs for payment platforms typically follow a modular architecture separating accrual (earning points), accounting (balance tracking), campaigns (rules), and distribution (claiming tokens). For OpenFacilitator, the architecture integrates with the existing transaction logging system, leverages the Better Auth user model, and adds new components for address verification, volume aggregation, campaign management, and SPL token distribution.

The recommended architecture uses an **event-sourced points model** where transaction events drive rewards accrual, combined with a **claim-based distribution** pattern where users explicitly claim earned rewards (vs. automatic distribution) to reduce costs and allow verification.

## Component Overview

### 1. Rewards Account Service

**Purpose:** Manages the relationship between users, wallet addresses, and their rewards balances.

**Boundaries:**
- OWNS: rewards_accounts table, address-to-account linking, balance tracking
- DOES NOT OWN: user authentication (Better Auth owns this), transaction logging (existing system)

**Depends on:** Better Auth (user model), existing transactions table (read-only)

**Data:**
```
rewards_accounts:
  - id: string (nanoid)
  - user_id: string | null (FK to user.id - null for non-dashboard users)
  - primary_address: string (verified Solana address for claiming)
  - earned_points: bigint (lifetime earned, never decreases)
  - claimed_points: bigint (total claimed)
  - available_points: bigint (computed: earned - claimed)
  - tier: 'bronze' | 'silver' | 'gold' | 'platinum' (computed from volume)
  - created_at, updated_at
```

**Key Design Decisions:**
- `user_id` is nullable to support "free users" who transact without dashboard accounts
- Points are tracked separately from token amounts (allows flexible conversion rates)
- Tier is computed from aggregated volume, not stored (or cached with TTL)

### 2. Address Registry

**Purpose:** Tracks and verifies wallet addresses associated with rewards accounts. Handles multi-chain support.

**Boundaries:**
- OWNS: registered_addresses table, address verification proofs
- DOES NOT OWN: transaction matching (Volume Aggregator does this)

**Depends on:** Rewards Account Service

**Data:**
```
registered_addresses:
  - id: string
  - rewards_account_id: string (FK)
  - network: 'solana' | 'base' | 'ethereum' | 'base-sepolia' | 'solana-devnet'
  - address: string (normalized - lowercase for EVM, original case for Solana)
  - verified: boolean
  - verification_signature: string | null (signed message proving ownership)
  - verified_at: timestamp | null
  - created_at
```

**Verification Flow:**
1. User submits address via API
2. System generates challenge message: `"Link address ${address} to OpenFacilitator rewards account ${account_id} at ${timestamp}"`
3. User signs with wallet
4. System verifies signature matches address
5. Address marked as verified

**Why Verification Matters:** Prevents users from claiming rewards for transactions by addresses they don't control.

### 3. Volume Aggregator

**Purpose:** Aggregates transaction volume per address, calculates rewards eligibility, and credits points.

**Boundaries:**
- OWNS: volume calculation logic, points crediting rules
- DOES NOT OWN: raw transaction data (reads from transactions table)

**Depends on:** Address Registry, Rewards Account Service, existing transactions table

**Data:**
```
rewards_accruals:
  - id: string
  - rewards_account_id: string (FK)
  - transaction_id: string (FK to transactions.id)
  - points_earned: bigint
  - multiplier_applied: number (from active campaigns)
  - campaign_id: string | null (if bonus applied)
  - accrued_at: timestamp
```

**Aggregation Patterns:**

Option A: **Real-time on transaction** (recommended for MVP)
- Hook into settlement success
- Calculate points immediately
- Pros: Simple, immediate feedback
- Cons: Slight overhead per transaction

Option B: **Batch aggregation** (recommended for scale)
- Cron job runs every N minutes
- Scans transactions since last run
- Credits points in batch
- Pros: Efficient, handles backfill
- Cons: Delayed feedback

**Recommendation:** Start with real-time (Option A), add batch reconciliation for missed transactions.

### 4. Campaign Manager

**Purpose:** Defines and manages reward campaigns with rules, time bounds, and multipliers.

**Boundaries:**
- OWNS: campaign definitions, eligibility rules, budget tracking
- DOES NOT OWN: point crediting (Volume Aggregator applies campaigns)

**Depends on:** Facilitator model (campaigns can be global or per-facilitator)

**Data:**
```
rewards_campaigns:
  - id: string
  - facilitator_id: string | null (null = global campaign)
  - name: string
  - description: string
  - type: 'multiplier' | 'bonus' | 'threshold'
  - config: JSON {
      multiplier?: number,           // e.g., 2.0 for 2x points
      bonus_points?: bigint,         // flat bonus
      threshold_volume?: bigint,     // minimum volume to qualify
      threshold_points?: bigint,     // points awarded at threshold
      max_participants?: number,
      max_budget_points?: bigint
    }
  - start_at: timestamp
  - end_at: timestamp
  - active: boolean
  - created_at, updated_at
```

**Campaign Types:**
1. **Multiplier:** 2x, 3x points during promotional period
2. **Bonus:** Extra points for first transaction, reaching milestones
3. **Threshold:** Unlock bonus at volume tiers (e.g., 1000 points at $100 volume)

### 5. Claims Processor

**Purpose:** Handles user claims for converting points to SPL tokens and executing transfers.

**Boundaries:**
- OWNS: claim requests, claim validation, token transfer execution
- DOES NOT OWN: point balances (reads from Rewards Account), token minting

**Depends on:** Rewards Account Service, Solana infrastructure (existing solana.ts)

**Data:**
```
rewards_claims:
  - id: string
  - rewards_account_id: string (FK)
  - points_claimed: bigint
  - token_amount: bigint (in atomic units)
  - token_mint: string (SPL token address)
  - destination_address: string (must match verified address)
  - status: 'pending' | 'processing' | 'completed' | 'failed'
  - transaction_hash: string | null
  - error_message: string | null
  - created_at
  - processed_at: timestamp | null
```

**Claim Flow:**
1. User requests claim (points amount + destination)
2. System validates: sufficient balance, address verified, not already processing
3. Calculate token amount from points (conversion rate from campaign or global config)
4. Queue transfer job
5. Execute SPL token transfer using existing Solana infrastructure
6. Update claim status, deduct points from available balance

**Token Distribution Approaches:**

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Direct Transfer** | Simple, immediate | Requires funded hot wallet | Good for MVP |
| **Merkle Claim** | Gas-efficient for batches | Complex setup, delayed | Good for large drops |
| **On-demand Mint** | Flexible supply | Requires mint authority | If creating new token |

**Recommendation:** Direct transfer from a funded rewards wallet for MVP. The existing `@solana/spl-token` infrastructure in `solana.ts` supports this.

### 6. Rewards Wallet

**Purpose:** Manages the hot wallet that holds tokens for distribution.

**Boundaries:**
- OWNS: wallet key management (encrypted storage), balance monitoring
- DOES NOT OWN: claim decisions (Claims Processor decides when to pay)

**Depends on:** Existing wallet infrastructure (similar to facilitator wallets)

**Data:**
```
rewards_wallet:
  - id: string
  - network: 'solana' | 'solana-devnet'
  - wallet_address: string
  - encrypted_private_key: string
  - token_mint: string (SPL token to distribute)
  - low_balance_threshold: bigint (for alerts)
  - created_at
```

**Security Considerations:**
- Key encryption using existing `crypto.ts` utility
- Rate limiting on claims
- Maximum claim amount per period
- Balance monitoring and alerts

## Data Flow

```
                                    +------------------+
                                    |   Dashboard UI   |
                                    +--------+---------+
                                             |
                    +------------------------+------------------------+
                    |                        |                        |
                    v                        v                        v
           +-------+-------+      +----------+----------+    +--------+--------+
           | Register      |      | View Balance &      |    | Submit Claim    |
           | Address       |      | History             |    | Request         |
           +-------+-------+      +----------+----------+    +--------+--------+
                   |                        |                        |
                   v                        v                        v
           +-------+-------+      +----------+----------+    +--------+--------+
           | Address       |      | Rewards Account     |    | Claims          |
           | Registry      |      | Service             |    | Processor       |
           +-------+-------+      +----------+----------+    +--------+--------+
                   |                        ^                        |
                   |                        |                        v
                   |              +---------+----------+    +--------+--------+
                   |              | Volume Aggregator  |    | Rewards Wallet  |
                   |              +---------+----------+    +--------+--------+
                   |                        ^                        |
                   |                        |                        v
                   v              +---------+---------+     +--------+--------+
           +-------+-------+      | Existing          |     | SPL Token       |
           | registered_   |<-----| Transactions      |     | Transfer        |
           | addresses     |      | Table             |     | (solana.ts)     |
           +---------------+      +-------------------+     +-----------------+


Transaction Flow (Accrual):
===========================
1. Payment settled -> transactions table updated (existing)
2. Volume Aggregator detects new settlement
3. Looks up registered_addresses by from_address
4. If found & verified -> credits points to rewards_account
5. Applies any active campaign multipliers


Claim Flow (Distribution):
==========================
1. User initiates claim in dashboard
2. Claims Processor validates (balance, address, limits)
3. Creates claim record with 'pending' status
4. Calculates token amount from points
5. Calls SPL transfer function
6. On success: updates claim to 'completed', deducts available_points
7. On failure: updates claim to 'failed', logs error
```

## Suggested Build Order

Based on dependencies between components:

### Phase 1: Foundation (Week 1-2)
**Build:** Rewards Account Service + Address Registry

**Why First:** Everything depends on accounts and address linking. Cannot aggregate volume or process claims without knowing which addresses belong to which accounts.

**Deliverables:**
- `rewards_accounts` table schema + CRUD operations
- `registered_addresses` table schema
- Address registration API endpoint
- Signature verification for address ownership
- Dashboard UI: Account overview, register address flow

### Phase 2: Accrual (Week 2-3)
**Build:** Volume Aggregator + basic points crediting

**Why Second:** Once addresses are registered, we can start crediting points. This provides immediate value to users.

**Deliverables:**
- `rewards_accruals` table schema
- Hook into settlement success (or batch job)
- Points calculation logic (e.g., 1 point per $0.01 volume)
- Dashboard UI: Points history, volume breakdown

**Depends on:** Phase 1 (address registry to match transactions)

### Phase 3: Distribution (Week 3-4)
**Build:** Claims Processor + Rewards Wallet

**Why Third:** Users now have points and want to claim them. This is the core value delivery.

**Deliverables:**
- `rewards_claims` table schema
- `rewards_wallet` configuration
- Claim API endpoint
- SPL token transfer integration
- Dashboard UI: Claim flow, claim history

**Depends on:** Phase 2 (must have points to claim)

### Phase 4: Campaigns (Week 4-5)
**Build:** Campaign Manager

**Why Fourth:** Campaigns are enhancements. The core earn-and-claim loop should work first.

**Deliverables:**
- `rewards_campaigns` table schema
- Campaign CRUD API (admin)
- Campaign application logic in Volume Aggregator
- Dashboard UI: Active campaigns display

**Depends on:** Phase 2 (campaigns modify accrual behavior)

### Phase 5: Polish (Week 5-6)
**Build:** Tier system, notifications, analytics

**Deliverables:**
- Tier calculation and display
- Low-balance alerts for rewards wallet
- Rewards analytics dashboard
- Rate limiting and fraud detection

**Depends on:** All previous phases

## Integration Points

### Integration with Existing OpenFacilitator Architecture

| Existing Component | Integration | Notes |
|--------------------|-------------|-------|
| `transactions` table | READ | Volume Aggregator queries for settlement data |
| `user` table (Better Auth) | FK | rewards_accounts.user_id references user.id |
| `solana.ts` | EXTEND | Add SPL token transfer function for claims |
| `crypto.ts` | REUSE | Encrypt rewards wallet private key |
| Admin Router | EXTEND | Add /api/admin/rewards endpoints |
| Dashboard | EXTEND | Add Rewards tab with account, claims UI |

### New API Endpoints

```
# Account Management
POST   /api/rewards/account              # Create rewards account (auto-link to user if logged in)
GET    /api/rewards/account              # Get current user's rewards account
POST   /api/rewards/account/addresses    # Register an address
POST   /api/rewards/account/addresses/:id/verify  # Verify address ownership

# Balance & History
GET    /api/rewards/balance              # Get points balance
GET    /api/rewards/history              # Get accrual history
GET    /api/rewards/claims               # Get claim history

# Claims
POST   /api/rewards/claims               # Submit new claim
GET    /api/rewards/claims/:id           # Get claim status

# Campaigns (Admin)
GET    /api/admin/rewards/campaigns      # List campaigns
POST   /api/admin/rewards/campaigns      # Create campaign
PUT    /api/admin/rewards/campaigns/:id  # Update campaign
```

### Dashboard UI Components Needed

1. **Rewards Overview Card** - Points balance, tier, next tier progress
2. **Address Management** - List registered addresses, add new, verify
3. **Earnings History** - Table of point accruals with transaction links
4. **Claim Flow** - Select points amount, confirm destination, submit
5. **Claim History** - Table of past claims with status
6. **Campaign Banner** - Active campaigns with multipliers

## Architecture Patterns

### Pattern: Event-Driven Accrual

Instead of directly modifying points when a transaction settles, emit an event that the Volume Aggregator consumes. This decouples settlement from rewards logic.

```typescript
// In settlement handler (existing)
await createTransaction({ ... });
eventEmitter.emit('settlement:success', { transactionId, fromAddress, amount, network });

// In Volume Aggregator (new)
eventEmitter.on('settlement:success', async (event) => {
  const account = await findAccountByAddress(event.fromAddress, event.network);
  if (account) {
    await creditPoints(account.id, event.transactionId, calculatePoints(event.amount));
  }
});
```

**Benefit:** Settlement doesn't slow down if rewards processing is slow or fails.

### Pattern: Idempotent Point Crediting

Use the transaction ID as a unique key to prevent double-crediting.

```typescript
// rewards_accruals table has unique constraint on transaction_id
async function creditPoints(accountId, transactionId, points) {
  try {
    await db.insert('rewards_accruals', {
      rewards_account_id: accountId,
      transaction_id: transactionId, // unique constraint
      points_earned: points,
    });
    await updateAvailablePoints(accountId);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // Already credited, ignore
      return;
    }
    throw e;
  }
}
```

### Pattern: Optimistic Claim with Rollback

Start claim optimistically, rollback on transfer failure.

```typescript
async function processClaim(claimId) {
  const claim = await getClaim(claimId);

  // 1. Deduct points optimistically
  await deductPoints(claim.rewards_account_id, claim.points_claimed);

  // 2. Update status to processing
  await updateClaimStatus(claimId, 'processing');

  try {
    // 3. Execute transfer
    const result = await executeSPLTransfer({
      destination: claim.destination_address,
      amount: claim.token_amount,
      mint: claim.token_mint,
    });

    // 4. Success
    await updateClaimStatus(claimId, 'completed', result.transactionHash);
  } catch (error) {
    // 5. Rollback points on failure
    await creditPointsBack(claim.rewards_account_id, claim.points_claimed);
    await updateClaimStatus(claimId, 'failed', null, error.message);
  }
}
```

## Anti-Patterns to Avoid

### Anti-Pattern: Storing Computed Values Without Invalidation

**Bad:** Store `available_points` as a column that's updated on every accrual and claim.

**Problem:** Race conditions, drift between computed and actual values.

**Better:** Compute available_points from `earned_points - claimed_points`, or use a view/computed column.

### Anti-Pattern: Direct Token Transfer Without Queuing

**Bad:** Execute token transfer directly in HTTP request handler.

**Problem:** Slow response times, no retry on failure, user doesn't know status.

**Better:** Queue claim, return immediately with `pending` status, process async.

### Anti-Pattern: Single Global Rewards Wallet

**Bad:** One wallet for all networks, all tokens.

**Problem:** Key compromise affects everything, complex multi-sig setup.

**Better:** Separate wallets per network/token, smaller individual balances.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Address lookup | Simple index | Compound index | Consider cache |
| Point calculation | Real-time | Real-time | Batch + real-time |
| Claim processing | Sync | Async queue | Async + rate limit |
| Volume aggregation | Per-transaction | Per-transaction | Hourly batches |

## Sources

- [Solana SPL Token Transfer Guide](https://www.quicknode.com/guides/solana-development/spl-tokens/how-to-transfer-spl-tokens-on-solana) - Token transfer implementation
- [Solana Token Documentation](https://solana.com/docs/tokens) - ATA and token account concepts
- [Merkle Airdrop Pattern](https://www.cyfrin.io/glossary/merkle-airdrop-solidity-code-example) - Efficient claim verification (future optimization)
- [Loyalty Architecture Guide](https://www.voucherify.io/blog/architecture-of-customer-loyalty-software-a-guide-for-product-managers) - Points system design patterns
- [Open Loyalty Architecture](https://docs.openloyalty.io/en/latest/developer/architecture/overview.html) - CQRS/event-sourcing for loyalty
- [Crypto Rewards Patterns](https://blinqnetworks.com/how-cryptocurrency-loyalty-reward-programs-and-tokens-work/) - Token-based rewards fundamentals
- OpenFacilitator codebase analysis - Existing transaction, auth, and Solana infrastructure
