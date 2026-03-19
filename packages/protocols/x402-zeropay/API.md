# ZeroPay API Reference

This document describes the REST API endpoints and webhook events for ZeroPay.

## Table of Contents

- [Authentication](#authentication)
- [Base URL](#base-url)
- [Payment API](#payment-api)
  - [Create Payment Session](#create-payment-session)
  - [Get Payment Session](#get-payment-session)
- [Webhook Events](#webhook-events)
  - [Webhook Security](#webhook-security)
  - [Event Types](#event-types)
- [Response Codes](#response-codes)
- [Examples](#examples)

## Authentication

All API requests require authentication using an API key. Include your API key as a query parameter:

```
?apikey=your-api-key-here
```

**Security Note:** For production environments, consider using header-based authentication or implement OAuth 2.0.

## Base URL

### Self-Hosted
```
http://your-domain:9000
```

### Platform (Managed Service)
```
https://api.zpaynow.com
```

Platform deployment includes additional features such as a public payment UI and automatic chain configuration, with a commission deducted as gas fee handling.

## Payment API

### Create Payment Session

Create a new payment session for a customer.

**Endpoint:** `POST /sessions`

**Query Parameters:**
- `apikey` (required): Your API key

**Request Body:**
```json
{
  "customer": "string",
  "amount": integer
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer` | string | Yes | Unique identifier for the customer |
| `amount` | integer | Yes | Payment amount in cents (e.g., 1000 = $10.00) |

**Response:** `200 OK`
```json
{
  "session_id": 12345,
  "customer": "neo",
  "pay_eth": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": 1000,
  "expired": "2025-10-13T12:00:00Z",
  "completed": false,
  "session_url": "https://zpaynow.com/sessions/abc123",
  "merchant": "Your Store Name",
  "chains": [
    {
      "name": "ethereum",
      "estimation": 72,
      "commission": 5,
      "commission_min": 50,
      "commission_max": 200,
      "tokens": {
        "USDT": {
          "identity": "ethereum:usdt",
          "name": "Tether USD",
          "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7"
        },
        "USDC": {
          "identity": "ethereum:usdc",
          "name": "USD Coin",
          "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        }
      }
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `session_id` | integer | Unique session identifier |
| `customer` | string | Customer identifier |
| `pay_eth` | string | Payment address for EVM-compatible chains |
| `amount` | integer | Payment amount in cents |
| `expired` | string (ISO 8601) | Session expiration timestamp |
| `completed` | boolean | Whether payment has been completed |
| `session_url` | string | Public payment page URL (platform only)* |
| `merchant` | string | Merchant name (platform only)* |
| `chains` | array | List of supported blockchain networks (platform only)* |

**Note:** Fields marked with * are only available when using the managed platform service.

**Chain Object:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Blockchain network name |
| `estimation` | integer | Estimated confirmation time in seconds |
| `commission` | integer | Commission rate percentage (1-100) |
| `commission_min` | integer | Minimum commission in cents |
| `commission_max` | integer | Maximum commission in cents |
| `tokens` | object | Supported tokens on this chain |

**Token Object:**
| Field | Type | Description |
|-------|------|-------------|
| `identity` | string | Unique token identifier |
| `name` | string | Human-readable token name |
| `address` | string | Token contract address |

**Example Request:**
```bash
curl -X POST "https://api.zpaynow.com/sessions?apikey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "neo",
    "amount": 1000
  }'
```

---

### Get Payment Session

Retrieve the current status of a payment session.

**Endpoint:** `GET /sessions/{session_id}`

**Query Parameters:**
- `apikey` (required): Your API key

**Path Parameters:**
- `session_id` (required): The session ID to query

**Response:** `200 OK`

Returns the same response structure as the Create Payment Session endpoint.

**Example Request:**
```bash
curl "https://api.zpaynow.com/sessions/12345?apikey=your-api-key"
```

---

## Webhook Events

ZeroPay sends HTTP POST requests to your configured webhook URL when payment events occur.

### Webhook Security

All webhook requests are secured using HMAC-SHA256 signatures to verify authenticity.

**Verification Process:**

1. **Secret Key:** Your API key serves as the HMAC secret
2. **Signature Header:** The `X-HMAC` header contains the signature
3. **Message:** The raw request body is the signed message

**Example Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(apiKey, signature, body) {
  const hmac = crypto.createHmac('sha256', apiKey);
  hmac.update(body);
  const computed = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

// In your webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hmac'];
  const body = JSON.stringify(req.body);

  if (!verifyWebhook(process.env.APIKEY, signature, body)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process the webhook event
  const { event, params } = req.body;
  // ...
});
```

**Example Verification (Python):**
```python
import hmac
import hashlib

def verify_webhook(api_key: str, signature: str, body: bytes) -> bool:
    computed = hmac.new(
        api_key.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, computed)

# In your webhook handler
@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-HMAC')
    body = request.get_data()

    if not verify_webhook(os.environ['APIKEY'], signature, body):
        return {'error': 'Invalid signature'}, 401

    data = request.json
    event = data['event']
    params = data['params']
    # ...
```

**Example Verification (Rust):**
```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn verify_webhook(api_key: &str, signature: &str, body: &[u8]) -> bool {
    let mut mac = HmacSha256::new_from_slice(api_key.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(body);

    let computed = hex::encode(mac.finalize().into_bytes());
    signature == computed
}
```

### Event Types

#### session.paid

Triggered when a customer completes payment for a session.

**Payload:**
```json
{
  "event": "session.paid",
  "params": [12345, "neo", 1000]
}
```

**Parameters:**
- `params[0]` (integer): Session ID
- `params[1]` (string): Customer identifier
- `params[2]` (integer): Deposited amount in cents

---

#### session.settled

Triggered when funds (minus commission) are transferred to your merchant account.

**Payload:**
```json
{
  "event": "session.settled",
  "params": [12345, "neo", 9500]
}
```

**Parameters:**
- `params[0]` (integer): Session ID
- `params[1]` (string): Customer identifier
- `params[2]` (integer): Settled amount in cents (after commission)

**Note:** The settled amount is less than the paid amount due to commission fees for gas and platform services.

---

#### unknown.paid

Triggered when payment is received but cannot be linked to a session (e.g., customer paid to a reused address).

**Payload:**
```json
{
  "event": "unknown.paid",
  "params": ["neo", 1000]
}
```

**Parameters:**
- `params[0]` (string): Customer identifier (if available)
- `params[1]` (integer): Deposited amount in cents

---

#### unknown.settled

Triggered when unlinked funds are transferred to your merchant account.

**Payload:**
```json
{
  "event": "unknown.settled",
  "params": ["neo", 9500]
}
```

**Parameters:**
- `params[0]` (string): Customer identifier (if available)
- `params[1]` (integer): Settled amount in cents (after commission)

---

## Response Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters |
| `401` | Unauthorized - Invalid or missing API key |
| `404` | Not Found - Session does not exist |
| `500` | Internal Server Error |

## API Usage

### Traditional Payment Flow

Create a payment session and receive a unique deposit address:

```bash
curl -X POST "http://localhost:9000/sessions?apikey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "user123",
    "amount": 1000
  }'
```

Check payment status:

```bash
curl "http://localhost:9000/sessions/12345?apikey=your-api-key"
```

### Complete Payment Flow

1. **Create a payment session:**
```bash
curl -X POST "https://api.zpaynow.com/sessions?apikey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "user123",
    "amount": 5000
  }'
```

2. **Display payment information to customer:**
   - Show the `pay_eth` address
   - Display the `amount` to be paid
   - List available `chains` and `tokens`
   - Show `expired` time

3. **Monitor session status (polling):**
```bash
curl "https://api.zpaynow.com/sessions/12345?apikey=your-api-key"
```

4. **Receive webhook notifications:**
   - `session.paid`: Customer completed payment
   - `session.settled`: Funds transferred to your account

### Integration Tips

1. **Session Expiration:** Always check the `expired` field and handle expired sessions appropriately
2. **Polling vs Webhooks:** Use webhooks for real-time updates, polling as a fallback
3. **Idempotency:** Store session IDs to prevent duplicate session creation
4. **Error Handling:** Implement retry logic with exponential backoff for API calls
5. **Testing:** Use testnet chains during development
6. **Webhook Endpoint:** Ensure your webhook endpoint:
   - Responds quickly (< 5 seconds)
   - Returns 2xx status on success
   - Handles duplicate events idempotently
   - Verifies HMAC signatures before processing

### Rate Limits

Currently, there are no enforced rate limits, but we recommend:
- Max 100 requests per second per API key
- Max 1000 session creations per hour

For higher limits, contact support or consider self-hosting.

## Support

For questions and issues:
- GitHub: [https://github.com/zpaynow/zeropay/issues](https://github.com/zpaynow/zeropay/issues)
- Platform Support: [https://zpaynow.com/support](https://zpaynow.com/support)
