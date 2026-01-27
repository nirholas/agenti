# MCP Notify x402 Integration

> Monitor MCP registry for new servers - Discord, Slack notifications, alerts.

## Overview

**Repository:** [nirholas/mcp-notify](https://github.com/nirholas/mcp-notify)  
**MCP Registry:** `io.github.nirholas/mcp-notify`  
**x402 Use Case:** Premium alert tiers, real-time webhooks, custom filters

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/mcp-notify
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { MCPNotify } from '@nirholas/mcp-notify';

// Subscription-based pricing
const notifyPricing = PricingStrategy.fixed({
  'free-tier': 0,              // Free: daily digest
  'basic': 2.00,               // $2/month: hourly updates
  'pro': 5.00,                 // $5/month: real-time + filters
  'enterprise': 20.00,         // $20/month: webhooks + API
  'custom-filter': 0.50,       // $0.50: per custom filter
  'webhook': 1.00,             // $1/month: per webhook endpoint
  'sms-alert': 0.05            // $0.05: per SMS alert
});

const notify = new PaywallBuilder()
  .service('mcp-notify')
  .pricing(notifyPricing)
  .build();
```

## Subscription Tiers

```typescript
// Tier configurations
const tiers = {
  free: {
    frequency: 'daily',
    channels: ['email'],
    filters: 0,
    webhooks: 0,
    cost: 0
  },
  basic: {
    frequency: 'hourly',
    channels: ['email', 'discord', 'slack'],
    filters: 3,
    webhooks: 0,
    cost: 2.00
  },
  pro: {
    frequency: 'realtime',
    channels: ['email', 'discord', 'slack', 'telegram'],
    filters: 10,
    webhooks: 1,
    cost: 5.00
  },
  enterprise: {
    frequency: 'realtime',
    channels: ['all'],
    filters: 'unlimited',
    webhooks: 10,
    cost: 20.00
  }
};

// Subscribe to notifications
async function subscribe(tier: keyof typeof tiers, config: NotifyConfig) {
  const tierConfig = tiers[tier];
  
  if (tierConfig.cost > 0) {
    await notify.charge(tierConfig.cost, {
      type: 'subscription',
      tier,
      period: 'monthly'
    });
  }
  
  return MCPNotify.subscribe(tier, config);
}
```

## Custom Filters

```typescript
// Premium custom filter creation
async function addCustomFilter(filter: FilterConfig) {
  await notify.charge(0.50, { type: 'custom-filter' });
  
  return MCPNotify.addFilter({
    name: filter.name,
    conditions: filter.conditions,
    // Example conditions:
    // - category: 'defi'
    // - author: 'nirholas'
    // - keywords: ['wallet', 'ethereum']
    // - minStars: 100
    actions: filter.actions
  });
}

// Example filter
const defiFilter = {
  name: 'DeFi Tools Alert',
  conditions: {
    category: ['defi', 'trading', 'yield'],
    keywords: ['swap', 'bridge', 'lending'],
    excludeKeywords: ['deprecated', 'beta']
  },
  actions: {
    notify: ['discord', 'slack'],
    priority: 'high'
  }
};
```

## Webhook Integration

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['mcp-notify'],
  dailyLimit: 10
});

// Add webhook endpoint (premium)
async function addWebhook(endpoint: string, events: string[]) {
  await agent.pay({
    service: 'mcp-notify',
    amount: 1.00,
    description: 'Add webhook endpoint (monthly)'
  });
  
  return MCPNotify.addWebhook({
    url: endpoint,
    events, // ['new-server', 'update', 'trending']
    secret: generateWebhookSecret(),
    retries: 3
  });
}

// Webhook payload example
interface WebhookPayload {
  event: 'new-server' | 'update' | 'trending';
  server: {
    id: string;
    name: string;
    version: string;
    author: string;
    category: string;
    description: string;
    registry_url: string;
  };
  timestamp: string;
}
```

## Alert Channels

| Channel | Free | Basic | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Email digest | ✅ | ✅ | ✅ | ✅ |
| Discord | ❌ | ✅ | ✅ | ✅ |
| Slack | ❌ | ✅ | ✅ | ✅ |
| Telegram | ❌ | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | 1 | 10 |
| SMS | ❌ | ❌ | ❌ | $0.05/msg |
| API access | ❌ | ❌ | ❌ | ✅ |

## Frequency Options

```typescript
// Update frequencies
const frequencies = {
  daily: { interval: '24h', cost: 0 },
  hourly: { interval: '1h', cost: 2.00 },
  realtime: { interval: '<1m', cost: 5.00 }
};
```

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // MCP Notify maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + messaging costs
};
```

## MCP Tool Registration

```typescript
server.tool('subscribe_mcp_alerts', {
  description: 'Subscribe to MCP registry notifications',
  inputSchema: z.object({
    tier: z.enum(['free', 'basic', 'pro', 'enterprise']),
    channels: z.array(z.enum(['email', 'discord', 'slack', 'telegram'])),
    filters: z.array(z.object({
      category: z.string().optional(),
      keywords: z.array(z.string()).optional()
    })).optional()
  }),
  handler: async (params) => {
    return subscribe(params.tier, {
      channels: params.channels,
      filters: params.filters
    });
  }
});
```
