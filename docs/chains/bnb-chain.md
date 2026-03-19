# BNB Chain Support

Agenti provides full support for the BNB Chain ecosystem including BSC mainnet and opBNB Layer 2.

## Supported Networks

| Network | Chain ID | Type |
|---------|----------|------|
| BNB Smart Chain (BSC) | 56 | Mainnet |
| opBNB | 204 | L2 Mainnet |
| BSC Testnet | 97 | Testnet |
| opBNB Testnet | 5611 | Testnet |

## Available Tools

### Binance DEX Integration
- `binance_account_info` - Account balances and positions
- `binance_order_book` - Real-time order book data
- `binance_spot_place_order` - Place spot market/limit orders
- `binance_twap_future_algo` - Time-weighted average price futures algorithm

### BNB Chain On-Chain
- `bnb_balance` - Check BNB native token balance
- `bep20_transfer` - Transfer BEP-20 tokens
- `bep20_balance` - Query BEP-20 token balances
- `pancakeswap_swap` - Execute PancakeSwap trades

### Analytics
- `bnb_gas_tracker` - BSC gas price tracking
- `bnb_token_security` - GoPlus security analysis for BSC tokens
- `bnb_whale_tracker` - Large transaction monitoring

## Configuration

```json
{
  "chains": {
    "bnb": {
      "rpcUrl": "https://bsc-dataseed.binance.org/",
      "chainId": 56
    },
    "opbnb": {
      "rpcUrl": "https://opbnb-mainnet-rpc.bnbchain.org",
      "chainId": 204
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BINANCE_API_KEY` | Binance exchange API key | For exchange tools |
| `BINANCE_SECRET_KEY` | Binance exchange secret | For exchange tools |
| `BSC_RPC_URL` | Custom BSC RPC endpoint | No |
| `PRIVATE_KEY` | Wallet private key | For on-chain ops |

## Packages

This chain is supported across multiple packages:
- `packages/chains/bnbchain-mcp` - Core BNB Chain MCP tools
- `packages/exchanges/binance-mcp` - Binance exchange integration
- `packages/protocols/sperax-crypto-mcp/BNB-Chain-MCP` - Sperax on BNB Chain

## Key Differences from Ethereum

- Lower gas fees (typically < $0.10 per transaction)
- 3-second block times (vs Ethereum's 12 seconds)
- PancakeSwap is the primary DEX (vs Uniswap on Ethereum)
- BEP-20 standard (compatible with ERC-20)
- opBNB provides even cheaper L2 transactions
