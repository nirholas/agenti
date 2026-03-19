# ZeroPay AI Integration Guide

This document provides complete implementation details for AI code generation tools to integrate with the ZeroPay payment service.

## Quick Overview

ZeroPay is a cryptocurrency payment gateway that:
1. Creates payment sessions with unique deposit addresses
2. Monitors blockchain for incoming payments
3. Automatically settles payments to merchant wallets
4. Sends webhook notifications for payment events

---

## 1. API Base Configuration

```javascript
const ZEROPAY_CONFIG = {
  apiUrl: "https://api.zpaynow.com",           // Replace with actual API URL
  apiKey: "your-api-key-here",                 // Provided by ZeroPay
  webhookSecret: "your-api-key-here",          // Same as apiKey for HMAC verification
};
```

---

## 2. Create Payment Session

### Request
```http
POST /sessions?apikey={API_KEY}
Content-Type: application/json

{
  "customer": "user123",    // Unique customer identifier
  "amount": 1000           // Amount in cents (1000 = $10.00)
}
```

### Response
```json
{
  "session_id": 42,
  "customer": "user123",
  "pay_eth": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": 1000,
  "expired": "2025-10-18T12:00:00",
  "completed": false
}
```

### Implementation Examples

#### JavaScript/TypeScript (fetch)
```javascript
async function createPaymentSession(customer, amountInCents) {
  const response = await fetch(
    `${ZEROPAY_CONFIG.apiUrl}/sessions?apikey=${ZEROPAY_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customer,
        amount: amountInCents
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create session');
  }

  return await response.json();
}

// Usage
const session = await createPaymentSession("user123", 1000);
console.log(`Payment address: ${session.pay_eth}`);
```

#### Python (requests)
```python
import requests

def create_payment_session(customer: str, amount_in_cents: int) -> dict:
    url = f"{ZEROPAY_CONFIG['apiUrl']}/sessions"
    params = {"apikey": ZEROPAY_CONFIG['apiKey']}
    payload = {
        "customer": customer,
        "amount": amount_in_cents
    }

    response = requests.post(url, json=payload, params=params)
    response.raise_for_status()
    return response.json()

# Usage
session = create_payment_session("user123", 1000)
print(f"Payment address: {session['pay_eth']}")
```

#### Go
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type SessionRequest struct {
    Customer string `json:"customer"`
    Amount   int    `json:"amount"`
}

type SessionResponse struct {
    SessionID int    `json:"session_id"`
    Customer  string `json:"customer"`
    PayEth    string `json:"pay_eth"`
    Amount    int    `json:"amount"`
    Expired   string `json:"expired"`
    Completed bool   `json:"completed"`
}

func createPaymentSession(customer string, amount int) (*SessionResponse, error) {
    reqBody, _ := json.Marshal(SessionRequest{
        Customer: customer,
        Amount:   amount,
    })

    url := fmt.Sprintf("%s/sessions?apikey=%s", config.ApiUrl, config.ApiKey)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(reqBody))
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var session SessionResponse
    if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
        return nil, err
    }

    return &session, nil
}
```

#### Rust (reqwest)
```rust
use reqwest;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct SessionRequest {
    customer: String,
    amount: i32,
}

#[derive(Deserialize)]
struct SessionResponse {
    session_id: i32,
    customer: String,
    pay_eth: String,
    amount: i32,
    expired: String,
    completed: bool,
}

async fn create_payment_session(
    customer: &str,
    amount: i32
) -> Result<SessionResponse, reqwest::Error> {
    let client = reqwest::Client::new();
    let url = format!("{}/sessions?apikey={}", CONFIG.api_url, CONFIG.api_key);

    let response = client
        .post(&url)
        .json(&SessionRequest {
            customer: customer.to_string(),
            amount,
        })
        .send()
        .await?;

    response.json::<SessionResponse>().await
}
```

---

## 3. Get Payment Session Status

### Request
```http
GET /sessions/{session_id}?apikey={API_KEY}
```

