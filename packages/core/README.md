# @agenti/core

Wallet primitives shared by every agenti package: key generation, mnemonic
derivation, and the wallet/balance types the rest of the stack passes around.

This package holds no network code. It creates and derives keys, and nothing
else, so anything that needs a wallet can depend on it without pulling in a
chain client.

## Install

```bash
npm install @agenti/core
```

## Usage

Generate a fresh wallet for both chains:

```ts
import { generateWallet } from '@agenti/core'

const wallet = generateWallet()

console.log(wallet.evm.address)     // 0x...
console.log(wallet.solana.address)  // base58
```

Derive a wallet deterministically from a mnemonic, so an agent can be restored
rather than re-funded:

```ts
import { generateMnemonic, walletFromMnemonic, validateMnemonic } from '@agenti/core'

const phrase = generateMnemonic()        // 12 words (pass 256 for 24)
validateMnemonic(phrase)                 // true

const first = walletFromMnemonic(phrase)
const second = walletFromMnemonic(phrase, 1)   // next account index
```

## API

| Export | Description |
| --- | --- |
| `generateWallet()` | New EVM + Solana wallet pair. |
| `generateEVMWallet()` | New EVM wallet only. |
| `generateSolanaWallet()` | New Solana wallet only. |
| `walletFromKeys(evmPrivateKey, solanaPrivateKey)` | Rebuild a wallet pair from raw keys. |
| `generateMnemonic(strength?)` | BIP-39 phrase. `128` (default) gives 12 words, `256` gives 24. |
| `validateMnemonic(phrase)` | Checksum check. |
| `walletFromMnemonic(phrase, accountIndex?)` | Derive both chains from one phrase. |
| `evmWalletFromMnemonic(phrase, accountIndex?)` | Derive the EVM wallet only. |
| `solanaWalletFromMnemonic(phrase, accountIndex?)` | Derive the Solana wallet only. |

Types: `Chain`, `EVMWallet`, `SolanaWallet`, `AgentiWallet`, `Balance`, `Invoice`.

## Handling keys

`EVMWallet.privateKey` and `SolanaWallet.privateKey` are live secrets. Keep them
out of logs, prompts, and anything an LLM can read back. `@agenti/sdk` takes a
wallet object and never asks a model for the key itself.

## Related

- [`@agenti/sdk`](../sdk) pays x402 endpoints and reads balances with these wallets.
- [`@agenti/mcp`](../mcp) exposes the same capabilities to any MCP client.
