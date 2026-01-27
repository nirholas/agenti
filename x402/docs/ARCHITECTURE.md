# x402 Architecture Guide

> Technical deep dive into the x402 payment protocol.

---

## Protocol Overview

x402 is built on HTTP 402 Payment Required, a standard HTTP status code for payment-required resources. The protocol enables:

- **Stateless payments** - No sessions, accounts, or stored credentials
- **Atomic transactions** - Pay and receive data in a single HTTP flow
- **Chain-agnostic** - Same protocol works across EVM and Solana
- **Trust-minimized** - Cryptographic proofs prevent fraud

---

## Payment Flow

### Sequence Diagram

```
┌────────┐          ┌────────────┐          ┌─────────────┐          ┌────────────┐
│ Client │          │  Resource  │          │ Facilitator │          │ Blockchain │
│  (AI)  │          │   Server   │          │             │          │            │
└───┬────┘          └─────┬──────┘          └──────┬──────┘          └─────┬──────┘
    │                     │                        │                       │
    │  1. GET /resource   │                        │                       │
    │────────────────────▶│                        │                       │
    │                     │                        │                       │
    │  2. 402 + PAYMENT   │                        │                       │
    │      -REQUIRED      │                        │                       │
    │◀────────────────────│                        │                       │
    │                     │                        │                       │
    │  3. Parse payment   │                        │                       │
    │     requirements    │                        │                       │
    │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                        │                       │
    │                     │                        │                       │
    │  4. Sign payment    │                        │                       │
    │     with wallet     │                        │                       │
    │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                        │                       │
    │                     │                        │                       │
    │  5. GET /resource   │                        │                       │
    │  + PAYMENT-SIGNATURE│                        │                       │
    │────────────────────▶│                        │                       │
    │                     │                        │                       │
    │                     │  6. POST /verify       │                       │
    │                     │────────────────────────▶                       │
    │                     │                        │                       │
    │                     │  7. Verification OK    │                       │
    │                     │◀────────────────────────                       │
    │                     │                        │                       │
    │                     │  8. Serve resource     │                       │
    │                     │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                       │
    │                     │                        │                       │
    │                     │  9. POST /settle       │                       │
    │                     │────────────────────────▶                       │
    │                     │                        │                       │
    │                     │                        │  10. Submit TX        │
    │                     │                        │──────────────────────▶│
    │                     │                        │                       │
    │                     │                        │  11. TX confirmed     │
    │                     │                        │◀──────────────────────│
    │                     │                        │                       │
    │                     │  12. Settlement OK     │                       │
    │                     │◀────────────────────────                       │
    │                     │                        │                       │
    │  13. 200 + data     │                        │                       │
    │  + PAYMENT-RESPONSE │                        │                       │
    │◀────────────────────│                        │                       │
    │                     │                        │                       │
```

### Step-by-Step Breakdown

| Step | Actor | Action |
|------|-------|--------|
| 1 | Client | Makes HTTP request to resource |
| 2 | Server | Returns 402 + payment requirements |
| 3 | Client | Parses payment options |
| 4 | Client | Signs payment with private key |
| 5 | Client | Retries request with payment signature |
| 6 | Server | Sends payment to facilitator for verification |
| 7 | Facilitator | Verifies signature validity |
| 8 | Server | Serves the requested resource |
| 9 | Server | Requests payment settlement |
| 10 | Facilitator | Submits transaction to blockchain |
| 11 | Blockchain | Confirms transaction |
| 12 | Facilitator | Returns settlement confirmation |
| 13 | Server | Returns resource + settlement proof |

---

## HTTP Headers

### Request Headers

| Header | Description | Example |
|--------|-------------|---------|
| `PAYMENT-SIGNATURE` | Base64-encoded payment payload | `eyJzY2hlbWUiOi...` |

### Response Headers

| Header | Status | Description |
|--------|--------|-------------|
| `PAYMENT-REQUIRED` | 402 | Base64-encoded payment requirements |
| `PAYMENT-RESPONSE` | 200 | Base64-encoded settlement proof |

---

## Data Structures

### Payment Requirements (402 Response)

