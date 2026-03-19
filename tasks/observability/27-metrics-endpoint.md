# Task: Add Prometheus Metrics Endpoint

## Priority: HIGH

## Context
Enterprise deployments need real-time metrics for monitoring, alerting, and capacity planning. The existing Grafana setup in `docker-compose.yml` needs a metrics source.

## Requirements
1. Add `/metrics` endpoint serving Prometheus format
2. Implement metrics:
   - **Request metrics**: `mcp_requests_total{tool, status}`, `mcp_request_duration_seconds{tool}`
   - **RPC metrics**: `rpc_requests_total{chain, provider, status}`, `rpc_request_duration_seconds{chain}`
   - **Business metrics**: `transactions_total{chain, type}`, `payment_amount_total{currency}`
   - **System metrics**: `nodejs_heap_used_bytes`, `nodejs_active_handles`, `nodejs_event_loop_lag_seconds`
   - **Rate limit metrics**: `rate_limit_hits_total{client}`, `rate_limit_remaining{client}`
   - **Connection pool metrics**: `rpc_pool_active{chain}`, `rpc_pool_idle{chain}`
3. Use `prom-client` library with default Node.js metrics enabled
4. Add histogram buckets optimized for blockchain latencies: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]
5. Provide Grafana dashboard JSON for import
6. Add alerting rules for:
   - Error rate > 5%
   - p99 latency > 5s
   - Memory usage > 80%
   - RPC provider failure rate > 10%

## Acceptance Criteria
- [ ] `/metrics` endpoint returns Prometheus format
- [ ] All metric categories implemented
- [ ] Grafana dashboard provided
- [ ] Alerting rules defined
- [ ] Metrics do not impact performance (< 1% overhead)
