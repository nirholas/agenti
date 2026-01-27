# MCP Notify

<p align="center">
  <img src="docs/assets/logo.svg" alt="MCP Notify" width="200" />
</p>

<p align="center">
  <strong>Real-time monitoring and notifications for the MCP Registry ecosystem.</strong>
</p>
<p align="center">
  <a href="https://go.dev/">
    <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go" alt="Go Version" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  </a>
  <a href="https://registry.modelcontextprotocol.io">
    <img src="https://img.shields.io/badge/MCP-Registry-purple" alt="MCP Registry" />
  </a>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-deployment">Deploy</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://mcp-notify.vercel.app">
    <img src="https://img.shields.io/badge/MCP_Notify_Docs-blue" alt="MCP Notify Docs" />
  </a>
  <a href="https://mcp-notify.vercel.app">
    <img src="https://img.shields.io/badge/MCP_Notify_Dashoard-purple" alt="MCP Notify Dashboard" />
  </a>
</p>

---

**Never miss an MCP update again.** MCP Notify monitors the [official MCP Registry](https://registry.modelcontextprotocol.io) for changes and delivers instant notifications through Discord, Slack, email, webhooks, and more.

MCP Notify monitors the [official MCP Registry](https://registry.modelcontextprotocol.io) for changes and delivers notifications through multiple channels. Track new servers, version updates, and removals across the entire ecosystem or filter to specific namespaces and keywords.

## ✨ Features

### Core Capabilities
- **Real-time Monitoring**: Poll the MCP Registry at configurable intervals
- **Smart Diffing**: Detect new servers, updates, version changes, and removals
- **Flexible Filtering**: Subscribe to specific namespaces, keywords, or server patterns
- **Change History**: Full audit trail of all detected changes with timestamps

### Notification Channels
- **Discord**: Rich embeds with server details and direct links
- **Slack**: Interactive messages with action buttons
- **Email**: Digest emails (immediate, hourly, daily, weekly)
- **Webhooks**: Generic HTTP webhooks for custom integrations
- **RSS/Atom**: Subscribe via any feed reader
- **Telegram**: Bot notifications via Telegram Bot API
- **Microsoft Teams**: Adaptive Cards with full Teams integration

### Deployment Options
- **Hosted Service**: Use our hosted instance at `watch.mcpregistry.dev`
- **Self-Hosted**: Deploy your own instance via Docker or Kubernetes
- **CLI Tool**: One-off checks and local monitoring

### Developer Experience
- **REST API**: Full API for programmatic subscription management
- **Web Dashboard**: Visual configuration and monitoring interface
- **Go SDK**: Embed in your own applications
- **OpenAPI Spec**: Generate clients in any language

  ## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        MCP Notify                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│  │  Poller  │───▶│  Differ  │───▶│  Notification Dispatcher │  │
│  └──────────┘    └──────────┘    └──────────────────────────┘  │
│       │               │                      │                 │
│       ▼               ▼                      ▼                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐  │
│  │ Registry │    │ Snapshot │    │        Channels          │  │
│  │   API    │    │  Store   │    │  ┌───────┐ ┌───────────┐ │  │
│  └──────────┘    └──────────┘    │  │Discord│ │   Slack   │ │  │
│                       │          │  └───────┘ └───────────┘ │  │
│                       ▼          │  ┌───────┐ ┌───────────┐ │  │
│                  ┌──────────┐    │  │ Email │ │  Webhook  │ │  │
│                  │PostgreSQL│    │  └───────┘ └───────────┘ │  │
│                  └──────────┘    │  ┌───────┐               │  │
│                                  │  │  RSS  │               │  │
│                                  │  └───────┘               │  │
│                                  └──────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                       REST API                           │  │
│  │  /subscriptions  /changes  /feeds  /health  /metrics     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Web Dashboard                         │  │
│  │  React + TypeScript + Tailwind + shadcn/ui               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Using the Hosted Service

```bash
# Create a webhook subscription via API
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My DeFi Alerts",
    "filters": {
      "keywords": ["defi", "ethereum", "swap"],
      "namespaces": ["io.github.*"]
    },
    "channels": [{
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/..."
      }
    }]
  }'
```

### Self-Hosted with Docker

```bash
# Clone the repository
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker compose up -d

# Access dashboard at http://localhost:8080
```

### Using the CLI

```bash
# Install CLI
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest

# Check for recent changes
mcp-notify-cli changes --since 24h

# Watch with live output
mcp-notify-cli watch --filter "defi,blockchain" --output json

# Subscribe to notifications
mcp-notify-cli subscribe \
  --discord-webhook "https://discord.com/api/webhooks/..." \
  --filter "io.github.myorg/*"
```

## 📦 Installation

### Prerequisites
- Go 1.22+ (for building from source)
- PostgreSQL 15+ (for persistence)
- Redis 7+ (optional, for caching)
- Docker & Docker Compose (for containerized deployment)

### From Source

```bash
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify
make build
./bin/mcp-notify --config config.yaml
```

### Docker

```bash
docker pull ghcr.io/nirholas/mcp-notify:latest
docker run -p 8080:8080 -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/nirholas/mcp-notify:latest
```

### Kubernetes

```bash
helm repo add mcp-notify https://YOUR_USERNAME.github.io/mcp-notify
helm install mcp-notify mcp-notify/mcp-notify \
  --set config.registryUrl=https://registry.modelcontextprotocol.io \
  --set notifications.discord.enabled=true
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_WATCH_REGISTRY_URL` | MCP Registry API URL | `https://registry.modelcontextprotocol.io` |
| `MCP_WATCH_POLL_INTERVAL` | Polling interval | `5m` |
| `MCP_WATCH_DATABASE_URL` | PostgreSQL connection string | Required |
| `MCP_WATCH_REDIS_URL` | Redis connection string | Optional |
| `MCP_WATCH_API_PORT` | API server port | `8080` |
| `MCP_WATCH_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |

### Configuration File

```yaml
# config.yaml
server:
  port: 8080
  host: "0.0.0.0"
  cors:
    origins: ["*"]

registry:
  url: "https://registry.modelcontextprotocol.io"
  poll_interval: 5m
  timeout: 30s
  retry_attempts: 3

database:
  url: "postgres://user:pass@localhost:5432/mcp_watch?sslmode=disable"
  max_connections: 25
  
redis:
  url: "redis://localhost:6379/0"
  
notifications:
  discord:
    enabled: true
    rate_limit: 30/min
  slack:
    enabled: true
    rate_limit: 30/min
  email:
    enabled: true
    smtp:
      host: "smtp.example.com"
      port: 587
      username: ""
      password: ""
      from: "mcp-notify@example.com"
  webhook:
    enabled: true
    timeout: 10s
    retry_attempts: 3
  rss:
    enabled: true
    items_per_feed: 100
    
telemetry:
  metrics:
    enabled: true
    port: 9090
  tracing:
    enabled: false
    endpoint: ""
```

## 📡 API Reference

### Subscriptions

```bash
# Create subscription
POST /api/v1/subscriptions

# List subscriptions
GET /api/v1/subscriptions

# Get subscription
GET /api/v1/subscriptions/{id}

# Update subscription
PUT /api/v1/subscriptions/{id}

# Delete subscription
DELETE /api/v1/subscriptions/{id}

# Pause/resume subscription
POST /api/v1/subscriptions/{id}/pause
POST /api/v1/subscriptions/{id}/resume
```

### Changes

```bash
# Get recent changes
GET /api/v1/changes?since=2025-01-01T00:00:00Z&limit=100

# Get change details
GET /api/v1/changes/{id}

# Get changes for specific server
GET /api/v1/changes?server=io.github.example/my-server
```

### Feeds

```bash
# RSS feed (all changes)
GET /api/v1/feeds/rss

# Atom feed (all changes)
GET /api/v1/feeds/atom

# Filtered feed
GET /api/v1/feeds/rss?namespace=io.github.*&keywords=defi
```

### Health & Metrics

```bash
# Health check
GET /health

# Readiness check
GET /ready

# Prometheus metrics
GET /metrics
```

Full API documentation available at `/api/docs` when running the server, or see [docs/api/openapi.yaml](docs/api/openapi.yaml).

## 🔔 Notification Formats

### Discord

![Discord notification example](docs/images/discord-notification.png)

Rich embeds include:
- Server name and description
- Change type (new, updated, removed)
- Version information
- Direct link to registry
- Package registry links (npm, PyPI, etc.)

### Slack

Interactive messages with:
- Expandable server details
- Quick action buttons
- Thread support for related changes

### Email Digest

Configurable digest emails:
- Immediate (per-change)
- Hourly summary
- Daily digest
- Weekly roundup

### Webhook Payload

```json
{
  "event_type": "server.updated",
  "timestamp": "2025-01-04T12:00:00Z",
  "server": {
    "name": "io.github.example/my-server",
    "description": "An example MCP server",
    "version": "2.0.0",
    "previous_version": "1.5.0",
    "packages": [...],
    "remotes": [...]
  },
  "changes": [
    {
      "field": "version",
      "old_value": "1.5.0",
      "new_value": "2.0.0"
    },
    {
      "field": "description",
      "old_value": "...",
      "new_value": "..."
    }
  ],
  "registry_url": "https://registry.modelcontextprotocol.io/v0/servers/io.github.example%2Fmy-server"
}
```

## 📸 Screenshots

<details>
<summary>Click to expand screenshots</summary>

### Dashboard Overview
![Dashboard Overview](docs/assets/screenshots/dashboard.png)

### Changes Explorer
![Changes Explorer](docs/assets/screenshots/changes.png)

### Subscription Management
![Subscription Management](docs/assets/screenshots/subscriptions.png)

### Server Browser
![Server Browser](docs/assets/screenshots/servers.png)

### Settings
![Settings](docs/assets/screenshots/settings.png)

</details>

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, components, and data flow |
| [API Reference](docs/API.md) | Complete REST API documentation |
| [Deployment Guide](docs/DEPLOYMENT.md) | Docker, Kubernetes, and production setup |
| [Notification Channels](docs/NOTIFICATION_CHANNELS.md) | Channel configuration and troubleshooting |
| [Demo Guide](docs/DEMO.md) | Hands-on walkthrough and examples |
| [Contributing](CONTRIBUTING.md) | Development setup and guidelines |

## 🧪 Testing

```bash
# Run unit tests
make test

# Run integration tests (requires Docker)
make test-integration

# Run e2e tests
make test-e2e

# Run all tests with coverage
make test-coverage
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone repo
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Install dependencies
make deps

# Start development services
make dev-services

# Run in development mode with hot reload
make dev

# Run linters
make lint

# Generate code (API clients, mocks, etc.)
make generate
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) team for the protocol and registry
- [MCP Registry](https://github.com/modelcontextprotocol/registry) maintainers
- All contributors to this project

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/nirholas/mcp-notify/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nirholas/mcp-notify/discussions)
- **X (Twitter)**: [@nichxbt](https://x.com/nichxbt)

---

<p align="center">
  Made with ❤️ for the MCP community
</p>

---

**Built with ❤️ for the MCP community**
