# Base Chain Support

Base is the primary chain for x402 payment protocol integration in Agenti. Built on the OP Stack by Coinbase.

## Supported Networks

| Network | Chain ID | Status | x402 Support |
|---------|----------|--------|--------------|
| Base Mainnet | 8453 | Active | Primary |
| Base Sepolia | 84532 | Active | Testnet |

## Available Tools

### Core Operations
- `base_balance` - Check ETH balance on Base
- `base_transfer` - Send ETH
- `base_erc20_balance` - Token balance queries
- `base_erc20_transfer` - Token transfers

### x402 Payment Tools
- `x402_pay_request` - HTTP request with automatic 402 payment handling
- `x402_balance` - Check USDC/USDs balance on Base
- `x402_send` - Direct payment to address
- `x402_batch_send` - Batch multiple payments
- `x402_gasless_send` - EIP-3009 gasless USDC transfers
- `x402_estimate` - Cost estimation
- `x402_yield` - USDs auto-yield earnings
- `x402_apy` - Current USDs APY rate

### DeFi
- `base_uniswap_swap` - Uniswap on Base
- `base_aerodrome_swap` - Aerodrome DEX

## Configuration

```json
{
  "chains": {
    "base": {
      "rpcUrl": "https://mainnet.base.org",
      "chainId": 8453
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BASE_RPC_URL` | Custom Base RPC | No |
| `PRIVATE_KEY` | Wallet private key | For all x402 ops |
| `BASESCAN_API_KEY` | BaseScan API key | No |

## Why Base is the x402 Primary Chain

1. **Low fees** - Sub-cent transaction costs
2. **Coinbase ecosystem** - Native USDC support
3. **OP Stack** - Battle-tested infrastructure
4. **Fast finality** - 2-second block times
5. **USDC native** - Circle's native USDC deployment

## x402 Payment Flow on Base

```
Agent Request -> 402 Response -> Parse Payment Header
    -> Sign USDC/USDs Transfer on Base
    -> Submit Payment Proof
    -> Receive Paid Content
```

## USDs Stablecoin on Base

Agenti integrates with Sperax USDs on Base, providing:
- Auto-yield on holdings (no staking required)
- Collateralized by diversified crypto assets
- Yield estimation and tracking tools
