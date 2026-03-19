# Universal Crypto MCP Package

`packages/tools/universal-crypto-mcp` - A streamlined MCP server with the most commonly used crypto tools.

## Overview

Universal Crypto MCP is a curated subset of Agenti's tools optimized for general-purpose AI agent crypto interactions. It includes the essential tools without the full 380+ tool set, reducing complexity for simpler use cases.

## Included Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| Prices | 5 | Current and historical pricing |
| Balances | 4 | Multi-chain balance checking |
| Transfers | 3 | Token and native transfers |
| Swaps | 2 | DEX swap execution |
| Staking | 2 | Liquid staking operations |
| Analytics | 3 | Basic market analytics |
| Security | 2 | Token security checks |

## Quick Start

```bash
npx @nirholas/universal-crypto-mcp
```

### Claude Desktop

```json
{
  "mcpServers": {
    "crypto": {
      "command": "npx",
      "args": ["@nirholas/universal-crypto-mcp"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## When to Use This vs Agenti

| Use Case | Recommended |
|----------|-------------|
| General crypto AI assistant | Universal Crypto MCP |
| Full DeFi automation | Agenti |
| Simple balance/price checks | Universal Crypto MCP |
| Advanced trading strategies | Agenti |
| x402 payment integration | Agenti |
| Lightweight deployment | Universal Crypto MCP |

## Supported Chains

- Ethereum
- Polygon
- Arbitrum
- Optimism
- Base
- BNB Chain
- Solana

## Configuration

Same environment variables as Agenti - see [Environment Variables](../guides/environment-variables.md).

## Extending

If you need additional tools beyond what Universal Crypto MCP provides, switch to the full Agenti server. All tools are backward-compatible.
