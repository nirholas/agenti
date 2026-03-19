# Task: Implement RPC Connection Pooling and Failover

## Priority: MEDIUM

## Context
RPC endpoints in `src/evm/chains.ts` include demo/public URLs with rate limits. Enterprise deployments need connection pooling, load balancing, and automatic failover across providers.

## Requirements
1. Create an RPC connection pool manager supporting multiple providers per chain
2. Implement round-robin or least-connections load balancing across providers
3. Automatic failover: if a provider returns errors or exceeds latency threshold, route to next
4. Health checking: periodically verify provider availability (e.g., `eth_blockNumber`)
5. Circuit breaker pattern: after N consecutive failures, mark provider as unhealthy for M seconds
6. Support provider priority (e.g., Alchemy primary, Infura fallback, public last resort)
7. Metrics: track per-provider latency, error rate, and request count
8. Configuration via environment variables per chain:
   ```
   RPC_ETHEREUM=https://eth.alchemy.com/v2/KEY,https://mainnet.infura.io/v3/KEY
   ```
9. Remove all demo/public RPC URLs from defaults

## Acceptance Criteria
- [ ] Multi-provider connection pool per chain
- [ ] Automatic failover on provider errors
- [ ] Circuit breaker prevents cascading failures
- [ ] Per-provider metrics exposed
- [ ] Demo/public URLs removed from defaults
