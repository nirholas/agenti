# x402 MCP Tools Reference

> Complete reference for all 14 x402 payment tools available in Universal Crypto MCP.

---

## Overview

x402 provides these categories of tools:

| Category | Tools |
|----------|-------|
| **Payments** | `x402_pay_request`, `x402_send`, `x402_batch_send`, `x402_gasless_send` |
| **Balance** | `x402_balance`, `x402_address` |
| **Information** | `x402_estimate`, `x402_networks`, `x402_config`, `x402_tx_status` |
| **Yield** | `x402_yield`, `x402_apy`, `x402_yield_estimate` |
| **Approvals** | `x402_approve` |

---

## Payment Tools

### x402_pay_request

Make an HTTP request that automatically handles x402 payment requirements.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✓ | - | The URL to request |
| `method` | enum | - | `"GET"` | HTTP method: GET, POST, PUT, DELETE |
| `body` | string | - | - | Request body (for POST/PUT) |
| `headers` | object | - | - | Additional headers |
| `maxPayment` | string | - | `"1.00"` | Maximum payment in USD |

**Example:**

```json
{
  "tool": "x402_pay_request",
  "arguments": {
    "url": "https://api.weather.io/premium/forecast",
    "method": "GET",
    "maxPayment": "0.10"
  }
}
```

**Response:**

```json
{
  "success": true,
  "status": 200,
  "data": {
    "temperature": 72,
    "conditions": "sunny",
    "forecast": [...]
  },
  "paymentMade": "0xabc123..."
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Payment of $0.50 exceeds maximum allowed ($0.10)"
}
```

---

### x402_send

Send a direct cryptocurrency payment to an address.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `to` | string | ✓ | - | Recipient address (0x...) |
| `amount` | string | ✓ | - | Amount to send (e.g., "10.00") |
| `token` | enum | - | `"USDs"` | Token: USDs, USDC, native |
| `memo` | string | - | - | Optional memo/note |

**Example:**

```json
{
  "tool": "x402_send",
  "arguments": {
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f4E1B3",
    "amount": "5.00",
    "token": "USDs",
    "memo": "Payment for API access"
  }
}
```

**Response:**

```json
{
  "success": true,
  "transaction": {
    "hash": "0xdef456...",
    "from": "0x123...",
    "to": "0x742...",
    "amount": "5.00",
    "token": "USDs",
    "chain": "arbitrum",
    "explorerUrl": "https://arbiscan.io/tx/0xdef456..."
  },
  "memo": "Payment for API access"
}
```

---

### x402_batch_send

Send multiple payments in a single transaction (gas efficient).

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `payments` | array | ✓ | - | Array of {to, amount} (max 20) |
| `token` | enum | - | `"USDs"` | Token to send |

**Example:**

```json
{
  "tool": "x402_batch_send",
  "arguments": {
    "payments": [
      { "to": "0xAAA...", "amount": "1.00" },
      { "to": "0xBBB...", "amount": "2.50" },
      { "to": "0xCCC...", "amount": "0.50" }
    ],
    "token": "USDs"
  }
}
```

**Response:**

```json
{
  "success": true,
  "totalAmount": "4.00",
  "totalRecipients": 3,
  "successful": 3,
  "failed": 0,
  "transactions": ["0xabc...", "0xdef...", "0x123..."]
}
```

---

### x402_gasless_send

Send a gasless payment using EIP-3009. Recipient or facilitator pays gas.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `to` | string | ✓ | - | Recipient address |
| `amount` | string | ✓ | - | Amount to send |
| `token` | enum | - | `"USDs"` | Token (must support EIP-3009) |
| `validityPeriod` | number | - | `300` | Auth valid for (seconds) |

**Example:**

```json
{
  "tool": "x402_gasless_send",
  "arguments": {
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f4E1B3",
    "amount": "10.00",
    "token": "USDs"
  }
}
```

**Response:**

```json
{
  "success": true,
  "transaction": {
    "hash": "0xghi789...",
    "from": "0x123...",
    "to": "0x742...",
    "amount": "10.00",
    "token": "USDs"
  },
  "gasless": true,
  "gasPaidBy": "facilitator",
  "authorization": {
    "nonce": "12345",
    "validBefore": "1706500000"
  }
}
```

---

