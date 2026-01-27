# Sperax Crypto MCP x402 Integration

> Sperax Protocol MCP – USDs stablecoin, SPA, veSPA governance & Demeter DeFi on Arbitrum.

## Overview

**Repository:** [nirholas/sperax-crypto-mcp](https://github.com/nirholas/sperax-crypto-mcp)  
**MCP Registry:** `io.github.nirholas/sperax-crypto-mcp`  
**x402 Use Case:** Native USDs yield integration, premium analytics, governance tools

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/sperax-crypto-mcp
```

## ⭐ Critical Integration

This is the **most important** x402 integration because Sperax USDs is the native yield-bearing stablecoin used by x402 payments. This creates a virtuous cycle:

```
x402 Payments → USDs → 5% APY → More x402 Payments
```

## Integration Pattern

```typescript
import { YieldingWallet } from '@nirholas/x402-ecosystem/yield';
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { SperaxMCP } from '@nirholas/sperax-crypto-mcp';

// Premium feature pricing
const speraxPricing = PricingStrategy.fixed({
  // Free tier
  'usds-balance': 0,
  'spa-balance': 0,
  'basic-stats': 0,
  
  // Premium analytics
  'yield-history': 0.02,       // $0.02: detailed yield history
  'yield-projection': 0.01,    // $0.01: yield projections
  'whale-tracking': 0.05,      // $0.05: large holder analysis
  
  // Governance tools
  'proposal-alerts': 1.00,     // $1/month: governance alerts
  'voting-power-calc': 0.01,   // $0.01: veSPA calculator
  'delegation-assist': 0.05,   // $0.05: delegation optimization
  
  // Demeter DeFi
  'farm-analytics': 0.03,      // $0.03: farming analytics
  'optimal-strategy': 0.10,    // $0.10: strategy recommendations
  'auto-compound': 5.00        // $5/month: auto-compound service
});

const sperax = new PaywallBuilder()
  .service('sperax-crypto-mcp')
  .pricing(speraxPricing)
  .build();
```

## USDs Yield Integration

```typescript
import { YieldingWallet, YieldProjector } from '@nirholas/x402-ecosystem/yield';

// Create yield-aware wallet
const wallet = new YieldingWallet({
  address: '0x...',
  network: 'eip155:42161', // Arbitrum
  yieldAsset: 'USDs'
});

// Native USDs yield tracking
async function getUSdsYield(address: string, period: string) {
  const history = await SperaxMCP.getRebaseHistory(address, period);
  
  return {
    totalYield: history.totalRebaseAmount,
    apy: history.effectiveAPY,
    rebases: history.rebases.map(r => ({
      timestamp: r.timestamp,
      amount: r.amount,
      newBalance: r.balanceAfter
    }))
  };
}

// Premium yield projection
async function projectYield(
  amount: number,
  months: number,
  compoundFrequency: 'daily' | 'weekly' | 'monthly' = 'daily'
) {
  await sperax.charge(0.01, { type: 'yield-projection' });
  
  const projector = new YieldProjector({
    principal: amount,
    annualYield: 0.05, // 5% APY
    months,
    compoundFrequency
  });
  
  return projector.project();
}
```

## Governance Tools

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['sperax-crypto-mcp']
});

// veSPA voting power calculator
async function calculateVotingPower(
  spaAmount: number,
  lockDuration: number // weeks
) {
  await sperax.charge(0.01, { type: 'voting-power-calc' });
  
  return SperaxMCP.calculateVeSPA({
    spaAmount,
    lockDuration,
    // veSPA = SPA * (lockWeeks / 208) // max 4 years
    projectedVotingPower: spaAmount * (lockDuration / 208),
    estimatedAPY: await SperaxMCP.getVeSPAAPY()
  });
}

// Delegation optimization
async function optimizeDelegation(address: string) {
  await agent.pay({
    service: 'sperax-crypto-mcp',
    amount: 0.05,
    description: 'Delegation optimization analysis'
  });
  
  return SperaxMCP.analyzeDelegation(address, {
    currentDelegations: true,
    optimalStrategy: true,
    topDelegates: true,
    gasEstimate: true
  });
}
```

## Demeter DeFi Integration

```typescript
// Farm analytics (premium)
async function getFarmAnalytics(farmAddress: string) {
  await sperax.charge(0.03, { type: 'farm-analytics' });
  
  return SperaxMCP.analyzeFarm(farmAddress, {
    tvl: true,
    apy: true,
    rewards: true,
    impermanentLoss: true,
    historicalPerformance: true
  });
}

// Optimal strategy recommendation
async function getOptimalStrategy(
  capital: number,
  riskTolerance: 'low' | 'medium' | 'high'
) {
  await sperax.charge(0.10, { type: 'optimal-strategy' });
  
  return SperaxMCP.recommendStrategy({
    capital,
    riskTolerance,
    options: [
      { type: 'hold-usds', description: 'Pure USDs yield (~5% APY)' },
      { type: 'usds-lp', description: 'USDs LP farming' },
      { type: 'vespa-boost', description: 'veSPA boosted farming' },
      { type: 'demeter-farms', description: 'Demeter yield optimization' }
    ]
  });
}
```

## Auto-Compound Service

```typescript
// Premium auto-compound subscription
async function enableAutoCompound(config: AutoCompoundConfig) {
  await agent.subscribe({
    service: 'sperax-crypto-mcp',
    plan: 'auto-compound',
    monthlyCost: 5.00,
    config: {
      walletAddress: config.address,
      frequency: config.frequency || 'daily',
      minAmount: config.minAmount || 10, // Min $10 to compound
      reinvestStrategy: config.strategy || 'usds-hold'
    }
  });
  
  return SperaxMCP.setupAutoCompound(config);
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| USDs balance | ✅ | ✅ |
| SPA/veSPA balance | ✅ | ✅ |
| Basic protocol stats | ✅ | ✅ |
| Yield history | ❌ | $0.02 |
| Yield projection | ❌ | $0.01 |
| Whale tracking | ❌ | $0.05 |
| Governance alerts | ❌ | $1/month |
| Voting calculator | ❌ | $0.01 |
| Delegation assist | ❌ | $0.05 |
| Farm analytics | ❌ | $0.03 |
| Strategy recs | ❌ | $0.10 |
| Auto-compound | ❌ | $5/month |

## Revenue Model

```typescript
const revenueSplit = {
  speraxTreasury: 0.40,  // Sperax Protocol
  developer: 0.35,       // Sperax MCP maintainer
  ecosystem: 0.15,       // Universal Crypto MCP
  infrastructure: 0.10   // x402 protocol
};
```

## MCP Tool Registration

```typescript
server.tool('get_usds_yield', {
  description: 'Get USDs yield information and projections',
  inputSchema: z.object({
    address: z.string().optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
    includeProjection: z.boolean().default(false)
  }),
  handler: async (params) => {
    const history = await getUSdsYield(params.address, params.period);
    
    if (params.includeProjection) {
      const projection = await projectYield(history.currentBalance, 12);
      return { ...history, projection };
    }
    
    return history;
  }
});

server.tool('sperax_strategy', {
  description: 'Get optimal Sperax DeFi strategy recommendation',
  inputSchema: z.object({
    capital: z.number(),
    riskTolerance: z.enum(['low', 'medium', 'high']).default('medium')
  }),
  handler: async (params) => {
    return getOptimalStrategy(params.capital, params.riskTolerance);
  }
});
```
