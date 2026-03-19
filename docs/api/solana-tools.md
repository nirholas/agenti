# Solana Tools Reference

Reference for all Solana blockchain tools available in Agenti.

## Core Operations

| Tool | Description | Write |
|------|-------------|-------|
| `solana_balance` | Get SOL balance | No |
| `solana_transfer` | Send SOL | Yes |
| `solana_account_info` | Account details and metadata | No |
| `solana_recent_blockhash` | Get recent blockhash | No |
| `solana_slot` | Current slot number | No |

## SPL Token Operations

| Tool | Description | Write |
|------|-------------|-------|
| `solana_spl_balance` | SPL token balance | No |
| `solana_spl_transfer` | Transfer SPL tokens | Yes |
| `solana_spl_create_account` | Create associated token account | Yes |
| `solana_token_info` | Token metadata (name, symbol, decimals) | No |
| `solana_token_supply` | Token total/circulating supply | No |
| `solana_token_accounts` | All token accounts for a wallet | No |

## NFT Operations

| Tool | Description | Write |
|------|-------------|-------|
| `solana_nft_holdings` | NFTs owned by a wallet | No |
| `solana_nft_metadata` | NFT metadata and attributes | No |
| `solana_nft_collection` | Collection details | No |

## DeFi Tools

### Jupiter Aggregator

| Tool | Description | Write |
|------|-------------|-------|
| `solana_jupiter_quote` | Get swap quote from Jupiter | No |
| `solana_jupiter_swap` | Execute swap via Jupiter | Yes |
| `solana_jupiter_price` | Token price via Jupiter | No |

### Raydium

| Tool | Description | Write |
|------|-------------|-------|
| `solana_raydium_pools` | Query Raydium pools | No |
| `solana_raydium_swap` | Execute Raydium swap | Yes |

### Marinade (Liquid Staking)

| Tool | Description | Write |
|------|-------------|-------|
| `solana_marinade_stake` | Stake SOL via Marinade | Yes |
| `solana_marinade_unstake` | Unstake mSOL | Yes |
| `solana_marinade_apy` | Current staking APY | No |

## Transaction Tools

| Tool | Description |
|------|-------------|
| `solana_tx_status` | Transaction confirmation status |
| `solana_tx_history` | Recent transactions for account |
| `solana_tx_decode` | Decode transaction instructions |

## Input Schemas

### solana_transfer

```typescript
z.object({
  to: z.string().describe('Recipient address (base58)'),
  amount: z.string().describe('Amount in SOL'),
  memo: z.string().optional().describe('Optional transaction memo'),
})
```

### solana_jupiter_swap

```typescript
z.object({
  inputMint: z.string().describe('Input token mint address'),
  outputMint: z.string().describe('Output token mint address'),
  amount: z.string().describe('Input amount in token units'),
  slippageBps: z.number().default(50).describe('Slippage in basis points'),
})
```

## x402 on Solana

| Tool | Description |
|------|-------------|
| `x402_svm_pay` | x402 payment via Solana |
| `x402_svm_balance` | USDC balance for x402 on Solana |

## SDK

Agenti uses `@solana/web3.js` v1.87+ for Solana interactions:

```typescript
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
);
```

## Key Differences from EVM

| Aspect | Solana | EVM |
|--------|--------|-----|
| Address format | Base58 | 0x-prefixed hex |
| Token standard | SPL (separate accounts) | ERC-20 (single contract) |
| Transaction model | Instructions in transactions | Single call per tx |
| Gas | Compute units + priority fees | Gas price * gas used |
| Finality | ~5 seconds | 12s - 15 minutes |
| Account model | Rent-based | Balance-based |
