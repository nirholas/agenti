# x402 Protocol GitHub Scan Results
status: complete
date: 2026-04-17

---

## Overview

x402 is an HTTP-native payment protocol that repurposes the HTTP 402 Payment Required status code for blockchain micropayments. The flow:

1. Client sends an HTTP request to a resource server
2. Server returns `402 Payment Required` with a `X-PAYMENT-REQUIRED` header containing payment details
3. Client creates a `transferWithAuthorization` signature (EIP-3009) and retries with `X-PAYMENT` header
4. Server delegates to a facilitator (POST `/verify` + POST `/settle`) or verifies/settles directly
5. Server returns `200 OK` with `X-PAYMENT-RESPONSE` header on success

The protocol is championed by Coinbase but is formally maintained as an open standard by the x402 Foundation. The TypeScript SDK uses scoped npm packages (`@x402/*`). It is chain-agnostic and currently has production facilitators for EVM chains (Base, Ethereum, Polygon, Arbitrum) and Solana.

---

## Repo 1: coinbase/x402 (Reference Implementation)

**URL:** https://github.com/coinbase/x402  
**License:** Apache-2.0  
**Stars:** 55 (fork of x402-foundation/x402)  
**Language:** TypeScript (50.5%), Python (29.3%), Go (19.1%), Solidity (0.4%)  
**Homepage:** https://x402.org  
**Created:** 2026-04-02 | **Last Updated:** 2026-04-16

### Repository Structure

```
├── contracts/evm/        # EIP-3009 smart contracts, USDC/EURC support
├── docs/                 # GitBook documentation
├── examples/             # Full working examples
│   ├── typescript/
│   │   ├── servers/express/         # Express middleware example
│   │   ├── servers/hono/            # Hono middleware example
│   │   ├── clients/axios/           # Axios interceptor example
│   │   ├── clients/fetch/           # fetch wrapper example
│   │   ├── fullstack/miniapp/       # Farcaster Mini App
│   │   ├── fullstack/next-app/      # Next.js app router
│   │   ├── agents/                  # Anthropic + dynamic agents
│   │   └── facilitator/             # Facilitator verify/settle implementation
│   └── go/
│       ├── servers/                 # Go server examples
│       └── clients/http/            # Go HTTP client
├── go/                   # Go SDK
├── java/                 # Java SDK
├── python/               # Python SDK (FastAPI middleware)
├── typescript/
│   └── packages/
│       ├── core/         # Core protocol types and utilities
│       ├── extensions/   # Extensibility modules
│       ├── http/         # HTTP-related functionality
│       ├── legacy/       # Legacy support
│       ├── mcp/          # Model Context Protocol integration
│       └── mechanisms/   # Core payment mechanisms
├── specs/                # Protocol specification
└── e2e/                  # End-to-end test suite
```

### TypeScript npm Packages

```bash
npm install @x402/core @x402/evm @x402/svm @x402/axios @x402/fetch @x402/express @x402/hono @x402/next @x402/paywall @x402/extensions
```

| Package | Purpose |
|---------|---------|
| `@x402/core` | Protocol types, validation, payment payload construction |
| `@x402/evm` | EVM chain support — EIP-3009 signing, USDC/EURC |
| `@x402/svm` | Solana VM support |
| `@x402/express` | Express.js middleware for gating routes |
| `@x402/hono` | Hono middleware for gating routes |
| `@x402/next` | Next.js App Router middleware |
| `@x402/axios` | Axios interceptor for auto-paying 402s |
| `@x402/fetch` | fetch() wrapper that auto-pays 402s |
| `@x402/paywall` | Browser-facing paywall component |
| `@x402/extensions` | Protocol extensions |

### Key Reusable Patterns