### Response
```json
{
  "session_id": 42,
  "customer": "user123",
  "pay_eth": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": 1000,
  "expired": "2025-10-18T12:00:00",
  "completed": true
}
```

### Implementation Examples

#### JavaScript/TypeScript
```javascript
async function getPaymentSession(sessionId) {
  const response = await fetch(
    `${ZEROPAY_CONFIG.apiUrl}/sessions/${sessionId}?apikey=${ZEROPAY_CONFIG.apiKey}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get session');
  }

  return await response.json();
}

// Usage
const session = await getPaymentSession(42);
console.log(`Payment completed: ${session.completed}`);
```

#### Python
```python
def get_payment_session(session_id: int) -> dict:
    url = f"{ZEROPAY_CONFIG['apiUrl']}/sessions/{session_id}"
    params = {"apikey": ZEROPAY_CONFIG['apiKey']}

    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()

# Usage
session = get_payment_session(42)
print(f"Payment completed: {session['completed']}")
```

---

## 4. Webhook Integration

### Webhook Event Types

ZeroPay sends webhook notifications for these events:

#### 1. `session.paid` - Payment Detected
```json
{
  "event": "session.paid",
  "params": [42, "user123", 1000]
}
```
- `params[0]`: session_id (integer)
- `params[1]`: customer (string)
- `params[2]`: amount in cents (integer)

#### 2. `session.settled` - Funds Transferred to Merchant
```json
{
  "event": "session.settled",
  "params": [42, "user123", 950]
}
```
- `params[0]`: session_id (integer)
- `params[1]`: customer (string)
- `params[2]`: settled_amount after commission (integer)

#### 3. `unknow.paid` - Unlinked Payment Detected
```json
{
  "event": "unknow.paid",
  "params": ["user123", 1000]
}
```
- `params[0]`: customer (string)
- `params[1]`: amount in cents (integer)

#### 4. `unknow.settled` - Unlinked Payment Settled
```json
{
  "event": "unknow.settled",
  "params": ["user123", 950]
}
```
- `params[0]`: customer (string)
- `params[1]`: settled_amount after commission (integer)

### Webhook Security (HMAC Verification)

**CRITICAL:** Always verify webhook signatures to prevent fraud.

ZeroPay signs all webhooks with HMAC-SHA256:
- Header: `X-HMAC`
- Secret: Your API key
- Message: Raw request body

#### JavaScript/TypeScript (Express)
```javascript
const express = require('express');
const crypto = require('crypto');

app.post('/webhooks/zeropay', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hmac'];
  const body = req.body;

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', ZEROPAY_CONFIG.webhookSecret)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Unauthorized');
  }

  // Parse webhook event
  const event = JSON.parse(body.toString());

  switch (event.event) {
    case 'session.paid':
      const [sessionId, customer, amount] = event.params;
      console.log(`Payment detected: Session ${sessionId}, Amount $${amount/100}`);
      // Update your database: mark payment as pending
      break;

    case 'session.settled':
      const [sessionId, customer, settledAmount] = event.params;
      console.log(`Payment settled: Session ${sessionId}, Net $${settledAmount/100}`);
      // Update your database: mark payment as complete
      // Grant access to product/service
      break;

    case 'unknow.paid':
      const [customer, amount] = event.params;
      console.log(`Unlinked payment: Customer ${customer}, Amount $${amount/100}`);
      break;

    case 'unknow.settled':
      const [customer, settledAmount] = event.params;
      console.log(`Unlinked settlement: Customer ${customer}, Net $${settledAmount/100}`);
      break;
  }

  res.status(200).send('OK');
});
```

#### Python (Flask)
```python
from flask import Flask, request
import hmac
import hashlib
import json

app = Flask(__name__)

