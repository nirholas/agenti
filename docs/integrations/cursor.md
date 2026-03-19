# Cursor Integration

Guide for integrating Agenti with the Cursor AI code editor.

## Setup

### 1. Create MCP Configuration

In your project root, create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x_YOUR_KEY"
      }
    }
  }
}
```

### 2. Restart Cursor

Restart Cursor to load the MCP configuration. Agenti tools become available in Cursor's AI chat.

### 3. Verify

In Cursor's AI chat, ask:
- "List the available crypto tools"
- "What's the price of ETH right now?"

## Use Cases in Cursor

### Smart Contract Development
While coding Solidity contracts, use Agenti tools to:
- Check current gas prices for deployment estimates
- Verify contract addresses on-chain
- Look up token information for integration
- Check DeFi protocol parameters

### DApp Development
During frontend/backend development:
- Test wallet interactions
- Verify token balances and transfers
- Debug transaction failures
- Check blockchain state

### Research While Coding
- Get market data for trading bot development
- Check protocol APY rates for yield aggregator work
- Analyze DEX pool data for AMM development

## Project-Level vs Global

### Project-level (recommended)
`.cursor/mcp.json` in project root - tools available only in this project.

### Global
Configure in Cursor settings for tools available in all projects.

## Configuration with API Keys

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "ETHEREUM_RPC_URL": "https://...",
        "COINGECKO_API_KEY": "..."
      }
    }
  }
}
```

## Tips

- Use the AI chat panel for interactive queries
- Agenti tools work alongside Cursor's code generation
- Combine blockchain data lookups with code writing for informed development
- Use testnet configuration during development
