# Webhooks

Receive real-time HTTP callbacks when MCP Registry changes match your subscription filters.

## Overview

Webhooks allow you to receive push notifications to your own HTTP endpoint. When a change matches your subscription, MCP Notify sends a POST request to your configured URL.

## Configuration

Add a webhook channel to your subscription:

```json
{
  "name": "My Webhook Alerts",
  "channels": [
    {
      "type": "webhook",
      "config": {
        "url": "https://your-server.com/webhooks/mcp",
        "secret": "your-hmac-secret",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer your-token"
        }
      }
    }
  ]
}
```

### Configuration Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ | Your webhook endpoint URL (HTTPS recommended) |
| `secret` | string | ❌ | HMAC-SHA256 secret for signature verification |
| `method` | string | ❌ | HTTP method: `POST` (default) or `PUT` |
| `headers` | object | ❌ | Custom headers to include in requests |

---

## Webhook Payload

When a change is detected, your endpoint receives:

```http
POST /webhooks/mcp HTTP/1.1
Host: your-server.com
Content-Type: application/json
User-Agent: MCP-Notify/1.0
X-Webhook-ID: wh_abc123xyz
X-Webhook-Timestamp: 1704456600
X-Webhook-Signature: sha256=a1b2c3d4e5f6...
```

### Request Body

```json
{
  "id": "evt_abc123",
  "type": "change.detected",
  "timestamp": "2026-01-05T10:30:00Z",
  "subscription": {
    "id": "sub_xyz789",
    "name": "My Webhook Alerts"
  },
  "change": {
    "id": "chg_def456",
    "server_name": "@anthropic/claude-mcp",
    "change_type": "updated",
    "previous_version": "1.2.0",
    "new_version": "1.3.0",
    "field_changes": [
      {
        "field": "version",
        "old_value": "1.2.0",
        "new_value": "1.3.0"
      }
    ],
    "server": {
      "name": "@anthropic/claude-mcp",
      "display_name": "Claude MCP",
      "description": "Official Claude MCP integration",
      "version": "1.3.0",
      "repository": {
        "url": "https://github.com/anthropic/claude-mcp",
        "source": "github"
      }
    },
    "detected_at": "2026-01-05T10:30:00Z"
  }
}
```

---

## Signature Verification

If you configured a `secret`, verify webhook authenticity using HMAC-SHA256:

### Headers

| Header | Description |
|--------|-------------|
| `X-Webhook-ID` | Unique webhook delivery ID |
| `X-Webhook-Timestamp` | Unix timestamp of delivery |
| `X-Webhook-Signature` | HMAC-SHA256 signature |

### Verification Algorithm

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str, timestamp: str) -> bool:
    # Construct signed payload
    signed_payload = f"{timestamp}.{payload.decode()}"
    
    # Compute expected signature
    expected = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Compare signatures (timing-safe)
    expected_sig = f"sha256={expected}"
    return hmac.compare_digest(expected_sig, signature)
```

### Node.js Example

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret, timestamp) {
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSig),
    Buffer.from(signature)
  );
}
```

### Go Example

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
)

func VerifyWebhook(payload []byte, signature, secret, timestamp string) bool {
    signedPayload := fmt.Sprintf("%s.%s", timestamp, string(payload))
    
    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(signedPayload))
    expected := "sha256=" + hex.EncodeToString(h.Sum(nil))
    
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

---

## Response Requirements

Your webhook endpoint must:

1. **Return 2xx status** within 30 seconds
2. **Be idempotent** - same webhook may be delivered multiple times

### Success Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"received": true}
```

### Retry Behavior

If your endpoint fails or times out, we retry with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts, the webhook is marked as failed and won't be retried.

---

## Event Types

| Type | Description |
|------|-------------|
| `change.detected` | New change matching subscription filters |
| `subscription.test` | Test webhook from dashboard/API |
| `subscription.paused` | Subscription was paused |
| `subscription.resumed` | Subscription was resumed |

---

## Testing Webhooks

### Using the API

```bash
curl -X POST "https://watch.mcpregistry.dev/api/v1/subscriptions/{id}/test" \
  -H "X-API-Key: your-api-key"
```

### Using webhook.site

For testing, use [webhook.site](https://webhook.site) to get a temporary URL:

```json
{
  "channels": [{
    "type": "webhook",
    "config": {
      "url": "https://webhook.site/your-unique-id"
    }
  }]
}
```

---

## Security Best Practices

1. **Always use HTTPS** - Plain HTTP webhooks are rejected in production
2. **Verify signatures** - Always validate the HMAC signature
3. **Check timestamps** - Reject webhooks older than 5 minutes
4. **Use unique secrets** - Generate a unique secret per subscription
5. **Implement idempotency** - Use `X-Webhook-ID` to deduplicate

### Timestamp Validation

```python
import time

MAX_AGE_SECONDS = 300  # 5 minutes

def is_timestamp_valid(timestamp: str) -> bool:
    webhook_time = int(timestamp)
    current_time = int(time.time())
    return abs(current_time - webhook_time) < MAX_AGE_SECONDS
```

---

## Debugging

### Check Webhook Delivery Status

```bash
curl "https://watch.mcpregistry.dev/api/v1/subscriptions/{id}" \
  -H "X-API-Key: your-api-key"
```

Response includes delivery stats:

```json
{
  "channels": [{
    "type": "webhook",
    "stats": {
      "total_sent": 42,
      "total_failed": 2,
      "last_success": "2026-01-05T10:30:00Z",
      "last_failure": "2026-01-04T08:15:00Z",
      "last_error": "Connection timeout"
    }
  }]
}
```
