# Cosmos Chain Support

Agenti supports the Cosmos ecosystem including IBC-connected chains for cross-chain DeFi and staking.

## Supported Networks

| Network | Token | Status |
|---------|-------|--------|
| Cosmos Hub | ATOM | Active |
| Osmosis | OSMO | Active |
| Juno | JUNO | Active |
| Injective | INJ | Active |
| Stargaze | STARS | Active |

## Available Tools

### Core Operations
- `cosmos_balance` - Check native token balance
- `cosmos_transfer` - Send tokens
- `cosmos_staking_delegate` - Delegate to validators
- `cosmos_staking_undelegate` - Undelegate tokens
- `cosmos_staking_rewards` - Claim staking rewards

### IBC Transfers
- `cosmos_ibc_transfer` - Cross-chain IBC transfers
- `cosmos_ibc_channels` - Query available IBC channels

### Osmosis DEX
- `osmosis_swap` - Token swaps on Osmosis
- `osmosis_pools` - Query liquidity pools
- `osmosis_provide_liquidity` - Add liquidity

### Governance
- `cosmos_proposals` - View governance proposals
- `cosmos_vote` - Vote on proposals

## Configuration

```json
{
  "chains": {
    "cosmos": {
      "rpcUrl": "https://rpc.cosmos.network",
      "prefix": "cosmos"
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `COSMOS_RPC_URL` | Cosmos Hub RPC | No |
| `COSMOS_MNEMONIC` | Wallet mnemonic | For write ops |
| `OSMOSIS_RPC_URL` | Osmosis RPC | No |

## Vendor Integration

Located at `src/vendors/cosmos`, the Cosmos vendor provides:
- CosmJS-based transaction signing
- IBC protocol support
- Multi-chain account derivation
- Amino and Direct signing modes

## Key Features

- IBC cross-chain transfers between 50+ chains
- Staking with validator delegation
- On-chain governance participation
- Osmosis DEX for Cosmos ecosystem trading
- Liquid staking via Stride and pSTAKE
