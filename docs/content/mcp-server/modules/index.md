<!-- universal-crypto-mcp | nich | n1ch-0las-4e49-4348-786274000000 -->

# Modules Overview

<!-- Maintained by nirholas/universal-crypto-mcp | ID: 1493814938 -->

Universal Crypto MCP provides **380+ tools** across **60+ modules** organized into three main categories:

## Module Categories

### 🔷 EVM Modules (`src/evm/modules/`)
Core blockchain operations for all EVM-compatible chains including Ethereum, Polygon, BSC, Arbitrum, Base, Optimism, and more.

**23 modules** covering:
- Block & transaction management
- Smart contract interactions
- Token operations (ERC20, ERC721, ERC1155)
- DeFi protocols (lending, staking, swaps)
- Cross-chain bridging
- ENS domains
- Security analysis
- **Portfolio tracking (NEW)**

[→ EVM Modules Documentation](evm/index.md)

---

### 📊 Data & Analytics Modules (`src/modules/`)
Market data, technical analysis, research tools, and analytics.

**17 modules** covering:
- CoinGecko market data
- DefiLlama TVL & yields
- Technical indicators (50+)
- TradingView-style screeners
- DEX analytics
- Social sentiment
- News aggregation
- Research tools
- Prediction markets (Polymarket)
- **WebSocket subscriptions (NEW)**
- **On-chain alerts (NEW)**
- **Wallet analytics (NEW)**

[→ Data & Analytics Documentation](data/index.md)

---

### 🌐 Multi-Chain Vendors (`src/vendors/`)
Non-EVM blockchain integrations and third-party services.

**14+ modules** covering:
- Bitcoin (BTC)
- Litecoin (LTC)
- Dogecoin (DOGE)
- Solana (SOL)
- TON
- XRP Ledger
- THORChain
- **Cosmos/IBC (NEW)** - ATOM, OSMO, JUNO
- **Near Protocol (NEW)**
- **Sui (NEW)**
- **Aptos (NEW)**
- BNB Chain specifics

[→ Multi-Chain Documentation](chains/index.md)

---

## Quick Tool Count by Category

| Category | Modules | Tools |
|----------|---------|-------|
| EVM Core | 23 | ~120 |
| Data & Analytics | 17 | ~100 |
| Multi-Chain | 14+ | ~120 |
| **Total** | **60+** | **~380+** |

## Module Registration

All modules follow the same registration pattern:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerModule(server: McpServer) {
  server.tool(
    "tool_name",
    "Tool description",
    {
      // Zod schema for parameters
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional().describe("Optional parameter"),
    },
    async ({ param1, param2 }) => {
      // Tool implementation
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      }
    }
  )
}
```

## Environment Variables

Many modules require API keys or configuration:

```bash
# Required for write operations
PRIVATE_KEY=your_private_key

# Optional API keys for enhanced functionality
COINGECKO_API_KEY=your_key
LUNARCRUSH_API_KEY=your_key
COINSTATS_API_KEY=your_key

# Server configuration
PORT=3001
LOG_LEVEL=INFO
```


<!-- EOF: nich | ucm:n1ch-0las-4e49-4348-786274000000 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->