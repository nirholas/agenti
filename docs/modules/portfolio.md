# Portfolio Module

The portfolio module provides multi-chain portfolio tracking, wallet analytics, and position management tools for AI agents.

## Tools

### Balance Tracking
- `portfolio_balances` - All token balances across chains for a wallet
- `portfolio_native_balances` - Native token balances (ETH, BNB, MATIC, etc.)
- `portfolio_token_balances` - ERC-20/SPL token holdings
- `portfolio_nft_holdings` - NFT collection holdings

### Portfolio Analytics
- `portfolio_total_value` - Total portfolio value in USD
- `portfolio_allocation` - Asset allocation breakdown (by chain, category, token)
- `portfolio_pnl` - Profit and loss tracking
- `portfolio_history` - Historical portfolio value

### Wallet Analytics
- `wallet_transaction_history` - Recent transactions for a wallet
- `wallet_token_transfers` - Token transfer history
- `wallet_first_transaction` - Wallet age and first activity
- `wallet_interaction_map` - Protocols and contracts interacted with

### Whale Monitoring
- `whale_tracker` - Monitor large transactions for a token
- `whale_wallets` - Identify top holders for a token
- `whale_alerts` - Recent whale movements

## Input Schemas

### portfolio_balances

```typescript
z.object({
  address: z.string().describe('Wallet address (0x... or .sol)'),
  chains: z.array(z.string()).optional().describe('Filter to specific chains'),
  minValueUSD: z.number().default(1).describe('Minimum value to include'),
})
```

### whale_tracker

```typescript
z.object({
  token: z.string().describe('Token address or symbol'),
  chain: z.string().describe('Chain name'),
  minAmount: z.number().describe('Minimum transaction amount in USD'),
  timeframe: z.enum(['1h', '4h', '24h', '7d']).default('24h'),
})
```

## Response Format

### Portfolio Balances
```json
{
  "success": true,
  "data": {
    "totalValueUSD": 52350.00,
    "chains": {
      "ethereum": {
        "native": { "symbol": "ETH", "balance": "5.2", "valueUSD": 16900 },
        "tokens": [
          { "symbol": "USDC", "balance": "10000", "valueUSD": 10000 },
          { "symbol": "LINK", "balance": "500", "valueUSD": 7500 }
        ]
      },
      "polygon": {
        "native": { "symbol": "MATIC", "balance": "1000", "valueUSD": 850 }
      }
    }
  }
}
```

## Supported Chains for Portfolio Tracking

All 20+ EVM chains plus Solana, Cosmos, Near, Sui, and Aptos are supported for portfolio aggregation.

## Common Workflows

### Full Portfolio Audit
1. Query `portfolio_balances` for all chains
2. Check `portfolio_allocation` for diversification analysis
3. Review `portfolio_pnl` for performance
4. Identify large positions for risk assessment

### Whale Watching
1. Set up `whale_tracker` for tokens of interest
2. Monitor `whale_alerts` for significant movements
3. Cross-reference with `dex_recent_swaps` for on-chain activity
