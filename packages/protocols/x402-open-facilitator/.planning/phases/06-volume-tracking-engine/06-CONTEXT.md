# Phase 6: Volume Tracking Engine - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

System accurately calculates qualifying volume for each user from transactions. Aggregates volume from the `transactions` table for verified addresses, excludes self-transfers, and tracks unique_payers metric. Dashboard display and campaign integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Data Sources
- Source table: `transactions` (existing)
- Include only `type='settle'` transactions (not verify)
- Include only `status='success'` transactions
- Attribution: Both to_address matching AND facilitator ownership count
- When both apply (to_address is user's verified address AND user owns the facilitator), volume counts 2x (stacked, not deduped)

### Aggregation Timing
- Daily batch job via external cron/scheduler writes to `volume_snapshots` table
- Dashboard shows: snapshot value + live delta (transactions since last snapshot)
- Job endpoint called by external scheduler (not server-side timer)

### Volume Definition
- Normalize all assets to USD value
- Capture USD exchange rate at transaction time (store usd_value when transaction recorded)
- Only successful transactions count toward volume

### Anti-Gaming Rules
- Basic self-transfer exclusion: skip transactions where `from_address == to_address`
- No cycle/wash-trading detection (keep it simple)
- Track `unique_payers` per address for data purposes, but no threshold required
- No minimum transaction amount
- Volume counts from enrollment date forward only (no retroactive credit for pre-enrollment transactions)

### Claude's Discretion
- Choice of price API for USD conversion (e.g., CoinGecko, Pyth, or alternative)
- Exact daily job scheduling time
- Live delta calculation approach (query or incremental)
- Index optimization for volume queries

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-volume-tracking-engine*
*Context gathered: 2026-01-20*