- **Facilitator implementation** (`examples/typescript/facilitator/`): Full `/verify` and `/settle` endpoint reference — directly reusable for `packages/facilitator/`
- **Server middleware** (`@x402/express`, `@x402/hono`, `@x402/next`): Single-line middleware integration patterns, inspectable in `examples/typescript/servers/`
- **Client pay.ts** (`@x402/axios`, `@x402/fetch`): Interceptor patterns that auto-sign EIP-3009 and retry — directly relevant to improving `packages/core/src/pay.ts`
- **E2E test suite** (`e2e/`): Full 402 flow tests, usable as reference for `packages/*/src/__tests__/`
- **Protocol spec** (`specs/x402-specification.md`): Canonical payload formats and scheme definitions

### Clone & Attribution

```bash
git clone https://github.com/coinbase/x402.git
```

```
# Attribution: Coinbase x402 reference implementation (Apache-2.0)
# https://github.com/coinbase/x402
```

---

## Repo 2: x402-foundation/x402 (Upstream Canonical)

**URL:** https://github.com/x402-foundation/x402  
**License:** Apache-2.0  
**Stars:** ~6,000 | **Forks:** ~1,500  
**Language:** TypeScript (50.5%), Python (29.3%), Go (19.1%), Solidity (0.4%)

The upstream foundation fork with significantly higher community engagement than the Coinbase mirror. Identical code structure but has 6k stars vs 55 for the Coinbase fork — meaning this is the one most community PRs and issues live on.

### What's Reusable vs. coinbase/x402

Same packages and structure. Prefer this repo for:
- Watching issues/PRs for protocol changes
- Latest community-contributed middleware
- Java SDK (currently developing)

### Clone & Attribution

```bash
git clone https://github.com/x402-foundation/x402.git
```

```
# Attribution: x402 Foundation (Apache-2.0)
# https://github.com/x402-foundation/x402
```

---

## Repo 3: nirholas/x402-facilitator (Reference Facilitator — Public)

**URL:** https://github.com/nirholas/x402-facilitator  
**License:** MIT  
**Language:** TypeScript (98.2%), Dockerfile (1.4%), JavaScript (0.4%)  
**Author:** Sperax

> Note: This repo is PUBLIC (not private/404 as anticipated).

### What It Does

EIP-3009 USDC micropayment facilitator for Base, Arbitrum, and Ethereum. Verifies and settles gasless payments using signed EIP-712 authorizations.

### Structure

```
src/
├── facilitator/     # Core orchestration
├── verification/    # EIP-712 signature validation
├── settlement/      # On-chain settlement logic
├── routes/          # REST route handlers (/verify, /settle)
└── middleware/      # Rate limiting, metrics, gas monitoring
tests/               # Unit test suite
docs/                # Payment flow diagrams
.github/workflows/   # CI/CD
Dockerfile
docker-compose.yml
```

### Key Features

- Multi-network: Base, Arbitrum, Ethereum
- EIP-712 signature validation
- Rate limiting middleware
- Metrics tracking
- Gas balance monitoring
- Per-chain RPC connectivity health checks
- Docker-ready

### Most Reusable for agenti

- `src/verification/` → `packages/facilitator/src/verification.ts`
- `src/settlement/` → `packages/facilitator/src/settlement.ts`
- `src/routes/` → `packages/facilitator/src/routes.ts`
- `tests/` → `packages/facilitator/src/__tests__/`
- The rate limiting and gas monitoring middleware patterns are production-quality and not in the reference implementation

### Clone & Attribution

```bash
git clone https://github.com/nirholas/x402-facilitator.git
```

```
# Attribution: nirholas/x402-facilitator by Sperax (MIT)
# https://github.com/nirholas/x402-facilitator
```

---

## Repo 4: nirholas/x402-deploy (1-Click Deployment)

**URL:** https://github.com/nirholas/x402-deploy  
**License:** MIT  
**Language:** TypeScript (92.1%), HTML (6.8%)

> Note: This repo is also PUBLIC.

### What It Does

"1-click deployment for monetized APIs & MCP servers" — turn any API or MCP server into a paid service in 5 minutes. Deploys to Railway, Fly.io, Vercel, and Docker.

### Structure

```
src/             # Core source
tests/           # Test suite
examples/        # Usage examples
dashboard-web/   # Live earnings dashboard UI
docs/            # Documentation
website/         # Marketing site
x402-facilitator/ # Bundled facilitator module
```

