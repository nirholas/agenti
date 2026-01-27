# x402 Ecosystem Integration Guides

This directory contains integration guides for connecting x402 payments to various repositories in the nirholas ecosystem.

## 📚 Guides

### MCP Registry Servers

| Guide | Registry ID | Description |
|-------|-------------|-------------|
| [abi-to-mcp](./abi-to-mcp.md) | `io.github.nirholas/abi-to-mcp` | Premium ABI conversions, complex contracts |
| [crypto-market-data](./crypto-market-data.md) | `io.github.nirholas/crypto-market-data` | Pay-per-query premium data tiers |
| [crypto-tools-registry](./crypto-tools-registry.md) | `io.github.nirholas/crypto-tools-registry` | Featured listings, marketplace sync |
| [defi-agents](./defi-agents.md) | `io.github.nirholas/defi-agents` | Payment-capable agent definitions |
| [ethereum-wallet-mcp](./ethereum-wallet-mcp.md) | `io.github.nirholas/ethereum-wallet-mcp` | Vanity addresses, bulk generation |
| [extract-llms-docs](./extract-llms-docs.md) | `io.github.nirholas/extract-llms-docs` | Bulk extraction, recurring updates |
| [free-crypto-news](./free-crypto-news.md) | `io.github.nirholas/free-crypto-news` | Premium news tier with paywall |
| [github-to-mcp](./github-to-mcp.md) | `io.github.nirholas/github-to-mcp` | Premium conversions, private repos |
| [keystore-mcp-server](./keystore-mcp-server.md) | `io.github.nirholas/keystore-mcp-server` | HSM integration, audit logging |
| [mcp-notify](./mcp-notify.md) | `io.github.nirholas/mcp-notify` | Premium alerts, webhooks |
| [repo-intel](./repo-intel.md) | `io.github.nirholas/repo-intel` | Security audits, continuous monitoring |
| [signing-mcp-server](./signing-mcp-server.md) | `io.github.nirholas/signing-mcp-server` | Per-signature fees, batch signing |
| [solidity-compiler](./solidity-compiler.md) | `io.github.nirholas/solidity-compiler` | Optimization, security scans |
| [sperax-crypto-mcp](./sperax-crypto-mcp.md) | `io.github.nirholas/sperax-crypto-mcp` | ⭐ Native USDs yield integration |
| [tool-discovery-mcp](./tool-discovery-mcp.md) | `io.github.nirholas/tool-discovery-mcp` | AI recommendations, batch discovery |
| [transaction-mcp-server](./transaction-mcp-server.md) | `io.github.nirholas/transaction-mcp-server` | Batch txs, Flashbots, gas optimization |
| [validation-mcp-server](./validation-mcp-server.md) | `io.github.nirholas/validation-mcp-server` | Bulk validation, ENS resolution |

### Other Ecosystem Repos

| Guide | Repository | Description |
|-------|-----------|-------------|
| [AI-Agents-Library](./ai-agents-library.md) | nirholas/AI-Agents-Library | Payment-capable agent templates |
| [plugin.delivery](./plugin-delivery.md) | nirholas/plugin.delivery | x402 pricing for plugin marketplace |
| [lyra-registry](./lyra-registry.md) | nirholas/lyra-registry | Tool pricing with registry |

## 🎯 Integration Priority

1. **Tier 1: Core Infrastructure** (Week 1)
   - universal-crypto-mcp ✅ (this repo)
   - x402-stablecoin (already built)
   - x402-ecosystem package ✅

2. **Tier 2: Agent Layer** (Week 2)
   - defi-agents
   - AI-Agents-Library

3. **Tier 3: Distribution** (Week 3)
   - plugin.delivery
   - lyra-registry

4. **Tier 4: Content Monetization** (Week 4)
   - free-crypto-news
   - Other content APIs

## 🔧 Common Integration Pattern

All integrations follow a similar pattern:

```typescript
import { PayableAgent, registerX402Ecosystem } from "@nirholas/x402-ecosystem";

// 1. Create or extend with payment capabilities
const agent = new PayableAgent({
  privateKey: process.env.X402_PRIVATE_KEY,
  maxDailySpend: "10.00",
});

// 2. Register x402 tools with your MCP server
registerX402Ecosystem(server, {
  enableMarketplace: true,
  enableYield: true,
});

// 3. Use payment methods in your existing code
const result = await agent.payForService(endpoint);
```

## 📦 Required Dependencies

```bash
npm install @nirholas/x402-ecosystem @nirholas/universal-crypto-mcp
```

## 🔗 Links

- [x402-ecosystem package](../../packages/x402-ecosystem/)
- [x402 MCP tools](../../src/x402/)
- [x402-stablecoin repository](https://github.com/nirholas/x402-stablecoin)
