# Quick Start Guide

Get MCP Notify running in under 5 minutes.

## Option 1: Use the Hosted Service (Fastest)

The easiest way to start is using our hosted service at `watch.mcpregistry.dev`.

### Step 1: Create an Account

```bash
# Create account and get API key
curl -X POST https://watch.mcpregistry.dev/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

You'll receive an API key via email.

### Step 2: Create Your First Subscription

```bash
curl -X POST https://watch.mcpregistry.dev/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "All MCP Updates",
    "channels": [{
      "type": "email",
      "config": {
        "email": "you@example.com",
        "digest": "daily"
      }
    }]
  }'
```

Done! You'll receive daily emails about new MCP servers.

---

## Option 2: Using Docker (Self-Hosted)

### Prerequisites

- Docker and Docker Compose installed
- A PostgreSQL database (or use the included one)

### Step 1: Clone the Repository

```bash
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify
```

### Step 2: Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### Step 3: Start Services

```bash
docker-compose up -d
```

### Step 4: Verify It's Running

```bash
curl http://localhost:8080/health
```

Expected response:
```json
{"status": "healthy", "version": "1.0.0"}
```

---

## Option 3: Using the CLI

### Install

```bash
# Using Go
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest

# Or download binary from releases
curl -L https://github.com/nirholas/mcp-notify/releases/latest/download/mcp-notify-cli-linux-amd64 -o mcp-notify-cli
chmod +x mcp-notify-cli
```

### Check for Changes

```bash
# List recent changes
mcp-notify-cli changes list --limit 10

# Watch for new servers
mcp-notify-cli changes list --type new --since 24h
```

### Create a Subscription

```bash
mcp-notify-cli subscriptions create \
  --name "My Alerts" \
  --discord-webhook "https://discord.com/api/webhooks/..."
```

---

## What's Next?

- [Create Your First Subscription](./first-subscription.md) - Detailed subscription setup
- [Discord Setup](./discord-setup.md) - Get Discord notifications
- [Filter Strategies](./filter-strategies.md) - Target specific servers
- [Self-Hosting Guide](./self-hosting.md) - Production deployment
