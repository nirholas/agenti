# Deployment Guide

This guide covers deploying MCP Notify in various environments, from local development to production Kubernetes clusters.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Railway (Recommended)](#railway-recommended)
- [Docker Compose (Development)](#docker-compose-development)
- [Docker Compose (Production)](#docker-compose-production)
- [Kubernetes with Helm](#kubernetes-with-helm)
- [Database Setup](#database-setup)
- [Monitoring Setup](#monitoring-setup)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required
- Docker 20.10+ and Docker Compose 2.0+
- PostgreSQL 14+ (or use containerized)
- Redis 6+ (or use containerized)

### Optional
- Kubernetes 1.24+ (for K8s deployment)
- Helm 3.10+ (for Helm deployment)
- Prometheus/Grafana (for monitoring)

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/mcpwatch` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `API_SECRET_KEY` | Secret for JWT signing | `your-secret-key-min-32-chars` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `LOG_LEVEL` | Logging level | `info` |
| `POLL_INTERVAL` | Registry poll interval | `5m` |
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |

### Notification Channels

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `SMTP_FROM` | From email address |

## Railway (Recommended)

Railway is the easiest way to deploy MCP Notify with PostgreSQL and Redis.

### One-Click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/mcp-notify)

### Manual Deployment

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create a new project**:
   ```bash
   railway init
   ```

3. **Add PostgreSQL and Redis**:
   ```bash
   railway add --plugin postgresql
   railway add --plugin redis
   ```

4. **Deploy the app**:
   ```bash
   railway up
   ```

5. **Set environment variables** (Railway Dashboard → Variables):
   ```
   MCP_WATCH_SERVER_HOST=0.0.0.0
   MCP_WATCH_SERVER_PORT=8080
   MCP_WATCH_LOG_LEVEL=info
   ```

   Railway automatically injects `DATABASE_URL` and `REDIS_URL` from the plugins.

6. **Generate a public URL**:
   ```bash
   railway domain
   ```

### Railway Environment Variables

Railway provides these automatically when you add PostgreSQL/Redis plugins:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - The port Railway expects your app to listen on

Configure these in the Railway dashboard:

| Variable | Description |
|----------|-------------|
| `MCP_WATCH_SERVER_HOST` | Set to `0.0.0.0` |
| `MCP_WATCH_SERVER_PORT` | Set to `$PORT` or `8080` |
| `MCP_WATCH_REGISTRY_URL` | MCP Registry URL (default: official registry) |
| `MCP_WATCH_REGISTRY_POLL_INTERVAL` | Poll interval (e.g., `5m`) |

## Docker Compose (Development)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Copy environment file
cp .env.example .env
# Edit .env with your settings

# Start all services
docker compose up -d

# Check logs
docker compose logs -f

# Access the dashboard
open http://localhost:8080
```

### docker-compose.yaml (Development)

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://mcpwatch:mcpwatch@postgres:5432/mcpwatch?sslmode=disable
      - REDIS_URL=redis://redis:6379/0
      - LOG_LEVEL=debug
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./config.yaml:/app/config.yaml:ro

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mcpwatch
      POSTGRES_USER: mcpwatch
      POSTGRES_PASSWORD: mcpwatch
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcpwatch"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  dashboard:
    build:
      context: ./web/dashboard
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

## Docker Compose (Production)

### Production Considerations

1. **Use external databases**: Don't run databases in Docker for production
2. **Enable TLS**: Use a reverse proxy (nginx, Traefik) for HTTPS
3. **Resource limits**: Set memory and CPU limits
4. **Health checks**: Ensure proper health check configuration
5. **Secrets management**: Use Docker secrets or external vault

### docker-compose.prod.yaml

```yaml
version: "3.8"

services:
  app:
    image: ghcr.io/nirholas/mcp-notify:latest
    restart: always
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - API_SECRET_KEY=${API_SECRET_KEY}
      - LOG_LEVEL=info
      - METRICS_ENABLED=true
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app

  prometheus:
    image: prom/prometheus:latest
    restart: always
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    restart: always
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

volumes:
  prometheus_data:
  grafana_data:
```

## Kubernetes with Helm

### Prerequisites

```bash
# Add Helm repository (if published)
helm repo add mcp-notify https://charts.mcpregistry.dev
helm repo update

# Or install from local chart
cd deploy/helm
```

### Basic Installation

```bash
# Create namespace
kubectl create namespace mcp-notify

# Create secrets
kubectl create secret generic mcp-notify-secrets \
  --namespace mcp-notify \
  --from-literal=database-url="postgres://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=api-secret-key="your-secret-key"

# Install with Helm
helm install mcp-notify ./mcp-notify \
  --namespace mcp-notify \
  --values values.yaml
```

### values.yaml Example

```yaml
replicaCount: 2

image:
  repository: ghcr.io/nirholas/mcp-notify
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: watch.mcpregistry.dev
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: mcp-notify-tls
      hosts:
        - watch.mcpregistry.dev

resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

postgresql:
  enabled: false  # Use external database
  
redis:
  enabled: true
  architecture: standalone
  auth:
    enabled: false

env:
  LOG_LEVEL: info
  POLL_INTERVAL: 5m

existingSecret: mcp-notify-secrets
```

### Upgrade

```bash
helm upgrade mcp-notify ./mcp-notify \
  --namespace mcp-notify \
  --values values.yaml
```

## Database Setup

### PostgreSQL Initial Setup

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE mcpwatch;
CREATE USER mcpwatch WITH ENCRYPTED PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE mcpwatch TO mcpwatch;
```

### Run Migrations

```bash
# Using the application
./mcp-notify migrate up

# Or manually
psql -U mcpwatch -d mcpwatch -f internal/db/migrations/001_initial_schema.sql
psql -U mcpwatch -d mcpwatch -f internal/db/migrations/002_add_indexes.sql
psql -U mcpwatch -d mcpwatch -f internal/db/migrations/003_add_digest_tracking.sql
```

### Connection Pooling (PgBouncer)

For production, consider using PgBouncer:

```ini
# pgbouncer.ini
[databases]
mcpwatch = host=postgres port=5432 dbname=mcpwatch

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

## Monitoring Setup

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mcp-notify'
    static_configs:
      - targets: ['app:8080']
    metrics_path: /metrics
```

### Grafana Dashboards

Import the pre-built dashboards from `deploy/grafana/dashboards/`:

1. Open Grafana (http://localhost:3001)
2. Go to Dashboards → Import
3. Upload `overview.json` and `notifications.json`

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| `mcp_watch_poll_errors_total` | > 3 in 15 minutes |
| `mcp_watch_notification_failures_total` | > 10% failure rate |
| `mcp_watch_api_latency_p99` | > 500ms |
| `up{job="mcp-notify"}` | == 0 |

## Backup & Recovery

### Database Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mcpwatch_backup_${DATE}.sql.gz"

pg_dump -U mcpwatch mcpwatch | gzip > /backups/${BACKUP_FILE}

# Upload to S3
aws s3 cp /backups/${BACKUP_FILE} s3://your-bucket/backups/

# Keep only last 30 days
find /backups -mtime +30 -delete
```

### Database Restore

```bash
# Stop the application
docker compose stop app

# Restore from backup
gunzip -c mcpwatch_backup_20240115.sql.gz | psql -U mcpwatch mcpwatch

# Restart
docker compose start app
```

### Disaster Recovery

1. **RTO (Recovery Time Objective)**: 1 hour
2. **RPO (Recovery Point Objective)**: 1 hour (with hourly backups)

**Recovery Steps:**
1. Provision new infrastructure
2. Restore database from latest backup
3. Configure Redis (ephemeral, no backup needed)
4. Deploy application
5. Update DNS

## Troubleshooting

### Common Issues

#### Connection Refused to Database

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Test connection
psql -h localhost -U mcpwatch -d mcpwatch
```

#### High Memory Usage

```bash
# Check container stats
docker stats

# Increase limits if needed
docker compose down
# Edit docker-compose.yaml to increase memory limits
docker compose up -d
```

#### Notifications Not Sending

```bash
# Check notification worker logs
docker compose logs app | grep notification

# Verify channel configuration
curl http://localhost:8080/api/v1/subscriptions/{id} \
  -H "X-API-Key: your-key"
```

### Health Checks

```bash
# Check API health
curl http://localhost:8080/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "registry": "ok"
  }
}
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug docker compose up

# Or for specific component
DEBUG=mcp:poller,mcp:notifier docker compose up
```

## Security Checklist

- [ ] Change default passwords
- [ ] Enable TLS/HTTPS
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Enable monitoring and alerting
- [ ] Review API rate limits
- [ ] Configure log retention
- [ ] Set up intrusion detection
- [ ] Regular security updates
- [ ] Audit access logs
