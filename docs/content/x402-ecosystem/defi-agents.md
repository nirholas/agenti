# 🤖 defi-agents Integration Guide

> Add x402 payment capabilities to DeFi agent specifications

## Overview

**Repository**: https://github.com/nirholas/defi-agents (10⭐)

defi-agents defines agent specifications for DeFi operations. This guide adds payment capabilities so agents can:

- Pay for premium data feeds
- Pay gas fees for users
- Receive payments for services
- Track earnings and spending

## Installation

```bash
cd defi-agents
npm install @nirholas/universal-crypto-mcp
```

## Step 1: Create PayableAgent Interface

Create `src/interfaces/PayableAgent.ts`:

```typescript
import type { Address } from "viem";

/**
 * Interface for agents with payment capabilities
 */
export interface PayableAgent {
  /** Agent's payment wallet address */
  walletAddress: Address;
  
  /** Supported payment tokens */
  supportedTokens: ("USDC" | "USDs" | "ETH")[];
  
  /** Maximum payment per request */
  maxPaymentPerRequest: string;
  
  /** Daily spending limit */
  dailyLimit: string;
  
  /** Can this agent make payments? */
  canPay: boolean;
  
  /** Can this agent receive payments? */
  canReceive: boolean;
}

/**
 * Payment configuration for an agent
 */
export interface AgentPaymentConfig {
  /** Private key (keep secure!) */
  privateKey?: `0x${string}`;
  
  /** Chain to operate on */
  chain?: "arbitrum" | "base" | "ethereum";
  
  /** Enable yield-bearing stablecoin */
  useUSDs?: boolean;
  
  /** Approved service domains */
  approvedServices?: string[];
}

/**
 * Payment transaction record
 */
export interface AgentPayment {
  id: string;
  type: "sent" | "received";
  amount: string;
  token: string;
  counterparty: Address;
  purpose: string;
  timestamp: number;
  txHash?: string;
}
```

## Step 2: Update Agent Base Class

Modify your base agent class to include payment support:

```typescript
// src/agents/BaseAgent.ts
import { 
  registerX402,
  createX402Client,
  type X402ClientWrapper,
} from "@nirholas/universal-crypto-mcp";
import type { PayableAgent, AgentPaymentConfig } from "../interfaces/PayableAgent";

export abstract class BaseAgent implements PayableAgent {
  protected x402Client?: X402ClientWrapper;
  
  // PayableAgent implementation
  walletAddress: `0x${string}` = "0x0";
  supportedTokens: ("USDC" | "USDs")[] = ["USDs", "USDC"];
  maxPaymentPerRequest = "1.00";
  dailyLimit = "100.00";
  canPay = false;
  canReceive = false;
  
  constructor(config?: AgentPaymentConfig) {
    if (config?.privateKey) {
      this.initializePayments(config);
    }
  }
  
  private async initializePayments(config: AgentPaymentConfig) {
    const { client } = await createX402Client({
      evmPrivateKey: config.privateKey,
      chain: config.chain ?? "arbitrum",
    });
    
    this.x402Client = client;
    this.canPay = true;
    this.canReceive = true;
    
    // Get wallet address
    const evmSigner = client.getSigners().find(s => s.scheme === "exact");
    if (evmSigner) {
      this.walletAddress = evmSigner.address as `0x${string}`;
    }
  }
  
  /**
   * Pay for a service
   */
  async payForService(
    url: string, 
    maxAmount = this.maxPaymentPerRequest
  ): Promise<Response> {
    if (!this.x402Client) {
      throw new Error("Payment not configured");
    }
    
    const { wrapFetch } = await import("@nirholas/universal-crypto-mcp");
    const payingFetch = wrapFetch(fetch, this.x402Client);
    
    return payingFetch(url);
  }
  
  /**
   * Get wallet balance
   */
  async getBalance(): Promise<{ usdc: string; usds: string; native: string }> {
    // Implementation using viem
    return { usdc: "0", usds: "0", native: "0" };
  }
}
```

