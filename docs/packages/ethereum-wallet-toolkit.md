# Ethereum Wallet Toolkit Package

`packages/wallets/ethereum-wallet-toolkit` - A comprehensive EVM wallet management toolkit for AI agents.

## Overview

The Ethereum Wallet Toolkit provides a unified interface for wallet operations across all EVM-compatible chains supported by Agenti.

## Features

- Multi-chain wallet balance tracking
- Native and ERC-20 token transfers
- NFT management (ERC-721, ERC-1155)
- Token approval management
- Transaction history and decoding
- ENS name resolution
- Gas estimation and optimization

## Installation

Included as part of the Agenti monorepo. Can also be used standalone:

```bash
npm install @nirholas/ethereum-wallet-toolkit
```

## Usage

```typescript
import { EthereumWallet } from '@nirholas/ethereum-wallet-toolkit';

const wallet = new EthereumWallet({
  privateKey: process.env.PRIVATE_KEY,
  chain: 'ethereum',
});

// Check balance
const balance = await wallet.getBalance();

// Send ETH
const tx = await wallet.sendNative({
  to: '0x...',
  amount: '0.1',
});

// Send ERC-20
const tokenTx = await wallet.sendToken({
  token: '0x...', // USDC
  to: '0x...',
  amount: '100',
});
```

## Supported Chains

All EVM chains configured in Agenti:
- Ethereum, Polygon, Arbitrum, Optimism, Base
- BNB Chain, opBNB, IoTeX
- All corresponding testnets

## API

### Constructor

```typescript
new EthereumWallet({
  privateKey: string,     // Hex-encoded private key
  chain: string,          // Chain name
  rpcUrl?: string,        // Custom RPC (optional)
})
```

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAddress()` | Wallet address | `string` |
| `getBalance()` | Native token balance | `bigint` |
| `getTokenBalance(token)` | ERC-20 balance | `bigint` |
| `sendNative(params)` | Send native tokens | `TransactionReceipt` |
| `sendToken(params)` | Send ERC-20 | `TransactionReceipt` |
| `approve(token, spender, amount)` | Approve spending | `TransactionReceipt` |
| `revokeApproval(token, spender)` | Revoke approval | `TransactionReceipt` |
| `getTransactionHistory(limit)` | Recent transactions | `Transaction[]` |

## Dependencies

- `viem` - EVM interaction library
- `zod` - Input validation
