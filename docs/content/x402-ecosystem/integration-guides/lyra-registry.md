# lyra-registry Integration Guide

> Integrate tool pricing with registry in nirholas/lyra-registry

## Overview

The `lyra-registry` repository (9⭐) is a tool registry for AI agents. This guide shows how to add pricing metadata to tools and integrate with the ToolRegistry.sol smart contract from x402-stablecoin.

## Installation

```bash
cd lyra-registry
npm install @nirholas/x402-ecosystem
```

## Integration Steps

### 1. Extend Tool Schema with Pricing

```typescript
// src/types/tool.ts
import type { Address } from "@nirholas/x402-ecosystem";

/**
 * Tool pricing configuration
 */
export interface ToolPricing {
  /** Pricing model */
  model: "free" | "per-request" | "subscription" | "tiered";
  
  /** Price per request (for per-request model) */
  pricePerRequest?: string;
  
  /** Subscription prices */
  subscription?: {
    monthly?: string;
    yearly?: string;
  };
  
  /** Tiered pricing */
  tiers?: Array<{
    name: string;
    maxRequests: number;
    price: string;
  }>;
  
  /** Accepted tokens */
  acceptedTokens: ("USDC" | "USDs")[];
  
  /** Supported chains */
  supportedChains: string[];
}

/**
 * Extended tool definition with pricing
 */
export interface PricedTool {
  // Existing fields
  id: string;
  name: string;
  description: string;
  endpoint: string;
  schema: ToolSchema;
  
  // New pricing fields
  pricing: ToolPricing;
  owner: Address;
  verified: boolean;
  registryAddress?: Address; // On-chain registry address
}

interface ToolSchema {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}
```

### 2. Create Registry Integration Service

