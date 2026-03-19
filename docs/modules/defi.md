# DeFi Module

The DeFi module provides tools for interacting with decentralized finance protocols across multiple chains, including lending, borrowing, staking, and yield farming.

## Supported Protocols

| Protocol | Chains | Category |
|----------|--------|----------|
| Aave V3 | Ethereum, Polygon, Arbitrum, Optimism, Base | Lending |
| Compound V3 | Ethereum, Polygon, Arbitrum, Base | Lending |
| Lido | Ethereum | Liquid Staking |
| Uniswap V3 | Ethereum, Polygon, Arbitrum, Optimism, Base | DEX |
| Curve | Ethereum, Polygon, Arbitrum | Stableswap |
| Maker/DSR | Ethereum | Savings |

## Tools

### Lending & Borrowing
- `defi_aave_supply` - Supply assets to Aave V3
- `defi_aave_borrow` - Borrow assets from Aave V3
- `defi_aave_repay` - Repay Aave loans
- `defi_aave_withdraw` - Withdraw supplied assets
- `defi_aave_position` - View current Aave position (health factor, collateral, debt)
- `defi_compound_supply` - Supply to Compound V3
- `defi_compound_borrow` - Borrow from Compound V3

### Staking
- `defi_lido_stake` - Stake ETH via Lido (receive stETH)
- `defi_lido_wrap` - Wrap stETH to wstETH
- `defi_staking_apy` - Current staking APY rates

### Yield
- `defi_yield_rates` - Compare yield rates across protocols
- `defi_tvl` - Total Value Locked in protocols
- `defi_pool_info` - Liquidity pool details

## Input Schemas

### defi_aave_supply

```typescript
z.object({
  asset: z.string().describe('Token address or symbol'),
  amount: z.string().describe('Amount to supply (in token units)'),
  chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base']),
  onBehalfOf: z.string().optional().describe('Supply on behalf of another address'),
})
```

### defi_aave_position

```typescript
z.object({
  address: z.string().describe('Wallet address to check'),
  chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base']),
})
```

## Response Format

### Position Response
```json
{
  "success": true,
  "data": {
    "totalCollateralUSD": "15000.00",
    "totalDebtUSD": "5000.00",
    "availableBorrowsUSD": "7000.00",
    "healthFactor": "2.25",
    "ltv": "33.33",
    "supplies": [
      { "asset": "WETH", "amount": "5.0", "valueUSD": "15000.00", "apy": "2.1" }
    ],
    "borrows": [
      { "asset": "USDC", "amount": "5000.0", "valueUSD": "5000.00", "apy": "3.5" }
    ]
  }
}
```

## Risk Considerations

- **Health Factor**: Positions with health factor < 1.0 are subject to liquidation
- **Variable Rates**: Borrow/supply APY rates fluctuate based on utilization
- **Smart Contract Risk**: All DeFi interactions carry smart contract risk
- **Gas Costs**: Factor in transaction costs when calculating net yield
- **Impermanent Loss**: Liquidity provision carries impermanent loss risk

## Common Workflows

### Leverage Long ETH
1. Supply ETH as collateral (`defi_aave_supply`)
2. Borrow USDC against it (`defi_aave_borrow`)
3. Swap USDC for more ETH (via DEX module)
4. Supply additional ETH
5. Monitor health factor (`defi_aave_position`)

### Yield Comparison
1. Query rates across protocols (`defi_yield_rates`)
2. Check TVL for protocol safety (`defi_tvl`)
3. Supply to highest-yielding protocol
4. Monitor position regularly
