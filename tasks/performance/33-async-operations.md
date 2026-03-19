# Task: Implement Async Operation Queue for Long-Running Tasks

## Priority: MEDIUM

## Context
Some operations (TWAP orders, multi-step swaps, cross-chain bridges) take longer than reasonable request timeouts. These need async execution with status polling.

## Requirements
1. Create an async operation manager:
   - Submit operation: returns `operationId` immediately
   - Poll status: `GET /operations/{id}` returns current state
   - Cancel operation: `DELETE /operations/{id}`
2. Operation states: `pending` -> `running` -> `completed|failed|cancelled`
3. Store operation state durably (survive restarts)
4. Add MCP tools:
   - `submit_async_operation`: Submit long-running task
   - `check_operation_status`: Poll for completion
   - `cancel_operation`: Cancel pending/running operation
   - `list_operations`: List all operations with filters
5. Implement timeout: operations exceeding max duration auto-cancel
6. Add webhook notifications on completion/failure
7. Support operation chaining (e.g., approve -> swap -> verify)
8. Retain completed operation results for 24 hours

## Acceptance Criteria
- [ ] Async operations survive server restart
- [ ] Status polling returns accurate state
- [ ] Cancellation works for pending and running operations
- [ ] Webhook notifications delivered
- [ ] Operation results retained for 24h
