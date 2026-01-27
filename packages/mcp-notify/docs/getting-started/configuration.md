---
title: Configuration
description: Complete configuration reference for MCP Notify
icon: material/cog
---

# Configuration

MCP Notify can be configured via YAML file, environment variables, or command-line flags.

## Configuration File

Create a `config.yaml` file:

```yaml
# Server configuration
server:
  host: "0.0.0.0"
  port: 8080
  cors:
    origins: ["*"]
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    headers: ["*"]

# MCP Registry configuration
registry:
  url: "https://registry.modelcontextprotocol.io"
  poll_interval: 5m
  timeout: 30s
  retry_attempts: 3
  retry_delay: 5s
  user_agent: "MCP-Notify/1.0"

# Database configuration
database:
  url: "postgres://user:pass@localhost:5432/mcpwatch?sslmode=disable"
  max_connections: 25
  max_idle_conns: 5
  conn_max_lifetime: 1h
  conn_max_idle_time: 30m

# Redis configuration (optional, for caching)
redis:
  url: "redis://localhost:6379/0"
  max_retries: 3
  pool_size: 10

# Notification channel defaults
notifications:
  discord:
    enabled: true
    rate_limit: "30/min"
    retry_attempts: 3
  
  slack:
    enabled: true
    rate_limit: "30/min"
    retry_attempts: 3
  
  email:
    enabled: true
    smtp:
      host: "smtp.example.com"
      port: 587
      username: "notifications@example.com"
      password: "${SMTP_PASSWORD}"  # Use env var
      from: "MCP Watch <notifications@example.com>"
      tls: true
  
  webhook:
    enabled: true
    timeout: 10s
    retry_attempts: 3

# Telemetry
telemetry:
  metrics:
    enabled: true
    port: 9090
  tracing:
    enabled: false
    endpoint: "http://jaeger:14268/api/traces"
    sample_rate: 0.1

# Logging
log_level: "info"  # debug, info, warn, error
```

## Environment Variables

All configuration options can be set via environment variables with the `MCP_WATCH_` prefix:

| Environment Variable | Config Path | Default |
|---------------------|-------------|---------|
| `MCP_WATCH_SERVER_HOST` | `server.host` | `0.0.0.0` |
| `MCP_WATCH_SERVER_PORT` | `server.port` | `8080` |
| `MCP_WATCH_DATABASE_URL` | `database.url` | - |
| `MCP_WATCH_REDIS_URL` | `redis.url` | - |
| `MCP_WATCH_REGISTRY_URL` | `registry.url` | Official registry |
| `MCP_WATCH_REGISTRY_POLL_INTERVAL` | `registry.poll_interval` | `5m` |
| `MCP_WATCH_LOG_LEVEL` | `log_level` | `info` |
| `MCP_WATCH_SMTP_PASSWORD` | `notifications.email.smtp.password` | - |

### Railway/Heroku Compatibility

These standard environment variables are also supported:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | HTTP server port |

## CLI Configuration

The CLI tool uses a separate configuration file at `~/.mcp-notify/config.yaml`:

```yaml
# API endpoint (for self-hosted)
api_url: "http://localhost:8080"

# Default API key
api_key: "mcp_xxxxxxxxxxxx"

# Output format (table, json, yaml)
output: table

# Default flags
watch:
  interval: 5m
  sound: true

changes:
  limit: 50
  since: 24h
```

### CLI Environment Variables

| Variable | Description |
|----------|-------------|
| `MCP_WATCH_API_URL` | API endpoint URL |
| `MCP_WATCH_API_KEY` | API key for authentication |
| `MCP_WATCH_OUTPUT` | Default output format |

## Poll Interval Recommendations

| Use Case | Recommended Interval |
|----------|---------------------|
| Development | `1m` |
| Production (active monitoring) | `5m` |
| Production (relaxed) | `15m` |
| Low-priority | `1h` |

!!! warning "Rate Limiting"
    Don't set poll intervals below 1 minute to avoid overloading the MCP Registry.

## Security Configuration

### TLS/HTTPS

For production, use a reverse proxy (nginx, Caddy) with TLS:

```yaml
# Example with Caddy
server:
  host: "127.0.0.1"  # Bind to localhost only
  port: 8080
```

### API Keys

API keys are automatically generated when creating subscriptions. They:

- Are prefixed with `mcp_` for identification
- Are stored as bcrypt hashes (never in plain text)
- Can be rotated via the API or dashboard

### Webhook Secrets

Outgoing webhooks support HMAC-SHA256 signatures:

```json
{
  "type": "webhook",
  "config": {
    "url": "https://your-server.com/webhook",
    "secret": "your-webhook-secret"
  }
}
```

The signature is sent in the `X-Signature-256` header.

## Next Steps

- [Deploy to production →](../deployment/index.md)
- [Set up notification channels →](../channels/index.md)
- [Configure the MCP Server →](../mcp-server/setup.md)
