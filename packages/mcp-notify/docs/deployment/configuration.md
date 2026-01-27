---
title: Configuration Reference
description: Complete configuration options for MCP Notify
icon: material/cog
---

# Configuration Reference

Complete reference for all configuration options.

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `API_KEY` | - | API authentication key |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `DB_MAX_CONNECTIONS` | `25` | Maximum pool connections |
| `DB_MAX_IDLE` | `5` | Maximum idle connections |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection string |
| `REDIS_MAX_RETRIES` | `3` | Connection retry attempts |

### Polling

| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL` | `5m` | Registry poll interval |
| `POLL_TIMEOUT` | `30s` | Request timeout |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `LOG_FORMAT` | `json` | Log format (json, text) |

### Metrics

| Variable | Default | Description |
|----------|---------|-------------|
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics |
| `METRICS_PATH` | `/metrics` | Metrics endpoint path |

## Configuration File

You can also use a YAML configuration file:

```yaml
# config.yaml
server:
  port: 8080
  host: 0.0.0.0

database:
  url: postgres://user:pass@localhost:5432/mcp_notify
  max_connections: 25
  max_idle: 5

redis:
  url: redis://localhost:6379
  max_retries: 3

poller:
  interval: 5m
  timeout: 30s

log:
  level: info
  format: json

metrics:
  enabled: true
  path: /metrics
```

Load with:

```bash
mcp-notify --config config.yaml
```

## Priority

Configuration is loaded in this order (later overrides earlier):

1. Default values
2. Configuration file
3. Environment variables
4. Command-line flags
