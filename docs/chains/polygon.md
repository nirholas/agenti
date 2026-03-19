# Polygon Chain Support

Agenti supports Polygon PoS for low-cost EVM transactions and DeFi interactions.

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Polygon Mainnet | 137 | Active |
| Polygon Amoy Testnet | 80002 | Active |

## Available Tools

### Core Operations
- `polygon_balance` - Check MATIC/POL balance
- `polygon_transfer` - Send native tokens
- `polygon_erc20_balance` - Query token balances
- `polygon_erc20_transfer` - Transfer tokens
- `polygon_gas_price` - Current gas estimates

### DeFi on Polygon
- `quickswap_swap` - QuickSwap DEX trading
- `aave_polygon_supply` - Aave V3 on Polygon
- `aave_polygon_borrow` - Borrow on Aave V3 Polygon

### Analytics
- `polygon_token_security` - Security scanning via GoPlus
- `polygon_whale_monitor` - Whale transaction tracking

## Configuration

```json
{
  "chains": {
    "polygon": {
      "rpcUrl": "https://polygon-rpc.com",
      "chainId": 137
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POLYGON_RPC_URL` | Custom Polygon RPC | No |
| `PRIVATE_KEY` | Wallet private key | For write ops |
| `POLYGONSCAN_API_KEY` | PolygonScan API key | No |

## Key Features

- Sub-cent transaction fees
- 2-second block finality
- Full ERC-20/721/1155 compatibility
- Rich DeFi ecosystem (Aave, QuickSwap, Curve)
- USDC and USDT widely available
- Bridge support via native Polygon bridge and third-party bridges

## Common Use Cases

### Low-Cost Token Transfers
Polygon is ideal for frequent, small-value transfers where Ethereum gas fees would be prohibitive.

### DeFi Yield Farming
Access Aave, QuickSwap, and other protocols with minimal transaction costs, making it practical to compound yields frequently.

### NFT Minting and Trading
Low gas costs make Polygon popular for NFT projects requiring frequent minting operations.
