# Cross-Chain Portfolio Tracker

> **Tutorial**: Build an AI-powered portfolio tracker that monitors your assets across 15+ blockchains simultaneously.

## The Problem

Managing crypto across multiple chains is painful:
- Checking 10 different block explorers
- Manually calculating total portfolio value
- Missing price movements on lesser-used chains
- No unified view of DeFi positions

## The Solution

With Universal Crypto MCP, you can ask Claude:

> "Show me all my assets across every chain"

And get a complete portfolio breakdown in seconds.

## Setup

Follow the [basic setup guide](ai-crypto-trading-agent.md#step-1-install-universal-crypto-mcp) first.

## Usage Examples

### 1. Full Portfolio Scan

```
Scan my wallet across all supported chains and show me:
1. Token balances on each chain
2. Total USD value per chain
3. Overall portfolio value

Wallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f12345
```

**Claude will:**
- Query balances on Ethereum, Arbitrum, Base, Polygon, Optimism, etc.
- Fetch current prices for each token
- Calculate and display totals

### 2. Track Specific Tokens

```
Where do I hold USDC across all my chains? Show amounts and USD values.
```

### 3. Monitor DeFi Positions

```
Show me all my active DeFi positions:
- Aave deposits and borrows
- Uniswap LP positions
- Staking positions

Include health factors and APYs.
```

### 4. Daily Portfolio Summary

```
Give me a daily portfolio summary:
- Total value vs yesterday
- Biggest gainers/losers
- Any positions needing attention (low health factor, expiring farms)
```

## Example Output

```
📊 PORTFOLIO SUMMARY
━━━━━━━━━━━━━━━━━━━━

Chain Breakdown:
┌─────────────┬────────────┬──────────┐
│ Chain       │ Assets     │ Value    │
├─────────────┼────────────┼──────────┤
│ Ethereum    │ ETH, USDC  │ $12,450  │
│ Arbitrum    │ ETH, ARB   │ $3,200   │
│ Base        │ ETH, USDC  │ $1,850   │
│ Polygon     │ MATIC, USD │ $890     │
│ Optimism    │ ETH, OP    │ $2,100   │
└─────────────┴────────────┴──────────┘

Total Portfolio: $20,490

DeFi Positions:
• Aave (Ethereum): $5,000 supplied, $2,000 borrowed
  Health Factor: 1.82 ✅
• Uniswap V3 (Arbitrum): ETH/USDC LP
  Value: $1,200 | Fees earned: $45

24h Change: +$342 (+1.7%) 📈
```

## Pro Tips

### Set Up Aliases

Create a text file with your common queries:

```
# portfolio-queries.txt

## Quick balance check
Check ETH and USDC balance on Arbitrum for 0x...

## Full scan
Full portfolio scan across all chains for 0x...

## DeFi health check
Check health factor on all my Aave positions
```

### Multi-Wallet Tracking

```
Compare portfolios for these wallets:
- Main: 0x742d35...
- Trading: 0x1234...
- Cold storage: 0x5678...

Show combined total and breakdown by wallet.
```

### Price Alerts (Manual)

```
Alert me if any of these conditions are true for my portfolio:
- ETH drops below $3,000
- Any Aave health factor below 1.5
- Gas on Ethereum above 50 gwei
```

## Supported Assets

The portfolio tracker supports:

- **Native tokens**: ETH, MATIC, AVAX, BNB, FTM, etc.
- **ERC-20 tokens**: All tokens with CoinGecko listings
- **LP tokens**: Uniswap V2/V3, SushiSwap, Curve
- **Lending positions**: Aave, Compound
- **Staking**: Lido, Rocket Pool

## Limitations

- NFTs are not yet tracked (coming soon)
- Some newer DeFi protocols may not be supported
- Historical portfolio value requires external data source

## Next Steps

- [DeFi Analytics Tutorial](defi-analytics.md) - Deep dive into yield analysis
- [Security Scanner](security-scanner.md) - Audit your token holdings
- [Full Tool Reference](../mcp-server/tools-complete.md)

---

Built by [Nich](https://x.com/nichxbt) • [GitHub](https://github.com/nirholas/universal-crypto-mcp)
