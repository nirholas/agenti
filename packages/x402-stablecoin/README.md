# X402 Payment Protocol with Sperax USDs

[![CI](https://github.com/nirholas/x402/actions/workflows/ci.yml/badge.svg)](https://github.com/nirholas/x402/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Arbitrum](https://img.shields.io/badge/Network-Arbitrum-blue)](https://arbitrum.io/)

> **Revolutionary AI Agent Payment Infrastructure** — HTTP 402 payments with yield-bearing USDs stablecoin on Arbitrum

## 🌟 Overview

X402 is a complete payment protocol implementation for AI agents, combining:

- **[HTTP 402](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402)** - Payment Required standard for programmatic payments
- **[Sperax USDs](https://sperax.io/)** - Auto-yield stablecoin (8-25% APY) on Arbitrum
- **[EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)** - Gasless transfer authorization
- **[Arbitrum L2](https://arbitrum.io/)** - Low-cost, fast transactions

## 💡 Why X402 + USDs?

| Feature | Traditional Payments | X402 + USDs |
|---------|---------------------|-------------|
| **Fees** | 2-3% + fixed | ~$0.001 gas |
| **Settlement** | Days | Seconds |
| **Yield** | 0% | 8-25% APY |
| **AI Native** | ❌ | ✅ |
| **Gasless** | ❌ | ✅ (EIP-3009) |
| **Micropayments** | ❌ | ✅ |

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@x402/sdk` | Core SDK for X402 payments |
| `@x402/cli` | Command-line interface |
| `@x402/sperax-mcp` | MCP tools for AI agents |
| `facilitator` | Payment verification server |
| `yield-tracker` | USDs yield monitoring |
| `contracts` | Solidity smart contracts |

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/nirholas/x402.git
cd x402

# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Start the facilitator server
pnpm facilitator:dev

# In another terminal, start yield tracker
pnpm yield-tracker
```

## 💰 Make a Payment

### Using the SDK

```typescript
import { X402Client } from '@x402/sdk';

const client = new X402Client({
  network: 'arbitrum',
  facilitatorUrl: 'http://localhost:3002'
});

// Gasless payment with EIP-3009
const { txHash } = await client.pay({
  recipient: '0x...',
  amount: '1.50',  // $1.50 USDs
  token: 'USDs',
  gasless: true
});

console.log('Payment confirmed:', txHash);
```

### Using MCP Tools (AI Agents)

```json
{
  "tool": "x402_pay_with_usds",
  "arguments": {
    "recipient": "0x...",
    "amount": "1.50",
    "gasless": true,
    "memo": "API call payment"
  }
}
```

## 📈 Earn Yield on Payments Received

USDs automatically earns yield while sitting in your wallet:

```typescript
import { SperaxClient } from '@x402/sdk';

const client = new SperaxClient({ network: 'arbitrum' });

// Check balance with yield earned
const { balance, yieldEarned, apy } = await client.getBalanceWithYield(address);

console.log(`Balance: $${balance}`);
console.log(`Yield Earned: $${yieldEarned}`);
console.log(`Current APY: ${apy}%`);
```

## 🔧 Architecture

```
┌─────────────┐     HTTP 402      ┌─────────────────┐
│   AI Agent  │ ◄─────────────────│   API Server    │
│   (Payer)   │                   │   (Paywall)     │
└──────┬──────┘                   └────────┬────────┘
       │                                   │
       │ EIP-3009 Auth                     │ Verify
       ▼                                   ▼
┌─────────────────────────────────────────────────────┐
│                 Facilitator Server                   │
│  • Verify payment authorizations                     │
│  • Submit transactions                               │
│  • Track yields                                      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │   Arbitrum Network      │
         │  ┌───────────────────┐  │
         │  │   USDs Token      │  │
         │  │   (Auto-Yield)    │  │
         │  └───────────────────┘  │
         └─────────────────────────┘
```

## 🎯 Use Cases

### 1. AI Agent Tool Marketplace
Pay per API call with micropayments. No subscriptions, no minimums.

### 2. Content Monetization
Paywall articles, videos, or data with instant USDs payments.

### 3. Revenue Splitting
Automatic 80/20 split between developers and platforms.

### 4. Subscription Streaming
Pay-as-you-go subscriptions that auto-renew with yield earnings.

## 📋 Contract Addresses

### Arbitrum Mainnet

| Contract | Address |
|----------|---------|
| USDs Token | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| Sperax Vault | `0x8EC1877698ACF262Fe8Ad8a295ad94D6ea258988` |
| Revenue Splitter | *Deploy your own* |

### Arbitrum Sepolia (Testnet)

| Contract | Address |
|----------|---------|
| USDs Token | *See deployment docs* |

## 🛠️ Development

```bash
# Run all tests
pnpm test

# Run contract tests
pnpm contracts:test

# Build all packages
pnpm build

# Format code
pnpm format

# Lint
pnpm lint
```

## 📚 Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Smart Contracts](./docs/contracts.md)
- [MCP Integration](./docs/mcp-integration.md)
- [Sperax USDs Docs](./sperax-llms-full.md)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with ❤️ for the AI economy**

*X402 is not affiliated with Sperax or Coinbase. USDs is a product of Sperax Foundation.*
