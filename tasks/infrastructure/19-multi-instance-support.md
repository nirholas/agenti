# Task: Support Horizontal Scaling with Shared State

## Priority: MEDIUM

## Context
Current in-memory state (sessions, rate limits, payment tracking) prevents running multiple server instances. Enterprise deployments need horizontal scaling behind a load balancer.

## Requirements
1. Externalize all shared state to Redis:
   - MCP session state
   - Rate limit counters
   - Payment tracking / daily limits
   - Alert subscriptions
   - WebSocket connection registry
2. Add Redis connection configuration with TLS support
3. Implement session affinity via `mcp-session-id` header (sticky sessions)
4. Add a session store interface (Redis default, in-memory for development)
5. Handle Redis connection failures gracefully (degrade to in-memory with warnings)
6. Add cluster health endpoint showing instance count and state
7. Support Redis Sentinel or Cluster mode for HA

## Acceptance Criteria
- [ ] All shared state externalized to Redis
- [ ] Multiple instances serve same clients correctly
- [ ] Redis connection with TLS
- [ ] Graceful degradation on Redis failure
- [ ] Cluster health endpoint operational
