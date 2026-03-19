# Agenti

<p align="center">
  <strong>380+ blockchain tools for AI agents</strong><br>
  Connect Claude, ChatGPT, and Cursor to 20+ chains
</p>

<p align="center">
  <a href="https://github.com/nirholas/agenti">GitHub</a> &middot;
  <a href="mcp-server/quickstart.md">Quick Start</a> &middot;
  <a href="tutorials/index.md">Tutorials</a> &middot;
  <a href="prompts/index.md">Prompts</a>
</p>

---

## What is Agenti?

Agenti is an open-source [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants interact with blockchain networks through natural language.

**Instead of:**
- Switching between block explorers
- Connecting to multiple dApps
- Manual copy-pasting addresses

**Just ask:**
> "Check my portfolio across all chains"
> "Swap 1 ETH to USDC on Arbitrum"
> "Is this token safe to buy?"

---

## Supported Networks

<div class="grid" markdown>

| Layer 1 | Layer 2 | Multi-Chain |
|---------|---------|-------------|
| Ethereum | Arbitrum One | Solana |
| BNB Chain | Base | TON |
| Avalanche | Optimism | XRP Ledger |
| Fantom | Polygon | Cosmos/IBC |
| Near | zkSync Era | Sui |
| Aptos | Linea | |
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

    Swaps via 1inch, ParaSwap &middot; Lending on Aave, Compound &middot; Staking &middot; Yield farming

    [:octicons-arrow-right-24: DeFi Tools](mcp-server/tools.md)

-   :material-bridge:{ .lg .middle } **Cross-Chain**

    ---

    Bridge quotes &middot; Multi-hop routing &middot; 15+ chain support

    [:octicons-arrow-right-24: Bridge Tools](mcp-server/tools.md)

-   :material-shield-check:{ .lg .middle } **Security**

    ---

    Honeypot detection &middot; Rug pull scanning &middot; Contract analysis

    [:octicons-arrow-right-24: Security Tools](mcp-server/tools.md)

-   :material-chart-line:{ .lg .middle } **Market Data**

    ---

    Prices &middot; Technical indicators &middot; Fear & Greed &middot; Sentiment

    [:octicons-arrow-right-24: Market Tools](mcp-server/tools.md)

-   :material-cash:{ .lg .middle } **x402 Payments**

    ---

    AI agent micropayments &middot; Autonomous API payments &middot; USDs yield

    [:octicons-arrow-right-24: x402 Guide](../x402-ecosystem/README.md)

-   :material-monitor-multiple:{ .lg .middle } **Real-time Data**

    ---

    WebSocket streams &middot; Trade feeds &middot; Whale tracking &middot; Alerts

    [:octicons-arrow-right-24: Tools Reference](mcp-server/tools.md)

</div>

---

## Quick Start

### Option 1: npx (Recommended)

```bash
npx @nirholas/agenti
```

### Option 2: Clone & Build

```bash
git clone https://github.com/nirholas/agenti.git
cd agenti
npm install && npm run build
```

### Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["-y", "@nirholas/agenti@latest"],
      "env": {
        "PRIVATE_KEY": "your_key_here"
      }
    }
  }
}
```

### Start Using

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
| **Payments** | "Check my x402 balance and yield earnings" |

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

## Why Agenti?

| Feature | Agenti | Others |
|---------|--------|--------|
| Chains | **20+** | 1-3 |
| Tools | **380+** | 10-50 |
| DeFi | Full stack | Limited |
| Security | Built-in | None |
| AI Payments | x402 protocol | None |
| Transport | stdio, HTTP, SSE | stdio only |
| Open Source | Apache 2.0 | Varies |

[:octicons-arrow-right-24: Full Comparison](comparison.md)

---

## Community

- **Twitter:** [@nichxbt](https://x.com/nichxbt)
- **GitHub:** [nirholas/agenti](https://github.com/nirholas/agenti)

---

## License

Apache 2.0 &mdash; Free for personal and commercial use.

Built by **[Nich](https://x.com/nichxbt)** &middot; [:material-github: nirholas](https://github.com/nirholas)