### Key Features

- USDC on Base blockchain
- Automatic API discovery
- Live earnings dashboard
- CLI deployment tool
- Bundled facilitator module

### Most Reusable for agenti

- `x402-facilitator/` module bundled inside — inspect for any patterns not in nirholas/x402-facilitator
- Dashboard pattern — relevant for eventual monitoring in `packages/facilitator/`
- CLI deployment tool patterns for `examples/` directory

### Clone & Attribution

```bash
git clone https://github.com/nirholas/x402-deploy.git
```

```
# Attribution: nirholas/x402-deploy (MIT)
# https://github.com/nirholas/x402-deploy
```

---

## Repo 5: second-state/x402-facilitator

**URL:** https://github.com/second-state/x402-facilitator  
**License:** Apache-2.0  
**Stars:** 221  
**Language:** Rust (99.7%)

### What It Does

Universal x402 payment infrastructure for humans and AI agents. Supports Base, Avalanche, Solana, Polygon, and Sei. Multi-stablecoin: USDC and USDT.

### Key Features

- Multi-chain: Base, Avalanche, Solana, Polygon, Sei
- USDC + USDT support
- OpenTelemetry-compatible metrics and tracing
- Docker deployment (`docker build` + `docker run`)

### Configuration

```env
HOST=0.0.0.0
PORT=8080
SIGNER_TYPE=private-key
EVM_PRIVATE_KEY=...
SOLANA_PRIVATE_KEY=...
RPC_URL_BASE=...
RPC_URL_AVAX=...
RPC_URL_SOLANA=...
RPC_URL_POLYGON=...
RPC_URL_SEI=...
```

### Most Reusable for agenti

Not directly reusable (Rust), but the multi-chain config pattern and OpenTelemetry integration are worth referencing for the TypeScript facilitator's `.env` design and metrics export.

### Clone & Attribution

```bash
git clone https://github.com/second-state/x402-facilitator.git
```

```
# Attribution: second-state/x402-facilitator (Apache-2.0)
# https://github.com/second-state/x402-facilitator
```

---

## Repo 6: x402-rs/x402-rs

**URL:** https://github.com/x402-rs/x402-rs  
**License:** Apache-2.0  
**Language:** Rust (91.5%)

### Crates

| Crate | Purpose |
|-------|---------|
| `x402-types` | Core protocol types |
| `x402-axum` | Axum middleware (server-side gating) |
| `x402-reqwest` | Reqwest client (auto-pays 402s) |
| `x402-facilitator-local` | Local payment verification and settlement |
| `x402-chain-eip155` | EVM/EIP-155 support |
| `x402-chain-solana` | Solana support |
| `x402-chain-aptos` | Aptos support |

### Key Patterns

Server-side route protection:
```rust
let x402 = X402Middleware::new("http://facilitator.example.com");
let app = Router::new().route("/paid", get(handler).layer(x402.with_price_tag(...)));
```

Client-side auto-payment:
```rust
let x402_client = X402Client::new().register(V2Eip155ExactClient::new(signer));
let client = Client::new().with_payments(x402_client).build();
```

### Most Reusable for agenti

- Middleware pattern: `with_price_tag()` API is cleaner than the Express/Hono approach — worth adapting for TypeScript middleware signature design
- Protocol v1 + v2 support: reference for backwards compatibility in `packages/core/`
- Docker image: `ghcr.io/x402-rs/x402-facilitator` for test environment

### Clone & Attribution

```bash
git clone https://github.com/x402-rs/x402-rs.git
```

```
# Attribution: x402-rs (Apache-2.0)
# https://github.com/x402-rs/x402-rs
```

---

## Repo 7: primev/mainnet-x402-facilitator

**URL:** https://github.com/primev/mainnet-x402-facilitator  
**License:** Not specified  
**Language:** TypeScript (85.6%), Solidity (14.4%)  
**Production URL:** https://facilitator.primev.xyz

### What It Does

