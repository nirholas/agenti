<!-- universal-crypto-mcp | @nichxbt | 0.14.9.3 -->

# Architecture

<!-- Maintained by universal-crypto-mcp | ID: n1ch-0las-4e49-4348-786274000000 -->

Understanding how Universal Crypto MCP is structured and how components interact.

---

## System Overview

```mermaid
graph TB
    subgraph "AI Clients"
        Claude[Claude Desktop]
        ChatGPT[ChatGPT]
        Cursor[Cursor IDE]
        Other[Other MCP Clients]
    end

    subgraph "Transport Layer"
        STDIO[stdio Transport]
        HTTP[HTTP Transport]
        SSE[SSE Transport]
    end

    subgraph "MCP Server Core"
        Server[MCP Server]
        Router[Tool Router]
        Auth[Auth & Validation]
    end

    subgraph "Module Layer"
        EVM[EVM Modules]
        Market[Market Data]
        DeFi[DeFi Analytics]
        Social[Social Sentiment]
        News[Crypto News]
    end

    subgraph "EVM Modules"
        Swap[Swap/DEX]
        Bridge[Bridge]
        Staking[Staking]
        Lending[Lending]
        Security[Security]
        Wallet[Wallet]
        NFT[NFT]
        Governance[Governance]
    end

    subgraph "External APIs"
        CoinGecko[CoinGecko]
        DefiLlama[DefiLlama]
        GoPlus[GoPlus Security]
        LunarCrush[LunarCrush]
        GeckoTerminal[GeckoTerminal]
        Aggregators[DEX Aggregators]
    end

    subgraph "Blockchain Networks"
        Ethereum[Ethereum]
        Arbitrum[Arbitrum]
        Base[Base]
        Polygon[Polygon]
        BSC[BSC]
        Optimism[Optimism]
    end

    Claude --> STDIO
    ChatGPT --> HTTP
    Cursor --> STDIO
    Other --> SSE

    STDIO --> Server
    HTTP --> Server
    SSE --> Server

    Server --> Router
    Router --> Auth
    Auth --> EVM
    Auth --> Market
    Auth --> DeFi
    Auth --> Social
    Auth --> News

    EVM --> Swap
    EVM --> Bridge
    EVM --> Staking
    EVM --> Lending
    EVM --> Security
    EVM --> Wallet
    EVM --> NFT
    EVM --> Governance

    Market --> CoinGecko
    DeFi --> DefiLlama
    Security --> GoPlus
    Social --> LunarCrush
    Swap --> Aggregators
    Swap --> GeckoTerminal

    Swap --> Ethereum
    Swap --> Arbitrum
    Swap --> Base
    Swap --> Polygon
    Swap --> BSC
    Swap --> Optimism
```

---

## Component Details

### Transport Layer

| Transport | Protocol | Use Case | Port |
|-----------|----------|----------|------|
| **stdio** | Standard I/O | Claude Desktop, Cursor | N/A |
| **HTTP** | HTTP/1.1 | ChatGPT Developer Mode | 3001 |
| **SSE** | Server-Sent Events | Legacy clients, streaming | 3001 |

### Module Architecture

```mermaid
graph LR
    subgraph "src/"
        Index[index.ts<br/>Entry Point]
        Lib[lib.ts<br/>Library Export]
        EVM[evm/<br/>EVM Operations]
        Modules[modules/<br/>Data Providers]
        Vendors[vendors/<br/>Chain-Specific]
        Server[server/<br/>Transport]
        Utils[utils/<br/>Helpers]
    end

    Index --> Server
    Index --> EVM
    Index --> Modules
    Index --> Vendors
    Lib --> EVM
    Lib --> Modules
```

### EVM Module Structure

```
src/evm/modules/
├── blocks/        # Block queries
├── bridge/        # Cross-chain bridges
├── contracts/     # Contract interactions
├── deployment/    # Contract deployment
├── domains/       # ENS & domains
├── events/        # Event logs
├── gas/           # Gas estimation
├── governance/    # DAO voting
├── lending/       # Aave, Compound
├── mev/           # Flashbots, MEV protection
├── multicall/     # Batch calls
├── network/       # Chain info
├── nft/           # NFT operations
├── portfolio/     # Wallet tracking
├── price-feeds/   # Oracle prices
├── security/      # GoPlus, honeypot detection
├── signatures/    # Message signing
├── staking/       # Lido, LP staking
├── swap/          # DEX swaps
├── tokens/        # ERC-20 operations
├── transactions/  # Tx management
└── wallet/        # Wallet operations
```

---

## Data Flow

### Swap Request Flow