@app.route('/webhooks/zeropay', methods=['POST'])
def zeropay_webhook():
    signature = request.headers.get('X-HMAC')
    body = request.get_data()

    # Verify signature
    expected_signature = hmac.new(
        ZEROPAY_CONFIG['webhookSecret'].encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if signature != expected_signature:
        print('Invalid webhook signature')
        return 'Unauthorized', 401

    # Parse webhook event
    event = json.loads(body)

    if event['event'] == 'session.paid':
        session_id, customer, amount = event['params']
        print(f"Payment detected: Session {session_id}, Amount ${amount/100}")
        # Update your database: mark payment as pending

    elif event['event'] == 'session.settled':
        session_id, customer, settled_amount = event['params']
        print(f"Payment settled: Session {session_id}, Net ${settled_amount/100}")
        # Update your database: mark payment as complete
        # Grant access to product/service

    elif event['event'] == 'unknow.paid':
        customer, amount = event['params']
        print(f"Unlinked payment: Customer {customer}, Amount ${amount/100}")

    elif event['event'] == 'unknow.settled':
        customer, settled_amount = event['params']
        print(f"Unlinked settlement: Customer {customer}, Net ${settled_amount/100}")

    return 'OK', 200
```

#### Go (net/http)
```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "io"
    "net/http"
)

type WebhookEvent struct {
    Event  string        `json:"event"`
    Params []interface{} `json:"params"`
}

func zeropayWebhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-HMAC")
    body, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Bad request", http.StatusBadRequest)
        return
    }

    // Verify signature
    mac := hmac.New(sha256.New, []byte(config.WebhookSecret))
    mac.Write(body)
    expectedSignature := hex.EncodeToString(mac.Sum(nil))

    if signature != expectedSignature {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // Parse event
    var event WebhookEvent
    if err := json.Unmarshal(body, &event); err != nil {
        http.Error(w, "Bad request", http.StatusBadRequest)
        return
    }

    switch event.Event {
    case "session.paid":
        sessionID := int(event.Params[0].(float64))
        customer := event.Params[1].(string)
        amount := int(event.Params[2].(float64))
        // Handle payment detected

    case "session.settled":
        sessionID := int(event.Params[0].(float64))
        customer := event.Params[1].(string)
        settledAmount := int(event.Params[2].(float64))
        // Handle payment settled
    }

    w.WriteHeader(http.StatusOK)
}
```

#### Rust (actix-web)
```rust
use actix_web::{post, web, HttpRequest, HttpResponse};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct WebhookEvent {
    event: String,
    params: serde_json::Value,
}

#[post("/webhooks/zeropay")]
async fn zeropay_webhook(
    req: HttpRequest,
    body: web::Bytes,
) -> HttpResponse {
    let signature = match req.headers().get("X-HMAC") {
        Some(sig) => sig.to_str().unwrap_or(""),
        None => return HttpResponse::Unauthorized().finish(),
    };

    // Verify signature
    let mut mac = Hmac::<Sha256>::new_from_slice(CONFIG.webhook_secret.as_bytes())
        .expect("HMAC error");
    mac.update(&body);
    let expected_signature = hex::encode(mac.finalize().into_bytes());

    if signature != expected_signature {
        return HttpResponse::Unauthorized().finish();
    }

    // Parse event
    let event: WebhookEvent = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(_) => return HttpResponse::BadRequest().finish(),
    };

    match event.event.as_str() {
        "session.paid" => {
            // Handle payment detected
        }
        "session.settled" => {
            // Handle payment settled
        }
        _ => {}
    }

    HttpResponse::Ok().finish()
}
```

---

## 5. Complete Integration Flow

### Step-by-Step Implementation

```javascript
// 1. User initiates checkout
async function checkout(userId, productPrice) {
  // Create payment session
  const session = await createPaymentSession(userId, productPrice * 100);

  // Store session in your database
  await db.savePaymentSession({
    userId: userId,
    sessionId: session.session_id,
    amount: session.amount,
    paymentAddress: session.pay_eth,
    status: 'pending',
    expiresAt: session.expired
  });

  // Return payment details to frontend
  return {
    sessionId: session.session_id,
    paymentAddress: session.pay_eth,
    amount: session.amount,
    expiresAt: session.expired
  };
}

