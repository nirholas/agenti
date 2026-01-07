# Universal Crypto MCP

A Universal Model Context Protocol server for all EVM-compatible networks.

Enable AI agents to interact with any EVM blockchain through natural language.

## Supported Networks

- BNB Smart Chain (BSC)
- opBNB
- Arbitrum One
- Ethereum
- Polygon
- Base
- Optimism
- + All testnets

## Features

- 🔄 **Swap/DEX** - Token swaps via 1inch, 0x, ParaSwap
- 🌉 **Bridge** - Cross-chain transfers via LayerZero, Stargate, Wormhole
- ⛽ **Gas** - Gas prices across chains, EIP-1559 suggestions
- 📦 **Multicall** - Batch read/write operations
- 📊 **Events/Logs** - Query historical events, decode logs
- 🔒 **Security** - Token honeypot check, contract verification
- 💰 **Staking** - Liquid staking, validator info
- ✍️ **Signatures** - Sign messages, verify signatures, EIP-712
- 🏦 **Lending** - Aave/Compound positions, borrow rates
- 📈 **Price Feeds** - Historical prices, TWAP, oracle aggregation
- 📁 **Portfolio** - Track holdings across chains
- 🏛️ **Governance** - Snapshot votes, on-chain proposals

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

## Local Development

```bash
# Clone
git clone https://github.com/nirholas/universal-crypto-mcp
cd universal-crypto-mcp

# Install
bun install

# Run dev server
bun dev:sse
```

## Documentation

https://universal-crypto-mcp.vercel.app

## Credits

Built by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))

## License

MIT
