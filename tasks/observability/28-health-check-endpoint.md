# Task: Implement Comprehensive Health Check Endpoint

## Priority: HIGH

## Context
The Dockerfile references a `/health` endpoint, but it needs to be comprehensive for Kubernetes readiness/liveness probes and load balancer health checks.

## Requirements
1. Implement three health endpoints:
   - `GET /health` — Liveness probe (is the process alive?)
   - `GET /ready` — Readiness probe (can it serve traffic?)
   - `GET /health/detailed` — Full dependency health (authenticated)
2. Liveness check: always returns 200 unless the process is deadlocked
3. Readiness check verifies:
   - Configuration loaded
   - Required RPC endpoints reachable
   - Database connected (if configured)
   - Redis connected (if configured)
4. Detailed health check returns:
   ```json
   {
     "status": "healthy|degraded|unhealthy",
     "uptime": 3600,
     "version": "1.0.0",
     "checks": {
       "rpc_ethereum": { "status": "up", "latency_ms": 45 },
       "rpc_polygon": { "status": "up", "latency_ms": 32 },
       "redis": { "status": "up", "latency_ms": 2 },
       "database": { "status": "up", "latency_ms": 5 }
     }
   }
   ```
5. Cache health check results for 5s to avoid overloading dependencies
6. Return 503 during graceful shutdown drain period

## Acceptance Criteria
- [ ] Three health endpoints implemented
- [ ] Readiness probe checks all dependencies
- [ ] Detailed health requires authentication
- [ ] Results cached for 5s
- [ ] 503 during shutdown drain
