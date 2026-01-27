# Sperax MCP Server

> **A Model Context Protocol server that supports Arbitrum, BSC, opBNB, and other popular EVM-compatible networks.**

Enable AI agents to interact with USDs (auto-yield stablecoin), SPA governance, veSPA staking, Demeter yield farms, and general blockchain operations.

**Supported Networks:**

- **Arbitrum One** - USDs, Vault, veSPA, Demeter
- **BNB Smart Chain (BSC)** - Sperax protocol, SPA token
- **opBNB** - Layer 2 for BNB Chain
- **Other EVM networks** - Ethereum, Polygon, Base, etc.

---

## 📚 Documentation Sections

<div class="grid cards" markdown>

-   :material-robot:{ .lg .middle } **MCP Server**

    ---

    Tools, resources, and setup for AI agents

    [:octicons-arrow-right-24: MCP Documentation](index.md)

-   :material-bank:{ .lg .middle } **Protocol**

    ---

    USDs, Vault, Staking, Farms technical docs

    [:octicons-arrow-right-24: Protocol Docs](protocol/index.md)

-   :material-file-code:{ .lg .middle } **Contracts**

    ---

    Smart contract ABIs and addresses

    [:octicons-arrow-right-24: Contract Docs](contracts/index.md)

</div>

---

## Features

🪙 **USDs Stablecoin** - Query balances, yields, rebase mechanics, mint/redeem simulations

⚡ **Auto-Yield** - 5%+ APY distributed automatically via daily rebase

🗳️ **veSPA Governance** - Vote-escrowed staking with 7-day to 4-year locks

🌾 **Demeter Farms** - Discover and analyze yield farming opportunities

🏛️ **Vault System** - Collateral management and yield strategies

💰 **Yield Reserve** - Yield collection and distribution to USDs holders

🔮 **Oracle Integration** - Chainlink price feeds and monitoring

---

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sperax": {
      "command": "npx",
      "args": ["-y", "@sperax/mcp-server"]
    }
  }
}
```

### Cursor / VSCode

Add to MCP settings:

```json
{
  "mcp.servers": {
    "sperax": {
      "command": "npx",
      "args": ["-y", "@sperax/mcp-server"]
    }
  }
}
```

## Available Tools

| Category | Tools | Description |
|----------|-------|-------------|
| USDs Stablecoin | 7 | Balance, yield, rebase, mint/redeem params |
| Vault & Collateral | 10 | TVL, strategies, allocations, simulations |
| SPA & Staking | 8 | Token info, veSPA positions, xSPA redemption |
| Demeter Farms | 7 | Farm discovery, APR, positions, rewards |
| Dripper | 5 | Rebase timing, earnings projections |
| Oracle | 5 | Price feeds, staleness, deviation |
| Analytics | 6 | TVL, revenue, APY history, health scores |
| Governance | 5 | Proposals, voting power, delegates |
| Yield Reserve | 4 | Swap quotes, token permissions, flow |

## Key Formulas

### veSPA Voting Power
```
veSPA = SPA × (lockDays / 365)
```
Lock 1000 SPA for 4 years → Get 4000 veSPA

### xSPA Redemption
```
SPA_out = xSPA × (vestingDays + 150) / 330
```
- 15 days → 50% SPA
- 180 days → 100% SPA

### USDs Rebase
Your balance automatically increases daily based on protocol yield. No claiming required!

## Contract Addresses (Arbitrum One)

| Contract | Address |
|----------|---------|
| USDs | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` |
| SPA | `0x5575552988A3A80504bBaeB1311674fCFd40aD4B` |
| veSPA | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` |
| xSPA | `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` |
| Vault | `0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca` |
| Demeter Registry | `0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0` |

## Documentation

### MCP Server

- [Overview](index.md) - Installation & setup
- [Tools Reference](mcp-server/tools.md) - Core Sperax tools
- [Extended Tools](mcp-server/tools-extended.md) - Portfolio, Agents, News, Plugins
- [EVM Module](mcp-server/evm-module.md) - General blockchain tools
- [Resources & Prompts](mcp-server/resources-prompts.md) - AI resources
- [Development Guide](mcp-server/development.md) - Contributing

### Protocol

- [Protocol Overview](protocol/overview.md) - How Sperax works
- [USDs Token](protocol/usds-token.md) - Auto-yield stablecoin
- [Vault Core](protocol/vault-core.md) - Collateral management
- [Collateral Manager](protocol/collateral-manager.md) - Collateral params
- [Strategies](protocol/strategies.md) - Yield strategies
- [Rebase Dripper](protocol/rebase-dripper.md) - Yield distribution
- [Oracles](protocol/oracles.md) - Price feeds
- [SPA Buyback](protocol/spa-buyback.md) - Token buyback
- [SPA Staking](protocol/spa-staking.md) - veSPA/xSPA
- [Demeter Farms](protocol/demeter-farms.md) - Yield farming
- [Rewarder](protocol/rewarder.md) - Farm rewards
- [Addresses](protocol/addresses.md) - Contract addresses
- [Errors & Events](protocol/errors-events.md) - Reference

### Contracts

- [Contract Overview](contracts/index.md) - Contract summary
- [ABIs](contracts/abis.md) - Contract interfaces

## Links

- 🌐 [Sperax Website](https://sperax.io)
- 📖 [Protocol Documentation](https://docs.sperax.io)
- 🐦 [Twitter](https://twitter.com/SperaxUSD)
- 💬 [Discord](https://discord.gg/sperax)
- 📊 [DeFiLlama](https://defillama.com/protocol/sperax)

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([:material-github: nirholas](https://github.com/nirholas))

**Related Projects:**

- [universal-crypto-mcp](https://github.com/nirholas/universal-crypto-mcp) - Universal EVM MCP for all chains
- [sperax-crypto-mcp](https://github.com/nirholas/sperax-crypto-mcp) - Sperax Protocol MCP
