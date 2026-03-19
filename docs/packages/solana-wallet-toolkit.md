# Solana Wallet Toolkit Package

`packages/wallets/solana-wallet-toolkit` - Solana wallet management toolkit for AI agents.

## Overview

The Solana Wallet Toolkit provides wallet operations for the Solana blockchain, including SOL transfers, SPL token management, and NFT handling.

## Features

- SOL balance and transfers
- SPL token account management
- Token metadata resolution
- NFT collection browsing
- Transaction history
- Memo program support

## Installation

```bash
npm install @nirholas/solana-wallet-toolkit
```

## Usage

```typescript
import { SolanaWallet } from '@nirholas/solana-wallet-toolkit';

const wallet = new SolanaWallet({
  privateKey: process.env.SOLANA_PRIVATE_KEY,
  network: 'mainnet-beta',
});

// Check SOL balance
const balance = await wallet.getBalance();

// Send SOL
const tx = await wallet.sendSol({
  to: 'recipient_base58_address',
  amount: 1.5,
});

// Send SPL token
const tokenTx = await wallet.sendToken({
  mint: 'token_mint_address',
  to: 'recipient_address',
  amount: 100,
});
```

## API

### Constructor

```typescript
new SolanaWallet({
  privateKey: string,           // Base58-encoded private key
  network: 'mainnet-beta' | 'devnet' | 'testnet',
  rpcUrl?: string,              // Custom RPC (optional)
})
```

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAddress()` | Wallet public key | `string` |
| `getBalance()` | SOL balance in lamports | `number` |
| `getTokenAccounts()` | All SPL token accounts | `TokenAccount[]` |
| `sendSol(params)` | Send SOL | `TransactionSignature` |
| `sendToken(params)` | Send SPL token | `TransactionSignature` |
| `getNFTs()` | List owned NFTs | `NFT[]` |
| `getTransactionHistory(limit)` | Recent transactions | `Transaction[]` |

## Key Differences from EVM Toolkit

| Feature | EVM | Solana |
|---------|-----|--------|
| Private key format | Hex (0x...) | Base58 |
| Token accounts | Single contract | Separate accounts per token |
| Gas model | Gas price | Compute units + priority fees |
| NFT standard | ERC-721 | Metaplex |

## Dependencies

- `@solana/web3.js` - Solana JavaScript SDK
- `@solana/spl-token` - SPL token utilities
- `zod` - Input validation
