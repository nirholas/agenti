# Solana Chain Support

Agenti provides Solana blockchain integration for high-throughput, low-cost transactions and DeFi operations.

## Supported Networks

| Network | CAIP-2 Identifier | Status |
|---------|-------------------|--------|
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | Active |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | Active |
| Solana Testnet | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` | Active |

## Available Tools

### Core Operations
- `solana_balance` - Check SOL balance
- `solana_transfer` - Send SOL
- `solana_spl_balance` - Query SPL token balances
- `solana_spl_transfer` - Transfer SPL tokens
- `solana_token_info` - Token metadata lookup

### DeFi
- `solana_jupiter_swap` - Jupiter aggregator swaps
- `solana_raydium_swap` - Raydium AMM swaps
- `solana_marinade_stake` - Liquid staking via Marinade

### NFTs
- `solana_nft_holdings` - Query NFT collections
- `solana_nft_metadata` - NFT metadata lookup

### x402 on Solana
- `x402_svm_pay` - x402 payments via Solana
- `x402_svm_balance` - USDC balance on Solana

## Configuration

Solana uses `@solana/web3.js` for blockchain interaction:

```json
{
  "chains": {
    "solana": {
      "rpcUrl": "https://api.mainnet-beta.solana.com",
      "network": "mainnet-beta"
    }
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SOLANA_RPC_URL` | Custom Solana RPC | No |
| `SOLANA_PRIVATE_KEY` | Wallet private key (base58) | For write ops |

## Packages

- `packages/wallets/solana-wallet-toolkit` - Solana wallet management
- `src/vendors/solana` - Core Solana vendor integration

## Key Differences from EVM Chains

| Feature | Solana | EVM Chains |
|---------|--------|------------|
| Account model | Account-based (rent) | Account-based |
| Token standard | SPL | ERC-20 |
| Block time | ~400ms | 2-12s |
| Gas model | Compute units + priority fees | Gas price * gas used |
| Smart contracts | Programs (Rust/Anchor) | Solidity/Vyper |
| Finality | ~5s | 12s - 15min |

## Common Workflows

### Token Swap via Jupiter
1. Query token balances with `solana_spl_balance`
2. Get swap quote from Jupiter
3. Execute swap with `solana_jupiter_swap`
4. Verify new balance

### x402 Payments on Solana
The x402 protocol supports Solana via the `@x402/svm` package, enabling USDC payments on Solana for AI agent transactions.
