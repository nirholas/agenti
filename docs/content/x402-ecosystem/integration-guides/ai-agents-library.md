# AI-Agents-Library Integration Guide

> Create payment-capable agent templates in nirholas/AI-Agents-Library

## Overview

The `AI-Agents-Library` repository contains a collection of AI agent implementations. This guide shows how to add payment capabilities by creating an `AgentWithWallet` base class.

## Installation

```bash
cd AI-Agents-Library
npm install @nirholas/x402-ecosystem
```

## Integration Steps

### 1. Create AgentWithWallet Base Class

```typescript
// src/core/agent-with-wallet.ts
import { 
  PayableAgent, 
  YieldingWallet,
  type PayableAgentConfig,
  type BalanceInfo,
  type PaymentResult,
} from "@nirholas/x402-ecosystem";

/**
 * Base class for AI agents with integrated cryptocurrency wallet
 * 
 * @example
 * ```typescript
 * class MyAgent extends AgentWithWallet {
 *   async execute() {
 *     // Access wallet features
 *     const balance = await this.getBalance();
 *     
 *     // Pay for premium API
 *     const data = await this.payForService("https://premium.api.com/data");
 *     
 *     return this.processData(data);
 *   }
 * }
 * ```
 */
export abstract class AgentWithWallet {
  protected readonly wallet: PayableAgent;
  protected readonly yieldWallet: YieldingWallet;
  private readonly name: string;
  
  constructor(name: string, config: PayableAgentConfig = {}) {
    this.name = name;
    
    this.wallet = new PayableAgent({
      chain: config.chain ?? "eip155:42161",
      maxDailySpend: config.maxDailySpend ?? "10.00",
      maxPaymentPerRequest: config.maxPaymentPerRequest ?? "1.00",
      enableYield: config.enableYield ?? true,
      ...config,
    });
    
    this.yieldWallet = new YieldingWallet({
      address: this.wallet.address,
      autoConvert: config.enableYield ?? true,
    });
  }
  
  /** Get agent name */
  getName(): string {
    return this.name;
  }
  
  /** Get wallet address */
  getAddress(): `0x${string}` {
    return this.wallet.address;
  }
  
  /** Check if wallet is configured for payments */
  isPaymentEnabled(): boolean {
    return this.wallet.isConfigured;
  }
  
  /** Get current balance */
  async getBalance(): Promise<BalanceInfo> {
    return this.wallet.getBalance();
  }
  
  /** Pay for a service endpoint */
  protected async payForService(endpoint: string): Promise<PaymentResult> {
    if (!this.isPaymentEnabled()) {
      throw new Error("Payment not enabled - configure X402_PRIVATE_KEY");
    }
    return this.wallet.payForService(endpoint);
  }
  
  /** Get yield information for USDs holdings */
  async getYieldInfo() {
    return this.yieldWallet.getYieldInfo();
  }
  
  /** Abstract method - implement agent logic */
  abstract execute(...args: unknown[]): Promise<unknown>;
}
```

### 2. Create Specialized Agent Templates

#### Research Agent with Wallet

```typescript
// src/agents/research-agent.ts
import { AgentWithWallet } from "../core/agent-with-wallet.js";

export interface ResearchQuery {
  topic: string;
  sources?: string[];
  depth?: "quick" | "standard" | "deep";
}

export class ResearchAgent extends AgentWithWallet {
  private readonly premiumSources = [
    "https://api.premium-research.com",
    "https://api.advanced-analytics.io",
  ];
  
  constructor(config = {}) {
    super("research-agent", {
      maxDailySpend: "5.00",
      approvedServices: [
        "api.coingecko.com",
        "api.defillama.com",
        "api.premium-research.com",
        "api.advanced-analytics.io",
      ],
      ...config,
    });
  }
  
  async execute(query: ResearchQuery): Promise<ResearchResult> {
    const results: ResearchResult = {
      topic: query.topic,
      sources: [],
      insights: [],
      cost: "0.00",
    };
    
    // Gather from free sources first
    const freeData = await this.gatherFreeSources(query);
    results.sources.push(...freeData);
    
    // If deep research requested, use paid sources
    if (query.depth === "deep") {
      for (const source of this.premiumSources) {
        try {
          const payment = await this.payForService(
            `${source}/research?topic=${encodeURIComponent(query.topic)}`
          );
          
          if (payment.success) {
            results.cost = this.addCosts(results.cost, payment.amount);
            // Fetch and add premium data
          }
        } catch (error) {
          console.warn(`Premium source ${source} failed:`, error);
        }
      }
    }
    
    return results;
  }
  
  private async gatherFreeSources(query: ResearchQuery) {
    // Implement free source gathering
    return [];
  }
  
  private addCosts(a: string, b: string): string {
    return (parseFloat(a) + parseFloat(b)).toFixed(4);
  }
}

interface ResearchResult {
  topic: string;
  sources: unknown[];
  insights: string[];
  cost: string;
}
```

#### Trading Agent with Wallet

