# Task: Implement RPC Request Batching

## Priority: MEDIUM

## Context
Many tools make multiple sequential RPC calls that could be batched into a single HTTP request, reducing latency and connection overhead.

## Requirements
1. Create an RPC batch manager that:
   - Collects RPC calls within a configurable window (default 10ms)
   - Sends them as a JSON-RPC batch request
   - Distributes responses back to individual callers
2. Support configurable batch size limit (default 100 calls)
3. Implement batch-aware tools:
   - Multi-token balance check (batch `eth_call` for multiple tokens)
   - Multi-chain balance check (parallel batches across chains)
   - Portfolio snapshot (batch all token balances + prices)
4. Add metrics: `rpc_batch_size`, `rpc_batch_duration`, `rpc_calls_saved`
5. Graceful fallback: if batch fails, retry individual calls
6. Support providers that don't support batching (detect and disable)
7. Add `batchSize` parameter to tools that benefit from batching

## Acceptance Criteria
- [ ] RPC batching reduces call count by >60% for multi-token operations
- [ ] Batch size limits enforced
- [ ] Fallback to individual calls works
- [ ] Metrics tracking batch efficiency
- [ ] Provider compatibility detection
