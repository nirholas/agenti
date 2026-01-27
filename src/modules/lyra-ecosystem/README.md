# 🌐 Lyra Ecosystem Payment Layer

> Unified x402 payment integration for the entire Lyra ecosystem

## Overview

This module provides a single payment layer for all Lyra services:

| Service | GitHub | Description | Stars |
|---------|--------|-------------|-------|
| **lyra-intel** | [nirholas/lyra-intel](https://github.com/nirholas/lyra-intel) | Code analysis & security scanning | 9⭐ |
| **lyra-registry** | [nirholas/lyra-registry](https://github.com/nirholas/lyra-registry) | MCP tool catalog | 9⭐ |
| **lyra-tool-discovery** | [nirholas/lyra-tool-discovery](https://github.com/nirholas/lyra-tool-discovery) | Automatic API discovery | 6⭐ |

## Quick Start

```typescript
import { LyraClient } from "@/modules/lyra-ecosystem";

const lyra = new LyraClient({
  x402Wallet: process.env.X402_PRIVATE_KEY
});

// Initialize payments (optional - enables paid features)
await lyra.initializePayments();

// All Lyra services, one payment layer
await lyra.intel.securityScan(repoUrl);    // $0.05
await lyra.registry.getToolDetails(id);     // $0.01  
await lyra.discovery.analyze(apiUrl);       // $0.02
```

## Pricing

### Lyra Intel (Code Analysis)

| Tier | Price | Description |
|------|-------|-------------|
| Basic Analysis | **FREE** | File analysis, complexity metrics |
| Security Scan | **$0.05** | Vulnerability detection, OWASP Top 10 |
| Repo Audit | **$0.10** | Full repository code quality audit |
| Enterprise | **$1.00** | Monorepo analysis, dependency graphs |

### Lyra Registry (Tool Catalog)

| Tier | Price | Description |
|------|-------|-------------|
| Browse | **FREE** | Search and list tools |
| Tool Details | **$0.01** | Examples, config, documentation |
| Private Registration | **$0.05** | Register your own MCP tool |
| Featured Listing | **$10/mo** | Homepage placement, badges |

### Lyra Tool Discovery (Auto-Discovery)

| Tier | Price | Description |
|------|-------|-------------|
| Basic Discovery | **FREE** | Detect API endpoints |
| Compatibility | **$0.02** | AI-analyzed MCP compatibility |
| Config Generation | **$0.10** | Auto-generate MCP config |
| Full Assistance | **$0.50** | Code, tests, documentation |

## Usage Examples

### Lyra Intel

```typescript
// Free: Analyze a file
const analysis = await lyra.intel.analyzeFile({
  content: "const x = 1;",
  filename: "example.ts"
});

// $0.05: Security scan
const security = await lyra.intel.securityScan(
  "https://github.com/user/repo"
);
console.log(`Security score: ${security.score}/100`);

// $0.10: Full repo audit
const audit = await lyra.intel.repoAudit(repoUrl, {
  branch: "main",
  focus: ["security", "quality"]
});

// $1.00: Enterprise monorepo analysis
const enterprise = await lyra.intel.enterpriseAnalysis(repoUrl, {
  packageManager: "pnpm"
});
```

### Lyra Registry

```typescript
// Free: Browse tools
const tools = await lyra.registry.browse({
  category: "blockchain",
  sortBy: "stars"
});

// $0.01: Get detailed info
const details = await lyra.registry.getToolDetails("mcp-server-filesystem");
console.log(details.examples[0].code);

// $0.05: Register your tool
const result = await lyra.registry.registerTool({
  name: "my-mcp-tool",
  description: "Custom MCP server",
  version: "1.0.0",
  endpoint: "https://api.mytool.com/mcp",
  category: "utilities",
  visibility: "private"
});
console.log(`Tool ID: ${result.toolId}`);
```

### Lyra Tool Discovery

```typescript
// Free: Discover API
const discovered = await lyra.discovery.discover(
  "https://api.example.com"
);
console.log(`Protocol: ${discovered.protocol}`);

// $0.02: Compatibility analysis
const analysis = await lyra.discovery.analyze(apiUrl);
console.log(`MCP Compatible: ${analysis.mcpCompatible}`);

// $0.10: Generate MCP config
const config = await lyra.discovery.generateMcpConfig(apiUrl, {
  serverName: "my-api-mcp"
});

// $0.50: Full integration assistance
const assistance = await lyra.discovery.getFullAssistance(apiUrl, {
  targetLanguage: "typescript"
});
```

## MCP Tools

Register Lyra tools with your MCP server:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLyraTools } from "@/modules/lyra-ecosystem";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
registerLyraTools(server);
```

Available MCP tools:

| Tool | Description | Cost |
|------|-------------|------|
| `lyra_intel_analyze_file` | Analyze code file | FREE |
| `lyra_intel_security_scan` | Security vulnerability scan | $0.05 |
| `lyra_intel_repo_audit` | Full repository audit | $0.10 |
| `lyra_intel_enterprise_analysis` | Enterprise monorepo analysis | $1.00 |
| `lyra_registry_browse` | Browse tool catalog | FREE |
| `lyra_registry_tool_details` | Detailed tool info | $0.01 |
| `lyra_registry_register` | Register private tool | $0.05 |
| `lyra_registry_trending` | Get trending tools | FREE |
| `lyra_discovery_discover` | Discover API endpoints | FREE |
| `lyra_discovery_analyze` | AI compatibility analysis | $0.02 |
| `lyra_discovery_generate_config` | Generate MCP config | $0.10 |
| `lyra_discovery_full_assist` | Full integration assistance | $0.50 |
| `lyra_get_usage` | Get usage statistics | FREE |
| `lyra_get_pricing` | Get pricing info | FREE |

## Usage Tracking

```typescript
// Check spending
const stats = lyra.getUsageStats("day");
console.log(`Spent today: $${stats.totalSpent}`);
console.log(`Requests: ${stats.requestCount}`);

// Set daily limit
const lyra = new LyraClient({
  x402Wallet: process.env.X402_PRIVATE_KEY,
  maxDailySpend: "5.00" // Max $5/day
});

// Check remaining allowance
const remaining = lyra.getRemainingDailyAllowance();
console.log(`Can still spend: $${remaining}`);
```

## Environment Variables

```bash
# Required for paid features
X402_PRIVATE_KEY=0x...          # EVM wallet private key

# Optional configuration
LYRA_NETWORK=eip155:8453        # Payment network (default: Base)
LYRA_MAX_DAILY_SPEND=10.00      # Daily spending limit
```

## Supported Networks

- **Base Mainnet** (`eip155:8453`) - Default
- **Base Sepolia** (`eip155:84532`) - Testnet
- **Arbitrum One** (`eip155:42161`)
- **Solana Mainnet** (`solana:mainnet`)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     LyraClient                          │
│                  (Unified Entry Point)                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ LyraIntel   │  │ LyraRegistry│  │ LyraDiscovery   │ │
│  │             │  │             │  │                 │ │
│  │ • Analyze   │  │ • Browse    │  │ • Discover      │ │
│  │ • Security  │  │ • Details   │  │ • Analyze       │ │
│  │ • Audit     │  │ • Register  │  │ • Generate      │ │
│  │ • Enterprise│  │ • Featured  │  │ • Assist        │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
│         └────────────────┼───────────────────┘          │
│                          ▼                              │
│               ┌──────────────────┐                      │
│               │  x402 Payment    │                      │
│               │  (Auto-handled)  │                      │
│               └────────┬─────────┘                      │
│                        │                                │
└────────────────────────┼────────────────────────────────┘
                         ▼
              ┌──────────────────┐
              │  USDC on Base    │
              │  (or other nets) │
              └──────────────────┘
```

## License

Apache-2.0
