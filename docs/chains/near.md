# Near Protocol Support

Agenti integrates with Near Protocol for account-based blockchain operations and DeFi.

## Supported Networks

| Network | Status |
|---------|--------|
| Near Mainnet | Active |
| Near Testnet | Active |

## Available Tools

### Core Operations
- `near_balance` - Check NEAR balance
- `near_transfer` - Send NEAR tokens
- `near_account_info` - Account details and storage
- `near_ft_balance` - Fungible token balances

### DeFi
- `near_ref_swap` - Ref Finance swaps
- `near_staking_delegate` - Validator staking

## Configuration

```json
{
  "chains": {
    "near": {
      "networkId": "mainnet",
      "nodeUrl": "https://rpc.mainnet.near.org"
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEAR_NETWORK` | Network ID (mainnet/testnet) | No |
| `NEAR_ACCOUNT_ID` | Near account ID | For write ops |
| `NEAR_PRIVATE_KEY` | Account private key | For write ops |

## Key Features

- Human-readable account names (e.g., `alice.near`)
- Sharded architecture for scalability
- ~1 second block finality
- Storage staking model
- Ref Finance as primary DEX
- Aurora EVM compatibility layer

## Vendor Integration

Located at `src/vendors/near`, providing:
- Near API JS integration
- Account management
- Transaction construction and signing
- FT/NFT standard support (NEP-141, NEP-171)