Ethereum mainnet x402 facilitator using FastRPC preconfirmations for sub-200ms settlement. Gasless USDC transfers using EIP-3009 — no ETH needed for gas. Settlement in ~1.2 seconds via mev-commit.

### API Endpoints

```
POST /settle    # Verify + settle via FastRPC preconfirmation
POST /verify    # Validate signatures, balances, nonces (dry run)
GET  /supported # Return supported schemes and networks
```

### Tech Stack

- Viem (wallet client operations)
- Hono (API routing)
- Foundry/Forge (smart contract testing)
- FastRPC (preconfirmation service)

### Most Reusable for agenti

- Hono-based facilitator server pattern (TypeScript) — the most directly reusable server layout for `packages/facilitator/`
- Solidity contracts (14.4%) for EIP-3009 testing fixtures
- `/supported` endpoint design: canonical pattern for advertising supported schemes/networks

### Clone & Attribution

```bash
git clone https://github.com/primev/mainnet-x402-facilitator.git
```

```
# Attribution: primev/mainnet-x402-facilitator (license unspecified — verify before use)
# https://github.com/primev/mainnet-x402-facilitator
```

---

## Repo 8: ChaosChain/chaoschain-x402

**URL:** https://github.com/ChaosChain/chaoschain-x402  
**License:** MIT  
**Language:** TypeScript (64.3%), HTML, Shell, Python  
**Production URL:** https://facilitator.chaoscha.in

### What It Does

Decentralized x402 facilitator using Byzantine Fault Tolerant consensus via Chainlink CRE. Replaces centralized verification with committee consensus. Non-custodial settlement via `transferWithAuthorization`. Zero API keys needed. 1% flat fee.

### How to Run

```bash
# Docker (fastest):
git clone https://github.com/ChaosChain/chaoschain-x402.git
cd chaoschain-x402
docker-compose up http-bridge

# Native (Bun):
cd http-bridge && bun install && bun run dev
```

Listens on port 8402, provides `/verify` and `/settle`.

### Key Features

- Decentralized consensus (Byzantine Fault Tolerant)
- EIP-3009 gasless payments
- ERC-8004 agent identity integration
- TypeScript + Python client libraries included
- Multi-chain: Base, Ethereum (0G planned)

### Most Reusable for agenti

- `http-bridge/` source: Bun-native TypeScript facilitator server, clean minimal implementation
- Client libraries (TypeScript + Python) in the same repo — good reference for multi-language SDK design
- Port 8402 convention — worth following for `packages/facilitator/` dev server default

### Clone & Attribution

```bash
git clone https://github.com/ChaosChain/chaoschain-x402.git
```

```
# Attribution: ChaosChain/chaoschain-x402 (MIT)
# https://github.com/ChaosChain/chaoschain-x402
```

---

## Repo 9: fortylabs/local-x402-facilitator

**URL:** https://github.com/fortylabs/local-x402-facilitator  
**License:** Not specified  
**Language:** TypeScript (97.4%)

### What It Does

Local development x402 facilitator using Tenderly Virtual TestNets. Avoids public testnet faucet bottlenecks. Explicitly NOT for production.

### How to Run

```bash
npx local-x402-facilitator --rpc <TENDERLY_TESTNET_RPC_URL>
```

Or install and configure with custom script.

### Most Reusable for agenti

- `npx` invocation pattern: exactly the DX target for `packages/facilitator/` dev mode
- Tenderly Virtual TestNet integration: reference for CI test environment setup
- Single-command local facilitator: directly useful as reference for `examples/` dev workflow

### Clone & Attribution

```bash
git clone https://github.com/fortylabs/local-x402-facilitator.git
```

```
# Attribution: fortylabs/local-x402-facilitator (license unspecified — verify before use)
# https://github.com/fortylabs/local-x402-facilitator
```

---

## Repo 10: AceDataCloud/FacilitatorX402 (Django/Python)

**URL:** https://github.com/AceDataCloud/FacilitatorX402  
**License:** Not specified  
**Language:** Python (99.0%)

### What It Does

