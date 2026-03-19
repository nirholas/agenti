# Sui Blockchain Support

Agenti supports Sui, a Move-based Layer 1 blockchain with object-centric data model.

## Supported Networks

| Network | Status |
|---------|--------|
| Sui Mainnet | Active |
| Sui Testnet | Active |
| Sui Devnet | Active |

## Available Tools

### Core Operations
- `sui_balance` - Check SUI balance
- `sui_transfer` - Send SUI tokens
- `sui_object_info` - Query object details
- `sui_coin_balance` - Query coin balances

### DeFi
- `sui_cetus_swap` - Cetus DEX swaps
- `sui_turbos_swap` - Turbos Finance swaps

## Configuration

```json
{
  "chains": {
    "sui": {
      "rpcUrl": "https://fullnode.mainnet.sui.io",
      "network": "mainnet"
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUI_RPC_URL` | Custom Sui RPC | No |
| `SUI_PRIVATE_KEY` | Wallet private key | For write ops |

## Key Features

- Move programming language for smart contracts
- Object-centric data model (vs account-based)
- Parallel transaction execution
- Sub-second finality
- Native on-chain asset ownership
- zkLogin for Web2 authentication

## Vendor Integration

Located at `src/vendors/sui`, providing:
- Sui TypeScript SDK integration
- Object query and management
- Transaction block construction
- Coin management utilities
