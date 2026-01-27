# X402 Operations Guide

Operational runbooks, monitoring setup, and incident response procedures for X402 infrastructure.

## Table of Contents

- [Monitoring](#monitoring)
- [Incident Response](#incident-response)
- [Maintenance](#maintenance)

---

## Monitoring

### Key Metrics to Track

#### Smart Contract Metrics

| Metric | Description | Source | Alert Threshold |
|--------|-------------|--------|-----------------|
| `x402_total_payments` | Total payments processed | Event logs | N/A (informational) |
| `x402_payment_volume_usds` | Total USDs volume | Event logs | N/A (informational) |
| `x402_active_subscriptions` | Active subscription count | Contract call | < 80% of previous day |
| `x402_credit_balance_total` | Total credits outstanding | Contract call | > $1M (review) |
| `x402_failed_settlements` | Failed settlement attempts | Event logs | > 0 (immediate) |
| `x402_contract_balance` | Contract USDs balance | Balance query | Unexpected changes |

#### Facilitator Service Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `http_requests_total` | Total HTTP requests | N/A |
| `http_request_duration_seconds` | Request latency (p50, p95, p99) | p99 > 5s |
| `http_requests_failed_total` | Failed requests | > 1% error rate |
| `payment_verifications_total` | Payment verification count | N/A |
| `payment_settlements_total` | Settlement count | N/A |
| `payment_settlements_failed` | Failed settlements | > 0 |
| `rpc_requests_total` | RPC calls to Arbitrum | N/A |
| `rpc_request_duration_seconds` | RPC latency | p99 > 2s |
| `rpc_errors_total` | RPC errors | > 5% error rate |
| `cache_hits_total` | Cache hit count | N/A |
| `cache_misses_total` | Cache miss count | Hit rate < 70% |

#### Infrastructure Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `container_cpu_usage` | CPU utilization | > 80% for 5m |
| `container_memory_usage` | Memory utilization | > 85% |
| `container_restarts_total` | Container restart count | > 3 in 1h |
| `node_disk_usage_percent` | Disk utilization | > 80% |

### Alerting Configuration

#### Prometheus Alerting Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: x402-alerts
    rules:
      # High error rate
      - alert: X402HighErrorRate
        expr: |
          sum(rate(http_requests_failed_total{app="x402-facilitator"}[5m])) /
          sum(rate(http_requests_total{app="x402-facilitator"}[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on X402 Facilitator"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes"

      # Service down
      - alert: X402FacilitatorDown
        expr: up{app="x402-facilitator"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "X402 Facilitator is down"
          description: "Facilitator service has been down for more than 1 minute"

      # High latency
      - alert: X402HighLatency
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{app="x402-facilitator"}[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on X402 Facilitator"
          description: "p99 latency is {{ $value | humanizeDuration }}"

      # Failed settlements
      - alert: X402SettlementFailure
        expr: increase(payment_settlements_failed{app="x402-facilitator"}[5m]) > 0
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "Payment settlement failed"
          description: "{{ $value }} settlements failed in the last 5 minutes"

      # RPC errors
      - alert: X402RPCErrors
        expr: |
          sum(rate(rpc_errors_total{app="x402-facilitator"}[5m])) /
          sum(rate(rpc_requests_total{app="x402-facilitator"}[5m])) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High RPC error rate"
          description: "RPC error rate is {{ $value | humanizePercentage }}"

      # Low cache hit rate
      - alert: X402LowCacheHitRate
        expr: |
          sum(rate(cache_hits_total{app="x402-facilitator"}[1h])) /
          (sum(rate(cache_hits_total{app="x402-facilitator"}[1h])) + 
           sum(rate(cache_misses_total{app="x402-facilitator"}[1h]))) < 0.7
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"

      # Memory pressure
      - alert: X402HighMemoryUsage
        expr: |
          container_memory_usage_bytes{app="x402-facilitator"} /
          container_spec_memory_limit_bytes{app="x402-facilitator"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is at {{ $value | humanizePercentage }}"
```

### Grafana Dashboard Templates

#### Main Dashboard (JSON)

```json
{
  "dashboard": {
    "title": "X402 Operations Dashboard",
    "tags": ["x402", "production"],
    "timezone": "UTC",
    "panels": [
      {
        "title": "Request Rate",
        "type": "timeseries",
        "gridPos": { "x": 0, "y": 0, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{app=\"x402-facilitator\"}[5m]))",
            "legendFormat": "Requests/s"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "timeseries",
        "gridPos": { "x": 8, "y": 0, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "sum(rate(http_requests_failed_total{app=\"x402-facilitator\"}[5m])) / sum(rate(http_requests_total{app=\"x402-facilitator\"}[5m])) * 100",
            "legendFormat": "Error %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 5 }
              ]
            }
          }
        }
      },
      {
        "title": "Latency (p50, p95, p99)",
        "type": "timeseries",
        "gridPos": { "x": 16, "y": 0, "w": 8, "h": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{app=\"x402-facilitator\"}[5m]))",
            "legendFormat": "p50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{app=\"x402-facilitator\"}[5m]))",
            "legendFormat": "p95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{app=\"x402-facilitator\"}[5m]))",
            "legendFormat": "p99"
          }
        ]
      },
      {
        "title": "Payment Volume (USDs)",
        "type": "stat",
        "gridPos": { "x": 0, "y": 8, "w": 6, "h": 4 },
        "targets": [
          {
            "expr": "sum(increase(payment_volume_usds_total{app=\"x402-facilitator\"}[24h]))",
            "legendFormat": "24h Volume"
          }
        ]
      },
      {
        "title": "Active Settlements",
        "type": "stat",
        "gridPos": { "x": 6, "y": 8, "w": 6, "h": 4 },
        "targets": [
          {
            "expr": "sum(increase(payment_settlements_total{app=\"x402-facilitator\"}[24h]))",
            "legendFormat": "24h Settlements"
          }
        ]
      },
      {
        "title": "Failed Settlements",
        "type": "stat",
        "gridPos": { "x": 12, "y": 8, "w": 6, "h": 4 },
        "targets": [
          {
            "expr": "sum(increase(payment_settlements_failed{app=\"x402-facilitator\"}[24h]))",
            "legendFormat": "24h Failed"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "red", "value": 1 }
              ]
            }
          }
        }
      },
      {
        "title": "Cache Hit Rate",
        "type": "gauge",
        "gridPos": { "x": 18, "y": 8, "w": 6, "h": 4 },
        "targets": [
          {
            "expr": "sum(rate(cache_hits_total{app=\"x402-facilitator\"}[1h])) / (sum(rate(cache_hits_total{app=\"x402-facilitator\"}[1h])) + sum(rate(cache_misses_total{app=\"x402-facilitator\"}[1h]))) * 100",
            "legendFormat": "Hit Rate %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "min": 0,
            "max": 100,
            "thresholds": {
              "steps": [
                { "color": "red", "value": null },
                { "color": "yellow", "value": 50 },
                { "color": "green", "value": 70 }
              ]
            }
          }
        }
      }
    ]
  }
}
```

### Log Aggregation

#### Structured Logging Format

```typescript
// All logs should follow this format
interface LogEntry {
  timestamp: string;       // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: 'x402-facilitator';
  traceId?: string;        // Request correlation ID
  spanId?: string;         // Operation ID
  userId?: string;         // Wallet address
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}
```

#### Loki/Promtail Configuration

```yaml
# promtail/config.yml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: x402-facilitator
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.+)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_label_app']
        target_label: 'app'
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: message
            traceId: traceId
      - labels:
          level:
          traceId:
```

#### Useful Log Queries (LogQL)

```logql
# All errors in the last hour
{app="x402-facilitator"} |= "error" | json | level="error"

# Failed settlements
{app="x402-facilitator"} |= "settlement" |= "failed"

# High latency requests (> 5s)
{app="x402-facilitator"} | json | duration > 5000

# Requests by wallet address
{app="x402-facilitator"} | json | userId="0x..."

# Rate of errors over time
sum(rate({app="x402-facilitator"} |= "error" [5m]))
```

---

## Incident Response

### Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **SEV1** | Critical - Service down, payments failing | 15 minutes | Facilitator down, contract paused unexpectedly |
| **SEV2** | Major - Degraded service | 1 hour | High latency, partial failures |
| **SEV3** | Minor - Non-critical issues | 4 hours | Low cache hit rate, minor bugs |
| **SEV4** | Low - Improvements | Next sprint | Performance optimization |

### Runbook: Common Issues

#### Issue: Facilitator Service Unresponsive

**Symptoms:**
- Health check failing
- 5xx errors from service
- No responses to API requests

**Diagnosis:**
```bash
# Check pod status
kubectl -n x402 get pods -l app=x402-facilitator

# Check logs
kubectl -n x402 logs -l app=x402-facilitator --tail=100

# Check resource usage
kubectl -n x402 top pods -l app=x402-facilitator

# Check events
kubectl -n x402 get events --sort-by='.lastTimestamp'
```

**Resolution:**
```bash
# Restart pods (rolling restart)
kubectl -n x402 rollout restart deployment/x402-facilitator

# If stuck, force delete
kubectl -n x402 delete pods -l app=x402-facilitator --force

# Scale up if resource constrained
kubectl -n x402 scale deployment/x402-facilitator --replicas=5
```

#### Issue: High Error Rate on Payments

**Symptoms:**
- `payment_settlements_failed` increasing
- Users reporting failed transactions

**Diagnosis:**
```bash
# Check recent settlement errors
kubectl -n x402 logs -l app=x402-facilitator | grep -i "settlement" | grep -i "error"

# Check RPC connectivity
curl -X POST $RPC_URL -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check contract state
cast call $TOOL_REGISTRY "paused()(bool)" --rpc-url $RPC_URL
```

**Resolution:**
```bash
# If RPC issue, switch to backup RPC
kubectl -n x402 set env deployment/x402-facilitator RPC_URL=$BACKUP_RPC_URL

# If contract paused, check governance
cast call $TOOL_REGISTRY "owner()(address)" --rpc-url $RPC_URL

# If gas issue, check gas prices
cast gas-price --rpc-url $RPC_URL
```

#### Issue: RPC Provider Errors

**Symptoms:**
- `rpc_errors_total` spiking
- Timeout errors in logs

**Diagnosis:**
```bash
# Test RPC endpoint directly
curl -w "@curl-format.txt" -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check provider status page
# Alchemy: https://status.alchemy.com
# Infura: https://status.infura.io
```

**Resolution:**
```bash
# Failover to backup RPC
kubectl -n x402 set env deployment/x402-facilitator \
  RPC_URL=https://arb-mainnet.g.alchemy.com/v2/$BACKUP_ALCHEMY_KEY

# Restart to apply
kubectl -n x402 rollout restart deployment/x402-facilitator
```

### Emergency Pause Procedures

#### Pause Smart Contracts (if supported)

```bash
# 1. Connect to multi-sig or admin wallet
# 2. Execute pause transaction

# Using cast (direct admin)
cast send $TOOL_REGISTRY "pause()" \
  --rpc-url $RPC_URL \
  --private-key $ADMIN_PRIVATE_KEY

# Using Safe (multi-sig)
# 1. Go to https://app.safe.global
# 2. Create new transaction
# 3. Contract interaction: TOOL_REGISTRY.pause()
# 4. Collect required signatures
# 5. Execute
```

#### Pause Facilitator Service

```bash
# Scale down to 0
kubectl -n x402 scale deployment/x402-facilitator --replicas=0

# Or redirect traffic (if using ingress)
kubectl -n x402 annotate ingress x402-facilitator \
  nginx.ingress.kubernetes.io/server-snippet="return 503;"
```

### Rollback Procedures

#### Rollback Kubernetes Deployment

```bash
# View rollout history
kubectl -n x402 rollout history deployment/x402-facilitator

# Rollback to previous version
kubectl -n x402 rollout undo deployment/x402-facilitator

# Rollback to specific revision
kubectl -n x402 rollout undo deployment/x402-facilitator --to-revision=3

# Verify rollback
kubectl -n x402 get pods -w
```

#### Rollback Docker Image

```bash
# List available tags
docker image ls ghcr.io/nirholas/x402-facilitator

# Update deployment to previous tag
kubectl -n x402 set image deployment/x402-facilitator \
  facilitator=ghcr.io/nirholas/x402-facilitator:v1.0.0
```

#### Rollback Smart Contract (Proxy)

⚠️ **WARNING**: Contract rollbacks are complex and may have state implications.

```bash
# 1. Deploy previous implementation (or use existing)
# 2. Upgrade proxy to old implementation
forge script script/DeployX402Suite.s.sol:UpgradeX402Suite \
  --sig "upgradeToolRegistry(address,address)" \
  $PROXY_ADDRESS $OLD_IMPLEMENTATION \
  --rpc-url $RPC_URL \
  --broadcast

# 3. Verify state is intact
cast call $PROXY_ADDRESS "platformWallet()(address)" --rpc-url $RPC_URL
```

### Post-Incident Template

```markdown
# Incident Report: [Title]

## Summary
- **Date/Time**: YYYY-MM-DD HH:MM UTC
- **Duration**: X hours Y minutes
- **Severity**: SEV1/SEV2/SEV3
- **Impact**: [Description of user impact]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | First alert triggered |
| HH:MM | On-call engineer paged |
| HH:MM | Issue identified |
| HH:MM | Mitigation applied |
| HH:MM | Service restored |
| HH:MM | All-clear declared |

## Root Cause
[Detailed explanation of what caused the incident]

## Resolution
[What was done to resolve the incident]

## Impact Assessment
- **Affected Users**: X
- **Failed Transactions**: Y
- **Revenue Impact**: $Z

## Action Items
| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| [Action 1] | @name | YYYY-MM-DD | ⏳ |
| [Action 2] | @name | YYYY-MM-DD | ⏳ |

## Lessons Learned
- What went well?
- What could be improved?
- What will we do differently?

## Attendees
- Incident Commander: @name
- Technical Lead: @name
- Communications: @name
```

---

## Maintenance

### Dependency Updates

#### Node.js Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update all packages
pnpm update

# Update specific package
pnpm update viem@latest

# Update to latest major versions (review carefully)
pnpm update --latest

# Audit for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit --fix
```

#### Smart Contract Dependencies

```bash
cd contracts

# Update Foundry
foundryup

# Update forge-std
forge update lib/forge-std

# Update OpenZeppelin
forge update lib/openzeppelin-contracts
forge update lib/openzeppelin-contracts-upgradeable

# Check for vulnerabilities in contracts
# Use Slither or similar tools
pip install slither-analyzer
slither .
```

### Security Patches

#### Critical Vulnerability Response

```bash
# 1. Assess impact
# Review CVE details and affected components

# 2. Apply patch in staging
git checkout -b security/patch-cve-xxxx
pnpm update affected-package@patched-version
pnpm test

# 3. Deploy to staging
kubectl -n x402-staging apply -f k8s/

# 4. Verify functionality
curl https://staging.facilitator.x402.io/health

# 5. Deploy to production (expedited)
kubectl -n x402 apply -f k8s/

# 6. Verify production
curl https://facilitator.x402.io/health

# 7. Document and notify
```

#### OpenZeppelin Contract Updates

```bash
# Check for security advisories
# https://github.com/OpenZeppelin/openzeppelin-contracts/security/advisories

# Update to patched version
forge update lib/openzeppelin-contracts@v5.5.1

# Run all tests
forge test

# Review changes
forge diff src/ToolRegistry.sol
```

### Contract Upgrades

#### Upgrade Preparation

```bash
# 1. Write upgrade tests
forge test --match-contract UpgradeTest -vvv

# 2. Review storage layout compatibility
forge inspect ToolRegistry storage --pretty > storage-v1.json
# Make changes
forge inspect ToolRegistryV2 storage --pretty > storage-v2.json
diff storage-v1.json storage-v2.json

# 3. Test upgrade on fork
forge script script/DeployX402Suite.s.sol:UpgradeX402Suite \
  --sig "upgradeToolRegistry(address,address)" \
  $PROXY_ADDRESS $NEW_IMPL \
  --rpc-url http://localhost:8545 \
  --broadcast
```

#### Production Upgrade

```bash
# 1. Deploy new implementation
forge create src/ToolRegistryV2.sol:ToolRegistryV2 \
  --rpc-url $RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# 2. Verify new implementation
forge verify-contract $NEW_IMPL ToolRegistryV2 \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY

# 3. Create upgrade proposal in multi-sig
# Submit to Gnosis Safe or Governor contract

# 4. Execute upgrade after timelock
cast send $PROXY_ADDRESS \
  "upgradeToAndCall(address,bytes)" \
  $NEW_IMPL "" \
  --rpc-url $RPC_URL \
  --private-key $ADMIN_KEY

# 5. Verify upgrade
cast call $PROXY_ADDRESS "version()(string)" --rpc-url $RPC_URL
```

### Database Migrations (if applicable)

```bash
# Using Prisma (example)
# 1. Create migration
npx prisma migrate dev --name add_new_field

# 2. Apply to staging
DATABASE_URL=$STAGING_DB npx prisma migrate deploy

# 3. Verify
DATABASE_URL=$STAGING_DB npx prisma db pull

# 4. Apply to production
DATABASE_URL=$PROD_DB npx prisma migrate deploy
```

### Scheduled Maintenance Windows

| Task | Frequency | Window | Duration |
|------|-----------|--------|----------|
| Dependency updates | Weekly | Tuesday 10:00 UTC | 30 min |
| Security patches | As needed | ASAP | Variable |
| Contract upgrades | Quarterly | Saturday 06:00 UTC | 2 hours |
| Database maintenance | Monthly | Sunday 06:00 UTC | 1 hour |
| Full system backup | Daily | 04:00 UTC | 30 min |

### Maintenance Notification Template

```markdown
# Scheduled Maintenance Notice

**Service**: X402 Payment Facilitator
**Date**: YYYY-MM-DD
**Time**: HH:MM - HH:MM UTC
**Duration**: X hours (estimated)

## What's Happening
[Description of maintenance work]

## Impact
- [ ] Service will be unavailable
- [x] Service may experience brief interruptions
- [ ] No impact expected

## Actions Required
[Any user actions needed]

## Contact
For questions: support@x402.io
Status updates: https://status.x402.io
```

---

## Appendix

### Useful Commands Quick Reference

```bash
# Kubernetes
kubectl -n x402 get pods                    # List pods
kubectl -n x402 logs -f <pod>               # Stream logs
kubectl -n x402 exec -it <pod> -- sh        # Shell into pod
kubectl -n x402 port-forward svc/x402-facilitator 3002:80  # Port forward

# Docker
docker logs -f x402-facilitator             # Stream logs
docker exec -it x402-facilitator sh         # Shell into container
docker stats x402-facilitator               # Resource usage

# Foundry/Cast
cast call <addr> "fn()(type)" --rpc-url     # Read contract
cast send <addr> "fn(args)" --rpc-url       # Write contract
cast gas-price --rpc-url                    # Get gas price
cast block-number --rpc-url                 # Get block number

# Monitoring
curl localhost:3002/health                  # Health check
curl localhost:3002/metrics                 # Prometheus metrics
```

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | PagerDuty | Automatic |
| Infrastructure Lead | @infra-lead | Slack #x402-ops |
| Security Team | security@x402.io | SEV1/SEV2 |
| Contract Admin | Multi-sig holders | For contract emergencies |
