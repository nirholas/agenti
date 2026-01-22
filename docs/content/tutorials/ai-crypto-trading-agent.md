# Building an AI Crypto Trading Agent with Claude

> **Tutorial**: Give Claude Desktop the ability to interact with 15+ blockchains, execute swaps, check balances, and analyze DeFi protocols.

## What You'll Build

By the end of this tutorial, you'll have an AI assistant that can:

- ✅ Check token balances across Ethereum, Arbitrum, Base, Polygon, and more
- ✅ Execute token swaps via DEX aggregators
- ✅ Bridge assets between chains
- ✅ Analyze DeFi positions (Aave, Compound, Uniswap)
- ✅ Get real-time market data and technical indicators
- ✅ Monitor gas prices and optimize transactions

## Prerequisites

- [Claude Desktop](https://claude.ai/download) installed
- Node.js 18+ 
- A wallet address (for read operations) or private key (for transactions)
- 10 minutes of your time

## Step 1: Install Universal Crypto MCP

```bash
# Clone the repository
git clone https://github.com/nirholas/universal-crypto-mcp.git
cd universal-crypto-mcp

# Install dependencies
npm install

# Build the server
npm run build
```

## Step 2: Configure Environment

Create a `.env` file with your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
# Required for most operations
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key

# Optional: For executing transactions
PRIVATE_KEY=your_wallet_private_key

# Optional: Enhanced market data
COINGECKO_API_KEY=your_coingecko_key
```

> 💡 **Tip**: You can use the server with just `ALCHEMY_API_KEY` for read-only operations. Add `PRIVATE_KEY` only when you want to execute transactions.

## Step 3: Connect to Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "node",
      "args": ["/path/to/universal-crypto-mcp/dist/index.js"],
      "env": {
        "ALCHEMY_API_KEY": "your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop.

## Step 4: Start Talking to Your AI Agent

Now Claude has access to 330+ blockchain tools. Try these prompts:

### Check Your Portfolio

```
What's my wallet balance on Ethereum, Arbitrum, and Base?
Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

### Get a Swap Quote

```
How much USDC would I get for swapping 1 ETH on Arbitrum?
```

### Analyze DeFi Positions

```
Show me the top Aave lending pools by TVL on Ethereum
```

### Technical Analysis

```
What are the RSI and MACD indicators for ETH/USD?
```

### Cross-Chain Bridge Quote

```
What's the best route to bridge 100 USDC from Ethereum to Base?
```

## Example Conversation

**You**: Check my ETH balance on Arbitrum and tell me if gas is cheap enough to swap

**Claude**: I'll check your balance and current gas prices on Arbitrum.

*[Uses evm_getBalance and evm_getGasPrice tools]*

Your Arbitrum wallet shows:
- **ETH**: 0.523 ETH (~$1,884)
- **USDC**: 500.00 USDC

Current gas on Arbitrum:
- **Gas Price**: 0.1 gwei
- **Swap Cost**: ~$0.02

Gas is very cheap right now! This is a good time to execute swaps. Would you like me to get a quote for a specific swap?

---

## Supported Chains

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 1 | ✅ Full Support |
| Arbitrum One | 42161 | ✅ Full Support |
| Base | 8453 | ✅ Full Support |
| Polygon | 137 | ✅ Full Support |
| Optimism | 10 | ✅ Full Support |
| BNB Chain | 56 | ✅ Full Support |
| Avalanche | 43114 | ✅ Full Support |
| Fantom | 250 | ✅ Full Support |
| zkSync Era | 324 | ✅ Full Support |
| Linea | 59144 | ✅ Full Support |
| Scroll | 534352 | ✅ Full Support |
| Mantle | 5000 | ✅ Full Support |
| Blast | 81457 | ✅ Full Support |
| Mode | 34443 | ✅ Full Support |
| opBNB | 204 | ✅ Full Support |

## Available Tool Categories

### 💰 DeFi Operations (50+ tools)
- Token swaps via 1inch, ParaSwap, 0x
- Liquidity provision on Uniswap, SushiSwap
- Lending/borrowing on Aave, Compound
- Yield farming positions

### 🌉 Cross-Chain (20+ tools)
- Bridge quotes and execution
- Cross-chain swap routing
- Multi-chain balance aggregation

### 📊 Market Data (40+ tools)
- Real-time prices from CoinGecko, CoinMarketCap
- Historical OHLCV data
- Technical indicators (RSI, MACD, Bollinger Bands)
- Fear & Greed Index

### 🔒 Security (15+ tools)
- Contract verification
- Token security scanning
- Honeypot detection
- Rug pull risk analysis

### ⛓️ On-Chain Analysis (30+ tools)
- Transaction decoding
- Event log parsing
- ENS resolution
- Gas estimation

## Safety Features

The server includes built-in safety features:

1. **Confirmation prompts** for transactions over threshold
2. **Slippage protection** on swaps
3. **Gas price limits** to prevent overpaying
4. **Read-only mode** when no private key configured

## Troubleshooting

### "Tool not found" error
Make sure you rebuilt after pulling latest: `npm run build`

### "Invalid API key" error
Check your `.env` file and ensure keys are correctly set

### Claude doesn't see the tools
Restart Claude Desktop after editing the config file

## Next Steps

- 📖 [Full API Reference](../mcp-server/tools-complete.md)
- 🔧 [Configuration Guide](../mcp-server/configuration.md)
- 💡 [Example Prompts](../mcp-server/prompts.md)
- 🤝 [Contributing](../contributing/index.md)

---

## About

Built by [Nich](https://x.com/nichxbt) • [GitHub](https://github.com/nirholas/universal-crypto-mcp)

Licensed under Apache-2.0
