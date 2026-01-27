# plugin.delivery Integration Guide

> Add x402 pricing to plugin marketplace in nirholas/plugin.delivery

## Overview

The `plugin.delivery` repository (9⭐) is a plugin marketplace. This guide shows how to add x402 pricing for paid plugin distribution with revenue sharing via x402RevenueSplitter.

## Installation

```bash
cd plugin.delivery
npm install @nirholas/x402-ecosystem
```

## Integration Steps

### 1. Add Pricing Schema to Plugins

```typescript
// src/types/plugin.ts
import type { Address } from "@nirholas/x402-ecosystem";

/**
 * Plugin pricing configuration
 */
export interface PluginPricing {
  type: "free" | "paid" | "freemium" | "subscription";
  price?: string; // USD amount
  currency?: "USDC" | "USDs";
  period?: "one-time" | "monthly" | "yearly";
  trialDays?: number;
  revenueSplit?: RevenueSplitConfig[];
}

/**
 * Revenue split configuration
 */
export interface RevenueSplitConfig {
  address: Address;
  percentage: number;
  label: string;
}

/**
 * Extended plugin definition with pricing
 */
export interface PaidPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: {
    name: string;
    address: Address;
  };
  pricing: PluginPricing;
  downloads: number;
  rating: number;
  verified: boolean;
  categories: string[];
  repository?: string;
  homepage?: string;
}
```

### 2. Create Plugin Payment Service

```typescript
// src/services/payment.ts
import { 
  PayableAgent, 
  ToolMarketplace,
  type PaymentResult,
} from "@nirholas/x402-ecosystem";
import type { PaidPlugin, RevenueSplitConfig } from "../types/plugin.js";

export class PluginPaymentService {
  private readonly marketplace: ToolMarketplace;
  private readonly platformAddress: `0x${string}`;
  private readonly platformFee: number;
  
  constructor(config: {
    platformAddress: `0x${string}`;
    platformFee?: number; // Default 10%
  }) {
    this.marketplace = new ToolMarketplace();
    this.platformAddress = config.platformAddress;
    this.platformFee = config.platformFee ?? 10;
  }
  
  /**
   * Process plugin purchase
   */
  async purchasePlugin(
    plugin: PaidPlugin,
    buyer: PayableAgent
  ): Promise<PaymentResult> {
    if (plugin.pricing.type === "free") {
      return {
        success: true,
        amount: "0",
        token: "USDC",
        recipient: plugin.author.address,
        chain: "eip155:8453",
        timestamp: Date.now(),
      };
    }
    
    const price = plugin.pricing.price ?? "0";
    
    // Create payment with revenue split
    const revenueSplit = this.calculateRevenueSplit(plugin);
    
    // Process payment through x402
    return buyer.payWithRevenueSplit(
      price,
      revenueSplit,
      `Purchase: ${plugin.name} v${plugin.version}`
    );
  }
  
  /**
   * Calculate revenue split for a plugin
   */
  private calculateRevenueSplit(plugin: PaidPlugin): RevenueSplitConfig[] {
    // If custom split defined, use it
    if (plugin.pricing.revenueSplit?.length) {
      return this.ensurePlatformFee(plugin.pricing.revenueSplit);
    }
    
    // Default split: 90% to author, 10% to platform
    return [
      {
        address: plugin.author.address,
        percentage: 100 - this.platformFee,
        label: "author",
      },
      {
        address: this.platformAddress,
        percentage: this.platformFee,
        label: "platform",
      },
    ];
  }
  
  /**
   * Ensure platform fee is included in split
   */
  private ensurePlatformFee(
    split: RevenueSplitConfig[]
  ): RevenueSplitConfig[] {
    const platformEntry = split.find(s => s.label === "platform");
    
    if (!platformEntry) {
      // Reduce all other percentages proportionally to add platform fee
      const scaleFactor = (100 - this.platformFee) / 100;
      const adjusted = split.map(s => ({
        ...s,
        percentage: s.percentage * scaleFactor,
      }));
      
      adjusted.push({
        address: this.platformAddress,
        percentage: this.platformFee,
        label: "platform",
      });
      
      return adjusted;
    }
    
    return split;
  }
  
  /**
   * Register plugin with x402 marketplace
   */
  async registerPluginForPayments(plugin: PaidPlugin): Promise<void> {
    if (plugin.pricing.type === "free") return;
    
    await this.marketplace.registerTool({
      name: `plugin-${plugin.id}`,
      description: plugin.description,
      endpoint: `https://plugin.delivery/api/plugins/${plugin.id}/download`,
      price: plugin.pricing.price ?? "0",
      owner: plugin.author.address,
      category: "Plugin",
      revenueSplit: this.calculateRevenueSplit(plugin),
    });
  }
}
```

### 3. Create Pricing UI Components

```typescript
// src/components/PluginPricing.tsx
import React from "react";
import type { PluginPricing } from "../types/plugin.js";

