# Ethereum Chain Support

Agenti provides comprehensive Ethereum mainnet and testnet support via the EVM module.

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Ethereum Mainnet | 1 | Active |
| Sepolia Testnet | 11155111 | Active |

## Available Tools

### Token Operations
- `erc20_balance` - Query ERC-20 token balances
- `erc20_transfer` - Transfer ERC-20 tokens
- `erc20_approve` - Approve token spending allowances
- `erc721_balance` - Query NFT holdings
- `erc721_transfer` - Transfer NFTs

### DeFi Interactions
- `defi_aave_supply` - Supply assets to Aave V3
- `defi_aave_borrow` - Borrow from Aave V3
- `defi_uniswap_swap` - Execute Uniswap V3 swaps
- `defi_compound_supply` - Supply to Compound V3
- `defi_lido_stake` - Stake ETH via Lido

### Wallet Operations
- `eth_balance` - Check native ETH balance
- `eth_transfer` - Send ETH to addresses
- `eth_gas_price` - Current gas price estimates
- `eth_transaction_status` - Check transaction receipt

## Configuration

```json
{
  "chains": {
    "ethereum": {
      "rpcUrl": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
      "chainId": 1
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ETHEREUM_RPC_URL` | Custom Ethereum RPC endpoint | No |
| `PRIVATE_KEY` | Wallet private key for signing | Yes (for write ops) |
| `ETHERSCAN_API_KEY` | Etherscan API key for verification | No |

## Usage with Claude Desktop

```json
{
  "mcpServers": {
    "agenti": {
      "command": "npx",
      "args": ["@nirholas/agenti"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## Security Considerations

- Always use testnets for development and testing
- Never expose private keys in configuration files committed to version control
- Use hardware wallets or secure key management for mainnet operations
- Validate all contract addresses before interacting with them
- Monitor gas costs to avoid unexpected transaction fees

## Example Workflows

### Check Portfolio Value
1. Use `eth_balance` to get ETH holdings
2. Use `erc20_balance` with popular token addresses
3. Use `market_data_price` to get current USD values
4. Aggregate total portfolio value

### Execute a DeFi Strategy
1. Check current Aave/Compound APY rates
2. Approve token spending with `erc20_approve`
3. Supply tokens with `defi_aave_supply`
4. Monitor position with `defi_aave_position`
