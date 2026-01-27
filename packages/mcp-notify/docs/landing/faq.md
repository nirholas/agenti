# Frequently Asked Questions

## General

### What is MCP Notify?

MCP Notify is a monitoring and notification service for the Model Context Protocol (MCP) registry. It detects changes to MCP servers (new additions, updates, and removals) and delivers notifications through your preferred channels.

### Is MCP Notify free?

The open-source version is free to self-host. We also offer a hosted service with free and paid tiers.

### How often does it check for changes?

By default, the registry is polled every 5 minutes. This is configurable in self-hosted deployments.

### What changes can it detect?

- **New servers**: When a server is added to the registry
- **Updates**: Version changes, description updates, package modifications
- **Removals**: When a server is removed from the registry

---

## Subscriptions

### How many subscriptions can I create?

Self-hosted: Unlimited
Hosted free tier: 5 subscriptions
Hosted paid tiers: Varies by plan

### Can I have multiple channels per subscription?

Yes! You can configure multiple notification channels for a single subscription for redundancy or different audiences.

### How do filters work?

Filters are combined with AND logic:
- A change must match ALL specified filter criteria
- Within a filter type (e.g., keywords), items are OR'd together

Example: `keywords: ["ai", "ml"]` + `change_types: ["new"]` = New servers with "ai" OR "ml" in their name/description.

### What are namespace patterns?

Namespaces are hierarchical identifiers for MCP servers. Patterns use glob syntax:
- `io.github.user/*` - All servers from a specific user
- `*.ai.*` - Any namespace containing "ai"
- `io.github.*/mcp-*` - MCP-prefixed servers from any GitHub user

### Can I pause notifications temporarily?

Yes! Use the pause/resume endpoints or toggle in the dashboard. Paused subscriptions stop receiving notifications but aren't deleted.

---

## Notifications

### Why am I not receiving notifications?

Common reasons:
1. **Subscription is paused** - Check status in dashboard
2. **Filters too strict** - Broaden your filters
3. **Channel misconfigured** - Use the test endpoint
4. **No matching changes** - Check the changes feed

### How do I test my notification setup?

Use the test endpoint:
```bash
curl -X POST https://api.watch.mcpregistry.dev/v1/subscriptions/{id}/test \
  -H "X-API-Key: your-key"
```

Or click "Test" in the dashboard.

### What's the notification payload format?

Webhooks receive JSON:
```json
{
  "event": "server.updated",
  "timestamp": "2024-01-15T12:00:00Z",
  "change": {...},
  "server": {...},
  "subscription": {...}
}
```

### How do I verify webhook signatures?

Check the `X-Signature` header using HMAC-SHA256:
```python
import hmac
import hashlib

expected = hmac.new(secret, payload, hashlib.sha256).hexdigest()
is_valid = signature == f"sha256={expected}"
```

### What happens if a notification fails?

Failed notifications are retried with exponential backoff:
1. Immediate
2. 1 minute
3. 5 minutes
4. 30 minutes
5. 2 hours

After 5 failures, the notification moves to a dead letter queue.

### Can I get digest notifications instead of immediate?

Yes! Email channel supports digest modes:
- `immediate` - Send instantly (default)
- `hourly` - Aggregate per hour
- `daily` - Daily summary at specified time
- `weekly` - Weekly summary

---

## Self-Hosting

### What are the system requirements?

Minimum:
- 1 CPU, 512MB RAM
- PostgreSQL 14+
- Redis 6+

Recommended for production:
- 2 CPU, 1GB RAM
- PostgreSQL with connection pooling
- Redis cluster for high availability

### How do I upgrade?

Docker Compose:
```bash
docker compose pull
docker compose up -d
```

Kubernetes:
```bash
helm upgrade mcp-notify ./mcp-notify
```

### How do I backup my data?

Database backup:
```bash
pg_dump -U mcpwatch mcpwatch > backup.sql
```

Redis is ephemeral (rate limits, caches) and doesn't need backup.

### How do I run database migrations?

Migrations run automatically on startup. For manual runs:
```bash
./mcp-notify migrate up
```

---

## API

### How do I get an API key?

An API key is returned when you create a subscription:
```bash
curl -X POST https://api.watch.mcpregistry.dev/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{"name": "My Sub", "channels": [...]}'

# Response includes api_key field
```

**Important**: The key is only shown once!

### What are the rate limits?

| Tier | Requests/minute |
|------|-----------------|
| Free | 60 |
| Pro | 300 |
| Enterprise | Unlimited |

### Can I regenerate my API key?

Yes, in the dashboard settings. The old key is immediately invalidated.

### Is there an SDK?

Official SDKs:
- Go: `github.com/nirholas/mcp-notify/pkg/client`

Community contributions for JavaScript and Python clients are welcome! The REST API and OpenAPI spec make it easy to generate clients in any language.

---

## Security

### Is my data secure?

Yes:
- API keys stored as bcrypt hashes
- Webhook secrets encrypted at rest
- HTTPS required for all endpoints
- No PII in logs

### Can someone subscribe to my notifications?

No. Subscriptions are private:
- Each subscription has a unique API key
- API key required for all operations
- Keys are never shared or exposed

### How do I report a security issue?

Email security@mcpregistry.dev with details. Please don't open public issues for security vulnerabilities.

---

## Troubleshooting

### Error: "Subscription not found"

- Check the subscription ID
- Verify you're using the correct API key
- The subscription may have been deleted

### Error: "Rate limit exceeded"

Wait for the rate limit window to reset. Check `X-RateLimit-Reset` header for timing.

### Error: "Invalid webhook URL"

Ensure your URL:
- Uses HTTPS (HTTP allowed only for localhost)
- Is publicly accessible
- Responds to POST requests
- Returns 2xx status

### Error: "Channel delivery failed"

Check channel-specific issues:
- Discord: Webhook URL still valid?
- Slack: App still has permissions?
- Email: Check spam folder
- Webhook: Server responding correctly?

### Where can I get help?

- Documentation: [docs/](./docs/)
- GitHub Issues: [github.com/nirholas/mcp-notify/issues](https://github.com/nirholas/mcp-notify/issues)
- X (Twitter): [@nichxbt](https://x.com/nichxbt)
