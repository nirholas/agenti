# x402 Protocol Specification v1.0

## Overview

x402 is an HTTP-native payment protocol for machine-to-machine commerce. When a server requires payment for a resource, it returns HTTP 402 (Payment Required) with payment instructions in the response headers and body. The client pays on-chain, then retries the request with proof of payment.

This implementation is compatible with the [Coinbase x402 standard](https://github.com/coinbase/x402), maintaining full backward compatibility while adding extension fields for service verification and agent identification.

## Payment Flow

```
Client                                  Server
  |                                       |
  |-- GET /api/resource ----------------->|
  |                                       |
  |<---- 402 Payment Required ------------|
  |      WWW-Authenticate: x402 ...       |
  |      Body: {chain, token, amount, ..} |
  |                                       |
  | [Parse challenge]                     |
  | [Check budget]                        |
  | [Sign & send USDC on Solana]          |
  |                                       |
  |-- GET /api/resource ----------------->|
  |   Authorization: x402 <tx_hash>       |
  |                                       |
  |<---- 200 OK -------------------------|
  |      (resource data)                  |
```

## Standard Fields (Coinbase x402 Compatible)

### 402 Response — WWW-Authenticate Header

```
WWW-Authenticate: x402 chain="solana" token="USDC" amount="0.05" address="<recipient>"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chain` | string | Yes | Blockchain identifier: `solana`, `base`, `ethereum` |
| `token` | string | Yes | Payment token: `USDC` or mint address |
| `amount` | string | Yes | Amount in token units (string for precision) |
| `address` | string | Yes | Recipient wallet address |

### 402 Response — JSON Body

```json
{
  "chain": "solana",
  "token": "USDC",
  "amount": "0.05",
  "address": "SolAddress..."
}
```

### Client Retry — Authorization Header

```
Authorization: x402 <tx_hash>
```

## Extension Fields (V1: Parsed and Passed Through)

### Request Extensions

| Header | V1 Behavior | Description |
|--------|-------------|-------------|
| `Accept-x402-Version` | **Active** | Protocol version negotiation |
| `X-Agent-ID` | Passthrough | Client agent fingerprint |

### Response Extensions

| Header | V1 Behavior | Description |
|--------|-------------|-------------|
| `X-Service-Hash` | Passthrough | SHA256 of service description |

### Version Negotiation

Client sends: `Accept-x402-Version: v1.0`

- If server supports v1.0 → full feature set
- If server doesn't recognize → graceful degradation to base x402 (standard fields only)
- If client doesn't send version header → server assumes base x402 compatibility

## Security

- **Replay protection**: Requests include `timestamp` and `nonce`
- **Rate limiting**: Per wallet address, configurable per minute
- **Budget enforcement**: Configurable daily limit (default $10, hard ceiling $1000), configurable single-tx limit
- **Sub-wallet**: Auto-generated on first run, never import main wallet
- **Wallet encryption**: PBKDF2 + AES encryption for private keys at rest

## JSON Schema

See `protocol/open402/spec.py` for the machine-readable JSON Schema definition, or run `ag402 info` to view it.