```mermaid
sequenceDiagram
    participant User as User (Claude)
    participant MCP as MCP Server
    participant Router as Tool Router
    participant Swap as Swap Module
    participant Agg as DEX Aggregator
    participant Chain as Blockchain

    User->>MCP: "Swap 1 ETH for USDC on Arbitrum"
    MCP->>Router: Parse intent
    Router->>Swap: get_swap_quote()
    Swap->>Agg: Fetch quotes (1inch, 0x, ParaSwap)
    Agg-->>Swap: Best route + price
    Swap-->>Router: Quote response
    Router-->>MCP: Format result
    MCP-->>User: "Best rate: 3,248 USDC via Uniswap V3"
    
    User->>MCP: "Execute the swap"
    MCP->>Router: Parse intent
    Router->>Swap: execute_swap()
    Swap->>Chain: Sign & broadcast tx
    Chain-->>Swap: Tx hash
    Swap-->>Router: Tx result
    Router-->>MCP: Format result
    MCP-->>User: "✅ Swap complete! Tx: 0x..."
```

### Security Check Flow

```mermaid
sequenceDiagram
    participant User as User
    participant MCP as MCP Server
    participant Security as Security Module
    participant GoPlus as GoPlus API
    participant Chain as Blockchain

    User->>MCP: "Is this token safe? 0x..."
    MCP->>Security: analyze_token_security()
    
    par Parallel Checks
        Security->>GoPlus: Token security scan
        Security->>Chain: Contract verification
        Security->>Chain: Holder distribution
    end
    
    GoPlus-->>Security: Risk indicators
    Chain-->>Security: Contract data
    Chain-->>Security: Holder data
    
    Security->>Security: Aggregate & score
    Security-->>MCP: Security report
    MCP-->>User: "⚠️ Risk Score: 7/10 - Hidden mint function detected"
```

---

## Configuration

### Environment Variables

```mermaid
graph TD
    subgraph "Required"
        PK[PRIVATE_KEY<br/>For write operations]
    end

    subgraph "Market Data"
        CG[COINGECKO_API_KEY]
        CS[COINSTATS_API_KEY]
    end

    subgraph "Social & News"
        LC[LUNARCRUSH_API_KEY]
        CP[CRYPTOPANIC_API_KEY]
    end

    subgraph "RPC Endpoints"
        ETH[ETHEREUM_RPC_URL]
        ARB[ARBITRUM_RPC_URL]
        BASE[BASE_RPC_URL]
        POLY[POLYGON_RPC_URL]
    end

    PK --> Transactions
    CG --> Prices
    LC --> Sentiment
    ETH --> Blockchain
```

---

## Security Model

### Trust Boundaries

```mermaid
graph TB
    subgraph "Untrusted"
        User[User Input]
        External[External APIs]
    end

    subgraph "Trusted"
        Validation[Input Validation<br/>Zod Schemas]
        Server[MCP Server]
        Crypto[Crypto Operations]
    end

    subgraph "Sensitive"
        PrivateKey[Private Key]
        Signing[Transaction Signing]
    end

    User -->|Sanitized| Validation
    Validation -->|Validated| Server
    External -->|Rate Limited| Server
    Server -->|Authorized| Crypto
    PrivateKey -->|Never Exposed| Signing
    Crypto --> Signing
```

### Key Security Features

1. **Input Validation**: All inputs validated with Zod schemas
2. **Private Key Isolation**: Never logged or exposed
3. **Rate Limiting**: Automatic for external API calls
4. **Transaction Simulation**: Preview before execution
5. **MEV Protection**: Flashbots integration available

---

## Extending the Server

### Adding a New Module

```typescript
// src/modules/my-module/tools.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerMyModuleTools(server: McpServer) {
  server.tool(
    "my_tool_name",
    "Description of what this tool does",
    {
      param1: z.string().describe("Parameter description"),
      param2: z.number().optional().describe("Optional param")
    },
    async ({ param1, param2 }) => {
      // Implementation
      return {
        content: [{ type: "text", text: "Result" }]
      }
    }
  )
}
```

### Adding a New Chain

```typescript
// src/evm/chains.ts
export const CHAINS = {
  // ... existing chains
  
  mychain: {
    id: 12345,
    name: "My Chain",
    rpcUrl: "https://rpc.mychain.com",
    explorer: "https://explorer.mychain.com",
    nativeCurrency: {
      name: "MYC",
      symbol: "MYC",
      decimals: 18
    }
  }
}
```

---

## Performance Considerations

| Operation | Typical Latency | Notes |
|-----------|-----------------|-------|
| Price query | 100-300ms | Cached for 30s |
| Swap quote | 500-1500ms | Multiple aggregator calls |
| Transaction | 2-30s | Depends on chain & gas |
| Security scan | 1-3s | Multiple API calls |
| Portfolio | 2-5s | Multi-chain queries |

### Optimization Tips

1. **Use caching**: Price data cached automatically
2. **Batch requests**: Use multicall for multiple reads
3. **Choose fast chains**: L2s (Arbitrum, Base) are faster
4. **Set gas appropriately**: Don't overpay, don't underpay


<!-- EOF: @nichxbt | ucm:0.14.9.3 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->