# Optimism Chain Support

Agenti supports Optimism, an Ethereum Layer 2 using the OP Stack for scalable, low-cost transactions.

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Optimism Mainnet | 10 | Active |
| Optimism Sepolia | 11155420 | Active |

## Available Tools

### Core Operations
- `optimism_balance` - Check ETH balance on Optimism
- `optimism_transfer` - Send ETH
- `optimism_erc20_balance` - Token balance queries
- `optimism_erc20_transfer` - Token transfers

### DeFi
- `optimism_uniswap_swap` - Uniswap on Optimism
- `optimism_aave_supply` - Aave V3 lending
- `optimism_velodrome_swap` - Velodrome DEX

### Analytics
- `optimism_gas_price` - Gas estimation with L1 data costs
- `optimism_token_security` - Security scanning

## Configuration

```json
{
  "chains": {
    "optimism": {
      "rpcUrl": "https://mainnet.optimism.io",
      "chainId": 10
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPTIMISM_RPC_URL` | Custom Optimism RPC | No |
| `PRIVATE_KEY` | Wallet private key | For write ops |
| `OPTIMISTIC_ETHERSCAN_API_KEY` | Explorer API key | No |

## Key Features

- OP Stack architecture (shared with Base)
- Bedrock upgrade for EVM equivalence
- Low gas fees (~$0.01-0.10 per transaction)
- OP token for governance
- Superchain ecosystem member
- Retroactive public goods funding (RetroPGF)

## x402 Support

Optimism is supported as a payment chain in the x402 protocol, enabling AI agents to make autonomous payments on Optimism with USDC.
