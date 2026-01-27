# Crypto Market Data x402 Integration

> Real-time crypto prices, OHLCV, orderbook for 10,000+ tokens with premium data tiers.

## Overview

**Repository:** [nirholas/crypto-market-data](https://github.com/nirholas/crypto-market-data)  
**MCP Registry:** `io.github.nirholas/crypto-market-data`  
**x402 Use Case:** Pay-per-query for premium data, real-time streams, historical depth

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/crypto-market-data
```

## Integration Pattern

```typescript
import { PricingStrategy, PaywallBuilder } from '@nirholas/x402-ecosystem/premium';
import { MarketDataClient } from '@nirholas/crypto-market-data';

// Resource-based pricing for data queries
const dataPricing = PricingStrategy.resourceBased({
  'price-single': 0,           // Free: single price
  'price-batch': 0.001,        // $0.001 per 100 tokens
  'ohlcv-1d': 0.002,           // $0.002 per query
  'ohlcv-1h': 0.005,           // $0.005 per query (higher resolution)
  'ohlcv-1m': 0.02,            // $0.02 per query (minute data)
  'orderbook-l1': 0.001,       // $0.001 top of book
  'orderbook-l2': 0.01,        // $0.01 full depth
  'trades-realtime': 0.05,     // $0.05/hour stream
});

// Build paywall
const marketData = new PaywallBuilder()
  .service('crypto-market-data')
  .pricing(dataPricing)
  .rateLimit({ free: 100, premium: 10000 }) // per hour
  .build();

// Usage
async function getOHLCV(symbol: string, interval: string, limit: number) {
  const resourceType = `ohlcv-${interval}`;
  const price = dataPricing.calculate({ resource: resourceType });
  
  if (price > 0) {
    await marketData.charge(price, { symbol, interval, limit });
  }
  
  return MarketDataClient.ohlcv(symbol, interval, limit);
}
```

## Data Tiers

| Endpoint | Free Tier | Premium |
|----------|-----------|---------|
| Current prices | ✅ 100/hr | ✅ Unlimited |
| 24h OHLCV | ✅ 10/hr | ✅ $0.002/query |
| Hourly OHLCV | ❌ | ✅ $0.005/query |
| Minute OHLCV | ❌ | ✅ $0.02/query |
| L1 Orderbook | ✅ 10/hr | ✅ $0.001/query |
| L2 Orderbook | ❌ | ✅ $0.01/query |
| Trade stream | ❌ | ✅ $0.05/hour |
| Historical (30d+) | ❌ | ✅ $0.10/query |

## Streaming with x402

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  dailyLimit: 10, // $10/day max for data
});

// Subscribe to real-time trades
const subscription = await agent.subscribe({
  service: 'crypto-market-data',
  endpoint: 'trades-realtime',
  symbols: ['BTC/USDT', 'ETH/USDT'],
  costPerHour: 0.05,
  maxHours: 24
});

subscription.on('trade', (trade) => {
  console.log(`${trade.symbol}: ${trade.price} x ${trade.amount}`);
});
```

## Batch Queries

```typescript
// Efficient batch pricing
async function getBatchPrices(symbols: string[]) {
  const batchSize = symbols.length;
  const cost = Math.ceil(batchSize / 100) * 0.001; // $0.001 per 100
  
  if (cost > 0) {
    await marketData.charge(cost, { batch: symbols });
  }
  
  return MarketDataClient.batchPrices(symbols);
}
```

## Revenue Model

```typescript
const revenueSplit = {
  dataProvider: 0.60,   // Crypto Market Data
  ecosystem: 0.25,      // Universal Crypto MCP
  infrastructure: 0.15  // x402 + data sources
};
```
