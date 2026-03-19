# EVM Tools Reference

Comprehensive reference for all EVM-compatible blockchain tools available in Agenti.

## Core EVM Operations

These tools work across all supported EVM chains (Ethereum, Polygon, Arbitrum, Optimism, Base, BNB Chain, opBNB, IoTeX).

### Native Token Operations

| Tool | Description | Write |
|------|-------------|-------|
| `{chain}_balance` | Get native token balance | No |
| `{chain}_transfer` | Send native tokens | Yes |
| `{chain}_gas_price` | Current gas price | No |
| `{chain}_gas_estimate` | Estimate gas for a transaction | No |

### ERC-20 Token Operations

| Tool | Description | Write |
|------|-------------|-------|
| `erc20_balance` | Query token balance | No |
| `erc20_transfer` | Transfer tokens | Yes |
| `erc20_approve` | Approve token spending | Yes |
| `erc20_allowance` | Check spending allowance | No |
| `erc20_total_supply` | Token total supply | No |
| `erc20_info` | Token name, symbol, decimals | No |

### ERC-721 NFT Operations

| Tool | Description | Write |
|------|-------------|-------|
| `erc721_balance` | NFT count for address | No |
| `erc721_owner` | Check NFT owner | No |
| `erc721_transfer` | Transfer NFT | Yes |
| `erc721_metadata` | NFT metadata (name, image, attributes) | No |

### ERC-1155 Multi-Token

| Tool | Description | Write |
|------|-------------|-------|
| `erc1155_balance` | Token balance for ID | No |
| `erc1155_transfer` | Transfer tokens | Yes |
| `erc1155_batch_balance` | Batch balance query | No |

## Contract Interaction

### Generic Contract Calls

| Tool | Description | Write |
|------|-------------|-------|
| `contract_read` | Read from any contract (view functions) | No |
| `contract_write` | Write to any contract (state-changing) | Yes |
| `contract_events` | Query contract events/logs | No |

### Input Schema: contract_read

```typescript
z.object({
  address: z.string().describe('Contract address'),
  abi: z.array(z.any()).describe('Contract ABI (or single function ABI)'),
  functionName: z.string().describe('Function to call'),
  args: z.array(z.any()).optional().describe('Function arguments'),
  chain: z.string().default('ethereum'),
})
```

## Transaction Management

| Tool | Description |
|------|-------------|
| `tx_status` | Get transaction receipt and status |
| `tx_decode` | Decode transaction input data |
| `tx_simulate` | Simulate transaction before sending |

## Security Tools

| Tool | Description |
|------|-------------|
| `token_security` | GoPlus security scan for tokens |
| `honeypot_check` | Check if token is a honeypot |
| `contract_verified` | Check if contract source is verified |
| `rugpull_risk` | Assess rug pull risk score |

## ENS & Name Resolution

| Tool | Description |
|------|-------------|
| `ens_resolve` | Resolve ENS name to address |
| `ens_reverse` | Reverse lookup address to ENS name |
| `ens_records` | Get ENS text records |

## Multicall Support

For batch operations, Agenti uses viem's multicall:

```typescript
// Internally batches multiple read calls
const results = await publicClient.multicall({
  contracts: [
    { address: token1, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] },
    { address: token2, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] },
  ],
});
```

## Chain Configuration

All EVM tools accept a `chain` parameter:

```typescript
chain: z.enum([
  'ethereum', 'polygon', 'arbitrum', 'optimism', 'base',
  'bnb', 'opbnb', 'iotex',
  // Testnets
  'sepolia', 'polygon_amoy', 'arbitrum_sepolia',
  'optimism_sepolia', 'base_sepolia', 'bsc_testnet',
  'opbnb_testnet', 'iotex_testnet'
])
```

## viem Integration

Agenti uses `viem` (v2.46+) for all EVM interactions, providing:
- Type-safe contract interactions
- Automatic ABI encoding/decoding
- Gas estimation
- Transaction signing
- Chain-specific optimizations
- Built-in multicall batching