interface Props {
  pricing: PluginPricing;
  onPurchase: () => void;
  isPurchasing: boolean;
}

export function PluginPricingCard({ pricing, onPurchase, isPurchasing }: Props) {
  if (pricing.type === "free") {
    return (
      <div className="pricing-card free">
        <span className="price">Free</span>
        <button onClick={onPurchase} disabled={isPurchasing}>
          Install
        </button>
      </div>
    );
  }
  
  const priceDisplay = formatPrice(pricing.price ?? "0", pricing.period);
  
  return (
    <div className="pricing-card paid">
      <span className="price">${priceDisplay}</span>
      {pricing.trialDays && (
        <span className="trial">{pricing.trialDays}-day free trial</span>
      )}
      <button 
        onClick={onPurchase} 
        disabled={isPurchasing}
        className="purchase-btn"
      >
        {isPurchasing ? "Processing..." : "Purchase with USDC"}
      </button>
      <span className="payment-info">
        Powered by x402 • Instant settlement
      </span>
    </div>
  );
}

function formatPrice(price: string, period?: string): string {
  switch (period) {
    case "monthly": return `${price}/mo`;
    case "yearly": return `${price}/yr`;
    case "one-time": return price;
    default: return price;
  }
}
```

### 4. Create Purchase Flow

```typescript
// src/hooks/usePurchase.ts
import { useState } from "react";
import { PayableAgent } from "@nirholas/x402-ecosystem";
import { PluginPaymentService } from "../services/payment.js";
import type { PaidPlugin } from "../types/plugin.js";