// 2. Display payment information to user
// Frontend shows:
// - Payment address (QR code)
// - Amount to send
// - Supported tokens (USDT, USDC)
// - Expiration time

// 3. Webhook handler processes payment
app.post('/webhooks/zeropay', express.raw({ type: 'application/json' }),
  async (req, res) => {
    // Verify signature (see examples above)
    if (!verifySignature(req)) {
      return res.status(401).send('Unauthorized');
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === 'session.paid') {
      const [sessionId, customer, amount] = event.params;

      // Update payment status
      await db.updatePaymentSession(sessionId, {
        status: 'paid',
        paidAt: new Date()
      });

      // Notify user (email, push notification, etc.)
      await notifyUser(customer, 'Payment received and being processed');
    }

    if (event.event === 'session.settled') {
      const [sessionId, customer, settledAmount] = event.params;

      // Update payment status
      await db.updatePaymentSession(sessionId, {
        status: 'completed',
        settledAmount: settledAmount,
        completedAt: new Date()
      });

      // Grant access to product/service
      await grantAccess(customer);

      // Notify user
      await notifyUser(customer, 'Payment completed successfully');
    }

    res.status(200).send('OK');
});

// 4. Polling for session status (optional, for real-time UI updates)
async function pollSessionStatus(sessionId) {
  const interval = setInterval(async () => {
    const session = await getPaymentSession(sessionId);

    if (session.completed) {
      clearInterval(interval);
      // Update UI: Payment complete
    }
  }, 5000); // Poll every 5 seconds

  // Stop polling after expiration
  setTimeout(() => clearInterval(interval), 24 * 60 * 60 * 1000);
}
```

---

## 6. Error Handling

### Error Response Format
```json
{
  "status": "failure",
  "error": "error_message"
}
```

### Common Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `"user auth error"` | Invalid or missing API key | Check API key in query parameter |
| `"not found"` | Session ID doesn't exist | Verify session was created |
| `"internal error"` | Database error | Retry request |
| `"internal server error"` | Server I/O error | Retry request |

### Error Handling Example
```javascript
async function createPaymentSessionWithRetry(customer, amount, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await createPaymentSession(customer, amount);
    } catch (error) {
      if (error.message === 'user auth error') {
        throw new Error('Invalid API key - check configuration');
      }

      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}
```

---

## 7. Testing Checklist

### Integration Testing Steps

1. **Create Session Test**
   ```javascript
   const session = await createPaymentSession("test_user", 1000);
   assert(session.session_id > 0);
   assert(session.pay_eth.startsWith("0x"));
   ```

2. **Get Session Test**
   ```javascript
   const retrieved = await getPaymentSession(session.session_id);
   assert(retrieved.session_id === session.session_id);
   ```

3. **Webhook Signature Test**
   ```javascript
   const body = JSON.stringify({ event: "session.paid", params: [1, "test", 1000] });
   const signature = crypto
     .createHmac('sha256', ZEROPAY_CONFIG.apiKey)
     .update(body)
     .digest('hex');

   const response = await fetch('/webhooks/zeropay', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-HMAC': signature
     },
     body: body
   });

   assert(response.status === 200);
   ```

4. **Invalid Signature Test**
   ```javascript
   const response = await fetch('/webhooks/zeropay', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-HMAC': 'invalid_signature'
     },
     body: JSON.stringify({ event: "session.paid", params: [1, "test", 1000] })
   });

   assert(response.status === 401);
   ```

5. **Test Payment Flow** (on testnet)
   - Create session
   - Send tokens to payment address
   - Wait for `session.paid` webhook
   - Wait for `session.settled` webhook
   - Verify settled amount (original - commission)

---

## 8. Production Considerations

### Security Best Practices
1. **Store API keys securely** - Use environment variables, never commit to git
2. **Verify webhook signatures** - Always validate HMAC before processing
3. **Use HTTPS** - Ensure webhook endpoint uses SSL/TLS
4. **Implement idempotency** - Handle duplicate webhook deliveries gracefully
5. **Rate limiting** - Implement rate limits on your webhook endpoint

### Database Schema Example
```sql
CREATE TABLE payment_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  session_id INTEGER NOT NULL UNIQUE,
  payment_address VARCHAR NOT NULL,
  amount INTEGER NOT NULL,
  settled_amount INTEGER,
  status VARCHAR NOT NULL, -- 'pending', 'paid', 'completed', 'expired'
  paid_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_id ON payment_sessions(session_id);