```typescript
// src/services/registry.ts
import { 
  ToolMarketplace, 
  type Address,
  type MarketplaceTool,
} from "@nirholas/x402-ecosystem";
import type { PricedTool, ToolPricing } from "../types/tool.js";

/**
 * Registry service that syncs with x402 ToolRegistry contract
 */
export class RegistryService {
  private readonly marketplace: ToolMarketplace;
  private readonly localTools: Map<string, PricedTool> = new Map();
  
  constructor(config?: { registryUrl?: string }) {
    this.marketplace = new ToolMarketplace({
      registryUrl: config?.registryUrl,
    });
  }
  
  /**
   * Register a tool with pricing
   */
  async registerTool(tool: PricedTool): Promise<string> {
    // Validate pricing
    this.validatePricing(tool.pricing);
    
    // Register locally
    this.localTools.set(tool.id, tool);
    
    // Register with x402 marketplace for discovery
    const marketplaceListing = await this.marketplace.registerTool({
      name: tool.name,
      description: tool.description,
      endpoint: tool.endpoint,
      price: this.getPrimaryPrice(tool.pricing),
      owner: tool.owner,
      category: "Tool",
      metadata: {
        schema: tool.schema,
        pricingModel: tool.pricing.model,
        fullPricing: tool.pricing,
      },
    });
    
    return marketplaceListing.id;
  }
  
  /**
   * Get primary price for marketplace listing
   */
  private getPrimaryPrice(pricing: ToolPricing): string {
    switch (pricing.model) {
      case "free":
        return "0";
      case "per-request":
        return pricing.pricePerRequest ?? "0";
      case "subscription":
        return pricing.subscription?.monthly ?? "0";
      case "tiered":
        return pricing.tiers?.[0]?.price ?? "0";
      default:
        return "0";
    }
  }
  
  /**
   * Validate pricing configuration
   */
  private validatePricing(pricing: ToolPricing): void {
    if (pricing.model === "per-request" && !pricing.pricePerRequest) {
      throw new Error("Per-request pricing requires pricePerRequest");
    }
    if (pricing.model === "subscription" && !pricing.subscription) {
      throw new Error("Subscription pricing requires subscription config");
    }
    if (pricing.model === "tiered" && !pricing.tiers?.length) {
      throw new Error("Tiered pricing requires tiers");
    }
    if (!pricing.acceptedTokens.length) {
      throw new Error("Must specify at least one accepted token");
    }
  }
  
  /**
   * Discover tools by criteria
   */
  async discoverTools(filters: {
    maxPrice?: string;
    category?: string;
    search?: string;
    pricingModel?: ToolPricing["model"];
  }): Promise<PricedTool[]> {
    // Get from x402 marketplace
    const marketplaceTools = await this.marketplace.discoverTools({
      maxPrice: filters.maxPrice,
      search: filters.search,
    });
    
    // Filter by pricing model if specified
    let results = marketplaceTools.map(t => this.toLocalTool(t));
    
    if (filters.pricingModel) {
      results = results.filter(t => t.pricing.model === filters.pricingModel);
    }
    
    return results;
  }
  
  /**
   * Convert marketplace tool to local format
   */
  private toLocalTool(tool: MarketplaceTool): PricedTool {
    const fullPricing = (tool.metadata?.fullPricing as ToolPricing) ?? {
      model: parseFloat(tool.price) > 0 ? "per-request" : "free",
      pricePerRequest: tool.price,
      acceptedTokens: [tool.token as "USDC" | "USDs"],
      supportedChains: ["eip155:8453"],
    };
    
    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      endpoint: tool.endpoint,
      schema: (tool.metadata?.schema as any) ?? { input: {}, output: {} },
      pricing: fullPricing,
      owner: tool.owner,
      verified: true,
    };
  }
  
  /**
   * Get tool by ID
   */
  async getTool(id: string): Promise<PricedTool | null> {
    // Check local cache first
    if (this.localTools.has(id)) {
      return this.localTools.get(id)!;
    }
    
    // Fetch from marketplace
    const tool = await this.marketplace.getTool(id);
    return tool ? this.toLocalTool(tool) : null;
  }
  
  /**
   * Update tool pricing
   */
  async updatePricing(toolId: string, pricing: ToolPricing): Promise<void> {
    this.validatePricing(pricing);
    
    const tool = this.localTools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    
    tool.pricing = pricing;
    this.localTools.set(toolId, tool);
    
    // Update marketplace listing
    await this.marketplace.updateTool(toolId, {
      price: this.getPrimaryPrice(pricing),
      metadata: {
        ...tool.schema,
        pricingModel: pricing.model,
        fullPricing: pricing,
      },
    });
  }
}
```

### 3. Create Tool Discovery API

```typescript
// src/api/tools.ts
import { Router } from "express";
import { RegistryService } from "../services/registry.js";

const router = Router();
const registry = new RegistryService();

/**
 * GET /api/tools
 * List tools with optional filters
 */
router.get("/", async (req, res) => {
  const { maxPrice, category, search, pricingModel, page = 1, limit = 20 } = req.query;
  
  const tools = await registry.discoverTools({
    maxPrice: maxPrice as string,
    category: category as string,
    search: search as string,
    pricingModel: pricingModel as any,
  });
  
  // Paginate
  const startIndex = (Number(page) - 1) * Number(limit);
  const paginated = tools.slice(startIndex, startIndex + Number(limit));
  
  res.json({
    success: true,
    data: paginated,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: tools.length,
      totalPages: Math.ceil(tools.length / Number(limit)),
    },
  });
});

/**
 * GET /api/tools/:id
 * Get tool details
 */
router.get("/:id", async (req, res) => {
  const tool = await registry.getTool(req.params.id);
  
  if (!tool) {
    return res.status(404).json({ error: "Tool not found" });
  }
  
  res.json({
    success: true,
    data: tool,
  });
});

/**
 * POST /api/tools
 * Register a new tool
 */
router.post("/", async (req, res) => {
  try {
    const id = await registry.registerTool(req.body);
    
    res.status(201).json({
      success: true,
      id,
      message: "Tool registered successfully",
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Registration failed",
    });
  }
});

/**
 * PATCH /api/tools/:id/pricing
 * Update tool pricing
 */
router.patch("/:id/pricing", async (req, res) => {
  try {
    await registry.updatePricing(req.params.id, req.body);
    
    res.json({
      success: true,
      message: "Pricing updated",
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Update failed",
    });
  }
});

export default router;
```

