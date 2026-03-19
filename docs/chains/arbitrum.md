# Arbitrum Chain Support

Agenti supports Arbitrum One, an Ethereum Layer 2 optimistic rollup offering low fees with Ethereum-level security.

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Arbitrum One | 42161 | Active |
| Arbitrum Sepolia | 421614 | Active |

## Available Tools

### Core Operations
- `arbitrum_balance` - Check ETH balance on Arbitrum
- `arbitrum_transfer` - Send ETH on Arbitrum
- `arbitrum_erc20_balance` - Query token balances
- `arbitrum_erc20_transfer` - Transfer tokens

### DeFi
- `arbitrum_uniswap_swap` - Uniswap V3 on Arbitrum
- `arbitrum_aave_supply` - Aave V3 on Arbitrum
- `arbitrum_gmx_position` - GMX perpetuals interaction

### Analytics
- `arbitrum_gas_price` - L2 gas estimation
- `arbitrum_token_security` - Token security scanning

## Configuration

```json
{
  "chains": {
    "arbitrum": {
      "rpcUrl": "https://arb1.arbitrum.io/rpc",
      "chainId": 42161
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ARBITRUM_RPC_URL` | Custom Arbitrum RPC | No |
| `PRIVATE_KEY` | Wallet private key | For write ops |
| `ARBISCAN_API_KEY` | Arbiscan API key | No |

## Key Features

- Ethereum L2 with optimistic rollup security
- ~10x cheaper than Ethereum mainnet
- Full EVM equivalence
- Rich DeFi ecosystem (GMX, Uniswap, Aave, Camelot)
- Fast transaction confirmation (~250ms)

## Gas Pricing

Arbitrum uses a dual-component gas model:
1. **L2 execution cost** - Computation on Arbitrum
2. **L1 data cost** - Posting calldata to Ethereum

The `arbitrum_gas_price` tool returns both components for accurate cost estimation.

## Popular Protocols on Arbitrum

| Protocol | Category | Tool Prefix |
|----------|----------|-------------|
| GMX | Perpetuals | `arbitrum_gmx_` |
| Uniswap V3 | DEX | `arbitrum_uniswap_` |
| Aave V3 | Lending | `arbitrum_aave_` |
| Camelot | DEX | `arbitrum_camelot_` |
| Radiant | Lending | `arbitrum_radiant_` |