Django + PostgreSQL facilitator with nonce storage for replay protection, on-chain settlement with configurable gas limits, Kubernetes-ready deployment, GitHub Actions CI/CD.

### API Endpoints

```
POST /verify    # Validate signatures and integrity
POST /settle    # Execute on-chain settlement
GET  /          # Facilitator overview
GET  /healthz   # Health probe for load balancers
```

### Most Reusable for agenti

- Nonce storage pattern (PostgreSQL): replay protection design relevant for `packages/facilitator/` state management
- `/healthz` endpoint pattern: canonical health probe design
- K8s deployment patterns in `.github/workflows/`: reference for CI/CD pipeline

### Clone & Attribution

```bash
git clone https://github.com/AceDataCloud/FacilitatorX402.git
```

```
# Attribution: AceDataCloud/FacilitatorX402 (license unspecified — verify before use)
# https://github.com/AceDataCloud/FacilitatorX402
```

---

## Repo 11: dabit3/x402-starter-kit

**URL:** https://github.com/dabit3/x402-starter-kit  
**License:** MIT  
**Language:** TypeScript

### What It Includes

- Express HTTP server with payment validation
- MerchantExecutor for facilitator integration
- EVM test client (payment signing)
- Solana test client
- Local facilitator server for mainnet
- OpenAI / EigenAI service integration example

### How to Run

```bash
npm install
cp .env.example .env
npm run dev                          # testnet
npm run start:facilitator            # local facilitator (terminal 1)
FACILITATOR_URL=http://localhost:4022 npm run start  # app (terminal 2)
npm run test          # EVM
npm run test:solana   # Solana
```

### Most Reusable for agenti

- Test client patterns (EVM + Solana) — directly usable for `packages/*/src/__tests__/integration.ts`
- MerchantExecutor pattern — an abstraction layer between route handler and facilitator, worth adding to `packages/sdk/`
- `start:facilitator` + `FACILITATOR_URL` pattern: exact dev workflow to replicate

### Clone & Attribution

```bash
git clone https://github.com/dabit3/x402-starter-kit.git
```

```
# Attribution: dabit3/x402-starter-kit (MIT)
# https://github.com/dabit3/x402-starter-kit
```

---

## Repo 12: microchipgnu/MCPay

**URL:** https://github.com/microchipgnu/MCPay  
**License:** Apache-2.0  
**Stars:** 86  
**Language:** TypeScript (96.7%)  
**Networks:** Base, Avalanche, IoTeX, Sei (EVM); Solana

### What It Does

Open-source infrastructure for MCP server monetization via x402. Pay-per-call without subscriptions or API keys.

### Key Exports

```typescript
import { withX402Client } from 'mcpay';    // Wrap MCP client with payment capabilities
import { createMcpPaidHandler } from 'mcpay';  // Build monetized MCP server (Hono)
import { paidTool } from 'mcpay';           // Declare priced tools
```

### CLI

```bash
mcpay connect  # Proxy remote MCP servers locally with payment support
```

### Most Reusable for agenti

- `withX402Client()` pattern: exact pattern needed for `packages/mcp/src/client.ts`
- `paidTool()` decorator: clean API for tool-level pricing in `packages/mcp/`
- Hono-based paid handler: reference for `packages/mcp/src/server.ts`
- Multi-network support: Base, Avalanche, IoTeX, Sei, Solana — reference for `packages/core/` chain config

### Clone & Attribution

```bash
git clone https://github.com/microchipgnu/MCPay.git
```

```
# Attribution: microchipgnu/MCPay (Apache-2.0)
# https://github.com/microchipgnu/MCPay
```

---

## Repo 13: qntx/facilitator

**URL:** https://github.com/qntx/facilitator  
**License:** Functional Source License v1.1 (FSL) → Apache-2.0 after 2 years  
**Stars:** 148  
**Language:** Rust (64.4%), Shell (28.9%), Makefile (4.3%)

### API Endpoints

```
GET  /supported   # List enabled payment kinds
POST /verify      # Validate payment payloads
POST /settle      # Execute on-chain settlement
GET  /health      # Service health
```

