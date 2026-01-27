# Demo Guide

This guide walks you through setting up a complete MCP Notify demo environment and demonstrates key features.

## Quick Start Demo (5 minutes)

### Prerequisites

- Docker and Docker Compose installed
- Terminal access

### 1. Start the Demo Environment

```bash
# Clone the repository
git clone https://github.com/nirholas/mcp-notify.git
cd mcp-notify

# Start all services
docker compose up -d

# Wait for services to be ready (about 30 seconds)
docker compose logs -f app
# Look for: "Server started on :8080"
# Press Ctrl+C to exit logs
```

### 2. Open the Dashboard

```bash
# Open in browser
open http://localhost:8080
# or
xdg-open http://localhost:8080  # Linux
```

### 3. Create Your First Subscription

**Via Dashboard:**
1. Click "New Subscription"
2. Enter a name: "My Demo Subscription"
3. Add a keyword filter: "ai"
4. Add a Discord webhook (see Discord Setup below)
5. Click "Create"
6. **Save your API key!** (shown only once)

**Via API:**
```bash
curl -X POST http://localhost:8080/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Demo Subscription",
    "filters": {
      "keywords": ["ai"]
    },
    "channels": [
      {
        "type": "webhook",
        "config": {
          "url": "https://webhook.site/your-unique-id"
        }
      }
    ]
  }' | jq
```

### 4. Browse Servers

Navigate to "Servers" in the dashboard to see all MCP Registry servers. Use the search to find specific servers.

### 5. View Changes

Navigate to "Changes" to see recent registry changes. Filter by type (new, updated, removed) or search for specific servers.

---

## Feature Demos

### Demo 1: Real-time Change Monitoring

Watch changes as they happen:

1. Open the Dashboard page
2. Observe the "Live Feed" section
3. Changes appear automatically as they're detected

### Demo 2: Multi-Channel Notifications

Set up multiple notification channels:

```bash
# Create subscription with multiple channels
curl -X POST http://localhost:8080/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Multi-Channel Demo",
    "channels": [
      {
        "type": "discord",
        "config": {
          "webhook_url": "https://discord.com/api/webhooks/..."
        }
      },
      {
        "type": "slack",
        "config": {
          "webhook_url": "https://hooks.slack.com/services/..."
        }
      },
      {
        "type": "email",
        "config": {
          "to": "demo@example.com"
        }
      }
    ]
  }'
```

### Demo 3: Filter Configuration

Create targeted subscriptions:

```bash
# Only new servers from a specific org
curl -X POST http://localhost:8080/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Org Monitor",
    "filters": {
      "namespaces": ["io.github.myorg/*"],
      "change_types": ["new"]
    },
    "channels": [...]
  }'
```

```bash
# Only AI-related server updates
curl -X POST http://localhost:8080/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Updates",
    "filters": {
      "keywords": ["ai", "llm", "gpt", "openai"],
      "change_types": ["new", "updated"]
    },
    "channels": [...]
  }'
```

### Demo 4: RSS Feed

Subscribe via RSS reader:

```bash
# Get RSS feed
curl http://localhost:8080/api/v1/feeds/rss

# Filtered RSS feed
curl "http://localhost:8080/api/v1/feeds/rss?keywords=ai,ml&types=new"
```

### Demo 5: Test Notifications

Test your channel configuration:

```bash
# Get your subscription ID and API key first
SUBSCRIPTION_ID="your-subscription-id"
API_KEY="your-api-key"

# Send test notification
curl -X POST "http://localhost:8080/api/v1/subscriptions/${SUBSCRIPTION_ID}/test" \
  -H "X-API-Key: ${API_KEY}"
```

---

## Channel Setup Guides

### Discord Webhook Setup

1. **In Discord:**
   - Right-click channel → Edit Channel
   - Integrations → Webhooks → New Webhook
   - Name it "MCP Watch"
   - Copy Webhook URL

2. **Test the webhook:**
   ```bash
   curl -X POST "YOUR_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content": "Hello from MCP Watch!"}'
   ```

3. **Add to subscription:**
   ```json
   {
     "type": "discord",
     "config": {
       "webhook_url": "YOUR_WEBHOOK_URL"
     }
   }
   ```

### Slack Webhook Setup

1. **Create Slack App:**
   - Go to https://api.slack.com/apps
   - Create New App → From scratch
   - Features → Incoming Webhooks → Activate
   - Add New Webhook to Workspace
   - Select channel → Allow
   - Copy Webhook URL

2. **Add to subscription:**
   ```json
   {
     "type": "slack",
     "config": {
       "webhook_url": "https://hooks.slack.com/services/T.../B.../xxx"
     }
   }
   ```

### Webhook.site Testing

For testing without setting up real channels:

1. Go to https://webhook.site
2. Copy your unique URL
3. Use it as a webhook:
   ```json
   {
     "type": "webhook",
     "config": {
       "url": "https://webhook.site/your-unique-id"
     }
   }
   ```
4. Watch incoming requests on webhook.site

---

## Sample Use Cases

### Use Case 1: Monitor Competitor Releases

Track when specific organizations publish new servers:

