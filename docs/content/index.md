# Universal Crypto MCP

<p align="center">
  <strong>🚀 330+ blockchain tools for AI agents</strong><br>
  Connect Claude, ChatGPT, and Cursor to 15+ EVM chains
</p>

<p align="center">
  <a href="https://github.com/nirholas/universal-crypto-mcp">GitHub</a> •
  <a href="mcp-server/quickstart.md">Quick Start</a> •
  <a href="tutorials/index.md">Tutorials</a> •
  <a href="prompts/index.md">Prompts</a>
</p>

---

## What is Universal Crypto MCP?

Universal Crypto MCP is an open-source [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants interact with blockchain networks through natural language.

**Instead of:**
- Switching between 10 block explorers
- Connecting to multiple dApps
- Manual copy-pasting addresses

**Just ask:**
> "Check my portfolio across all chains"
> "Swap 1 ETH to USDC on Arbitrum"
> "Is this token safe to buy?"

---

## Supported Networks

<div class="grid" markdown>

| Layer 1 | Layer 2 | Alt Chains |
|---------|---------|------------|
| Ethereum | Arbitrum One | Solana |
| BNB Chain | Base | TON |
| Avalanche | Optimism | XRP Ledger |
| Fantom | Polygon | |
| | zkSync Era | |
| | Linea | |
| | Scroll | |
| | Blast | |
| | Mode | |
| | Mantle | |
| | opBNB | |

</div>

---

## Key Features

<div class="grid cards" markdown>

-   :material-swap-horizontal:{ .lg .middle } **DeFi Operations**

    ---

    Swaps via 1inch, ParaSwap • Lending on Aave, Compound • Staking • Yield farming

    [:octicons-arrow-right-24: DeFi Tools](mcp-server/tools.md)

-   :material-bridge:{ .lg .middle } **Cross-Chain**

    ---

    Bridge quotes • Multi-hop routing • 15+ chain support

    [:octicons-arrow-right-24: Bridge Tools](mcp-server/tools.md)

-   :material-shield-check:{ .lg .middle } **Security**

    ---

    Honeypot detection • Rug pull scanning • Contract analysis

    [:octicons-arrow-right-24: Security Tools](mcp-server/tools.md)

-   :material-chart-line:{ .lg .middle } **Market Data**

    ---

    Prices • Technical indicators • Fear & Greed • Sentiment

    [:octicons-arrow-right-24: Market Tools](mcp-server/tools.md)

</div>

---

## Quick Start

### 1. Clone & Build

```bash
git clone https://github.com/nirholas/universal-crypto-mcp.git
cd universal-crypto-mcp
npm install && npm run build
```

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "node",
      "args": ["/path/to/universal-crypto-mcp/dist/index.js"],
      "env": {
        "ALCHEMY_API_KEY": "your_key"
      }
    }
  }
}
```

### 3. Start Chatting!

```
"What's my ETH balance on Arbitrum?"
"Get a swap quote for 100 USDC to ETH on Base"
"Scan this token for security risks: 0x..."
```

[:octicons-arrow-right-24: Full Setup Guide](mcp-server/quickstart.md)

---

## Example Prompts

| Category | Prompt |
|----------|--------|
| **Portfolio** | "Check my wallet balance across all chains" |
| **Trading** | "Swap 1 ETH to USDC on Arbitrum with 0.5% slippage" |
| **DeFi** | "What's my Aave health factor on Ethereum?" |
| **Security** | "Is this token a honeypot? 0x1234..." |
| **Research** | "Compare USDC lending rates across Aave and Compound" |
| **Bridges** | "Best route to bridge 100 USDC from Ethereum to Base" |

[:octicons-arrow-right-24: 100+ Example Prompts](prompts/index.md)

---

## Documentation

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Tutorials**

    ---

    Step-by-step guides for common workflows

    [:octicons-arrow-right-24: View Tutorials](tutorials/index.md)

-   :material-book-open-variant:{ .lg .middle } **API Reference**

    ---

    Complete tool documentation

    [:octicons-arrow-right-24: API Docs](mcp-server/tools-complete.md)

-   :material-cog:{ .lg .middle } **Configuration**

    ---

    Environment variables and setup

    [:octicons-arrow-right-24: Config Guide](mcp-server/configuration.md)

-   :material-frequently-asked-questions:{ .lg .middle } **FAQ**

    ---

    Common questions answered

    [:octicons-arrow-right-24: FAQ](faq.md)

</div>

---

## Why Universal Crypto MCP?

| Feature | Universal Crypto MCP | Others |
|---------|---------------------|--------|
| Chains | **15+** | 3-5 |
| Tools | **330+** | 20-50 |
| DeFi | ✅ Full stack | Limited |
| Security | ✅ Built-in | ❌ |
| Open Source | ✅ Apache 2.0 | Varies |

[:octicons-arrow-right-24: Full Comparison](comparison.md)

---

## Community

- 🐦 **Twitter:** [@nichxbt](https://x.com/nichxbt)
- 💻 **GitHub:** [nirholas/universal-crypto-mcp](https://github.com/nirholas/universal-crypto-mcp)
- ⭐ **Star the repo** if you find it useful!

---

## License

Apache 2.0 - Free for personal and commercial use.

Built by **[Nich](https://x.com/nichxbt)** • [:material-github: nirholas](https://github.com/nirholas)