CREATE INDEX idx_user_id ON payment_sessions(user_id);
CREATE INDEX idx_status ON payment_sessions(status);
```

### Monitoring & Logging
```javascript
// Log all payment events
function logPaymentEvent(event, data) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: event,
    data: data,
    service: 'zeropay'
  }));
}

// Usage
logPaymentEvent('session.created', { sessionId: 42, customer: 'user123' });
logPaymentEvent('webhook.received', { event: 'session.paid', sessionId: 42 });
```

### Webhook Retry Logic
ZeroPay will retry failed webhooks:
- Implement idempotency using session_id
- Return 200 OK even if already processed
- Use database transactions to prevent duplicate processing

```javascript
async function handleWebhook(event) {
  const { sessionId } = extractSessionId(event);

  // Start transaction
  await db.transaction(async (trx) => {
    // Check if already processed
    const existing = await trx('webhook_events')
      .where({ session_id: sessionId, event: event.event })
      .first();

    if (existing) {
      console.log('Webhook already processed, skipping');
      return; // Idempotent handling
    }

    // Process webhook
    await processPayment(event, trx);

    // Mark as processed
    await trx('webhook_events').insert({
      session_id: sessionId,
      event: event.event,
      processed_at: new Date()
    });
  });
}
```

---

## 9. Frontend Integration Example

### React Payment Component
```jsx
import { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';

function PaymentPage({ amount, onComplete }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('creating');

  useEffect(() => {
    // Create payment session
    fetch('/api/create-payment', {
      method: 'POST',
      body: JSON.stringify({ amount })
    })
      .then(res => res.json())
      .then(data => {
        setSession(data);
        setStatus('pending');
        pollStatus(data.sessionId);
      });
  }, [amount]);

  const pollStatus = (sessionId) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/payment-status/${sessionId}`);
      const data = await response.json();

      if (data.status === 'completed') {
        clearInterval(interval);
        setStatus('completed');
        onComplete();
      }
    }, 5000);

    // Stop polling after 24 hours
    setTimeout(() => clearInterval(interval), 24 * 60 * 60 * 1000);
  };

  if (status === 'creating') {
    return <div>Creating payment session...</div>;
  }

  if (status === 'completed') {
    return <div>Payment completed! Thank you.</div>;
  }

  return (
    <div>
      <h2>Send Payment</h2>
      <p>Amount: ${session.amount / 100}</p>
      <p>Send USDT or USDC to:</p>

      <QRCode value={session.paymentAddress} />

      <p>{session.paymentAddress}</p>

      <p>Expires: {new Date(session.expiresAt).toLocaleString()}</p>

      <div>
        {status === 'pending' && <p>Waiting for payment...</p>}
        {status === 'paid' && <p>Payment received, processing...</p>}
      </div>
    </div>
  );
}
```

---

## 10. Supported Networks & Tokens

### Configuration
Tokens and networks are configured server-side in `config.toml`:
```toml
[[chains]]
chain_type = "evm"
chain_name = "ethereum"
tokens = [
  "USDT:0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "USDC:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
]
```

Contact ZeroPay support for network/token configuration.

---

## Summary

This guide provides everything needed to integrate ZeroPay:

1. **Create sessions** with POST /sessions
2. **Monitor status** with GET /sessions/{id}
3. **Receive webhooks** for payment events
4. **Verify signatures** with HMAC-SHA256
5. **Handle all event types** (paid, settled, unknown)

Key points:
- Always verify webhook signatures
- Handle idempotency for webhook retries
- Store sessions in your database
- Grant access on `session.settled` event
- Sessions expire after 24 hours

For support: contact ZeroPay team with your API key.