## Step 3: Create Specific Payable Agents

Example: DeFi Arbitrage Agent with payments:

```typescript
// src/agents/ArbitrageAgent.ts
import { BaseAgent } from "./BaseAgent";

export class ArbitrageAgent extends BaseAgent {
  name = "Arbitrage Agent";
  description = "Finds and executes arbitrage opportunities";
  
  // Agent can pay for premium price feeds
  maxPaymentPerRequest = "0.10"; // Up to $0.10 per price query
  dailyLimit = "50.00"; // $50/day for data
  
  async findOpportunities() {
    // Pay for premium real-time prices
    const prices = await this.payForService(
      "https://prices.premium.com/api/v1/realtime"
    );
    
    // Process opportunities...
  }
}
```

## Step 4: Register with MCP Server

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerX402 } from "@nirholas/universal-crypto-mcp";
import { ArbitrageAgent } from "./agents/ArbitrageAgent";

const server = new McpServer({
  name: "defi-agents",
  version: "1.0.0",
});

// Register x402 payment protocol
registerX402(server);

// Create agent with payment capabilities
const agent = new ArbitrageAgent({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  chain: "arbitrum",
  useUSDs: true,
});

// Register agent-specific tools
server.tool(
  "arbitrage_scan",
  "Scan for arbitrage opportunities (may require paid data)",
  {},
  async () => {
    const opportunities = await agent.findOpportunities();
    return {
      content: [{
        type: "text",
        text: JSON.stringify(opportunities),
      }],
    };
  }
);
```

## Step 5: Add to Agent Specifications

Update your agent spec files to include payment fields:

```yaml
# specs/arbitrage-agent.yaml
name: ArbitrageAgent
version: 1.0.0
description: Finds arbitrage opportunities across DEXes

# NEW: Payment configuration
payment:
  enabled: true
  wallet:
    type: evm
    chain: arbitrum
  tokens:
    - USDs  # Preferred (earns yield)
    - USDC
  limits:
    perRequest: "0.10"
    daily: "50.00"
  services:
    - prices.premium.com
    - data.dex.io

capabilities:
  - scan_dexes
  - execute_trades
  - pay_for_data  # NEW
```

## Testing

```bash
# Set up testnet
export X402_CHAIN=arbitrum-sepolia
export AGENT_PRIVATE_KEY=0x...

# Run tests
npm test
```

## Example: Full Agent with Payments

```typescript
import { BaseAgent } from "./BaseAgent";
import type { AgentPaymentConfig } from "../interfaces/PayableAgent";

export class PremiumDataAgent extends BaseAgent {
  name = "Premium Data Agent";
  
  private dataProviders = [
    { url: "https://api.coingecko.com/pro", costPerCall: "0.001" },
    { url: "https://api.defillama.com/pro", costPerCall: "0.002" },
  ];
  
  constructor(config: AgentPaymentConfig) {
    super(config);
    this.maxPaymentPerRequest = "0.01";
    this.dailyLimit = "10.00";
  }
  
  async fetchPremiumData(provider: string) {
    const providerConfig = this.dataProviders.find(p => 
      p.url.includes(provider)
    );
    
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    // This automatically handles 402 payments
    const response = await this.payForService(providerConfig.url);
    return response.json();
  }
  
  async getMarketOverview() {
    const [coingecko, defillama] = await Promise.all([
      this.fetchPremiumData("coingecko"),
      this.fetchPremiumData("defillama"),
    ]);
    
    return { coingecko, defillama };
  }
}
```

## Next Steps

1. ✅ Install @nirholas/universal-crypto-mcp
2. ✅ Create PayableAgent interface
3. ✅ Update BaseAgent with payment support
4. ✅ Add payment config to agent specs
5. 🔲 Test on Arbitrum Sepolia
6. 🔲 Deploy to mainnet

---

**Related**: [AI-Agents-Library Integration](./ai-agents-library.md)