```json
{
  "name": "Competitor Watch",
  "description": "Monitor competitor MCP releases",
  "filters": {
    "namespaces": [
      "io.github.competitor-a/*",
      "io.github.competitor-b/*"
    ],
    "change_types": ["new", "updated"]
  },
  "channels": [
    {
      "type": "email",
      "config": {
        "to": "product-team@yourcompany.com",
        "digest": "daily"
      }
    }
  ]
}
```

### Use Case 2: Security Monitoring

Track all security-related updates:

```json
{
  "name": "Security Updates",
  "filters": {
    "keywords": ["security", "vulnerability", "cve", "patch"]
  },
  "channels": [
    {
      "type": "slack",
      "config": {
        "webhook_url": "https://hooks.slack.com/..."
      }
    },
    {
      "type": "email",
      "config": {
        "to": "security@yourcompany.com"
      }
    }
  ]
}
```

### Use Case 3: Internal Tool Tracking

Monitor your own organization's servers:

```json
{
  "name": "Internal Tools",
  "filters": {
    "namespaces": ["io.github.our-org/*"]
  },
  "channels": [
    {
      "type": "teams",
      "config": {
        "webhook_url": "https://outlook.office.com/webhook/..."
      }
    }
  ]
}
```

### Use Case 4: Community Highlights

Aggregate interesting new servers for a community:

```json
{
  "name": "Community Highlights",
  "filters": {
    "keywords": ["awesome", "featured", "popular"],
    "change_types": ["new"]
  },
  "channels": [
    {
      "type": "discord",
      "config": {
        "webhook_url": "https://discord.com/api/webhooks/..."
      }
    }
  ]
}
```

---

## CLI Demo

The CLI tool allows command-line interaction:

```bash
# Build the CLI
go build -o mcp-notify-cli ./cmd/mcp-notify-cli

# Configure
export MCP_WATCH_API_KEY="your-api-key"
export MCP_WATCH_API_URL="http://localhost:8080/api/v1"

# List subscriptions
./mcp-notify-cli subscriptions list

# Create subscription
./mcp-notify-cli subscriptions create \
  --name "CLI Demo" \
  --keywords "ai,automation" \
  --discord-webhook "https://discord.com/api/webhooks/..."

# View changes
./mcp-notify-cli changes list --since 24h

# Watch live changes
./mcp-notify-cli changes watch

# Export changes to CSV
./mcp-notify-cli changes list --format csv > changes.csv
```

---

## API Examples

### Python Script

```python
import requests
import os

BASE_URL = "http://localhost:8080/api/v1"
API_KEY = os.environ.get("MCP_WATCH_API_KEY")

headers = {"X-API-Key": API_KEY}

# List recent changes
response = requests.get(f"{BASE_URL}/changes", headers=headers)
changes = response.json()["changes"]

for change in changes:
    print(f"[{change['change_type']}] {change['server_name']}")

# Create subscription
subscription = {
    "name": "Python Demo",
    "filters": {"keywords": ["python"]},
    "channels": [
        {"type": "webhook", "config": {"url": "https://webhook.site/xxx"}}
    ]
}
response = requests.post(f"{BASE_URL}/subscriptions", json=subscription)
print(f"Created: {response.json()['id']}")
print(f"API Key: {response.json()['api_key']}")
```

### JavaScript Example

```javascript
const BASE_URL = 'http://localhost:8080/api/v1';
const API_KEY = process.env.MCP_WATCH_API_KEY;

async function demo() {
  // Get stats
  const stats = await fetch(`${BASE_URL}/stats`).then(r => r.json());
  console.log(`Total servers: ${stats.server_count}`);
  console.log(`Changes (24h): ${stats.changes_last_24h}`);

  // List changes
  const changes = await fetch(`${BASE_URL}/changes?limit=10`).then(r => r.json());
  changes.changes.forEach(c => {
    console.log(`[${c.change_type}] ${c.server_name}`);
  });
}

demo();
```

### cURL Reference

```bash
# Get statistics
curl http://localhost:8080/api/v1/stats | jq

# List servers
curl http://localhost:8080/api/v1/servers | jq

# Search servers
curl "http://localhost:8080/api/v1/servers?search=ai" | jq

# Get changes
curl "http://localhost:8080/api/v1/changes?since=2024-01-01T00:00:00Z" | jq

# Create subscription
curl -X POST http://localhost:8080/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d @subscription.json | jq

# Test subscription
curl -X POST http://localhost:8080/api/v1/subscriptions/{id}/test \
  -H "X-API-Key: your-key"

# Pause subscription
curl -X POST http://localhost:8080/api/v1/subscriptions/{id}/pause \
  -H "X-API-Key: your-key"
```

---

## Cleanup

Stop and remove the demo environment:

```bash
# Stop services
docker compose down

# Remove data volumes (optional)
docker compose down -v
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose logs app

# Check if ports are available
lsof -i :8080
lsof -i :5432
lsof -i :6379
```

### Can't Connect to Dashboard

- Ensure services are running: `docker compose ps`
- Check app logs: `docker compose logs app`
- Try accessing: `http://localhost:8080/health`

### Notifications Not Arriving

1. Check subscription status in dashboard
2. Verify channel configuration
3. Use the test endpoint
4. Check webhook.site for raw requests

### Database Errors

```bash
# Reset database
docker compose down -v
docker compose up -d
```