export function usePurchasePlugin() {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const purchase = async (plugin: PaidPlugin, privateKey: `0x${string}`) => {
    setIsPurchasing(true);
    setError(null);
    
    try {
      const agent = new PayableAgent({
        privateKey,
        maxPaymentPerRequest: plugin.pricing.price ?? "100",
      });
      
      const service = new PluginPaymentService({
        platformAddress: process.env.NEXT_PUBLIC_PLATFORM_ADDRESS as `0x${string}`,
      });
      
      const result = await service.purchasePlugin(plugin, agent);
      
      if (result.success) {
        // Grant access to plugin
        await grantPluginAccess(plugin.id, agent.address);
        return result;
      } else {
        throw new Error(result.error ?? "Payment failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsPurchasing(false);
    }
  };
  
  return { purchase, isPurchasing, error };
}

async function grantPluginAccess(pluginId: string, address: string) {
  // Record purchase and grant access
  await fetch("/api/plugins/grant-access", {
    method: "POST",
    body: JSON.stringify({ pluginId, address }),
  });
}
```

### 5. API Routes for Payments

```typescript
// src/pages/api/plugins/[id]/purchase.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { PluginPaymentService } from "../../../../services/payment.js";
import { verifyX402Payment } from "@nirholas/x402-ecosystem";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { id } = req.query;
  const paymentHeader = req.headers["x-402-payment"] as string;
  
  if (!paymentHeader) {
    // Return 402 with payment requirements
    const plugin = await getPlugin(id as string);
    
    return res.status(402).json({
      error: "Payment Required",
      paymentDetails: {
        amount: plugin.pricing.price,
        token: plugin.pricing.currency ?? "USDC",
        recipient: plugin.author.address,
        network: "eip155:8453",
      },
    });
  }
  
  // Verify payment
  const verification = await verifyX402Payment(paymentHeader);
  
  if (!verification.valid) {
    return res.status(402).json({
      error: "Invalid payment",
      details: verification.error,
    });
  }
  
  // Grant access
  await grantAccess(id as string, verification.payer);
  
  return res.json({
    success: true,
    message: "Plugin purchased successfully",
    downloadUrl: `/api/plugins/${id}/download`,
  });
}

async function getPlugin(id: string) {
  // Fetch plugin from database
  return {} as any;
}

async function grantAccess(pluginId: string, address: string) {
  // Store purchase record
}
```

### 6. Revenue Dashboard

```typescript
// src/components/RevenueDashboard.tsx
import React, { useEffect, useState } from "react";
import type { Address } from "@nirholas/x402-ecosystem";

interface RevenueStats {
  totalEarned: string;
  thisMonth: string;
  pendingPayout: string;
  plugins: Array<{
    name: string;
    sales: number;
    revenue: string;
  }>;
}

export function RevenueDashboard({ authorAddress }: { authorAddress: Address }) {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  
  useEffect(() => {
    fetchRevenueStats(authorAddress).then(setStats);
  }, [authorAddress]);
  
  if (!stats) return <div>Loading...</div>;
  
  return (
    <div className="revenue-dashboard">
      <h2>Revenue Dashboard</h2>
      
      <div className="stats-grid">
        <div className="stat">
          <label>Total Earned</label>
          <span>${stats.totalEarned}</span>
        </div>
        <div className="stat">
          <label>This Month</label>
          <span>${stats.thisMonth}</span>
        </div>
        <div className="stat">
          <label>Pending</label>
          <span>${stats.pendingPayout}</span>
        </div>
      </div>
      
      <h3>Plugin Performance</h3>
      <table>
        <thead>
          <tr>
            <th>Plugin</th>
            <th>Sales</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {stats.plugins.map(plugin => (
            <tr key={plugin.name}>
              <td>{plugin.name}</td>
              <td>{plugin.sales}</td>
              <td>${plugin.revenue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function fetchRevenueStats(address: Address): Promise<RevenueStats> {
  const res = await fetch(`/api/revenue/${address}`);
  return res.json();
}
```

## Plugin Manifest Schema

Update plugin manifest to include pricing:

```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "description": "An awesome plugin",
  "author": {
    "name": "Developer",
    "address": "0x..."
  },
  "pricing": {
    "type": "paid",
    "price": "9.99",
    "currency": "USDC",
    "period": "one-time",
    "revenueSplit": [
      { "address": "0x...", "percentage": 85, "label": "author" },
      { "address": "0x...", "percentage": 10, "label": "platform" },
      { "address": "0x...", "percentage": 5, "label": "marketing" }
    ]
  }
}
```

## Example Pricing Models

| Model | Use Case | Example |
|-------|----------|---------|
| Free | Open source plugins | Community tools |
| One-time | Complete plugins | $19.99 once |
| Monthly | Plugins with updates | $4.99/mo |
| Freemium | Basic free, premium paid | Free + $9.99 Pro |

## Testing

```typescript
// test/payment.test.ts
import { describe, it, expect } from "vitest";
import { PluginPaymentService } from "../src/services/payment.js";

describe("PluginPaymentService", () => {
  it("should calculate correct revenue split", () => {
    const service = new PluginPaymentService({
      platformAddress: "0x..." as `0x${string}`,
      platformFee: 10,
    });
    
    const plugin = {
      id: "test",
      pricing: { type: "paid", price: "10.00" },
      author: { address: "0x..." as `0x${string}` },
    };
    
    const split = service["calculateRevenueSplit"](plugin as any);
    
    expect(split).toHaveLength(2);
    expect(split[0].percentage).toBe(90);
    expect(split[1].percentage).toBe(10);
  });
});
```

## Next Steps

1. Clone plugin.delivery repository
2. Add @nirholas/x402-ecosystem dependency  
3. Add pricing schema to plugin types
4. Create payment service
5. Build purchase UI flow
6. Add revenue dashboard
7. Update documentation

## Related Links

- [x402-ecosystem package](../../packages/x402-ecosystem/)
- [Tool Marketplace API](../api/marketplace.md)
- [plugin.delivery repository](https://github.com/nirholas/plugin.delivery)
