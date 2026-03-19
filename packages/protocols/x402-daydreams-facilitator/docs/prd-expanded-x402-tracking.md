# PRD: Expanded x402 Tracking Persistence

## Metadata
- Status: Draft v1
- Date: February 9, 2026
- Owners: Facilitator Core + Facilitator Server maintainers
- Release posture: Direct release, no feature flag (project not yet in production)

## Summary
Expand facilitator SQL tracking to capture richer x402 audit data while preserving today’s normalized analytics model. Ship directly (no feature flag), with strong write-consistency guarantees and clear verification state semantics.

## Problem
Current tracking captures useful summaries but misses critical x402 forensic fields (payload integrity, nonce/deadline provenance, signature traceability). In addition, write lifecycle correctness has known gaps:
- possible out-of-order writes in async tracking mode
- stale `verification_error` values after a later successful verification
- schema/index drift between core SQL and facilitator-server Drizzle metadata

## Goals
1. Preserve existing normalized tracking fields and query ergonomics.
2. Add high-value x402 auditability fields to support disputes/investigation.
3. Ensure per-record write ordering and deterministic lifecycle state.
4. Keep storage safe by default (no plaintext replayable sensitive material).
5. Keep backward compatibility for current API consumers.

## Non-Goals
1. Building new analytics endpoints in this phase.
2. Replacing Postgres/Drizzle architecture.
3. Breaking existing tracking APIs or list/stats contracts.

## User Stories
1. As an operator, I can verify exactly what x402 payment context produced each settlement result.
2. As an engineer, I can query by key x402 fields without decoding full payload blobs.
3. As security/compliance, I can prove payload integrity and investigate mismatches.
4. As maintainers, I can trust async tracking not to silently drop lifecycle updates.

## Functional Requirements

### FR1: Keep Existing Normalized Model
Retain current `resource_call_records` baseline fields and semantics:
- request metadata
- normalized payment summary
- settlement outcome
- upto session metadata
- response timing/status

### FR2: Add New x402 Audit Fields
Add first-class columns:
- `x402_version` (integer)
- `payment_nonce` (text)
- `payment_valid_before` (text or bigint)
- `payload_hash` (text)
- `requirements_hash` (text)
- `payment_signature_hash` (text)

Do not store raw signed payloads or authorization blobs.

### FR3: Write Ordering Guarantees
Tracking operations for one `record.id` must execute in lifecycle order:
`startTracking -> recordRequest -> recordVerification -> recordUptoSession/recordSettlement -> finalizeTracking`

Async mode remains best-effort/non-blocking to request path, but internally ordered per record.

### FR4: Verification State Consistency
When verification succeeds:
- `payment_verified = true`
- `verification_error = NULL`

When verification fails:
- `payment_verified = false`
- `verification_error` contains the failure reason

### FR5: Missing-Row Update Detection
If an update targets a non-existent record:
- detect it deterministically (e.g., `UPDATE ... RETURNING id`)
- emit structured tracking error callback
- never throw into request path in async/best-effort mode

### FR6: Schema Parity
Core SQL schema, facilitator-server Drizzle schema, migration SQL, and snapshot metadata must remain aligned for columns/indexes used in runtime filters and stats.

## Non-Functional Requirements
1. Tracking remains best-effort by default and must not block successful payment request handling.
2. Query performance remains acceptable with additional indexed fields.
3. No breaking changes to existing exported tracking APIs.
4. Library code remains side-effect-free.

## Security Requirements
1. Do not persist raw replayable x402 authorization material at all.
2. Use deterministic hashing (SHA-256) for payload integrity fields.
3. Restrict access to tracking tables using standard DB role controls.
4. Document retention policy for summary/audit fields.

## Data Retention
- Summary tracking rows: default 90 days (or existing policy)
- Pruning behavior continues through existing `prune()`/auto-prune model

## Migrations
1. Add additive migration for new columns + indexes.
2. Data hygiene migration:
```sql
UPDATE resource_call_records
SET verification_error = NULL
WHERE payment_verified = true;
```
3. No destructive migration in this phase.

## API / Type Changes
Extend tracking types with optional fields for new structured x402 metadata and hashes.

No required changes for existing callers using current fields.

## Implementation Plan
1. Core correctness first:
- per-record ordered write queue
- verification error clearing on success
- missing-row update detection
2. Schema parity updates across core + facilitator-server.
3. x402 expanded field extraction and storage.
4. docs updates and operational guidance.

## Testing Plan

### Unit
1. Ordered writes under async tracking mode.
2. `verification_error` cleared on successful verification.
3. Missing-row update callback surfaced.
4. Hash extraction and stable serialization behavior.

### Integration
1. Postgres-backed lifecycle record completeness (`verify`, `settle`, `finalize`).
2. Schema parity tests for columns/indexes.
3. Migration tests including data hygiene SQL.

### E2E
1. Facilitator server writes complete row for `/verify` and `/settle`.
2. Assertions on new x402 columns where payload includes corresponding data.

## Acceptance Criteria
1. No dropped lifecycle updates in async mode for a single tracking ID.
2. No rows with `payment_verified = true` and non-null `verification_error` after migration + runtime updates.
3. New x402 audit columns populated when source data exists.
4. Existing list/stats consumers continue to work unchanged.
5. Core, server, and migration schema definitions are aligned and test-enforced.

## Rollout
Because system is not in production yet, release directly without feature flag.

1. Merge correctness + schema + expanded capture as one release train.
2. Validate in staging/dev load.
3. Release as next minor.
4. Monitor tracking error callbacks and row quality metrics.

## Risks
1. Queue implementation bug could stall per-id operation chain.
2. Added indexes could increase migration/runtime overhead.
3. Hash canonicalization changes could affect cross-version comparisons if not locked.

## Mitigations
1. Keep queue isolated and heavily unit-tested.
2. Add only query-justified indexes.
3. Lock canonicalization behavior with explicit unit coverage.

## Open Questions
1. Canonical JSON serialization strategy for hash stability.
2. Final type for `payment_valid_before` (`text` vs `bigint`).
3. Exact retention defaults per environment.