### 4. Create On-Chain Registry Integration

```typescript
// src/services/onchain-registry.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import type { Address } from "@nirholas/x402-ecosystem";

// ToolRegistry.sol ABI (from x402-stablecoin)
const TOOL_REGISTRY_ABI = [
  {
    name: "registerTool",
    type: "function",
    inputs: [
      { name: "name", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "price", type: "uint256" },
      { name: "token", type: "address" },
    ],
    outputs: [{ name: "toolId", type: "uint256" }],
  },
  {
    name: "getTool",
    type: "function",
    inputs: [{ name: "toolId", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "price", type: "uint256" },
      { name: "token", type: "address" },
      { name: "owner", type: "address" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    name: "updatePrice",
    type: "function",
    inputs: [
      { name: "toolId", type: "uint256" },
      { name: "newPrice", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export class OnChainRegistry {
  private readonly publicClient;
  private readonly walletClient;
  private readonly registryAddress: Address;
  
  constructor(config: {
    registryAddress: Address;
    privateKey?: `0x${string}`;
  }) {
    this.registryAddress = config.registryAddress;
    
    this.publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(),
    });
    
    if (config.privateKey) {
      const account = privateKeyToAccount(config.privateKey);
      this.walletClient = createWalletClient({
        account,
        chain: arbitrum,
        transport: http(),
      });
    }
  }
  
  /**
   * Register tool on-chain
   */
  async registerOnChain(tool: {
    name: string;
    endpoint: string;
    price: bigint;
    tokenAddress: Address;
  }): Promise<bigint> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured for on-chain registration");
    }
    
    const hash = await this.walletClient.writeContract({
      address: this.registryAddress,
      abi: TOOL_REGISTRY_ABI,
      functionName: "registerTool",
      args: [tool.name, tool.endpoint, tool.price, tool.tokenAddress],
    });
    
    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    
    // Extract tool ID from logs (simplified)
    return BigInt(0); // Return actual tool ID from event
  }
  
  /**
   * Get tool from on-chain registry
   */
  async getOnChainTool(toolId: bigint) {
    const result = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: TOOL_REGISTRY_ABI,
      functionName: "getTool",
      args: [toolId],
    });
    
    return {
      name: result[0],
      endpoint: result[1],
      price: result[2],
      token: result[3],
      owner: result[4],
      active: result[5],
    };
  }
  
  /**
   * Update tool price on-chain
   */
  async updateOnChainPrice(toolId: bigint, newPrice: bigint): Promise<void> {
    if (!this.walletClient) {
      throw new Error("Wallet not configured");
    }
    
    const hash = await this.walletClient.writeContract({
      address: this.registryAddress,
      abi: TOOL_REGISTRY_ABI,
      functionName: "updatePrice",
      args: [toolId, newPrice],
    });
    
    await this.publicClient.waitForTransactionReceipt({ hash });
  }
}
```

### 5. Create Tool Pricing Widget

