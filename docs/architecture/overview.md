# Architecture Overview

Technical architecture of the Agenti Universal MCP Server.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AI Clients                        │
│  (Claude Desktop, Cursor, ChatGPT, Custom Apps)     │
└──────────────┬──────────────┬──────────────┬────────┘
               │ stdio        │ HTTP         │ SSE
┌──────────────▼──────────────▼──────────────▼────────┐
│                  Transport Layer                     │
│          (src/server/stdio, http, sse)               │
├─────────────────────────────────────────────────────┤
│                  MCP Protocol Layer                  │
│          (@modelcontextprotocol/sdk)                 │
├─────────────────────────────────────────────────────┤
│                  Tool Registry                       │
│          (src/modules/index.ts)                      │
├──────┬──────┬──────┬──────┬──────┬──────┬───────────┤
│Market│ DeFi │ DEX  │ Port │Indic │Senti │  ...      │
│ Data │      │      │folio │ators │ment  │           │
├──────┴──────┴──────┴──────┴──────┴──────┴───────────┤
│                  Vendor Layer                        │
│   (src/vendors/ - chain-specific implementations)   │
├──────┬──────┬──────┬──────┬──────┬──────┬───────────┤
│Solana│Cosmos│ Near │ Sui  │Aptos │ TON  │  ...      │
├──────┴──────┴──────┴──────┴──────┴──────┴───────────┤
│                  EVM Layer                           │
│          (viem - 8 mainnets + 8 testnets)           │
├─────────────────────────────────────────────────────┤
│                x402 Payment Protocol                 │
│      (@x402/core, @x402/evm, @x402/svm)            │
└─────────────────────────────────────────────────────┘
```

## Layer Descriptions

### Transport Layer
Handles communication between AI clients and the MCP server. Three modes:
- **stdio** - Standard I/O for desktop integrations
- **HTTP** - RESTful API for web/cloud deployments
- **SSE** - Server-Sent Events for streaming

### MCP Protocol Layer
Implements the Model Context Protocol specification:
- JSON-RPC 2.0 message handling
- Tool discovery (`tools/list`)
- Tool execution (`tools/call`)
- Session management
- Capability negotiation

### Tool Registry
Central registry of all 380+ tools. Each tool has:
- Unique name (snake_case)
- Description (for AI model context)
- Input schema (Zod → JSON Schema)
- Execute function (async)

### Module Layer
Organized tool implementations by category:
- 22 module categories in `src/modules/`
- Cross-chain tools (work on any supported chain)
- Data aggregation and analytics tools

### Vendor Layer
Chain-specific implementations in `src/vendors/`:
- 25 vendor integrations
- Each vendor encapsulates chain-specific SDK usage
- Standardized response format across vendors

### EVM Layer
Shared EVM infrastructure via `viem`:
- Chain configuration and client creation
- Contract interaction (read/write)
- Transaction signing and submission
- Gas estimation
- Multicall batching

### x402 Payment Layer
Autonomous payment protocol:
- HTTP 402 request/response handling
- EIP-3009 payment signing
- Multi-chain settlement (EVM + Solana)
- Payment verification

## Data Flow

### Read Operation (e.g., get price)
```
Client → Transport → MCP Protocol → Tool Registry
    → Module (market-data) → Vendor (coingecko) → External API
    → Response → Client
```

### Write Operation (e.g., swap tokens)
```
Client → Transport → MCP Protocol → Tool Registry
    → Module (defi) → EVM Layer (viem) → Blockchain RPC
    → Transaction Receipt → Client
```

### x402 Payment
```
Client → Transport → MCP Protocol → x402 Tool
    → HTTP Request → 402 Response → Sign Payment
    → Retry with Proof → Paid Content → Client
```

## Directory Structure

```
src/
├── index.ts              # Entry point, transport selection
├── cli.ts                # CLI argument parsing
├── lib.ts                # Library exports
├── evm.ts                # EVM module registration
├── evm/
│   └── chains.ts         # Chain definitions
├── server/
│   ├── http/             # HTTP transport
│   ├── sse/              # SSE transport
│   └── stdio/            # stdio transport
├── modules/              # Tool implementations (22 categories)
│   ├── index.ts          # Tool registry
│   ├── market-data/
│   ├── defi/
│   ├── dex-analytics/
│   └── ...
├── vendors/              # Chain-specific vendors (25)
│   ├── solana/
│   ├── cosmos/
│   ├── near/
│   └── ...
└── x402/                 # Payment protocol integration
    └── chains/
        ├── evm.ts
        └── solana.ts
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | >= 18 |
| Language | TypeScript | 5.0 |
| MCP SDK | @modelcontextprotocol/sdk | 1.26+ |
| EVM | viem | 2.46+ |
| Solana | @solana/web3.js | 1.87+ |
| Validation | Zod | 4.3+ |
| HTTP | Express | 4.22+ |
| Exchanges | CCXT | 4.5+ |
| Payments | @x402/core | 2.3+ |
| Build | tsup | 8.0 |
| Test | Vitest | 4.0 |

## Design Principles

1. **Tool-first** - Every capability is exposed as an MCP tool
2. **Chain-agnostic** - Consistent interface across blockchains
3. **Validation-first** - All inputs validated via Zod before processing
4. **Graceful degradation** - Missing API keys disable features, don't crash
5. **Composable** - Tools can be combined for complex workflows
6. **Extensible** - Plugin system for adding capabilities without modifying core
