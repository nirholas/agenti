# Sperax MCP Server - Code Examples & Tutorials

> 📚 Comprehensive examples and tutorials for integrating with the Sperax MCP Server

This directory contains production-ready code examples and step-by-step tutorials for developers building on the Sperax Protocol using the Model Context Protocol (MCP) server.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Examples Overview](#examples-overview)
- [Prerequisites](#prerequisites)
- [Running Examples](#running-examples)
- [Tutorials](#tutorials)
- [Contributing](#contributing)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/nirholas/sperax-crypto-mcp.git
cd sperax-crypto-mcp

# Install dependencies
pnpm install

# Navigate to examples
cd examples

# Run your first example
npx ts-node basic/usds-balance-checker.ts
```

## 📂 Examples Overview

### Basic Examples (Beginner)
| Example | Description | Difficulty | Est. Time |
|---------|-------------|------------|-----------|
| [usds-balance-checker.ts](./basic/usds-balance-checker.ts) | Check USDs balance and rebase status | ⭐ Beginner | 5 min |
| [farm-finder.ts](./basic/farm-finder.ts) | Find highest APR Demeter farms | ⭐ Beginner | 10 min |
| [protocol-health.ts](./basic/protocol-health.ts) | Get protocol health dashboard | ⭐ Beginner | 10 min |

### Intermediate Examples
| Example | Description | Difficulty | Est. Time |
|---------|-------------|------------|-----------|
| [portfolio-analyzer.ts](./intermediate/portfolio-analyzer.ts) | Analyze complete Sperax portfolio | ⭐⭐ Intermediate | 20 min |
| [yield-comparator.ts](./intermediate/yield-comparator.ts) | Compare yields across products | ⭐⭐ Intermediate | 15 min |
| [governance-tracker.ts](./intermediate/governance-tracker.ts) | Track governance activity | ⭐⭐ Intermediate | 15 min |

### Advanced Examples
| Example | Description | Difficulty | Est. Time |
|---------|-------------|------------|-----------|
| [autonomous-agent.ts](./advanced/autonomous-agent.ts) | Autonomous DeFi monitoring agent | ⭐⭐⭐ Advanced | 45 min |
| [multi-chain-tracker.ts](./advanced/multi-chain-tracker.ts) | Track Sperax across chains | ⭐⭐⭐ Advanced | 30 min |
| [webhook-integration.ts](./advanced/webhook-integration.ts) | HTTP server with webhooks | ⭐⭐⭐ Advanced | 40 min |

### Integration Examples
| Example | Description | Language | Difficulty |
|---------|-------------|----------|------------|
| [langchain-agent.py](./integrations/langchain-agent.py) | LangChain agent integration | Python | ⭐⭐ Intermediate |
| [autogpt-plugin/](./integrations/autogpt-plugin/) | Complete AutoGPT plugin | Python | ⭐⭐⭐ Advanced |
| [discord-bot.ts](./integrations/discord-bot.ts) | Discord bot for Sperax queries | TypeScript | ⭐⭐⭐ Advanced |

## 📋 Prerequisites

### For TypeScript Examples

- **Node.js** 18.0.0 or higher
- **pnpm** (recommended) or npm
- **TypeScript** 5.0 or higher

```bash
# Verify Node.js version
node --version  # Should be >= 18.0.0

# Install pnpm if needed
npm install -g pnpm
```

### For Python Examples

- **Python** 3.9 or higher
- **pip** or **poetry**

```bash
# Verify Python version
python --version  # Should be >= 3.9

# Install dependencies
pip install -r requirements.txt
```

### Environment Setup

Create a `.env` file in the examples directory:

```bash
# Required for all examples
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Optional: For enhanced functionality
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key

# For Discord bot example
DISCORD_BOT_TOKEN=your_discord_token

# For webhook example
WEBHOOK_SECRET=your_webhook_secret
```

## 🏃 Running Examples

### TypeScript Examples

```bash
# Using ts-node (development)
npx ts-node basic/usds-balance-checker.ts

# Or build and run
pnpm build
node dist/basic/usds-balance-checker.js

# Run with custom address
ADDRESS=0xYourAddress npx ts-node basic/usds-balance-checker.ts
```

### Python Examples

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run example
python integrations/langchain-agent.py
```

## 📖 Tutorials

Comprehensive step-by-step guides for building with the Sperax MCP Server:

| Tutorial | Description | Difficulty | Est. Time |
|----------|-------------|------------|-----------|
| [01 - Getting Started](./tutorials/01-getting-started.md) | First steps with MCP server | ⭐ Beginner | 30 min |
| [02 - Portfolio Dashboard](./tutorials/02-building-portfolio-dashboard.md) | Build a portfolio dashboard | ⭐⭐ Intermediate | 2 hours |
| [03 - Yield Optimizer](./tutorials/03-creating-yield-optimizer.md) | Create a yield optimization bot | ⭐⭐⭐ Advanced | 3 hours |
| [04 - Governance Guide](./tutorials/04-governance-participation-guide.md) | Governance integration | ⭐⭐ Intermediate | 1.5 hours |
| [05 - Multi-Agent System](./tutorials/05-multi-agent-system.md) | Build multi-agent architecture | ⭐⭐⭐ Advanced | 4 hours |

## 🛠 Tool Categories Reference

The Sperax MCP Server provides 85 tools across 16 categories:

### Protocol Tools (67 tools)

| Category | Tools | Description |
|----------|-------|-------------|
| USDs | 7 | Stablecoin operations (balance, mint, redeem, yield) |
| SPA | 8 | Token operations and staking |
| Demeter | 7 | Yield farming operations |
| Vault | 10 | Collateral and strategy management |
| Dripper | 5 | Yield distribution |
| Oracle | 5 | Price feeds and data |
| Analytics | 6 | Protocol metrics and TVL |
| Governance | 5 | DAO operations and voting |
| YieldReserve | 4 | Yield collection and distribution |
| Portfolio | 2 | User position aggregation |
| Subgraph | 5 | Historical data queries |
| Supply | 3 | Circulating supply data |
| Swap | 3 | DEX routing and quotes |

### Ecosystem Tools (18 tools)

| Category | Tools | Description |
|----------|-------|-------------|
| Agents | 5 | DeFi AI agent definitions |
| Plugins | 6 | SperaxOS plugin marketplace |
| News | 7 | Crypto news aggregation |

## 🧪 Testing Examples

Each example includes built-in tests:

```bash
# Run all example tests
pnpm test

# Run specific example tests
pnpm test basic/usds-balance-checker.test.ts

# Run with coverage
pnpm test --coverage
```

## 📝 Code Standards

All examples follow these standards:

- ✅ Full TypeScript/Python with complete imports
- ✅ Comprehensive JSDoc/docstrings
- ✅ Error handling with try/catch
- ✅ Input validation
- ✅ Formatted output
- ✅ Environment variable support
- ✅ Testable structure
- ✅ Comments explaining the "why"

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

### Adding New Examples

1. Create your example in the appropriate directory
2. Follow the code standards above
3. Add tests for your example
4. Update this README with your example
5. Submit a pull request

## 📜 License

MIT License - see [LICENSE](../LICENSE) for details.

## 🔗 Resources

- [Sperax MCP Server Documentation](../docs/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Sperax Protocol Docs](https://docs.sperax.io/)
- [Arbitrum Developer Docs](https://docs.arbitrum.io/)

---

Built with ❤️ by the Sperax Community
