---
title: Webhook Notifications
description: Set up generic HTTP webhooks for custom integrations
icon: material/webhook
tags:
  - channels
  - webhooks
---

# Webhook Notifications

Send HTTP POST requests to any endpoint for custom integrations.

## Quick Setup

=== "CLI"

    ```bash
    mcp-notify-cli subscribe webhook \
      --url "https://your-server.com/webhook" \
      --name "My Integration"
    ```

=== "API"

    ```bash
    curl -X POST http://localhost:8080/api/v1/subscriptions \
      -H "Content-Type: application/json" \
      -d '{
        "name": "My Integration",
        "channels": [{
          "type": "webhook",
          "config": {
            "url": "https://your-server.com/webhook"
          }
        }]
      }'
    ```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `url` | string | ✅ | Webhook endpoint URL |
| `secret` | string | ❌ | HMAC secret for signature verification |
| `method` | string | ❌ | HTTP method (default: `POST`) |
| `headers` | object | ❌ | Custom headers to include |

### Full Example

```json
{
  "type": "webhook",
  "config": {
    "url": "https://your-server.com/webhook",
    "secret": "your-secret-key",
    "method": "POST",
    "headers": {
      "X-Custom-Header": "value",
      "Authorization": "Bearer token123"
    }
  }
}
```

## Payload Format

Webhooks receive a JSON payload:

```json
{
  "event": "change.detected",
  "timestamp": "2026-01-05T10:30:00Z",
  "subscription_id": "sub_abc123",
  "change": {
    "id": "chg_xyz789",
    "server_name": "awesome-database-tool",
    "change_type": "new",
    "new_version": "1.2.0",
    "server": {
      "name": "awesome-database-tool",
      "description": "A database integration for AI assistants",
      "repository": {
        "url": "https://github.com/example/awesome-database-tool"
      },
      "version_detail": {
        "version": "1.2.0"
      }
    },
    "detected_at": "2026-01-05T10:30:00Z"
  }
}
```

## Signature Verification

If you configure a `secret`, the request includes an HMAC-SHA256 signature:

```
X-Signature-256: sha256=abc123...
```

### Verify in Node.js

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-signature-256'];
  const payload = JSON.stringify(req.body);
  
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook...
  res.status(200).send('OK');
});
```

### Verify in Python

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

### Verify in Go

```go
func verifySignature(payload []byte, signature, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expected))
}
```

## Response Handling

| Status Code | Behavior |
|-------------|----------|
| 2xx | Success, no retry |
| 4xx | Client error, no retry |
| 5xx | Server error, retry with backoff |
| Timeout | Retry with backoff |

Retries: 3 attempts with exponential backoff (2s, 4s, 8s).

## Use Cases

- **Custom dashboards**: Build your own notification UI
- **Data pipelines**: Feed changes into data warehouses
- **ChatOps**: Integrate with custom bot platforms
- **Automation**: Trigger CI/CD pipelines on server updates
- **Monitoring**: Send to Datadog, PagerDuty, etc.
