# Frequently Asked Questions

## General

### What is Universal Crypto MCP?

Universal Crypto MCP is an open-source [Model Context Protocol](https://modelcontextprotocol.io) server that connects AI assistants (Claude, ChatGPT, Cursor) to blockchain networks. It provides 330+ tools for DeFi, trading, security analysis, and cross-chain operations.

### Is it free?

Yes! Universal Crypto MCP is open-source under the Apache 2.0 license. You can use, modify, and distribute it freely.

### Which AI assistants are supported?

- **Claude Desktop** - Full support via MCP
- **ChatGPT** - Via HTTP mode with Actions
- **Cursor** - Via MCP configuration
- **Any MCP-compatible client** - Will work out of the box

### Which blockchains are supported?

15+ chains including:
- Ethereum, Arbitrum, Base, Polygon, Optimism
- BNB Chain, opBNB, Avalanche, Fantom
- zkSync Era, Linea, Scroll, Blast, Mode, Mantle
- Solana, TON, XRP Ledger (extended support)

---

## Setup & Configuration

### How do I install it?

```bash
git clone https://github.com/nirholas/universal-crypto-mcp.git
cd universal-crypto-mcp
npm install
npm run build
```

Then add to your Claude Desktop config. See the [Quick Start Guide](mcp-server/quickstart.md).

### Do I need API keys?

For basic functionality, you need at least one RPC provider key:
- **Alchemy** (recommended) - Free tier available
- **Infura** - Alternative option

Optional keys for enhanced features:
- **CoinGecko** - Better rate limits for price data
- **1inch** - Direct DEX aggregator access

### Can I use it without a private key?

Yes! Without a private key, you get full read-only access:
- Check balances and positions
- Get swap quotes
- Analyze contracts
- View market data

Add a private key only when you want to execute transactions.

### How do I configure for multiple chains?

Just set your RPC provider key (Alchemy/Infura) and all supported chains work automatically. No per-chain configuration needed.

---

## Security

### Is it safe to use my private key?

The private key is stored locally in your `.env` file and never transmitted. However, best practices:

1. **Use a dedicated wallet** - Don't use your main wallet
2. **Fund minimally** - Only keep what you need for transactions
3. **Use hardware wallet signing** - Coming in future versions
4. **Review transactions** - The AI shows what it will do before executing

### Can the AI drain my wallet?

The server includes safety features:
- Confirmation prompts for large transactions
- Slippage limits on swaps
- Gas price caps

However, you are ultimately responsible for reviewing transactions before approval.

### Has the code been audited?

Not yet formally audited. We encourage security researchers to review the code and report issues via our [security policy](https://github.com/nirholas/universal-crypto-mcp/security/policy).

---

## Features

### Can I execute real trades?

Yes, with a private key configured you can:
- Execute swaps on DEXs
- Supply/withdraw from lending protocols
- Bridge assets between chains
- Stake tokens

### Does it support NFTs?

NFT support is limited currently:
- ✅ Check NFT ownership
- ✅ View NFT metadata
- ❌ Buy/sell NFTs (coming soon)
- ❌ NFT portfolio tracking (coming soon)

### Can I set up automated trading?

The MCP protocol is designed for interactive use, not unattended automation. For automated trading, you'd need to build additional infrastructure around the server.

### Does it support limit orders?

Currently supports:
- ✅ Market swaps
- ✅ Swap quotes
- ❌ Limit orders (on roadmap)

---

## Troubleshooting

### Claude says "tool not found"

1. Rebuild the project: `npm run build`
2. Restart Claude Desktop
3. Check your config path is correct

### Transactions are failing

Common causes:
- Insufficient gas (try increasing gas limit)
- Stale quotes (prices moved, retry)
- Insufficient balance (check you have enough + gas)
- Network congestion (try later or increase gas price)

### Getting rate limited

If you're hitting rate limits:
1. Add your own API keys (CoinGecko, etc.)
2. Reduce query frequency
3. Use caching (Claude naturally caches recent data)

### The balance shown is wrong

- Prices update every few minutes
- New transactions need block confirmations
- Some tokens may not have price feeds

---

## Development

### Can I add new chains?

Yes! See the [Contributing Guide](contributing/index.md). The modular architecture makes adding chains straightforward.

### Can I add custom tools?

Absolutely. The server uses a modular tool system. Create a new file in `src/modules/` following the existing patterns.

### How do I run tests?

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### Can I use this in my own project?

Yes, it's Apache 2.0 licensed. You can:
- Use it as a dependency
- Fork and modify it
- Build commercial products with it
- Just give attribution

---

## Roadmap

### What's coming next?

See the [GitHub Issues](https://github.com/nirholas/universal-crypto-mcp/issues) for the full roadmap. Highlights:

- **Q1 2026**: NFT support, limit orders
- **Q2 2026**: Hardware wallet integration
- **Q3 2026**: Advanced analytics, alerts

### How can I request features?

Open a [GitHub Issue](https://github.com/nirholas/universal-crypto-mcp/issues/new) with the "feature request" template.

### How can I contribute?

See our [Contributing Guide](contributing/index.md). We welcome:
- Bug fixes
- New features
- Documentation improvements
- Translations

---

## Contact

### Where can I get help?

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions
- **Twitter** - [@nichxbt](https://x.com/nichxbt)

### Who built this?

Built by [Nich](https://x.com/nichxbt). See [GitHub](https://github.com/nirholas) for more projects.

---

## Still have questions?

Open a [GitHub Discussion](https://github.com/nirholas/universal-crypto-mcp/discussions) or tweet [@nichxbt](https://x.com/nichxbt)!
