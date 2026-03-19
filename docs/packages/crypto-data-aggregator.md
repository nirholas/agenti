# Crypto Data Aggregator Package

`packages/data/crypto-data-aggregator` - Multi-source cryptocurrency data aggregation for reliable, deduplicated market intelligence.

## Overview

The Crypto Data Aggregator combines data from multiple providers (CoinGecko, CoinStats, exchanges) to deliver reliable, consistent market data with automatic fallback and deduplication.

## Features

- Multi-source price aggregation with confidence scoring
- Automatic failover when a data source is unavailable
- Price discrepancy detection across sources
- Configurable data source priority
- Built-in caching and rate limit management
- Historical data normalization

## Data Sources

| Source | Data Types | Free Tier |
|--------|-----------|-----------|
| CoinGecko | Prices, market cap, volume, OHLCV | 30 req/min |
| CoinStats | Prices, portfolios, news | Yes |
| Binance | Spot prices, order books, trades | Yes |
| Jupiter | Solana token prices | Yes |
| On-chain | DEX pool prices | RPC-dependent |

## Usage

```typescript
import { DataAggregator } from '@nirholas/crypto-data-aggregator';

const aggregator = new DataAggregator({
  sources: ['coingecko', 'coinstats', 'binance'],
  cacheTTL: 30, // seconds
});

// Aggregated price with confidence
const price = await aggregator.getPrice('bitcoin');
// { price: 43250.00, confidence: 0.99, sources: 3, deviation: 0.02 }

// Multi-token batch
const prices = await aggregator.getPrices(['bitcoin', 'ethereum', 'solana']);

// Historical with normalization
const history = await aggregator.getHistory('ethereum', { days: 30, interval: 'daily' });
```

## Aggregation Strategy

1. Query all configured sources in parallel
2. Filter out failed/timed-out responses
3. Detect outliers (> 2% deviation from median)
4. Calculate weighted average based on source reliability
5. Return aggregated result with confidence score

## Configuration

```typescript
{
  sources: string[],           // Data source priority order
  cacheTTL: number,            // Cache duration in seconds
  maxDeviation: number,        // Max acceptable price deviation (default: 2%)
  timeout: number,             // Per-source timeout in ms
  fallbackEnabled: boolean,    // Enable automatic fallback
}
```

## When to Use

- Production applications needing reliable price data
- Cross-source price verification
- Applications where a single source may be rate-limited
- Historical data analysis requiring normalized datasets
