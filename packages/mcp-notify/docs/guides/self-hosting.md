# Self-Hosting Guide

Deploy your own MCP Notify instance for full control.

## Prerequisites

- **Docker** and **Docker Compose** (recommended)
- Or: Go 1.22+, PostgreSQL 15+, Redis 7+
- A server or cloud instance

---

## Quick Start with Docker Compose

### 1. Clone Repository

```bash
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required
MCP_WATCH_DATABASE_URL=postgres://postgres:password@db:5432/mcpwatch?sslmode=disable
MCP_WATCH_REDIS_URL=redis://redis:6379

# Optional - for email notifications
MCP_WATCH_SMTP_HOST=smtp.gmail.com
MCP_WATCH_SMTP_PORT=587
MCP_WATCH_SMTP_USERNAME=your-email@gmail.com
MCP_WATCH_SMTP_PASSWORD=your-app-password
MCP_WATCH_SMTP_FROM=alerts@yourdomain.com

# Security
MCP_WATCH_API_SECRET_KEY=your-random-secret-key-here
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Verify

```bash
curl http://localhost:8080/health
```

---

## Manual Installation

### Install Dependencies

```bash
# PostgreSQL
sudo apt install postgresql-15

# Redis
sudo apt install redis-server

# Go
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
```

### Build from Source

```bash
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify
go build -o mcp-notify ./cmd/mcp-notify
go build -o mcp-notify-cli ./cmd/mcp-notify-cli
```

### Configure

```bash
cp config.example.yaml config.yaml
# Edit config.yaml with your settings
```

### Run

```bash
./mcp-notify
```

---

## Configuration Reference

### config.yaml

```yaml
server:
  host: "0.0.0.0"
  port: 8080
  read_timeout: 30s
  write_timeout: 30s

registry:
  url: "https://registry.modelcontextprotocol.io"
  poll_interval: 5m
  timeout: 30s

database:
  url: "${MCP_WATCH_DATABASE_URL}"
  max_connections: 25
  min_connections: 5

redis:
  url: "${MCP_WATCH_REDIS_URL}"
  
notifications:
  discord:
    enabled: true
    rate_limit: "30/min"
    retry_attempts: 3
    
  slack:
    enabled: true
    rate_limit: "30/min"
    
  email:
    enabled: true
    smtp_host: "${MCP_WATCH_SMTP_HOST}"
    smtp_port: 587
    smtp_username: "${MCP_WATCH_SMTP_USERNAME}"
    smtp_password: "${MCP_WATCH_SMTP_PASSWORD}"
    from_address: "${MCP_WATCH_SMTP_FROM}"
    
  webhook:
    enabled: true
    timeout: 10s
    retry_attempts: 5

telemetry:
  enabled: true
  prometheus_port: 9090
```

---

## Production Deployment

### Kubernetes

See [deploy/helm](../deploy/helm) for Helm chart.

```bash
helm install mcp-notify ./deploy/helm/mcp-notify \
  --set database.url="postgres://..." \
  --set redis.url="redis://..."
```

### Systemd Service

```ini
# /etc/systemd/system/mcp-notify.service
[Unit]
Description=MCP Notify
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=mcp-notify
WorkingDirectory=/opt/mcp-notify
ExecStart=/opt/mcp-notify/mcp-notify
Restart=always
RestartSec=5
Environment=MCP_WATCH_DATABASE_URL=postgres://...
Environment=MCP_WATCH_REDIS_URL=redis://...

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mcp-notify
sudo systemctl start mcp-notify
```

---

## Database Setup

### PostgreSQL

```sql
CREATE DATABASE mcpwatch;
CREATE USER mcpwatch WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE mcpwatch TO mcpwatch;
```

Migrations run automatically on startup.

### Redis

Default configuration works. For production:

```bash
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

---

## Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name watch.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/watch.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/watch.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Monitoring

### Prometheus Metrics

Metrics available at `:9090/metrics`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mcp-notify'
    static_configs:
      - targets: ['localhost:9090']
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| `mcp_watch_changes_detected_total` | Total changes detected |
| `mcp_watch_notifications_sent_total` | Notifications sent by channel |
| `mcp_watch_poll_duration_seconds` | Registry poll duration |
| `mcp_watch_active_subscriptions` | Current active subscriptions |

### Health Checks

```bash
# Liveness
curl http://localhost:8080/health

# Readiness
curl http://localhost:8080/ready
```

---

## Scaling

### Horizontal Scaling

Run multiple instances behind a load balancer:

```yaml
# docker-compose.scale.yml
services:
  mcp-notify:
    deploy:
      replicas: 3
```

The application handles coordination via Redis.

### Separate Workers

For high volume, run poller separately:

```bash
# API server only
MCP_WATCH_MODE=api ./mcp-notify

# Poller only
MCP_WATCH_MODE=poller ./mcp-notify

# Notifier only
MCP_WATCH_MODE=notifier ./mcp-notify
```

---

## Backup & Recovery

### Database Backup

```bash
pg_dump -h localhost -U mcpwatch mcpwatch > backup.sql
```

### Restore

```bash
psql -h localhost -U mcpwatch mcpwatch < backup.sql
```

---

## Troubleshooting

### Check Logs

```bash
docker-compose logs -f mcp-notify
# Or
journalctl -u mcp-notify -f
```

### Database Connection Issues

```bash
psql $MCP_WATCH_DATABASE_URL -c "SELECT 1"
```

### Redis Connection Issues

```bash
redis-cli -u $MCP_WATCH_REDIS_URL PING
```

### Enable Debug Logging

```yaml
# config.yaml
log_level: debug
```

---

## Next Steps

- [Production Checklist](./production-checklist.md)
- [Monitoring Setup](../DEPLOYMENT.md#monitoring)
- [API Documentation](../api/README.md)
