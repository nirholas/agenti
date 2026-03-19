# Phase 1: Database Foundation - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the data layer for the rewards program. Create tables for: addresses (Solana/EVM), campaigns, claims, and volume_snapshots. Schema must support all data relationships needed by downstream phases. This phase creates the schema only — no business logic, no UI.

</domain>

<decisions>
## Implementation Decisions

### Facilitator ownership (2x multiplier)
- Facilitator ownership already exists in the main database
- Users have facilitators with unique IDs and URLs
- Join against existing facilitator data to determine 2x eligibility — no separate flag needed in rewards schema

### Volume tracking approach
- Store periodic volume snapshots rather than calculating on-demand
- Snapshots enable fast reads for dashboard display
- Requires a scheduled job (implemented in Phase 6)

### Address storage
- Users can track unlimited addresses per chain
- Support both Solana and EVM addresses
- Track verification status (verified vs pending)

### Claude's Discretion
- Snapshot frequency (hourly vs daily — lean toward daily for simplicity)
- Exact field names and types
- Index strategy for performance
- Whether to use soft deletes or hard deletes for removed addresses

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that fit the existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-foundation*
*Context gathered: 2026-01-19*
