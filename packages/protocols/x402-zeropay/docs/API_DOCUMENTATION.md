# ZeroPay API Documentation

Welcome to ZeroPay - a cryptocurrency payment gateway that makes accepting crypto payments simple and secure.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Webhooks](#webhooks)
5. [Payment Flow](#payment-flow)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [FAQ](#faq)

---

## Getting Started

### What is ZeroPay?

ZeroPay is a payment gateway that allows you to accept cryptocurrency payments (USDT, USDC) without managing wallets or blockchain infrastructure. For each payment:

1. You create a payment session
2. We generate a unique deposit address
3. Customer sends crypto to that address
4. We automatically forward funds to your wallet (minus our commission)
5. You receive webhook notifications when payments are complete

### Requirements

- An API key (contact us to get one)
- A webhook endpoint (HTTPS recommended)
- An Ethereum wallet address to receive payments

### Base URL

```
https://api.zpaynow.com
```

Replace with your actual ZeroPay API URL provided during onboarding.

---

## Authentication

All API requests require authentication using your API key as a query parameter.

### API Key Usage

```
GET /sessions/123?apikey=your_api_key_here
POST /sessions?apikey=your_api_key_here
```

**Security Note:** Keep your API key secret. Never expose it in client-side code or public repositories.

---

## API Endpoints

### Create Payment Session

Create a new payment session for a customer.

**Endpoint:** `POST /sessions`

**Authentication:** Required (API key)

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer` | string | Yes | Unique identifier for your customer (e.g., user ID, email) |
| `amount` | integer | Yes | Payment amount in cents (e.g., 1000 = $10.00) |

**Example Request:**

```bash
curl -X POST "https://api.zpaynow.com/sessions?apikey=your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "user_12345",
    "amount": 5000
  }'
```

**Success Response (200 OK):**

```json
{
  "session_id": 42,
  "customer": "user_12345",
  "pay_eth": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": 5000,
  "expired": "2025-10-18T12:00:00",
  "completed": false
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | integer | Unique session identifier |
| `customer` | string | Customer identifier you provided |
| `pay_eth` | string | Ethereum address for payment (unique per customer) |
| `amount` | integer | Payment amount in cents |
| `expired` | string | Session expiration time (ISO 8601 format, 24 hours from creation) |
| `completed` | boolean | Whether payment has been completed |

**Error Responses:**

- `401 Unauthorized` - Invalid or missing API key
  ```json
  {
    "status": "failure",
    "error": "user auth error"
  }
  ```

- `500 Internal Server Error` - Server error
  ```json
  {
    "status": "failure",
    "error": "internal error"
  }
  ```

---

### Get Payment Session

Retrieve details of an existing payment session.

**Endpoint:** `GET /sessions/{session_id}`

**Authentication:** Required (API key)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | integer | Yes | The session ID returned when creating the session |

**Example Request:**

```bash
curl "https://api.zpaynow.com/sessions/42?apikey=your_api_key"
```

**Success Response (200 OK):**

```json
{
  "session_id": 42,
  "customer": "user_12345",
  "pay_eth": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": 5000,
  "expired": "2025-10-18T12:00:00",
  "completed": true
}
```

Response fields are the same as the Create Payment Session endpoint.

**Error Responses:**

- `401 Unauthorized` - Invalid or missing API key
- `404 Not Found` - Session doesn't exist
  ```json
  {
    "status": "failure",
    "error": "not found"
  }
  ```

---

## Webhooks

Webhooks notify your application about payment events in real-time.

### Configuration

Provide your webhook URL when registering for ZeroPay. It should:
- Accept POST requests
- Use HTTPS (recommended for security)
- Return 200 OK status on success
- Process requests quickly (< 5 seconds)

### Webhook Security

All webhook requests include an `X-HMAC` header containing an HMAC-SHA256 signature.

**Verification Process:**

1. Get the `X-HMAC` header value
2. Get the raw request body
3. Compute HMAC-SHA256 of the body using your API key as the secret
4. Compare your computed signature with the header value
5. Only process the webhook if signatures match

**Example Verification (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, apiKey) {
  const expectedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(body)
    .digest('hex');

  return signature === expectedSignature;
}

// Usage in Express
app.post('/webhooks/zeropay',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['x-hmac'];
    const isValid = verifyWebhook(req.body, signature, YOUR_API_KEY);

    if (!isValid) {
      return res.status(401).send('Invalid signature');
    }

    // Process webhook...
    res.status(200).send('OK');
  }
);
```

**Example Verification (Python):**

```python
import hmac
import hashlib

def verify_webhook(body: bytes, signature: str, api_key: str) -> bool:
    expected_signature = hmac.new(
        api_key.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    return signature == expected_signature

# Usage in Flask
@app.route('/webhooks/zeropay', methods=['POST'])
def webhook():
    signature = request.headers.get('X-HMAC')
    if not verify_webhook(request.get_data(), signature, YOUR_API_KEY):
        return 'Invalid signature', 401

    # Process webhook...
    return 'OK', 200
```

### Webhook Events

#### 1. Session Paid

Sent when we detect payment to the session's address.

**Event Type:** `session.paid`

**Payload:**

```json
{
  "event": "session.paid",
  "params": [42, "user_12345", 5000]
}
```

**Params Array:**
- `params[0]` (integer): Session ID
- `params[1]` (string): Customer identifier
- `params[2]` (integer): Amount paid in cents

**What to do:**
- Update your database to mark payment as "pending" or "processing"
- Notify your customer that payment was received
- Wait for `session.settled` event before granting access

---

#### 2. Session Settled

Sent when funds have been transferred to your wallet (minus commission).

**Event Type:** `session.settled`

**Payload:**

```json
{
  "event": "session.settled",
  "params": [42, "user_12345", 4750]
}
```

**Params Array:**
- `params[0]` (integer): Session ID
- `params[1]` (string): Customer identifier
- `params[2]` (integer): Settled amount in cents (after commission)

**What to do:**
- Mark payment as "completed" in your database
- Grant access to your product/service
- Send confirmation to your customer
- Issue receipt or invoice

**Important:** Only grant access after receiving this event, not `session.paid`.

---

#### 3. Unknown Paid

Sent when payment is received for a customer but not linked to any active session.

**Event Type:** `unknow.paid`

**Payload:**

```json
{
  "event": "unknow.paid",
  "params": ["user_12345", 5000]
}
```

**Params Array:**
- `params[0]` (string): Customer identifier
- `params[1]` (integer): Amount paid in cents

**Common Causes:**
- Payment sent after session expired
- Customer sent additional funds
- Payment to a customer address without an active session

**What to do:**
- Log the event
- Contact customer to clarify intent
- Optionally credit customer account or issue refund

---

#### 4. Unknown Settled

Sent when an unknown payment has been settled to your wallet.

**Event Type:** `unknow.settled`

**Payload:**

```json
{
  "event": "unknow.settled",
  "params": ["user_12345", 4750]
}
```

**Params Array:**
- `params[0]` (string): Customer identifier
- `params[1]` (integer): Settled amount in cents (after commission)

**What to do:**
- Record the settled funds
- Apply credit to customer account if applicable

---

### Webhook Retry Policy

If your webhook endpoint fails (doesn't return 200 OK), ZeroPay will retry:
- Multiple retry attempts with exponential backoff
- Retries continue for up to 24 hours
- Check your webhook logs if you miss events

**Best Practice:** Implement idempotency to handle duplicate webhook deliveries gracefully.

---

## Payment Flow

### End-to-End Process

```
┌─────────────┐
│  1. Create  │  You create a payment session
│   Session   │  GET session_id and pay_eth address
└─────┬───────┘
      │
      v
┌─────────────┐
│  2. Display │  Show payment address to customer
│   Payment   │  Customer sends USDT/USDC
│   Address   │
└─────┬───────┘
      │
      v
┌─────────────┐
│  3. Payment │  ZeroPay detects payment on blockchain
│   Detected  │  → Webhook: session.paid
└─────┬───────┘
      │
      v
┌─────────────┐
│4. Settlement│  ZeroPay forwards funds to your wallet
│  Processed  │  (minus commission)
│             │  → Webhook: session.settled
└─────┬───────┘
      │
      v
┌─────────────┐
│  5. Grant   │  You grant access to product/service
│   Access    │  Customer receives confirmation
└─────────────┘
```

### Detailed Steps

**Step 1: Create Session**

Your backend calls `POST /sessions` when customer initiates checkout.

```javascript
const session = await fetch(`${API_URL}/sessions?apikey=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer: 'user_12345',
    amount: 5000 // $50.00
  })
}).then(r => r.json());

// Store session in your database
database.savePayment({
  userId: 'user_12345',
  sessionId: session.session_id,
  amount: session.amount,
  status: 'pending'
});
```

**Step 2: Display to Customer**

Show payment details to customer:
- Payment address (QR code recommended)
- Amount to send
- Accepted tokens (USDT, USDC)
- Expiration time

**Step 3: Customer Sends Payment**

Customer uses their wallet (MetaMask, Trust Wallet, etc.) to send USDT or USDC to the provided address.

**Step 4: Payment Detection**

ZeroPay monitors the blockchain and detects the payment within seconds (depending on network congestion).

You receive `session.paid` webhook:

```javascript
// Webhook handler
if (event.event === 'session.paid') {
  const [sessionId, customer, amount] = event.params;

  database.updatePayment(sessionId, {
    status: 'processing',
    paidAt: new Date()
  });

  notifyCustomer(customer, 'Payment received! Processing...');
}
```

**Step 5: Automatic Settlement**

ZeroPay automatically:
1. Calculates commission
2. Transfers net amount to your wallet
3. Sends `session.settled` webhook

```javascript
if (event.event === 'session.settled') {
  const [sessionId, customer, settledAmount] = event.params;

  database.updatePayment(sessionId, {
    status: 'completed',
    settledAmount: settledAmount,
    completedAt: new Date()
  });

  // GRANT ACCESS HERE
  grantServiceAccess(customer);

  notifyCustomer(customer, 'Payment complete! Access granted.');
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Request processed successfully |
| 401 | Unauthorized | Check your API key |
| 404 | Not Found | Session doesn't exist, verify session ID |
| 500 | Server Error | Retry request with exponential backoff |

### Error Response Format

```json
{
  "status": "failure",
  "error": "error description"
}
```

### Common Errors

**1. Invalid API Key**

```json
{
  "status": "failure",
  "error": "user auth error"
}
```

**Solution:** Verify your API key is correct and included in the query parameter.

---

**2. Session Not Found**

```json
{
  "status": "failure",
  "error": "not found"
}
```

**Solution:** Check that the session ID exists and hasn't been deleted.

---

**3. Internal Server Error**

```json
{
  "status": "failure",
  "error": "internal error"
}
```

**Solution:** Retry the request with exponential backoff. Contact support if error persists.

---

### Retry Logic

Implement exponential backoff for transient errors:

```javascript
async function createSessionWithRetry(customer, amount, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createSession(customer, amount);
    } catch (error) {
      // Don't retry auth errors
      if (error.message.includes('auth error')) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts`);
      }

      // Wait before retry: 1s, 2s, 4s
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Best Practices

### Security

1. **Protect Your API Key**
   - Store in environment variables
   - Never commit to version control
   - Rotate periodically
   - Use different keys for development/production

2. **Verify Webhook Signatures**
   - Always validate HMAC signature
   - Use constant-time comparison
   - Reject invalid signatures immediately

3. **Use HTTPS**
   - Webhook endpoint must use HTTPS
   - Protects against man-in-the-middle attacks

4. **Implement Rate Limiting**
   - Protect webhook endpoint from abuse
   - Rate limit session creation per user

### Reliability

1. **Handle Idempotency**
   - Webhooks may be delivered multiple times
   - Use session_id to detect duplicates
   - Return 200 OK even if already processed

   ```javascript
   async function handleWebhook(event) {
     const sessionId = event.params[0];

     // Check if already processed
     const existing = await database.findWebhookEvent(sessionId, event.event);
     if (existing) {
       console.log('Already processed, skipping');
       return; // Still return 200 OK
     }

     // Process webhook
     await processPayment(event);

     // Record as processed
     await database.saveWebhookEvent(sessionId, event.event);
   }
   ```

2. **Monitor Webhook Health**
   - Log all webhook events
   - Alert on repeated failures
   - Track processing time

3. **Database Transactions**
   - Use transactions when updating payment status
   - Prevents inconsistent state

### User Experience

1. **Real-Time Updates**
   - Poll session status for UI updates
   - Show loading states during processing
   - Display clear error messages

2. **Payment Instructions**
   - Show QR code for easy scanning
   - List accepted tokens (USDT, USDC)
   - Display exact amount to send
   - Show expiration countdown

3. **Handle Timeouts**
   - Sessions expire after 24 hours
   - Allow creating new session if expired
   - Notify user before expiration

### Testing

1. **Test Webhook Signature Verification**
   ```javascript
   // Test with known signature
   const testBody = '{"event":"session.paid","params":[1,"test",1000]}';
   const testSignature = crypto
     .createHmac('sha256', API_KEY)
     .update(testBody)
     .digest('hex');

   assert(verifyWebhook(testBody, testSignature, API_KEY) === true);
   ```

2. **Test Error Handling**
   - Invalid API key
   - Non-existent session ID
   - Malformed request body
   - Invalid webhook signature

3. **Integration Testing**
   - Create session
   - Verify session retrieval
   - Test webhook endpoint with sample payloads

### Performance

1. **Database Indexing**
   ```sql
   CREATE INDEX idx_session_id ON payments(session_id);
   CREATE INDEX idx_customer ON payments(customer);
   CREATE INDEX idx_status ON payments(status);
   ```

2. **Caching**
   - Cache session data for quick retrieval
   - Reduce database queries

3. **Async Processing**
   - Process webhooks asynchronously
   - Return 200 OK immediately
   - Handle business logic in background job

---

## FAQ

### General Questions

**Q: What cryptocurrencies does ZeroPay support?**

A: Currently USDT and USDC on supported EVM networks. Contact us for specific network details.

---

**Q: What are the transaction fees?**

A: Commission is configurable per merchant. Check your contract or contact support for your specific rates. Typical range is 0.5% - 5% with minimum and maximum caps.

---

**Q: How long do sessions last?**

A: Sessions expire 24 hours after creation. You can create a new session if needed.

---

**Q: Can I reuse payment addresses?**

A: Each customer gets a unique address that persists across sessions. The same customer will always use the same address.

---

### Technical Questions

**Q: What happens if a customer sends the wrong amount?**

A: If the amount is less than expected, it won't match the session but will trigger `unknow.paid` webhook. You can handle this manually or set up partial payment logic.

---

**Q: What if payment arrives after session expires?**

A: The payment is still processed and forwarded to your wallet. You'll receive `unknow.paid` and `unknow.settled` webhooks with the customer identifier.

---

**Q: How fast are payments processed?**

A: Payments are detected within minutes of blockchain confirmation. Settlement typically happens within 15-30 minutes depending on network congestion.

---

**Q: Can I issue refunds?**

A: Refunds must be handled manually from your wallet to the customer's address. Contact support for assistance.

---

**Q: Do you support testnet?**

A: Yes, testnet environments are available for development. Contact support for testnet API credentials.

---

**Q: What if my webhook endpoint is down?**

A: ZeroPay retries webhooks for up to 24 hours. You can also poll the session status endpoint to check payment status.

---

**Q: Can I get transaction details?**

A: Transaction hashes and on-chain details are available through support. Enhanced API endpoints for transaction history are coming soon.

---

**Q: How do I handle multiple currencies?**

A: Amounts are always in cents (USD equivalent). Handle currency conversion on your end before creating sessions.

---

### Troubleshooting

**Q: Webhook signatures don't match**

A: Ensure you're:
- Using raw request body (not parsed JSON)
- Using your API key as the secret
- Computing HMAC-SHA256
- Comparing hex digest

---

**Q: Session creation fails with 401**

A: Check that:
- API key is correct
- API key is in query parameter: `?apikey=your_key`
- No typos in the URL

---

**Q: Not receiving webhooks**

A: Verify:
- Webhook URL is accessible from internet
- HTTPS is configured properly
- Endpoint returns 200 OK
- No firewall blocking requests
- Check ZeroPay dashboard for webhook delivery logs

---

## Changelog

### v1.0.0 (Current)
- Initial API release
- Session creation and retrieval
- Webhook notifications
- USDT/USDC support on Ethereum

---

**Happy building with ZeroPay!**
