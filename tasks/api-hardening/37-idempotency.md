# Task: Implement Idempotency for Write Operations

## Priority: HIGH

## Context
Network failures and retries can cause duplicate transactions (double transfers, duplicate orders). Write operations must be idempotent to prevent financial loss.

## Requirements
1. Add `idempotencyKey` parameter to all write operations:
   - Token transfers
   - ETH transfers
   - Swap executions
   - Order placements
   - Token approvals
2. Store idempotency records with the operation result for 24 hours
3. If a duplicate `idempotencyKey` is received:
   - If the original operation completed: return the cached result
   - If the original is still running: return 409 Conflict with operation status
   - If the original failed: allow retry
4. Generate idempotency key client-side (UUIDv4), but validate format server-side
5. Use database storage for idempotency records (survive restarts)
6. Add `Idempotency-Key` response header echoing the key
7. Clean up expired idempotency records automatically

## Acceptance Criteria
- [ ] All write operations support idempotency keys
- [ ] Duplicate requests return cached results
- [ ] Concurrent duplicates return 409
- [ ] Failed operations allow retry
- [ ] Records persist across restarts
- [ ] 24h auto-cleanup working
