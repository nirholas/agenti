# defi-agents Integration Guide

> Add x402 payment capabilities to AI agent definitions in nirholas/defi-agents

## Overview

The `defi-agents` repository contains agent definitions and specifications. This guide shows how to add payment capabilities to make agents able to pay for services and receive payments.

## Installation

```bash
cd defi-agents
npm install @nirholas/x402-ecosystem
```

## Integration Steps

### 1. Create PayableAgent Interface

Add a new interface that extends your existing agent interface:

```typescript
// src/interfaces/payable-agent.ts
import { PayableAgent, PaymentCapabilities } from "@nirholas/x402-ecosystem";
import type { Address } from "@nirholas/x402-ecosystem";

/**
 * Interface for agents with payment capabilities
 */
export interface IPayableAgent {
  /** Agent's wallet address */
  address: Address;
  
  /** Check if agent can make payments */
  canPay(): boolean;
  
  /** Check if agent can receive payments */
  canReceive(): boolean;
  
  /** Get payment capabilities */
  getCapabilities(): PaymentCapabilities;
  
  /** Pay for a service */
  payForService(endpoint: string): Promise<PaymentResult>;
  
  /** Get balance */
  getBalance(): Promise<BalanceInfo>;
}

/**
 * Configuration for payable agents
 */
export interface PayableAgentConfig {
  /** Private key (optional, can be provided at runtime) */
  privateKey?: `0x${string}`;
  
  /** Default chain for payments */
  chain?: "eip155:42161" | "eip155:8453";
  
  /** Maximum daily spend limit */
  maxDailySpend?: string;
  
  /** Maximum per-request spend */
  maxPaymentPerRequest?: string;
  
  /** Approved service domains */
  approvedServices?: string[];
  
  /** Enable auto-yield with USDs */
  enableYield?: boolean;
}
```

### 2. Create PayableAgent Base Class

```typescript
// src/agents/payable-agent.ts
import { PayableAgent as X402PayableAgent } from "@nirholas/x402-ecosystem";
import type { IPayableAgent, PayableAgentConfig } from "../interfaces/payable-agent.js";

export abstract class PayableAgentBase implements IPayableAgent {
  protected paymentAgent: X402PayableAgent;
  
  constructor(config: PayableAgentConfig = {}) {
    this.paymentAgent = new X402PayableAgent({
      privateKey: config.privateKey,
      chain: config.chain ?? "eip155:42161",
      maxDailySpend: config.maxDailySpend ?? "10.00",
      maxPaymentPerRequest: config.maxPaymentPerRequest ?? "1.00",
      approvedServices: config.approvedServices,
      enableYield: config.enableYield ?? true,
    });
  }
  
  get address() {
    return this.paymentAgent.address;
  }
  
  canPay(): boolean {
    return this.paymentAgent.getCapabilities().canPay;
  }
  
  canReceive(): boolean {
    return this.paymentAgent.getCapabilities().canReceive;
  }
  
  getCapabilities() {
    return this.paymentAgent.getCapabilities();
  }
  
  async payForService(endpoint: string) {
    return this.paymentAgent.payForService(endpoint);
  }
  
  async getBalance() {
    return this.paymentAgent.getBalance();
  }
}
```

### 3. Update Existing Agent Definitions

Convert existing agents to use payment capabilities:

```typescript
// src/agents/research-agent.ts
import { PayableAgentBase } from "./payable-agent.js";

export class ResearchAgent extends PayableAgentBase {
  constructor(config = {}) {
    super({
      ...config,
      maxDailySpend: "5.00", // Limit for research APIs
      approvedServices: [
        "api.coingecko.com",
        "api.defillama.com",
        "api.premium-research.com",
      ],
    });
  }
  
  async researchToken(symbol: string) {
    // If premium endpoint requires payment, agent can pay automatically
    const data = await this.payForService(
      `https://api.premium-research.com/token/${symbol}`
    );
    return this.processResearchData(data);
  }
  
  private processResearchData(data: unknown) {
    // ... process data
    return data;
  }
}
```

### 4. Add Agent Factory

```typescript
// src/factory.ts
import { ResearchAgent } from "./agents/research-agent.js";
import { TradingAgent } from "./agents/trading-agent.js";
import type { PayableAgentConfig } from "./interfaces/payable-agent.js";

export function createPayableAgent(
  type: "research" | "trading" | "analysis",
  config: PayableAgentConfig = {}
) {
  switch (type) {
    case "research":
      return new ResearchAgent(config);
    case "trading":
      return new TradingAgent(config);
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
}

// Create from environment
export function createAgentFromEnv(type: "research" | "trading" | "analysis") {
  return createPayableAgent(type, {
    privateKey: process.env.X402_PRIVATE_KEY as `0x${string}`,
    chain: (process.env.X402_CHAIN ?? "eip155:42161") as "eip155:42161",
    maxDailySpend: process.env.X402_MAX_DAILY_SPEND ?? "10.00",
    enableYield: process.env.X402_AUTO_YIELD === "true",
  });
}
```

## Example Usage

```typescript
import { createAgentFromEnv } from "@nirholas/defi-agents";

// Create a payment-capable research agent
const agent = createAgentFromEnv("research");

// Check capabilities
console.log(`Agent address: ${agent.address}`);
console.log(`Can pay: ${agent.canPay()}`);

// Get balance
const balance = await agent.getBalance();
console.log(`USDC: $${balance.usdc}`);
console.log(`USDs: $${balance.usds}`);

// Use paid service
const research = await agent.researchToken("ETH");
```

## Revenue Model

Agents can also receive payments for services they provide:

```typescript
import { ToolMarketplace } from "@nirholas/x402-ecosystem";

// Register agent as a paid service
const marketplace = new ToolMarketplace();

await marketplace.registerTool({
  name: "premium-research-agent",
  description: "AI-powered research agent with paid APIs access",
  endpoint: "https://agents.nirholas.dev/research",
  price: "0.10", // $0.10 per research request
  owner: agent.address,
  revenueSplit: [
    { address: agent.address, percentage: 80 },
    { address: "0x...", percentage: 20 }, // Platform fee
  ],
});
```

## Testing

```typescript
// test/payable-agent.test.ts
import { describe, it, expect } from "vitest";
import { ResearchAgent } from "../src/agents/research-agent.js";

describe("PayableAgent", () => {
  it("should create agent with payment capabilities", () => {
    const agent = new ResearchAgent({
      privateKey: "0x..." as `0x${string}`,
    });
    
    expect(agent.canPay()).toBe(true);
    expect(agent.address).toMatch(/^0x/);
  });
  
  it("should respect spending limits", async () => {
    const agent = new ResearchAgent({
      maxDailySpend: "1.00",
      maxPaymentPerRequest: "0.10",
    });
    
    const capabilities = agent.getCapabilities();
    expect(capabilities.maxPaymentPerRequest).toBe("0.10");
  });
});
```

## Next Steps

1. Clone the defi-agents repository
2. Add @nirholas/x402-ecosystem as a dependency
3. Create the PayableAgent interface and base class
4. Update existing agent definitions
5. Add tests and documentation
6. Publish updated package

## Related Links

- [x402-ecosystem package](../../packages/x402-ecosystem/)
- [PayableAgent API Reference](../api/payable-agent.md)
- [defi-agents repository](https://github.com/nirholas/defi-agents)
