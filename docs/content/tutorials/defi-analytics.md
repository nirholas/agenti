# DeFi Analytics with AI

> **Tutorial**: Use Claude to analyze DeFi protocols, find the best yields, and optimize your positions.

## What You'll Learn

- Query lending rates across protocols
- Find optimal yield farming strategies
- Analyze liquidity pool performance
- Compare DEX prices for arbitrage

## Prerequisites

Complete the [basic setup](ai-crypto-trading-agent.md) first.

## Lending Protocol Analysis

### Compare Lending Rates

```
Compare current lending rates for USDC across:
- Aave (Ethereum)
- Aave (Arbitrum)
- Compound (Ethereum)

Show supply APY, borrow APY, and utilization rate.
```

**Example Response:**

```
📊 USDC LENDING RATES COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────┬────────────┬────────────┬─────────────┐
│ Protocol         │ Supply APY │ Borrow APY │ Utilization │
├──────────────────┼────────────┼────────────┼─────────────┤
│ Aave (Ethereum)  │ 4.2%       │ 5.8%       │ 82%         │
│ Aave (Arbitrum)  │ 5.1%       │ 6.3%       │ 78%         │
│ Compound (ETH)   │ 3.9%       │ 5.2%       │ 75%         │
└──────────────────┴────────────┴────────────┴─────────────┘

💡 Recommendation: Aave on Arbitrum offers the best supply 
   rate at 5.1% with reasonable utilization.
```

### Health Factor Monitoring

```
Check my Aave position health on Ethereum.
Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345

What price movement would trigger liquidation?
```

## DEX Analytics

### Liquidity Pool Analysis

```
Analyze the ETH/USDC pool on Uniswap V3 (Arbitrum):
- Current liquidity depth
- 24h volume
- Fee tier performance
- Impermanent loss calculator for ±20% price move
```

### Price Impact Estimation

```
What's the price impact for swapping:
- 10 ETH to USDC on Arbitrum
- 100 ETH to USDC on Arbitrum
- 1000 ETH to USDC on Arbitrum

Compare across 1inch, ParaSwap, and direct Uniswap.
```

### Arbitrage Detection

```
Find price discrepancies for ETH across:
- Uniswap (Ethereum)
- SushiSwap (Arbitrum)
- Quickswap (Polygon)

Is there any profitable arbitrage opportunity after gas?
```

## Yield Optimization

### Find Best Yields

```
Find the best stablecoin yields over $1M TVL:
- USDC
- USDT
- DAI

Only show protocols with audited contracts.
Rank by risk-adjusted return.
```

### Yield Farming Strategy

```
I have $10,000 in stablecoins. Suggest a yield farming strategy:
- Risk tolerance: Medium
- Chains I'm comfortable with: Ethereum, Arbitrum, Base
- Lock-up preference: No more than 7 days

Consider gas costs in the analysis.
```

## Advanced Queries

### Protocol TVL Tracking

```
Show TVL trends for the top 5 lending protocols over the last 30 days.
Which protocols are gaining/losing deposits?
```

### Gas-Optimized Rebalancing

```
I want to rebalance my portfolio:
- Sell 2 ETH on Arbitrum
- Buy USDC
- Bridge to Base
- Deposit into Aave

What's the most gas-efficient route? Show total cost.
```

### Multi-Protocol Position Summary

```
Summarize all my DeFi positions:

Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345

Include:
- Lending (Aave, Compound)
- LPs (Uniswap, SushiSwap)
- Staking (Lido, Rocket Pool)
- Pending rewards to claim
```

## Building a DeFi Dashboard Prompt

Save this as your go-to morning check:

```
Daily DeFi Dashboard for 0x742d35Cc6634C0532925a3b844Bc9e7595f12345

1. POSITIONS
   - All lending positions with health factors
   - All LP positions with IL status
   - Staking positions with pending rewards

2. MARKET CONDITIONS
   - ETH price and 24h change
   - Gas prices on Ethereum, Arbitrum, Base
   - Best stablecoin yields today

3. ALERTS
   - Any health factors below 1.5?
   - Any positions with negative IL > 5%?
   - Any rewards > $50 ready to claim?

4. RECOMMENDATIONS
   - Should I rebalance anything?
   - Any better yield opportunities?
```

## Supported Protocols

### Lending
- Aave V3 (all chains)
- Compound V3
- Spark (MakerDAO)

### DEXs
- Uniswap V2/V3
- SushiSwap
- Curve
- Balancer
- 1inch (aggregator)
- ParaSwap (aggregator)

### Yield
- Yearn
- Convex
- Beefy

### Liquid Staking
- Lido (stETH)
- Rocket Pool (rETH)
- Coinbase (cbETH)

## Tips for Accurate Analysis

1. **Specify the chain** - Rates vary significantly across L1/L2
2. **Include time context** - "current rates" vs "average over 7 days"
3. **Consider gas** - A 0.5% better yield isn't worth $50 in gas
4. **Check TVL** - Higher TVL generally means lower risk

## Next Steps

- [Security Scanner](security-scanner.md) - Verify protocol safety
- [Cross-Chain Portfolio](cross-chain-portfolio.md) - Track all assets
- [API Reference](../mcp-server/tools-complete.md) - All available tools

---

Built by [Nich](https://x.com/nichxbt) • [GitHub](https://github.com/nirholas/universal-crypto-mcp)