```typescript
// src/components/ToolPricingWidget.tsx
import React from "react";
import type { ToolPricing } from "../types/tool.js";

interface Props {
  pricing: ToolPricing;
}

export function ToolPricingWidget({ pricing }: Props) {
  return (
    <div className="pricing-widget">
      {pricing.model === "free" && (
        <div className="free-badge">Free</div>
      )}
      
      {pricing.model === "per-request" && (
        <div className="per-request">
          <span className="price">${pricing.pricePerRequest}</span>
          <span className="label">per request</span>
        </div>
      )}
      
      {pricing.model === "subscription" && (
        <div className="subscription">
          {pricing.subscription?.monthly && (
            <div className="tier">
              <span className="price">${pricing.subscription.monthly}</span>
              <span className="label">/month</span>
            </div>
          )}
          {pricing.subscription?.yearly && (
            <div className="tier yearly">
              <span className="price">${pricing.subscription.yearly}</span>
              <span className="label">/year</span>
              <span className="savings">Save 20%</span>
            </div>
          )}
        </div>
      )}
      
      {pricing.model === "tiered" && (
        <div className="tiered">
          {pricing.tiers?.map((tier, i) => (
            <div key={i} className="tier">
              <span className="name">{tier.name}</span>
              <span className="limit">{tier.maxRequests.toLocaleString()} req</span>
              <span className="price">${tier.price}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="accepted-tokens">
        Accepts: {pricing.acceptedTokens.join(", ")}
      </div>
    </div>
  );
}
```

## Tool Manifest Examples

### Free Tool
```json
{
  "id": "weather-basic",
  "name": "Basic Weather",
  "endpoint": "https://api.example.com/weather",
  "pricing": {
    "model": "free",
    "acceptedTokens": [],
    "supportedChains": []
  }
}
```

### Per-Request Tool
```json
{
  "id": "ai-summary",
  "name": "AI Summarizer",
  "endpoint": "https://api.example.com/summarize",
  "pricing": {
    "model": "per-request",
    "pricePerRequest": "0.01",
    "acceptedTokens": ["USDC", "USDs"],
    "supportedChains": ["eip155:8453", "eip155:42161"]
  }
}
```

### Tiered Tool
```json
{
  "id": "data-analytics",
  "name": "Data Analytics Pro",
  "endpoint": "https://api.example.com/analytics",
  "pricing": {
    "model": "tiered",
    "tiers": [
      { "name": "Starter", "maxRequests": 100, "price": "0" },
      { "name": "Pro", "maxRequests": 1000, "price": "9.99" },
      { "name": "Enterprise", "maxRequests": 10000, "price": "49.99" }
    ],
    "acceptedTokens": ["USDC"],
    "supportedChains": ["eip155:8453"]
  }
}
```

## Testing

```typescript
// test/registry.test.ts
import { describe, it, expect } from "vitest";
import { RegistryService } from "../src/services/registry.js";

describe("RegistryService", () => {
  it("should register tool with valid pricing", async () => {
    const registry = new RegistryService();
    
    const id = await registry.registerTool({
      id: "test-tool",
      name: "Test Tool",
      description: "A test tool",
      endpoint: "https://test.com/api",
      schema: { input: {}, output: {} },
      pricing: {
        model: "per-request",
        pricePerRequest: "0.01",
        acceptedTokens: ["USDC"],
        supportedChains: ["eip155:8453"],
      },
      owner: "0x..." as any,
      verified: false,
    });
    
    expect(id).toBeDefined();
  });
  
  it("should reject invalid pricing", async () => {
    const registry = new RegistryService();
    
    await expect(registry.registerTool({
      id: "bad-tool",
      name: "Bad Tool",
      pricing: {
        model: "per-request",
        // Missing pricePerRequest
        acceptedTokens: [],
        supportedChains: [],
      },
    } as any)).rejects.toThrow();
  });
});
```

## Next Steps

1. Clone lyra-registry repository
2. Add @nirholas/x402-ecosystem dependency
3. Extend tool schema with pricing
4. Create registry integration service
5. Add on-chain registry support
6. Build pricing UI components
7. Update documentation

## Related Links

- [x402-ecosystem package](../../packages/x402-ecosystem/)
- [ToolRegistry.sol contract](https://github.com/nirholas/x402-stablecoin/contracts/ToolRegistry.sol)
- [lyra-registry repository](https://github.com/nirholas/lyra-registry)
