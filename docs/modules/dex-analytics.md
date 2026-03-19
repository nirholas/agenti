# DEX Analytics Module

The DEX analytics module provides data and tools for decentralized exchange analysis, including pool metrics, trade history, and liquidity monitoring.

## Data Coverage

| DEX | Chains | Features |
|-----|--------|----------|
| Uniswap V3 | Ethereum, Polygon, Arbitrum, Optimism, Base | Pools, swaps, positions |
| PancakeSwap | BNB Chain | Pools, farms |
| SushiSwap | Multi-chain | Pools, analytics |
| Curve | Ethereum, Polygon | Stable pools |
| Aerodrome | Base | ve(3,3) DEX |
| Velodrome | Optimism | ve(3,3) DEX |

## Tools

### Pool Analytics
- `dex_pool_info` - Detailed pool metrics (TVL, volume, fees, APR)
- `dex_pool_search` - Search pools by token pair
- `dex_top_pools` - Top pools by volume or TVL
- `dex_pool_history` - Historical pool performance

### Trade Data
- `dex_recent_swaps` - Recent swap transactions for a pool
- `dex_trade_volume` - Aggregated trade volume by timeframe
- `dex_price_impact` - Estimate price impact for a given trade size

### Liquidity
- `dex_liquidity_positions` - Active liquidity positions for an address
- `dex_liquidity_depth` - Liquidity depth at various price points
- `dex_impermanent_loss` - Calculate IL for a position

### Aggregation
- `dex_best_route` - Find best swap route across DEXes (1inch, 0x, ParaSwap)
- `dex_compare_prices` - Compare prices across multiple DEXes

## Input Schemas

### dex_pool_info

```typescript
z.object({
  poolAddress: z.string().describe('Pool contract address'),
  chain: z.string().describe('Chain name'),
})
```

### dex_best_route

```typescript
z.object({
  tokenIn: z.string().describe('Input token address or symbol'),
  tokenOut: z.string().describe('Output token address or symbol'),
  amount: z.string().describe('Input amount'),
  chain: z.string().describe('Chain name'),
  slippage: z.number().default(0.5).describe('Max slippage percentage'),
})
```

## Response Format

### Pool Info
```json
{
  "success": true,
  "data": {
    "pool": "0x...",
    "dex": "uniswap_v3",
    "token0": { "symbol": "WETH", "address": "0x..." },
    "token1": { "symbol": "USDC", "address": "0x..." },
    "fee": 0.3,
    "tvl": 125000000,
    "volume24h": 45000000,
    "apr": 18.5,
    "priceToken0": 3250.00,
    "priceToken1": 1.00
  }
}
```

## DEX Aggregation

The module integrates with multiple aggregation protocols:
- **1inch** - Optimal routing across 50+ DEXes
- **0x** - Professional-grade swap API
- **ParaSwap** - Multi-path routing for best prices
- **Rubic** - Cross-chain swap aggregation

## Common Use Cases

### Find Best Swap Price
Query `dex_best_route` to compare prices across all available DEXes and find the optimal execution path.

### Monitor Pool Performance
Track pool metrics over time with `dex_pool_history` to identify trends in TVL, volume, and fee generation.

### Analyze Trading Activity
Use `dex_recent_swaps` to monitor large trades and whale activity in specific pools.