```json
{
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "price": "1000",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f4E1B3",
      "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
  ],
  "description": "Weather API access",
  "mimeType": "application/json",
  "resource": "/api/weather"
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `accepts` | array | Accepted payment options |
| `accepts[].scheme` | string | Payment scheme (e.g., "exact") |
| `accepts[].network` | string | CAIP-2 network identifier |
| `accepts[].price` | string | Price in smallest unit |
| `accepts[].payTo` | string | Recipient address |
| `accepts[].token` | string | Token contract address |
| `description` | string | Human-readable description |
| `mimeType` | string | Response content type |
| `resource` | string | Resource path |

### Payment Signature (Request)

```json
{
  "scheme": "exact",
  "network": "eip155:8453",
  "payload": {
    "from": "0x123...",
    "to": "0x742...",
    "amount": "1000",
    "token": "0x833...",
    "nonce": "1706500000000",
    "validBefore": 1706503600
  },
  "signature": "0xabc123..."
}
```

### Settlement Response (200)

```json
{
  "success": true,
  "transactionHash": "0xdef456...",
  "blockNumber": 12345678,
  "settledAt": "2026-01-27T10:30:00Z"
}
```

---

## Payment Schemes

### Exact Scheme

The primary payment scheme. Client pays exact amount specified.

```
┌─────────────────────────────────────────────────────────────┐
│                    Exact Scheme Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Server: "Pay exactly 0.001 USDC to 0xABC..."             │
│                         │                                   │
│                         ▼                                   │
│   Client: Signs authorization for 0.001 USDC                │
│                         │                                   │
│                         ▼                                   │
│   Facilitator: Verifies signature matches requirements      │
│                         │                                   │
│                         ▼                                   │
│   Blockchain: Transfers exactly 0.001 USDC                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Use Cases:**
- Fixed-price API calls
- Content purchases
- Service fees

### Future Schemes

| Scheme | Status | Description |
|--------|--------|-------------|
| `exact` | ✅ Live | Pay exact amount |
| `upto` | 🔜 Planned | Pay up to amount (usage-based) |
| `streaming` | 🔜 Planned | Pay per second/byte |
| `subscription` | 🔜 Planned | Recurring payments |

---

## The Facilitator

The facilitator is a trusted service that verifies and settles payments.

### Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                    Facilitator Role                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐                                          │
│   │   VERIFY     │  Check signature validity                │
│   │              │  • Signer owns funds                     │
│   │              │  • Amount matches requirements           │
│   │              │  • Nonce is unused                       │
│   │              │  • Not expired                           │
│   └──────┬───────┘                                          │
│          │                                                  │
│          ▼                                                  │
│   ┌──────────────┐                                          │
│   │   SETTLE     │  Execute on-chain                        │
│   │              │  • Submit transaction                    │
│   │              │  • Pay gas fees                          │
│   │              │  • Wait for confirmation                 │
│   │              │  • Return proof                          │
│   └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | POST | Verify payment signature |
| `/settle` | POST | Execute payment on-chain |

### Default Facilitator

```
https://x402.org/facilitator
```

> **Note:** The facilitator is trust-minimized. It can only execute payments the client has explicitly signed.

---

## Network Support

### CAIP-2 Identifiers

x402 uses [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md) for chain identification.

**Format:** `<namespace>:<reference>`

| Network | CAIP-2 | Namespace |
|---------|--------|-----------|
| Ethereum | `eip155:1` | EVM |
| Base | `eip155:8453` | EVM |
| Arbitrum | `eip155:42161` | EVM |
| Polygon | `eip155:137` | EVM |
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Solana |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Solana |

### EVM Implementation

Uses EIP-3009 (Transfer With Authorization) for gasless transfers.

```solidity
// EIP-3009 signature
transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    bytes signature
)
```

**Benefits:**
- Gasless for sender
- Atomic (no separate approve step)
- Time-bounded validity

### Solana Implementation

Uses SPL Token program with authorization.

```typescript
// Solana payment structure
{
  programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  accounts: [source, destination, authority],
  data: TransferChecked { amount, decimals }
}
```

---

## Cryptographic Proofs

### Payment Signature

