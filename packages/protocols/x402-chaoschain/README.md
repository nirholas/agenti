# ChaosChain-x402

### The Decentralized Facilitator for Agentic Payments

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![x402](https://img.shields.io/badge/x402-compliant-blue)](https://x402.org)

**Powered by:** [ChaosChain](https://github.com/ChaosChain) · [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) · [x402](https://github.com/coinbase/x402) · [Chainlink CRE](https://chain.link/cre)

---

## Overview

**ChaosChain-x402** replaces x402's centralized facilitator with a **decentralized, BFT-verified runtime** on Chainlink CRE.

Verify & settle agent payments with **consensus proofs**, attach **ERC-8004 
identity**, and run it yourself or use our managed endpoints.

**Current Status:**
- **Managed Facilitator** - Production-ready, live on Base Sepolia
- **Decentralized Facilitator** - Active development using Chainlink CRE

> **The Goal:** Decentralized, trustless payment verification for the agent economy. The managed facilitator is our production MVP while we build the full CRE-based vision.

**Managed Facilitator (Production - Available Now):**
- ✅ **x402 compliant** - Works with any x402 client (ChaosChain, PayAI, custom)
- ✅ **EIP-3009 gasless** - Payers don't need ETH, facilitator sponsors gas
- ✅ **No API keys needed** - Anyone can use
- ✅ **Multi-chain** - Base Sepolia (testnet), Base Mainnet (coming soon)

**Decentralized Facilitator (In Development - The Vision):**
- **Byzantine Fault Tolerant consensus** - Multiple nodes verify every payment
- **Cryptographic proofs** - Every operation is verifiable on-chain
- **Multi-chain support** - Base, Ethereum, 0G, and more
- **Chainlink CRE powered** - Decentralized execution environment

---

## Quick Start

### Use the Managed Facilitator (Production)

```bash
# No installation needed! Just use the public endpoint:
# https://facilitator.chaoscha.in

# Test with Genesis Studio from https://github.com/ChaosChain/chaoschain-integrations:
export CC_FACILITATOR_URL=https://facilitator.chaoscha.in
python genesis_studio.py
```

### Self-Host the Facilitator (Local)

```bash
git clone https://github.com/ChaosChain/chaoschain-x402
cd chaoschain-x402/http-bridge

# Install dependencies
npm install

# Configure environment (.env file)
cp .env.example .env
# Add your FACILITATOR_PRIVATE_KEY, RPC URLs, etc.

# Start in managed mode
npm run dev
```

**The facilitator runs on `:8402`** and provides `/verify` and `/settle` endpoints for any x402 client.

---

## Why Decentralized?

**The Problem with Centralized Facilitators:**
- ❌ Single point of failure - If the facilitator goes down, payments stop
- ❌ Trust assumptions - Users must trust the facilitator operator
- ❌ Censorship risk - Centralized operators can block transactions
- ❌ No verifiability - Payment verification happens in a black box

**Our Decentralized Solution (CRE-based):**
- ✅ **Byzantine Fault Tolerant** - Multiple nodes reach consensus, no single point of failure
- ✅ **Cryptographically Verifiable** - Every payment verification produces an on-chain proof
- ✅ **Censorship Resistant** - Distributed node network, no central authority
- ✅ **Trustless** - Don't trust us, verify the consensus proofs yourself

---

## Architecture

**OLD (Centralized)**
```
Agent → Resource → [Facilitator Server] → Chain
• Single operator
• Opaque correctness
• Operational bottleneck
```

**NEW (Decentralized with CRE)**
```
Agent → Resource → [Workflow DON (N nodes)] → Chain
• BFT consensus on verify/settle
• Cryptographic proofs
• Run it yourself or use managed endpoints
```

**Why It Matters:**
- **Removes trust-in-operator:** Correctness comes from BFT consensus, not a server you run
- **Standardizes payments:** x402 API surface, multi-chain by config
- **Plugs into identity:** ERC-8004 agent IDs + Proof-of-Agency

See [`diagrams/architecture.txt`](./diagrams/architecture.txt) for detailed flow diagrams.

---

## Compatibility

| Component | Version | Status |
|-----------|---------|--------|
| **x402 (spec)** | v1 | Request/response shapes matched |
| **ERC-8004** | v1.0 | Identity attached via ChaosChain SDK |
| **CRE** | TS SDK 0.0.9-alpha | Simulate mode now; DON deployment later |
| **Chains** | Base, Ethereum | Sepolia testnets + mainnets ready |

---

## Quick Start

### Option 1: Docker (Fastest)

```bash
# Clone repo
git clone https://github.com/ChaosChain/chaoschain-x402.git
cd chaoschain-x402

# Start everything with Docker Compose
docker-compose up http-bridge

# In another terminal, run demo
docker-compose --profile demo up ts-demo
```

See [`docs/DOCKER.md`](./docs/DOCKER.md) for full Docker guide.

### Option 2: Native Install

**Prerequisites:**
- **Bun** 1.2.21+ - [Install](https://bun.sh/)
- **Python** 3.9+ (optional, for Python demo)
- **CRE CLI** (optional) - [Install](https://docs.chain.link/cre)

**Steps:**

```bash
# 1. Clone repo
git clone https://github.com/ChaosChain/chaoschain-x402.git
cd chaoschain-x402

# 2. Start HTTP bridge
cd http-bridge && bun install && bun run dev

# 3. Run demo (in new terminal)
cd examples/ts-demo && bun install && bun run dev
# or: cd examples/py-demo && pip install -r requirements.txt && python demo.py
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════╗
║   ChaosChain x402 Decentralized Facilitator Bridge       ║
╚═══════════════════════════════════════════════════════════╝

🚀 Server listening on http://localhost:8402
📋 CRE Workflow Ready
```

### (Optional) CRE Workflow Simulation

Test the actual CRE workflow locally:

```bash
cd workflows/x402-facilitator && bun install && cd ../..
cre workflow simulate x402-facilitator --target local-simulation
```

**Note:** The HTTP bridge provides a stable API without requiring CRE CLI.

---

## Managed Facilitator (Production-Ready)

ChaosChain provides a **production-ready managed facilitator** at `https://facilitator.chaoscha.in` that handles all payment verification and settlement complexity.

### Architecture: Non-Custodial & Secure

- **Non-custodial settlement:** Uses EIP-3009 `transferWithAuthorization` - we never hold your funds
- **Gasless for payers:** Facilitator sponsors gas, payers only need USDC (no ETH needed)
- **No approvals needed:** Single EIP-3009 signature - no separate `approve()` transaction
- **Fast settlement:** < 1 second (plus blockchain confirmation time)
- **Universal compatibility:** If it speaks HTTP, it speaks x402
- **Built-in identity:** Every payment automatically links to your ERC-8004 agent for reputation

### Amounts & Units

All API responses include both **human** strings (e.g., `"1.00" USDC`) and **base** unit strings (e.g., `"1000000"` for 6-decimal tokens). Use whichever is convenient; settlement logic uses base units.

**Example response:**
```json
{
  "amount": { "human": "1.00", "base": "1000000", "symbol": "USDC", "decimals": 6 },
  "fee": { "human": "0.01", "base": "10000", "bps": 100 },
  "net": { "human": "0.99", "base": "990000" }
}
```

### Facilitator URL

The ChaosChain facilitator URL is `https://facilitator.chaoscha.in`.

**That's it. No signup, no API keys, no complexity.** Every payment automatically builds your agent's on-chain reputation via ERC-8004.

### Using the Managed Facilitator

**With ChaosChain SDK (Recommended):**

```typescript
import { ChaosChainSDK } from '@chaoschain/sdk';

const sdk = new ChaosChainSDK({
  facilitatorUrl: 'https://facilitator.chaoscha.in',
  agentId: '8004#123', // Optional: ERC-8004 tokenId for reputation
});

// Payments automatically route through facilitator
```

**With Raw HTTP:**

```bash
curl -X POST https://facilitator.chaoscha.in/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "x402Version": 1,
    "paymentHeader": {
      "sender": "0xPayerAddress",
      "nonce": "unique_nonce_123",
      "validAfter": "2025-10-29T00:00:00Z",
      "validBefore": "2025-10-29T01:00:00Z"
    },
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "10.00",
      "payTo": "0xMerchantAddress",
      "asset": "usdc",
      "resource": "/api/service"
    }
  }'
```

**Response:**

```json
{
  "isValid": true,
  "feeAmount": "100000",
  "netAmount": "9900000",
  "feeBps": 100,
  "consensusProof": "0xabc123...",
  "timestamp": 1730160000
}
```

### Fee Structure

**Simple flat fee:** 1% on all transactions
- Transparent and disclosed before settlement
- Net amount goes directly to merchant
- Fee supports protocol development
- No hidden costs, no surprises

**Example:** 10 USDC payment
- Merchant receives: 9.90 USDC
- ChaosChain fee: 0.10 USDC
- Total from payer: 10.00 USDC

### Self-Hosting (Optional)

Want to run your own facilitator? Set these environment variables:

```bash
# Facilitator Configuration
FACILITATOR_MODE=managed
DEFAULT_CHAIN=base-sepolia

# Fee Configuration
FEE_BPS_DEFAULT=100  # 1%
TREASURY_ADDRESS=0xYourTreasuryAddress

# RPC Endpoints
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHEREUM_SEPOLIA_RPC_URL=https://ethereum-sepolia.blockpi.network/v1/rpc/public

# Hot Wallet
FACILITATOR_PRIVATE_KEY=0xYourPrivateKey

# ChaosChain ERC-8004 Integration (automatic when using SDK)
CHAOSCHAIN_ENABLED=true
VALIDATION_REGISTRY_ADDRESS=0xRegistryAddress

# Supabase (for transaction tracking)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### Health & Status

Check facilitator health:

```bash
curl https://facilitator.chaoscha.in/health
```

```json
{
  "healthy": true,
  "checks": {
    "supabase": true,
    "rpcBaseSepolia": true,
    "gasBalance": "0.5",
    "gasBalanceHealthy": true,
    "usdcBalance": "1000.0",
    "rpcLatencyMs": 120,
    "blockLag": 2
  }
}
```

**Status page:** https://status.facilitator.chaoscha.in

### For Merchants: Start Earning

Want to monetize your AI agent services? See our merchant guide:

**[→ Merchant Guide: Selling Services with x402](./docs/MERCHANT_GUIDE.md)**

Quick overview:
1. Return `402 Payment Required` with payment requirements
2. Client signs EIP-3009 authorization (no approval needed, gasless for payer)
3. You receive USDC (minus 1% facilitator fee)
4. Non-custodial, instant settlement via `transferWithAuthorization`

### For Developers: Integration Specs

External SDK integration specifications:

- **[Merchant Guide](./docs/MERCHANT_GUIDE.md)** - Set up your payment-protected API
- **[Terms of Service](./docs/TERMS.md)** - Legal terms and SLA

### Managed vs Decentralized

| Feature | Managed (Production) | Decentralized (Beta) |
|---------|---------------------|----------------------|
| **Deployment** | Hosted by ChaosChain | Self-hosted or CRE DON |
| **Settlement** | EIP-3009 on-chain | CRE workflow consensus |
| **Fees** | 1% flat fee | Gas only (if self-hosted) |
| **Setup** | Zero - just use the URL | Requires CRE deployment |
| **Support** | Community Discord | Community Discord |
| **Identity (ERC-8004)** | Automatic when using SDK | Automatic when using SDK |
| **Best for** | Production apps, merchants | Maximum trust-minimization |

**Recommendation:** Start with managed (`https://facilitator.chaoscha.in`) for immediate production use.

---

## What's Inside

```
chaoschain-x402/
├── workflows/x402-facilitator/   # CRE workflow (verify + settle handlers)
├── http-bridge/                   # REST API server (Fastify)
├── clients/
│   ├── ts/                        # @chaoschain/x402-client (TypeScript)
│   └── py/                        # chaoschain-x402-client (Python)
├── examples/
│   ├── ts-demo/                   # TypeScript demo
│   └── py-demo/                   # Python demo
├── diagrams/                      # Architecture diagrams
├── project.yaml                   # CRE project configuration
└── README.md                      # This file
```

---

## API Reference

The HTTP bridge implements the x402 facilitator API spec with full consensus verification flow.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8402` | HTTP bridge port |
| `CRE_MODE` | `simulate` | `simulate` \| `remote` |
| `CRE_WORKFLOW_URL` | — | Remote CRE endpoint (required for `remote` mode) |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |

### Endpoints

### `GET /`

Health check and service information.

**Example:**
```bash
curl -s http://localhost:8402/ | jq
```

**Response:**
```json
{
  "service": "ChaosChain x402 Decentralized Facilitator",
  "version": "0.1.0",
  "mode": "simulate",
  "endpoints": {
    "verify": "POST /verify",
    "settle": "POST /settle",
    "supported": "GET /supported"
  }
}
```

### `GET /supported`

List supported payment schemes and networks (per x402 spec).

**Example:**
```bash
curl -s http://localhost:8402/supported | jq
```

**Response:**
```json
{
  "kinds": [
    { "scheme": "exact", "network": "base-sepolia" },
    { "scheme": "exact", "network": "ethereum-sepolia" },
    { "scheme": "exact", "network": "base-mainnet" },
    { "scheme": "exact", "network": "ethereum-mainnet" }
  ]
}
```

### `POST /verify`

Verify an x402 payment via decentralized consensus.

**Example:**
```bash
curl -X POST http://localhost:8402/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "x402Version": 1,
    "paymentHeader": "base64_encoded_payment_payload",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000000",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "resource": "/api/weather"
    }
  }' | jq
```

**Response:**
```json
{
  "isValid": true,
  "invalidReason": null,
  "consensusProof": "0x307837343264333543633636333433303353333233323...",
  "reportId": "rep_1730845234567",
  "timestamp": 1730845234567
}
```

### `POST /settle`

Settle an x402 payment via decentralized consensus.

**Example:**
```bash
curl -X POST http://localhost:8402/settle \
  -H 'Content-Type: application/json' \
  -d '{
    "x402Version": 1,
    "paymentHeader": "base64_encoded_payment_payload",
    "paymentRequirements": {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000000",
      "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "resource": "/api/weather"
    }
  }' | jq
```

**Response:**
```json
{
  "success": true,
  "error": null,
  "txHash": "0x307837343264333543633636333433303353333233323...",
  "networkId": "base-sepolia",
  "consensusProof": "0x30783734326433354363636333343330335333323332...",
  "timestamp": 1730845234567
}
```

**OpenAPI Spec:** See [`docs/openapi.yaml`](./docs/openapi.yaml) for complete API specification.

---

## How It Works

### Current Mode: Local Development

Decentralized version currently runs in **local development mode**:

- ✅ Complete CRE workflow architecture implemented
- ✅ Full BFT consensus verification flow
- ✅ Production-ready API with cryptographic proofs
- ✅ Realistic transaction and consensus hashes
- 🔄 Awaiting CRE public beta for DON deployment

This allows **public development and testing** without requiring access to the CRE private alpha.

### Production Mode (When CRE is Public)

When Chainlink CRE becomes publicly available, swap to production mode:

1. **Deploy the CRE workflow** to a Decentralized Oracle Network (DON)
2. **Enable real EVM interactions** (signature verification, on-chain settlement)
3. **Point the HTTP bridge** to the deployed CRE workflow
4. **No API changes required** — clients continue working as-is

See [`workflows/x402-facilitator/README.md`](./workflows/x402-facilitator/README.md) for details on upgrading.

### Decentralization Explained

The facilitator is decentralized via **Chainlink CRE**:

- Multiple independent **nodes** in a DON execute the same workflow
- Each node verifies payment signatures and settlement conditions
- **BFT consensus** aggregates results into a single verified output
- **Cryptographic proofs** provide transparency and verifiability

See [`diagrams/architecture.txt`](./diagrams/architecture.txt) for the detailed flow.

---

## Multi-Chain Support

The facilitator supports multiple chains with different settlement methods:

| Chain                | Network ID             | Token      | Settlement Method | Status       |
| -------------------- | ---------------------- | ---------- | ----------------- | ------------ |
| **Base Sepolia**     | `base-sepolia`         | USDC       | EIP-3009 (gasless) | ✅ Supported  |
| **Ethereum Sepolia** | `ethereum-sepolia`     | USDC       | EIP-3009 (gasless) | ✅ Supported  |
| **Base Mainnet**     | `base-mainnet`         | USDC       | EIP-3009 (gasless) | ✅ Supported  |
| **Ethereum Mainnet** | `ethereum-mainnet`     | USDC       | EIP-3009 (gasless) | ✅ Supported  |
| **0G Mainnet**       | `0g-mainnet`           | W0G        | Relayer (requires approval) | ✅ Supported  |

**Settlement Methods:**
- **EIP-3009 (USDC)**: Gasless for payer, no approval needed, single signature
- **Relayer (W0G)**: User approves once, facilitator executes transfers

Add new chains by extending the `CHAIN_CONFIG` and `TOKEN_ADDRESSES` in `settlement.ts`.

---

## Economic Model (Facilitator-as-a-Service)

| Tier                   | Description                                      | Pricing Model     |
| ---------------------- | ------------------------------------------------ | ----------------- |
| **Open Source**        | Self-hosted CRE workflows                        | Free              |
| **Managed Facilitator**| SLA-backed endpoints hosted by ChaosChain        | % per transaction |
| **Enterprise Plan**    | Private facilitator cluster + audit logs         | Monthly SaaS      |

Protocol fees can be routed to the **ChaosChain Treasury** for validator rewards and future staking incentives.

---

## Development

### Build All Components

```bash
# HTTP Bridge
cd http-bridge
bun install
bun run build

# TypeScript Client
cd ../clients/ts
bun install
bun run build

# Python Client
cd ../clients/py
pip install -e .
```

### Run Tests

```bash
# TypeScript
cd clients/ts
bun run typecheck

# Python
cd clients/py
pytest
```

---

## Roadmap

> **Vision:** Build the first truly decentralized x402 facilitator with BFT consensus, replacing centralized payment verification with cryptographic proofs.

### Phase 1: Managed Facilitator COMPLETE
- ✅ EIP-3009 compliant payment verification
- ✅ On-chain settlement via `transferWithAuthorization`
- ✅ x402 universal compatibility (works with any client)
- ✅ Production-ready HTTP bridge
- ✅ Tested on Base Sepolia

### Phase 2: Mainet Launch
-  Public endpoint: `facilitator.chaoscha.in`
-  Revenue generation (1% facilitator fees)
-  Multi-chain support (Ethereum, 0G)

### Phase 3: Decentralized Facilitator (CRE) - ACTIVE DEVELOPMENT
-  **Byzantine Fault Tolerant consensus** - Multi-node verification
-  **Cryptographic proofs** - Every payment verifiable on-chain
-  **Remote CRE DON integration** - Live Chainlink network
-  **Distributed verification** - No single point of failure

### Phase 4: Full Decentralization Q1 2026
- Decentralized facilitator on mainnet (Base, Ethereum, 0G)
- ERC-8004 and ChaosChain's Proof-of-Agency integration
- Community validator program
- On-chain governance for facilitator parameters

---

## Learn More

### Documentation

- [CRE Workflow README](./workflows/x402-facilitator/README.md) - How the workflow works
- [HTTP Bridge README](./http-bridge/README.md) - API server details
- [TypeScript Client README](./clients/ts/README.md) - Using the TS client
- [Python Client README](./clients/py/README.md) - Using the Python client
- [Docker Guide](./docs/DOCKER.md) - Running with Docker Compose
- [OpenAPI Spec](./docs/openapi.yaml) - Complete API specification

### External Resources

- [x402 Protocol](https://github.com/coinbase/x402) - Coinbase's agent payment standard
- [Chainlink CRE](https://docs.chain.link/cre) 
- [CRE TypeScript SDK](https://github.com/smartcontractkit/cre-sdk-typescript) - Public CRE SDK
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) - Agent identity standard
- [ChaosChain SDK](https://github.com/ChaosChain/chaoschain-sdk-ts) - Agent identity & payments

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

**Key Areas for Contribution:**

- Adding support for new blockchains
- Implementing additional x402 payment schemes (e.g., `upto`)
- Improving documentation and examples
- Testing and reporting issues

---

##  Maintainers

**ChaosChain** — builders of the Triple-Verified Stack for trustless AI commerce.

Maintained by the same team behind:
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) - Proof-of-Agency standard
- [ChaosChain SDK](https://github.com/ChaosChain) - Agent identity & reputation
- Integrations on 0G, EigenLayer, and Filecoin

**License:** MIT  
**Contact:** sumeet.chougule@nethermind.io

---

## Get Involved

- **Try the SDKs** → [chaoschain-sdk-ts](https://github.com/ChaosChain/chaoschain-sdk-ts) | [chaoschain-sdk-py](https://github.com/ChaosChain/chaoschain-sdk-py)
- **Follow updates** → [@Ch40sChain](https://x.com/Ch40sChain)
- **Read the docs** → [docs.chaoscha.in](https://docs.chaoscha.in)

> "Decentralizing the economic heartbeat of the agentic web."

---

## Acknowledgments

Built with support from:
- **Coinbase** - x402 protocol specification
- **Chainlink** - CRE platform & private alpha access
- **EigenLayer** - Verifiable compute infrastructure
- **0G Labs** - High-performance blockchain & storage
- **Nethermind** - Engineering support & ecosystem integration

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

**Status:** 🟢 Production (Managed) | Active Development (Decentralized)

