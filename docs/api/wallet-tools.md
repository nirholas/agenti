# Wallet Tools Reference

Reference for wallet management and operations tools in Agenti.

## Packages

| Package | Purpose |
|---------|---------|
| `packages/wallets/ethereum-wallet-toolkit` | EVM wallet operations |
| `packages/wallets/solana-wallet-toolkit` | Solana wallet operations |
| `packages/wallets/sweep` | Wallet consolidation/sweeping |

## EVM Wallet Tools

### Address Management

| Tool | Description |
|------|-------------|
| `wallet_address` | Get wallet address from configured private key |
| `wallet_address_validate` | Validate an EVM address format |
| `ens_resolve` | Resolve ENS name to address |
| `ens_reverse` | Reverse lookup address to ENS name |

### Balance Operations

| Tool | Description |
|------|-------------|
| `wallet_eth_balance` | Native token balance on any EVM chain |
| `wallet_token_balances` | All ERC-20 token balances |
| `wallet_nft_list` | All NFTs owned by address |
| `wallet_total_value` | Total portfolio value in USD |

### Transaction Operations

| Tool | Description | Write |
|------|-------------|-------|
| `wallet_send_eth` | Send native tokens | Yes |
| `wallet_send_token` | Send ERC-20 tokens | Yes |
| `wallet_send_nft` | Transfer NFT | Yes |
| `wallet_approve_token` | Approve token spending | Yes |
| `wallet_revoke_approval` | Revoke token approval | Yes |

### Transaction History

| Tool | Description |
|------|-------------|
| `wallet_tx_history` | Recent transactions |
| `wallet_token_transfers` | ERC-20 transfer history |
| `wallet_nft_transfers` | NFT transfer history |

## Solana Wallet Tools

### Address Management

| Tool | Description |
|------|-------------|
| `solana_wallet_address` | Get Solana wallet address |
| `solana_wallet_validate` | Validate Solana address |

### Balance Operations

| Tool | Description |
|------|-------------|
| `solana_wallet_balance` | SOL balance |
| `solana_wallet_tokens` | All SPL token balances |
| `solana_wallet_nfts` | All NFTs owned |

### Transaction Operations

| Tool | Description | Write |
|------|-------------|-------|
| `solana_wallet_send` | Send SOL | Yes |
| `solana_wallet_send_token` | Send SPL token | Yes |

## Sweep Tool

The sweep package consolidates tokens from multiple wallets into one:

| Tool | Description |
|------|-------------|
| `sweep_scan` | Scan wallets for balances to sweep |
| `sweep_execute` | Execute sweep (transfer all to target) |
| `sweep_estimate` | Estimate gas costs for sweep |

### Input Schema: sweep_execute

```typescript
z.object({
  sourceAddresses: z.array(z.string()).describe('Addresses to sweep from'),
  targetAddress: z.string().describe('Destination address'),
  chain: z.string().default('ethereum'),
  tokens: z.array(z.string()).optional().describe('Specific tokens to sweep (default: all)'),
  includeNative: z.boolean().default(true).describe('Include native token'),
})
```

## Security Features

### Approval Management

Token approvals are a common attack vector. Agenti provides tools to manage them:

```
1. wallet_approve_token - Set approval with specific amount (avoid unlimited)
2. wallet_revoke_approval - Remove unused approvals
3. wallet_check_approvals - List all active approvals
```

### Best Practices

1. **Limit approvals** - Approve exact amounts, not unlimited
2. **Revoke unused** - Regularly check and revoke old approvals
3. **Verify addresses** - Always validate addresses before sending
4. **Use ENS** - Resolve ENS names to reduce address errors
5. **Check gas** - Verify gas estimates before large transactions
6. **Test first** - Use testnets for unfamiliar operations

## Multi-Chain Support

Wallet tools support all EVM chains. The `chain` parameter selects the network:

```typescript
// Check balance on multiple chains
const ethBalance = await wallet_eth_balance({ chain: 'ethereum' });
const baseBalance = await wallet_eth_balance({ chain: 'base' });
const polygonBalance = await wallet_eth_balance({ chain: 'polygon' });
```