```typescript
// src/agents/trading-agent.ts
import { AgentWithWallet } from "../core/agent-with-wallet.js";

export interface TradeSignal {
  action: "buy" | "sell" | "hold";
  asset: string;
  confidence: number;
  reason: string;
}

export class TradingAgent extends AgentWithWallet {
  constructor(config = {}) {
    super("trading-agent", {
      maxDailySpend: "20.00", // Higher limit for trading signals
      maxPaymentPerRequest: "2.00",
      approvedServices: [
        "api.trading-signals.pro",
        "api.onchain-analytics.com",
      ],
      ...config,
    });
  }
  
  async execute(asset: string): Promise<TradeSignal> {
    // Get premium trading signals (paid)
    const signals = await this.payForService(
      `https://api.trading-signals.pro/signal/${asset}`
    );
    
    // Get on-chain analytics (paid)
    const analytics = await this.payForService(
      `https://api.onchain-analytics.com/asset/${asset}`
    );
    
    return this.analyzeAndDecide(asset, signals, analytics);
  }
  
  private analyzeAndDecide(
    asset: string, 
    signals: unknown, 
    analytics: unknown
  ): TradeSignal {
    // Implement trading logic
    return {
      action: "hold",
      asset,
      confidence: 0.5,
      reason: "Analysis pending",
    };
  }
}
```

### 3. Create Agent Registry

```typescript
// src/registry.ts
import { AgentWithWallet } from "./core/agent-with-wallet.js";
import { ResearchAgent } from "./agents/research-agent.js";
import { TradingAgent } from "./agents/trading-agent.js";
import { ToolMarketplace } from "@nirholas/x402-ecosystem";

type AgentType = "research" | "trading" | "analysis";

const agentRegistry: Record<AgentType, new (config?: unknown) => AgentWithWallet> = {
  research: ResearchAgent,
  trading: TradingAgent,
  analysis: ResearchAgent, // Alias
};

/**
 * Create an agent by type
 */
export function createAgent(
  type: AgentType,
  config?: unknown
): AgentWithWallet {
  const AgentClass = agentRegistry[type];
  if (!AgentClass) {
    throw new Error(`Unknown agent type: ${type}`);
  }
  return new AgentClass(config);
}

/**
 * Create an agent from environment variables
 */
export function createAgentFromEnv(type: AgentType): AgentWithWallet {
  return createAgent(type, {
    privateKey: process.env.X402_PRIVATE_KEY,
    chain: process.env.X402_CHAIN ?? "eip155:42161",
    maxDailySpend: process.env.X402_MAX_DAILY_SPEND ?? "10.00",
    enableYield: process.env.X402_AUTO_YIELD === "true",
  });
}

/**
 * Register an agent as a paid service
 */
export async function registerAgentAsService(
  agent: AgentWithWallet,
  options: {
    endpoint: string;
    price: string;
    description?: string;
  }
) {
  const marketplace = new ToolMarketplace();
  
  return marketplace.registerTool({
    name: agent.getName(),
    description: options.description ?? `AI Agent: ${agent.getName()}`,
    endpoint: options.endpoint,
    price: options.price,
    owner: agent.getAddress(),
  });
}
```

### 4. Export Everything

```typescript
// src/index.ts
export { AgentWithWallet } from "./core/agent-with-wallet.js";
export { ResearchAgent, type ResearchQuery } from "./agents/research-agent.js";
export { TradingAgent, type TradeSignal } from "./agents/trading-agent.js";
export { 
  createAgent, 
  createAgentFromEnv, 
  registerAgentAsService 
} from "./registry.js";

// Re-export useful types from x402-ecosystem
export type { 
  BalanceInfo, 
  PaymentResult,
  PayableAgentConfig,
} from "@nirholas/x402-ecosystem";
```

## Example Usage

```typescript
import { 
  createAgentFromEnv, 
  ResearchAgent,
  registerAgentAsService 
} from "@nirholas/ai-agents-library";

// Create agent from environment
const agent = createAgentFromEnv("research");

// Check status
console.log(`Agent: ${agent.getName()}`);
console.log(`Address: ${agent.getAddress()}`);
console.log(`Payment enabled: ${agent.isPaymentEnabled()}`);

// Execute research
const result = await agent.execute({
  topic: "Ethereum Layer 2 scaling",
  depth: "deep",
});

console.log(`Research cost: $${result.cost}`);

// Register agent as a service others can pay for
await registerAgentAsService(agent, {
  endpoint: "https://agents.nirholas.dev/research",
  price: "0.25", // $0.25 per research query
  description: "Premium AI research agent with access to paid sources",
});
```

## Testing

```typescript
// test/agent-with-wallet.test.ts
import { describe, it, expect, vi } from "vitest";
import { AgentWithWallet } from "../src/core/agent-with-wallet.js";

class TestAgent extends AgentWithWallet {
  async execute() {
    return { success: true };
  }
}

describe("AgentWithWallet", () => {
  it("should initialize with default config", () => {
    const agent = new TestAgent("test-agent");
    expect(agent.getName()).toBe("test-agent");
  });
  
  it("should track balance when configured", async () => {
    const agent = new TestAgent("test-agent", {
      privateKey: "0x" + "a".repeat(64) as `0x${string}`,
    });
    
    expect(agent.isPaymentEnabled()).toBe(true);
    expect(agent.getAddress()).toMatch(/^0x/);
  });
});
```

## Package.json Updates

```json
{
  "name": "@nirholas/ai-agents-library",
  "dependencies": {
    "@nirholas/x402-ecosystem": "^0.1.0"
  },
  "exports": {
    ".": "./dist/index.js",
    "./agents/*": "./dist/agents/*.js",
    "./core": "./dist/core/index.js"
  }
}
```

## Next Steps

1. Clone AI-Agents-Library repository
2. Add @nirholas/x402-ecosystem dependency
3. Create AgentWithWallet base class
4. Update existing agents to extend AgentWithWallet
5. Add registry and factory functions
6. Publish updated package

## Related Links

- [x402-ecosystem package](../../packages/x402-ecosystem/)
- [defi-agents integration](./defi-agents.md)
- [AI-Agents-Library repository](https://github.com/nirholas/AI-Agents-Library)