### Supported Networks

- EVM: Ethereum, Base, Optimism, Arbitrum, Polygon, Avalanche, Celo + testnets
- Solana: Mainnet, Devnet, custom clusters

### Install

```bash
cargo install facilitator
facilitator init
facilitator serve
```

Or: `ghcr.io/qntx/facilitator` Docker image.

### Most Reusable for agenti

- `/supported` endpoint format: canonical response shape for listing available payment schemes
- Dual-license pattern (FSL → Apache): note for attribution — FSL restricts commercial use for 2 years, then goes Apache. DO NOT use code directly in agenti until confirmed Apache-2.0.

### Clone & Attribution

```bash
git clone https://github.com/qntx/facilitator.git
```

```
# Attribution: qntx/facilitator (FSL-1.1-Apache-2.0 — check license terms before use)
# https://github.com/qntx/facilitator
```

---

## Repo 14: qntx/x402-openai-typescript

**URL:** https://github.com/qntx/x402-openai-typescript  
**License:** MIT  
**Stars:** 151  
**Language:** TypeScript

### What It Does

Drop-in OpenAI client wrapper with transparent x402 payment handling. Automatically intercepts HTTP 402 responses, signs with EIP-3009, and retries.

```typescript
const client = new X402OpenAI({
  wallet: new EvmWallet({ privateKey: "0x…" }),
});
const res = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Hello!" }],
});
```

### Install

```bash
# EVM:
bun add x402-openai @x402/evm viem
# Solana:
bun add x402-openai @x402/svm @solana/kit @scure/base
```

### Most Reusable for agenti

- Wrapper pattern: exactly the `withX402` HOC pattern relevant for `packages/sdk/src/adapters/`
- `EvmWallet` abstraction: clean wallet interface worth mirroring in `packages/core/src/wallet.ts`
- Auto-intercept + retry logic: the core of `packages/core/src/pay.ts` — inspect this for improvements

### Clone & Attribution

```bash
git clone https://github.com/qntx/x402-openai-typescript.git
```

```
# Attribution: qntx/x402-openai-typescript (MIT)
# https://github.com/qntx/x402-openai-typescript
```

---

## Repo 15: TheGreatAxios/eip3009-forwarder

**URL:** https://github.com/TheGreatAxios/eip3009-forwarder  
**License:** Not specified  
**Language:** Solidity

### What It Does

EIP-3009 Wrapper Contracts and tests for driving x402 adoption on EVM. The `EIP3009Forwarder` contract enables meta-transactions for ERC-20 tokens that don't natively implement EIP-3009, allowing `transferWithAuthorization` via cryptographic signatures without gas fees.

### Most Reusable for agenti

- Test fixtures: EIP-3009 Solidity contracts and tests — useful for `packages/facilitator/contracts/` if we add contract testing
- Forwarder pattern: enables x402 for non-USDC ERC-20 tokens — relevant if agenti needs to support custom tokens

### Clone & Attribution

```bash
git clone https://github.com/TheGreatAxios/eip3009-forwarder.git
```

```
# Attribution: TheGreatAxios/eip3009-forwarder (license unspecified — verify before use)
# https://github.com/TheGreatAxios/eip3009-forwarder
```

---

## Repo 16: dabit3/a2a-x402-typescript

**URL:** https://github.com/dabit3/a2a-x402-typescript  
**License:** MIT (inferred)  
**Stars:** 101  
**Language:** TypeScript

### What It Does

Complete TypeScript implementation of x402 payment protocol for Agent-to-Agent (A2A) communication. Enables AI agents to request, verify, and settle crypto payments between each other.

### Most Reusable for agenti

- Agent-to-agent payment patterns: directly relevant to agenti's core use case
- A2A payment request/verify/settle lifecycle: reference for `packages/sdk/src/agent.ts`

### Clone & Attribution

```bash
git clone https://github.com/dabit3/a2a-x402-typescript.git
```

```
# Attribution: dabit3/a2a-x402-typescript (MIT)
# https://github.com/dabit3/a2a-x402-typescript
```

