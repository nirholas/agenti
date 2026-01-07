# Universal Crypto MCP

> **A Universal Model Context Protocol server for all EVM-compatible networks.**

Enable AI agents to interact with any EVM blockchain through natural language. Supports BSC, opBNB, Arbitrum, Ethereum, Polygon, Base, Optimism, and more.

**Supported Networks:**

- **BNB Smart Chain (BSC)**
- **opBNB** - Layer 2 for BNB Chain
- **Arbitrum One**
- **Ethereum**
- **Polygon**
- **Base**
- **Optimism**
- **+ All testnets**

---

## 📚 Documentation Sections

<div class="grid cards" markdown>

-   :material-robot:{ .lg .middle } **MCP Server**

    ---

    Tools, resources, and setup for AI agents

    [:octicons-arrow-right-24: MCP Documentation](mcp-server/index.md)

-   :material-swap-horizontal:{ .lg .middle } **Swap/DEX**

    ---

    Token swaps via DEX aggregators

    [:octicons-arrow-right-24: Swap Tools](mcp-server/tools.md)

-   :material-bridge:{ .lg .middle } **Bridge**

    ---

    Cross-chain transfers

    [:octicons-arrow-right-24: Bridge Tools](mcp-server/tools.md)

-   :material-shield-check:{ .lg .middle } **Security**

    ---

    Token safety & contract verification

    [:octicons-arrow-right-24: Security Tools](mcp-server/tools.md)

</div>

---

## Features

🔄 **Swap/DEX** - Get quotes and execute swaps via 1inch, 0x, ParaSwap

🌉 **Bridge** - Cross-chain transfers via LayerZero, Stargate, Wormhole

⛽ **Gas** - Gas prices across chains, EIP-1559 suggestions

📦 **Multicall** - Batch read/write operations

📊 **Events/Logs** - Query historical events, decode logs

🔒 **Security** - Token honeypot check, contract verification

💰 **Staking** - Liquid staking, validator info

✍️ **Signatures** - Sign messages, verify signatures, EIP-712

🏦 **Lending** - Aave/Compound positions, borrow rates

📈 **Price Feeds** - Historical prices, TWAP, oracle aggregation

📁 **Portfolio** - Track holdings across chains

🏛️ **Governance** - Snapshot votes, on-chain proposals

---

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

### Cursor

Add to your MCP settings:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## Links

- 🐦 [Twitter](https://x.com/nichxbt)
- 💻 [GitHub](https://github.com/nirholas/universal-crypto-mcp)

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([:material-github: nirholas](https://github.com/nirholas))

**Related Projects:**

- [sperax-crypto-mcp](https://github.com/nirholas/sperax-crypto-mcp) - Sperax Protocol MCP