```
┌─────────────────────────────────────────────────────────────┐
│                   Signature Generation                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Payment Data                                              │
│   ┌────────────────────────────────┐                        │
│   │ from: 0x123...                 │                        │
│   │ to: 0x456...                   │                        │
│   │ amount: 1000000                │                        │
│   │ token: 0x789...                │                        │
│   │ nonce: 1706500000000           │                        │
│   │ validBefore: 1706503600        │                        │
│   └────────────────┬───────────────┘                        │
│                    │                                        │
│                    ▼                                        │
│   ┌────────────────────────────────┐                        │
│   │         Hash (EIP-712)         │                        │
│   └────────────────┬───────────────┘                        │
│                    │                                        │
│                    ▼                                        │
│   ┌────────────────────────────────┐                        │
│   │    Sign with Private Key       │                        │
│   │         (secp256k1)            │                        │
│   └────────────────┬───────────────┘                        │
│                    │                                        │
│                    ▼                                        │
│   Signature: 0xabc123...def456                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### EIP-712 Typed Data

```typescript
const typedData = {
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  },
  primaryType: "TransferWithAuthorization",
  domain: {
    name: "USD Coin",
    version: "2",
    chainId: 8453,
    verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  message: {
    from: "0x...",
    to: "0x...",
    value: "1000000",
    validAfter: 0,
    validBefore: 1706503600,
    nonce: "0x..."
  }
};
```

---

## Security Model

### Trust Assumptions

| Component | Trust Level | Capabilities |
|-----------|-------------|--------------|
| Client | Untrusted | Signs payments only |
| Resource Server | Semi-trusted | Cannot steal funds |
| Facilitator | Trusted | Executes signed payments |
| Blockchain | Trustless | Final settlement |

### Security Properties

```
┌─────────────────────────────────────────────────────────────┐
│                   Security Guarantees                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ✓ Non-custodial                                           │
│     Client never gives up private key                       │
│                                                             │
│   ✓ Amount-bounded                                          │
│     Can only spend signed amount                            │
│                                                             │
│   ✓ Time-bounded                                            │
│     Signatures expire                                       │
│                                                             │
│   ✓ Recipient-specific                                      │
│     Can only pay specified address                          │
│                                                             │
│   ✓ Replay-protected                                        │
│     Nonces prevent double-spending                          │
│                                                             │
│   ✓ Verifiable                                              │
│     All proofs on-chain                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## MCP Integration

### How Universal Crypto MCP Uses x402

```
┌─────────────────────────────────────────────────────────────┐
│                 Universal Crypto MCP + x402                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                Claude Desktop                        │   │
│   │                                                      │   │
│   │  User: "Get premium weather data"                    │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         │ MCP Tool Call                     │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           Universal Crypto MCP Server                │   │
│   │                                                      │   │
│   │  x402_pay_request({                                  │   │
│   │    url: "https://weather.io/premium",                │   │
│   │    maxPayment: "0.10"                                │   │
│   │  })                                                  │   │
│   └─────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│                         │ x402 Protocol                     │
│                         ▼                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Paid Weather API                        │   │
│   │                                                      │   │
│   │  { temperature: 72, conditions: "sunny", ... }       │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tool Implementation

```typescript
// Simplified x402 tool implementation
server.tool(
  "x402_pay_request",
  "Make HTTP request with automatic payment",
  {
    url: z.string().url(),
    maxPayment: z.string()
  },
  async ({ url, maxPayment }) => {
    // 1. Make initial request
    const response = await fetch(url);
    
    // 2. Check for 402
    if (response.status === 402) {
      // 3. Parse payment requirements
      const requirements = parsePaymentRequired(
        response.headers.get("PAYMENT-REQUIRED")
      );
      
      // 4. Validate cost
      if (requirements.price > maxPayment) {
        throw new Error("Payment exceeds maximum");
      }
      
      // 5. Sign payment
      const signature = await wallet.signPayment(requirements);
      
      // 6. Retry with payment
      const paidResponse = await fetch(url, {
        headers: {
          "PAYMENT-SIGNATURE": signature
        }
      });
      
      return paidResponse.json();
    }
    
    return response.json();
  }
);
```

---

## Performance

### Latency Breakdown

| Step | Typical Time |
|------|--------------|
| Initial request | 50-100ms |
| Payment signing | 1-5ms |
| Facilitator verify | 50-100ms |
| Resource generation | Varies |
| Settlement (async) | 1-30s |
| **Total (sync)** | **100-300ms** |

### Optimization Strategies

1. **Parallel settlement** - Server returns data before settlement confirms
2. **Caching** - Cache facilitator verification for repeated clients
3. **Batch settlement** - Aggregate multiple payments into one tx
4. **Local verification** - Server verifies signature without facilitator

---

## Further Reading

- [x402 Specification](https://github.com/coinbase/x402/tree/main/specs)
- [CAIP-2 Standard](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
- [EIP-3009 Specification](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712 Typed Data](https://eips.ethereum.org/EIPS/eip-712)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

<p align="center">
  <b>💰 Give Claude Money!</b><br>
  <code>npx @nirholas/universal-crypto-mcp</code>
</p>