---

## Production Facilitators (Hosted — No Clone Needed)

| Facilitator | URL | Networks | Settlement Time |
|-------------|-----|----------|----------------|
| Coinbase CDP | `https://api.cdp.coinbase.com/platform/v1/x402/facilitator` | Base, Base Sepolia | ~2s |
| Cloudflare | TBD | Base, Ethereum | Instant/Deferred |
| Primev FastRPC | `https://facilitator.primev.xyz` | Ethereum mainnet | ~1.2s |
| ChaosChain | `https://facilitator.chaoscha.in` | Base, Ethereum | Decentralized |
| BNB Pieverse | TBD | BNB Chain | ~2s |

Use `https://api.cdp.coinbase.com/platform/v1/x402/facilitator` as the default for testnet dev and `https://facilitator.primev.xyz` for mainnet Ethereum.

---

## Summary: Most Reusable Pieces for agenti

### For `packages/facilitator/`

| Priority | Source | What to Take | Target File |
|----------|--------|-------------|-------------|
| P0 | `nirholas/x402-facilitator` | `/verify` + `/settle` routes, EIP-712 validation, rate limiting, gas monitoring | `src/routes.ts`, `src/verification.ts`, `src/settlement.ts` |
| P0 | `primev/mainnet-x402-facilitator` | Hono-based TypeScript facilitator server layout | `src/index.ts` |
| P0 | `coinbase/x402` examples/typescript/facilitator | Reference verify/settle endpoint implementation | `src/routes.ts` |
| P1 | `ChaosChain/chaoschain-x402` `http-bridge/` | Bun-native minimal facilitator, port 8402 convention | `src/index.ts` |
| P1 | `AceDataCloud/FacilitatorX402` | Nonce storage + replay protection (PostgreSQL pattern) | `src/nonces.ts` |
| P2 | `fortylabs/local-x402-facilitator` | `npx` invocation pattern for local dev | `scripts/dev.ts` |

### For `packages/core/src/pay.ts`

| Priority | Source | What to Take |
|----------|--------|-------------|
| P0 | `qntx/x402-openai-typescript` | Auto-intercept + sign + retry lifecycle |
| P0 | `coinbase/x402` `@x402/fetch` | fetch() wrapper with 402 handling |
| P1 | `coinbase/x402` `@x402/axios` | Axios interceptor pattern |
| P1 | `dabit3/x402-starter-kit` | EVM + Solana test client patterns |

### For `packages/mcp/`

| Priority | Source | What to Take |
|----------|--------|-------------|
| P0 | `microchipgnu/MCPay` | `withX402Client()`, `paidTool()`, `createMcpPaidHandler()` |
| P1 | `dabit3/a2a-x402-typescript` | A2A payment lifecycle patterns |

### For Server Middleware (Framework Adapters)

| Framework | Source | Notes |
|-----------|--------|-------|
| Express | `coinbase/x402` `@x402/express` | Official — single-line middleware |
| Hono | `coinbase/x402` `@x402/hono` | Official — also see primev Hono layout |
| Next.js | `coinbase/x402` `@x402/next` | App Router middleware |
| Axum (Rust) | `x402-rs/x402-rs` `x402-axum` | `with_price_tag()` API — adapt for TS |
| Fastify | Not found | Gap in ecosystem — build from Express pattern |
| Koa | Not found | Gap in ecosystem — build from Express pattern |

### For Test Suites

| Priority | Source | What to Take |
|----------|--------|-------------|
| P0 | `coinbase/x402` `e2e/` | Full 402 flow end-to-end tests |
| P0 | `dabit3/x402-starter-kit` | `npm run test` EVM + Solana patterns |
| P1 | `nirholas/x402-facilitator` `tests/` | Unit tests for facilitator routes |
| P1 | `TheGreatAxios/eip3009-forwarder` | Solidity EIP-3009 contract test fixtures |

### License Summary

