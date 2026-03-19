# Task: Persist x402 Payment Limits to Durable Storage

## Priority: MEDIUM

## Context
All payment tracking in `src/x402/limits.ts:141-145` is in-memory. A server restart resets daily spending caps, allowing bypass of financial controls.

## Requirements
1. Add a pluggable storage backend interface for payment state
2. Implement a SQLite-based default backend (file-based, no external dependencies)
3. Persist: daily spending totals, payment history, per-service limits
4. Add atomic read-modify-write operations to prevent race conditions
5. Support configurable storage backend via environment variable (SQLite, Redis, PostgreSQL)
6. Migrate existing in-memory structures to use the storage interface
7. Add a startup reconciliation step that loads persisted state

## Acceptance Criteria
- [ ] Payment limits survive server restarts
- [ ] SQLite backend works out of the box
- [ ] Race condition tests pass under concurrent load
- [ ] Existing payment limit tests still pass
- [ ] Migration path from in-memory to persistent documented
