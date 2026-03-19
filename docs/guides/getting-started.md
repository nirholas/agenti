# Getting Started with Agenti

This guide walks you through setting up and running Agenti, the universal MCP server for blockchain and DeFi AI agents.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- A wallet private key (for write operations)
- API keys for data providers (optional, for enhanced functionality)

## Quick Install

### As an npm package

```bash
npx @nirholas/agenti
```

### From source

```bash
git clone https://github.com/nirholas/agenti.git
cd agenti
npm install
npm run build
npm start
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required for write operations
PRIVATE_KEY=0x...

# Optional: Custom RPC endpoints
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://mainnet.base.org

# Optional: API keys for enhanced data
COINGECKO_API_KEY=your_key
LUNARCRUSH_API_KEY=your_key

# Optional: Binance exchange
BINANCE_API_KEY=your_key
BINANCE_SECRET_KEY=your_secret

# Optional: x402 payment protocol
X402_ENABLED=true
```

### Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### Cursor Integration

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"]
    }
  }
}
```

## Transport Modes

Agenti supports three transport modes:

| Mode | Flag | Use Case |
|------|------|----------|
| stdio (default) | none | Claude Desktop, Cursor |
| HTTP | `--http` or `-h` | ChatGPT Developer Mode |
| SSE | `--sse` or `-s` | Legacy HTTP clients |

```bash
# stdio (default)
npm start

# HTTP mode
npm start -- --http

# SSE mode
npm start -- --sse
```

## Verify Installation

After starting the server, you should see the MCP handshake complete. Try asking your AI assistant:

- "What tools are available?"
- "What is the current price of Bitcoin?"
- "Check my wallet balance on Ethereum"

## Next Steps

- [Adding Custom Tools](./adding-tools.md) - Extend Agenti with your own tools
- [Transport Modes](./transport-modes.md) - Configure server communication
- [Environment Variables](./environment-variables.md) - Full configuration reference
- [Testing](./testing.md) - Run and write tests

## Troubleshooting

### Server won't start
- Verify Node.js >= 18: `node --version`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for port conflicts (HTTP/SSE modes)

### Tools not appearing
- Ensure the server completed the MCP handshake
- Check that required environment variables are set
- Verify your AI client supports MCP

### Transaction failures
- Verify `PRIVATE_KEY` is set and valid
- Check wallet has sufficient balance for gas
- Ensure correct chain/network configuration
