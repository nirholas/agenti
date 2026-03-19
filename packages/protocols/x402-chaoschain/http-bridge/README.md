# HTTP Bridge for ChaosChain x402 Facilitator

REST API server for x402 payment verification and settlement with dual-mode support: **managed** (production) and **decentralized** (CRE-based).

## Overview

This service provides a standard HTTP interface for x402 payment verification and settlement. It supports two modes:

1. **Managed Mode (Production)**: EIP-3009 compliant, non-custodial settlement on Base/Ethereum
2. **Decentralized Mode (CRE)**: Distributed verification via Chainlink CRE (in development)

## Current Status

- **Managed Mode**: Production-ready on Base Sepolia
- **Decentralized Mode**: Active development using Chainlink CRE

## Installation

```bash
npm install
```

## Running the Server

### Development Mode (with hot reload)
```bash
npm run dev
```

### Production Mode
```bash
npm run start
```

The server will start on port `8402` (configurable via `PORT` env var).

**Default mode is `managed`** - production-ready EIP-3009 settlement.

## API Endpoints

### `GET /`
Health check and service information

**Response:**
```json
{
  "service": "ChaosChain x402 Decentralized Facilitator",
  "version": "0.1.0",
  "mode": "simulate",
  "endpoints": { ... }
}
```

### `GET /supported`
Returns supported payment schemes and networks (per x402 spec)

**Response:**
```json
{
  "kinds": [
    { "scheme": "exact", "network": "base-sepolia" },
    { "scheme": "exact", "network": "ethereum-sepolia" },
    { "scheme": "exact", "network": "skale-base-sepolia" }
  ]
}
```

### `POST /verify`
Verify an x402 payment via decentralized consensus

**Request:**
```json
{
  "x402Version": 1,
  "paymentHeader": "base64_encoded_payment_payload",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000000",
    "payTo": "0x...",
    "asset": "0x...",
    "resource": "/api/resource"
  }
}
```

**Response:**
```json
{
  "isValid": true,
  "invalidReason": null,
  "consensusProof": "0xCRE-MOCK-1234567890",
  "reportId": "rep_1234567890",
  "timestamp": 1234567890
}
```

### `POST /settle`
Settle an x402 payment via decentralized consensus

**Request:**
```json
{
  "x402Version": 1,
  "paymentHeader": "base64_encoded_payment_payload",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "payTo": "0x...",
    "asset": "0x...",
    "maxAmountRequired": "1000000",
    "resource": "/api/resource"
  }
}
```

**Response:**
```json
{
  "success": true,
  "error": null,
  "txHash": "0x30783734326433354363636333343330335333323332...",
  "networkId": "base-sepolia",
  "consensusProof": "0xCRE-MOCK-1234567890",
  "timestamp": 1234567890
}
```

## Configuration

Create a `.env` file:

```bash
# Mode selection
FACILITATOR_MODE=managed          # managed | decentralized
DEFAULT_CHAIN=base-sepolia        # base-sepolia | base-mainnet | ethereum-mainnet

# Managed mode (production)
FACILITATOR_PRIVATE_KEY=0x...     # Facilitator wallet private key
TREASURY_ADDRESS=0x...            # Fee collection address
BASE_SEPOLIA_RPC_URL=https://...
BASE_MAINNET_RPC_URL=https://...
ETHEREUM_MAINNET_RPC_URL=https://...
SKALE_BASE_SEPOLIA_RPC_URL=https://...

# Decentralized mode (CRE) - in development
CRE_MODE=simulate                 # simulate | remote
CRE_WORKFLOW_URL=https://...      # Remote CRE endpoint (for remote mode)

# General
PORT=8402
LOG_LEVEL=info
```

## Mode Comparison

| Feature | Managed Mode | Decentralized Mode |
|---------|--------------|-------------------|
| **Settlement** | EIP-3009 on-chain | CRE consensus |
| **Gasless** | ✅ Yes | ✅ Yes |
| **Approvals** | ❌ None needed | ❌ None needed |
| **Production** | ✅ Ready | 🔧 Development |

## Testing

```bash
# Start the server
bun run dev

# In another terminal, test the endpoints
curl http://localhost:8402/

curl http://localhost:8402/supported

curl -X POST http://localhost:8402/verify \
  -H "Content-Type: application/json" \
  -d '{
    "x402Version": 1,
    "paymentHeader": "test",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000000",
      "payTo": "0x0000000000000000000000000000000000000000",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "resource": "/api/test"
    }
  }'
```

## Learn More

- [x402 Protocol](https://github.com/coinbase/x402)
- [Chainlink CRE](https://docs.chain.link/cre)
- [ChaosChain Docs](https://docs.chaoscha.in)

