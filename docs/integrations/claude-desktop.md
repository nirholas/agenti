# Claude Desktop Integration

Step-by-step guide for integrating Agenti with Claude Desktop.

## Prerequisites

- Claude Desktop installed ([download](https://claude.ai/download))
- Node.js >= 18 installed
- A wallet private key (for write operations)

## Setup

### 1. Configure Claude Desktop

Open Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

Add the Agenti MCP server:

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x_YOUR_PRIVATE_KEY_HERE"
      }
    }
  }
}
```

### 2. Restart Claude Desktop

Close and reopen Claude Desktop. The MCP server will start automatically.

### 3. Verify Connection

Look for the tools icon in the Claude Desktop interface. You should see 380+ tools available from Agenti.

Try asking Claude:
- "What crypto tools do you have available?"
- "What's the current price of Bitcoin?"
- "Check my wallet balance on Ethereum"

## Advanced Configuration

### Multiple Environment Variables

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "COINGECKO_API_KEY": "your_key",
        "BINANCE_API_KEY": "your_key",
        "BINANCE_SECRET_KEY": "your_secret",
        "ETHEREUM_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        "X402_ENABLED": "true",
        "X402_MAX_PAYMENT": "5"
      }
    }
  }
}
```

### From Source (Development)

```json
{
  "mcpServers": {
    "agenti": {
      "command": "node",
      "args": ["/path/to/agenti/dist/index.js"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Example Conversations

### Portfolio Analysis
> "Analyze my crypto portfolio across Ethereum, Polygon, and Base. What's my total value and allocation?"

### DeFi Strategy
> "What are the best yield opportunities for USDC on Aave across different chains?"

### Market Research
> "Give me a comprehensive analysis of Solana - price, sentiment, on-chain metrics, and technical indicators"

### x402 Payment
> "Use x402 to pay for access to this API: https://paid-api.example.com/data"

## Troubleshooting

### Tools not appearing
1. Check config file JSON is valid
2. Verify `npx @nirholas/agenti` works in terminal
3. Restart Claude Desktop
4. Check Claude Desktop logs for errors

### Connection timeout
- Ensure Node.js >= 18 is in your PATH
- Try running `npx @nirholas/agenti` manually to check for errors
- Check if firewall blocks the process

### Transaction errors
- Verify PRIVATE_KEY is valid and funded
- Check you're on the correct chain
- Ensure sufficient gas balance

## Security Notes

- The config file contains your private key - protect it
- Use a dedicated wallet with limited funds for AI agent operations
- Never share your `claude_desktop_config.json` file
- Consider using testnets during experimentation
