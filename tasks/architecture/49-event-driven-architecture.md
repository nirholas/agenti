# Task: Implement Event Bus for Cross-Module Communication

## Priority: MEDIUM

## Context
Modules currently operate independently. An event bus enables reactive workflows (e.g., invalidate cache after transfer, update portfolio after swap, trigger alert on large transaction).

## Requirements
1. Create an in-process event bus with typed events:
   ```typescript
   interface AgentiEvent {
     type: string;
     timestamp: number;
     traceId: string;
     data: Record<string, unknown>;
   }
   ```
2. Define core event types:
   - `transaction.submitted` — new transaction broadcasted
   - `transaction.confirmed` — transaction mined
   - `transaction.failed` — transaction reverted
   - `balance.changed` — wallet balance changed
   - `price.alert` — price threshold crossed
   - `rate_limit.exceeded` — rate limit hit
   - `auth.failed` — authentication failure
3. Support event patterns:
   - Pub/sub (fire and forget)
   - Request/reply (synchronous response)
   - Event sourcing (replay events for state reconstruction)
4. Event handlers must:
   - Be non-blocking (async)
   - Have error boundaries (one handler's error doesn't affect others)
   - Support priority ordering
5. Optional: external event bus integration (Redis Pub/Sub, NATS, Kafka)
6. Add event metrics: published count, handler latency, error rate

## Acceptance Criteria
- [ ] Event bus with typed events operational
- [ ] Core event types defined and emitted
- [ ] Cache invalidation via events working
- [ ] Error boundaries prevent cascade failures
- [ ] Event metrics exposed
