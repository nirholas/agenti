<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/sweep-banner.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/assets/sweep-banner-light.svg">
    <img src="docs/assets/sweep-banner.svg" alt="Sweep" width="800"/>
  </picture>
</p>

<p align="center">
  <strong>Multi-chain dust sweeper that consolidates small token balances into DeFi yield positions.</strong>
</p>

<p align="center">
  <a href="https://github.com/nirholas/sweep/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-000?style=flat-square&labelColor=000" alt="License"></a>
  <a href="https://github.com/nirholas/sweep"><img src="https://img.shields.io/badge/PRs-Welcome-000?style=flat-square&labelColor=000" alt="PRs Welcome"></a>
  <img src="https://img.shields.io/badge/Chains-8-000?style=flat-square&labelColor=000" alt="8 Chains">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> · 
  <a href="#features">Features</a> · 
  <a href="docs/">Docs</a> · 
  <a href="#contributing">Contributing</a>
</p>

<br/>

<p align="center">
  <code>TypeScript</code> · <code>Solidity</code> · <code>Next.js 14</code> · <code>Foundry</code> · <code>Hono</code>
</p>

---

## Problem

Crypto users accumulate "dust" — small token balances worth $0.50-$10 that are economically impractical to move because gas fees exceed the token value.

```
Wallet Analysis
───────────────────────────────────────────
  Ethereum    $3.20 SHIB, $2.10 PEPE    ✗ no ETH for gas
  Base        $5.40 memecoins          ✗ no ETH for gas
  Arbitrum    $4.80 ARB dust           ✗ no ETH for gas
  Solana      $8.50 memecoins          ✗ no SOL for gas
───────────────────────────────────────────
  Total Trapped Value: $24.00
```

## Solution

Sweep consolidates dust across chains, pays gas with tokens you have, and routes everything into DeFi yield.

**Features**

| | |
|---|---|
| Multi-Chain | Ethereum · Base · Arbitrum · Polygon · BSC · Linea · Optimism · Solana |
| Gasless | Pay gas with any ERC-20 via ERC-4337 account abstraction |
| DeFi Yield | Route to Aave · Yearn · Beefy · Lido · Jito |
| Cross-Chain | Consolidate from all chains to one destination |
| MEV Protected | CoW Protocol batch auctions |

## Structure

```
sweep/
├── contracts/     Solidity (Foundry)
├── src/           Backend API (Hono)
├── frontend/      Next.js 14
├── docs/          Documentation
└── tests/         Test suites
```

## Quick Start

**Prerequisites:** Node.js 20+, Docker, Foundry

```bash
git clone https://github.com/nirholas/sweep.git && cd sweep
cp .env.example .env        # Configure your keys
docker-compose up -d        # Start Postgres + Redis
npm install && npm run db:migrate && npm run dev
```

**Contracts**

```bash
cd contracts && forge install && forge build && forge test
```

**Frontend**

```bash
cd frontend && npm install && npm run dev
```

## Docs

| | |
|---|---|
| [Architecture](./docs/architecture/SYSTEM_ARCHITECTURE.md) | System design |
| [API Reference](./docs/API.md) | REST endpoints |
| [OpenAPI Spec](./docs/openapi.yaml) | OpenAPI 3.1 |
| [Contracts](./docs/CONTRACTS.md) | Smart contracts |
| [Security](./docs/SECURITY.md) | Security policy |

## Tech Stack

| | |
|---|---|
| Contracts | Solidity · Foundry · OpenZeppelin |
| Backend | Node.js · Hono · BullMQ · Drizzle |
| Frontend | Next.js 14 · wagmi · viem · Tailwind |
| Infra | PostgreSQL · Redis · Docker · K8s |
| AA | ERC-4337 · Pimlico · Coinbase Smart Wallet |
| DEX | 1inch · Jupiter · Li.Fi · CoW Protocol |
| DeFi | Aave V3 · Yearn V3 · Beefy · Lido |

## Contributing

```
fork → branch → commit → push → PR
```

## License

Apache 2.0 — see [LICENSE](./LICENSE)