## Balance Tools

### x402_balance

Check your wallet balance.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `chain` | enum | - | configured | Chain to check |

**Example:**

```json
{
  "tool": "x402_balance",
  "arguments": {
    "chain": "arbitrum"
  }
}
```

**Response:**

```json
{
  "address": "0x1234567890abcdef...",
  "chain": "arbitrum",
  "chainInfo": {
    "name": "Arbitrum One",
    "caip2": "eip155:42161",
    "nativeCurrency": "ETH"
  },
  "balances": {
    "usds": "45.23",
    "native": "0.00156"
  },
  "yieldInfo": {
    "pending": "0.05",
    "apy": "5.2%"
  }
}
```

---

### x402_address

Get your wallet address.

**Parameters:** None

**Example:**

```json
{
  "tool": "x402_address",
  "arguments": {}
}
```

**Response:**

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "chain": "arbitrum",
  "chainInfo": {
    "name": "Arbitrum One",
    "caip2": "eip155:42161"
  },
  "fundingInstructions": "Send USDs or ETH to this address to fund your AI agent wallet."
}
```

---

## Information Tools

### x402_estimate

Check the payment required for a URL without paying.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✓ | - | The URL to check |

**Example:**

```json
{
  "tool": "x402_estimate",
  "arguments": {
    "url": "https://api.example.com/premium-data"
  }
}
```

**Response (payment required):**

```json
{
  "requiresPayment": true,
  "price": "0.01",
  "token": "USDC",
  "network": "eip155:8453",
  "recipient": "0xabc...",
  "description": "Premium API access"
}
```

**Response (no payment):**

```json
{
  "requiresPayment": false,
  "status": 200,
  "message": "This URL does not require x402 payment"
}
```

---

### x402_networks

List all supported networks.

**Parameters:** None

**Example:**

```json
{
  "tool": "x402_networks",
  "arguments": {}
}
```

**Response:**

```json
{
  "configuredChain": "arbitrum",
  "supportedNetworks": [
    {
      "id": "arbitrum",
      "name": "Arbitrum One",
      "caip2": "eip155:42161",
      "nativeCurrency": "ETH",
      "isConfigured": true
    },
    {
      "id": "base",
      "name": "Base",
      "caip2": "eip155:8453",
      "nativeCurrency": "ETH",
      "isConfigured": false
    }
  ],
  "paymentToken": "USDs (Sperax USD) - auto-yield stablecoin"
}
```

---

### x402_config

Get current configuration and status.

**Parameters:** None

**Example:**

```json
{
  "tool": "x402_config",
  "arguments": {}
}
```

**Response:**

```json
{
  "configured": true,
  "chain": "arbitrum",
  "chainInfo": {
    "name": "Arbitrum One",
    "caip2": "eip155:42161"
  },
  "maxPaymentPerRequest": "$1.00",
  "gaslessEnabled": true,
  "facilitatorUrl": "default",
  "debug": false,
  "validation": {
    "valid": true,
    "warnings": []
  },
  "environmentVariables": {
    "X402_PRIVATE_KEY": "✓ set",
    "X402_CHAIN": "arbitrum",
    "X402_MAX_PAYMENT": "1.00",
    "X402_ENABLE_GASLESS": "true"
  }
}
```

---

### x402_tx_status

Check the status of a transaction.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `txHash` | string | ✓ | - | Transaction hash (0x...) |

**Example:**

```json
{
  "tool": "x402_tx_status",
  "arguments": {
    "txHash": "0xabc123def456789..."
  }
}
```

**Response:**

```json
{
  "hash": "0xabc123def456789...",
  "explorerUrl": "https://arbiscan.io/tx/0xabc123...",
  "message": "Check the explorer link for transaction status.",
  "chain": "arbitrum"
}
```

---

## Yield Tools

### x402_yield

Get yield information for USDs holdings.

**Parameters:** None

**Example:**

```json
{
  "tool": "x402_yield",
  "arguments": {}
}
```

**Response:**

```json
{
  "balance": "100.00",
  "pendingYield": "0.42",
  "apy": "5.2%",
  "totalEarned": "2.35",
  "lastUpdate": "2026-01-27T10:30:00Z",
  "projectedMonthly": "0.43",
  "note": "USDs automatically rebases - your balance grows without claiming!"
}
```

---

### x402_apy

Get current APY for USDs.

**Parameters:** None

**Example:**

```json
{
  "tool": "x402_apy",
  "arguments": {}
}
```

**Response:**

```json
{
  "token": "USDs",
  "apy": "5.20%",
  "apyDecimal": 0.052,
  "source": "Sperax Protocol",
  "note": "USDs earns yield automatically via rebasing. No staking required.",
  "comparison": {
    "savingsAccount": "~0.5%",
    "usdc": "0%",
    "usds": "5.20%"
  }
}
```

---

### x402_yield_estimate

Estimate yield over a period of time.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `amount` | string | ✓ | - | Amount of USDs |
| `days` | number | - | `30` | Number of days |

**Example:**

```json
{
  "tool": "x402_yield_estimate",
  "arguments": {
    "amount": "1000.00",
    "days": 365
  }
}
```

**Response:**

```json
{
  "principal": "1000.00 USDs",
  "period": "365 days",
  "currentAPY": "5.20%",
  "estimatedYield": "52.00 USDs",
  "finalBalance": "1052.00 USDs",
  "projections": {
    "7 days": "+0.9973 USDs",
    "30 days": "+4.2740 USDs",
    "90 days": "+12.8219 USDs",
    "365 days": "+52.00 USDs"
  },
  "note": "Actual yield may vary based on protocol performance."
}
```

---

## Approval Tools

### x402_approve

Approve a contract to spend your tokens.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `spender` | string | ✓ | - | Contract address to approve |
| `amount` | string | ✓ | - | Amount or "unlimited" |
| `token` | enum | - | `"USDs"` | Token to approve |

**Example:**

```json
{
  "tool": "x402_approve",
  "arguments": {
    "spender": "0xUniswapRouter...",
    "amount": "100.00",
    "token": "USDs"
  }
}
```

**Response:**

```json
{
  "success": true,
  "approval": {
    "hash": "0xjkl012...",
    "spender": "0xUniswapRouter...",
    "token": "USDs",
    "amount": "100.00"
  },
  "warning": null
}
```

**Warning for unlimited:**

```json
{
  "warning": "Unlimited approval granted. Only do this for trusted contracts."
}
```

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message here",
  "hint": "Optional hint for fixing the issue"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `X402_PRIVATE_KEY not configured` | Missing env var | Set X402_PRIVATE_KEY |
| `Amount exceeds maximum allowed` | Payment too large | Increase X402_MAX_PAYMENT |
| `Insufficient funds` | Low balance | Fund wallet with USDC/USDs |
| `Transaction failed` | Gas or network issue | Check gas balance, retry |
| `Gasless payments disabled` | Config issue | Set X402_ENABLE_GASLESS=true |

---

## Best Practices

### 1. Start with Estimates

Before making large payments, check the cost:

```json
{ "tool": "x402_estimate", "arguments": { "url": "..." } }
```

### 2. Set Reasonable Limits

Configure `X402_MAX_PAYMENT` to prevent unexpected large payments:

```bash
export X402_MAX_PAYMENT=0.50  # Max $0.50 per request
```

### 3. Use Batch Payments

For multiple recipients, use `x402_batch_send` to save on gas.

### 4. Monitor Yield

If using USDs, check `x402_yield` periodically to track earnings.

### 5. Keep Gas Funded

Always maintain some native tokens (ETH) for gas fees.

---

## Type Definitions

### Token Types

```typescript
type Token = "USDs" | "USDC" | "USDT" | "DAI" | "native";
```

### Chain Types

```typescript
type Chain = 
  | "arbitrum" 
  | "arbitrum-sepolia" 
  | "base" 
  | "ethereum" 
  | "polygon" 
  | "optimism" 
  | "bsc";
```

### Address Format

```typescript
// EVM addresses: 42 characters starting with 0x
type Address = `0x${string}`;  // e.g., "0x742d35Cc6634C0532925a3b844Bc9e7595f4E1B3"

// Transaction hashes: 66 characters starting with 0x
type TxHash = `0x${string}`;   // e.g., "0xabc123..."
```

---

<p align="center">
  <b>💰 Give Claude Money!</b><br>
  <code>npx @nirholas/universal-crypto-mcp</code>
</p>