| Repo | License | Safe for agenti? |
|------|---------|-----------------|
| coinbase/x402 | Apache-2.0 | Yes |
| x402-foundation/x402 | Apache-2.0 | Yes |
| nirholas/x402-facilitator | MIT | Yes |
| nirholas/x402-deploy | MIT | Yes |
| second-state/x402-facilitator | Apache-2.0 | Yes |
| x402-rs/x402-rs | Apache-2.0 | Yes |
| ChaosChain/chaoschain-x402 | MIT | Yes |
| dabit3/x402-starter-kit | MIT | Yes |
| microchipgnu/MCPay | Apache-2.0 | Yes |
| qntx/x402-openai-typescript | MIT | Yes |
| dabit3/a2a-x402-typescript | MIT | Yes |
| qntx/facilitator | FSL-1.1 → Apache-2.0 | Verify — may restrict commercial use |
| primev/mainnet-x402-facilitator | Unspecified | Verify before use |
| fortylabs/local-x402-facilitator | Unspecified | Verify before use |
| AceDataCloud/FacilitatorX402 | Unspecified | Verify before use |
| TheGreatAxios/eip3009-forwarder | Unspecified | Verify before use |

---

## Ecosystem Gaps (Build These in agenti)

1. **Fastify middleware** — not found anywhere in ecosystem
2. **Koa middleware** — not found anywhere in ecosystem  
3. **gRPC transport** — no implementations found
4. **Budget enforcement / circuit breaker** (open source) — only commercial products found (PaySentry, Paybound, PolicyLayer)
5. **Multi-wallet selector** — no open clean implementation; all are tied to specific wallet SDKs

---

## Additional Notable Ecosystem Repos

- **xpaysh/awesome-x402**: https://github.com/xpaysh/awesome-x402 — curated x402 resource list (179 stars)
- **Merit-Systems/x402scan**: https://github.com/Merit-Systems/x402scan — blockchain explorer for x402 payments (323 stars)
- **qntx/r402**: https://github.com/qntx/r402 — x402 Rust SDK (146 stars)
- **google-agentic-commerce/a2a-x402**: https://github.com/google-agentic-commerce/a2a-x402 — Google's A2A x402 extension
- **mark3labs/mcp-go-x402**: https://github.com/mark3labs/mcp-go-x402 — x402 transport for MCP-Go

Sources:
- [GitHub - coinbase/x402](https://github.com/coinbase/x402)
- [GitHub - xpaysh/awesome-x402](https://github.com/xpaysh/awesome-x402)
- [GitHub - x402-foundation/x402](https://github.com/x402-foundation/x402)
- [GitHub - x402-rs/x402-rs](https://github.com/x402-rs/x402-rs)
- [GitHub - second-state/x402-facilitator](https://github.com/second-state/x402-facilitator)
- [GitHub - primev/mainnet-x402-facilitator](https://github.com/primev/mainnet-x402-facilitator)
- [GitHub - ChaosChain/chaoschain-x402](https://github.com/ChaosChain/chaoschain-x402)
- [GitHub - fortylabs/local-x402-facilitator](https://github.com/fortylabs/local-x402-facilitator)
- [GitHub - dabit3/x402-starter-kit](https://github.com/dabit3/x402-starter-kit)
- [GitHub - microchipgnu/MCPay](https://github.com/microchipgnu/MCPay)
- [GitHub - qntx/facilitator](https://github.com/qntx/facilitator)
- [GitHub - qntx/x402-openai-typescript](https://github.com/qntx/x402-openai-typescript)
- [GitHub - nirholas/x402-facilitator](https://github.com/nirholas/x402-facilitator)
- [GitHub - nirholas/x402-deploy](https://github.com/nirholas/x402-deploy)
- [GitHub - AceDataCloud/FacilitatorX402](https://github.com/AceDataCloud/FacilitatorX402)
- [GitHub - TheGreatAxios/eip3009-forwarder](https://github.com/TheGreatAxios/eip3009-forwarder)
- [GitHub - dabit3/a2a-x402-typescript](https://github.com/dabit3/a2a-x402-typescript)
- [GitHub Topics - x402](https://github.com/topics/x402)
