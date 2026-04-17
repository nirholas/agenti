# Integrate: HD Wallet & EIP-712 Signing

status: todo

## Source repo
https://github.com/nirholas/ethereum-wallet-toolkit

## Goal
Upgrade `packages/core/src/wallet.ts` to support BIP39 mnemonic phrases and
HD wallet derivation (BIP44), so agents can manage multiple addresses from a
single seed phrase. Also add EIP-712 typed data signing to the SDK.

## Steps

### 1. Clone and read
```
git clone https://github.com/nirholas/ethereum-wallet-toolkit /tmp/ethereum-wallet-toolkit
```
Read:
- `/tmp/ethereum-wallet-toolkit/ethereum-wallet-mcp/src/tools/wallet_generation.py`
- `/tmp/ethereum-wallet-toolkit/ethereum-wallet-mcp/src/tools/signing.py`
- `/tmp/ethereum-wallet-toolkit/ethereum-wallet-mcp/src/tools/typed_data.py`
- `/tmp/ethereum-wallet-toolkit/ethereum-wallet-mcp/src/ethereum_wallet_mcp/server.py`

Note: source is Python. Rewrite in TypeScript using viem's HD wallet utilities.

### 2. Upgrade `packages/core/src/wallet.ts`

Add mnemonic / HD derivation alongside the existing random keypair generation:

```ts
import { english, generateMnemonic, mnemonicToSeed } from '@scure/bip39'
import { HDKey } from '@scure/bip32'

/**
 * Generate a new 12 or 24-word BIP39 mnemonic phrase.
 * Default: 12 words (128 bits entropy).
 */
export function generateMnemonic(strength?: 128 | 256): string

/**
 * Derive an EVM wallet from a mnemonic at the given BIP44 account index.
 * Path: m/44'/60'/0'/0/{accountIndex}
 */
export function evmWalletFromMnemonic(
  mnemonic: string,
  accountIndex?: number
): EVMWallet

/**
 * Derive a Solana wallet from a mnemonic at the given account index.
 * Path: m/44'/501'/{accountIndex}'/0'
 */
export function solanaWalletFromMnemonic(
  mnemonic: string,
  accountIndex?: number
): SolanaWallet

/**
 * Derive a full AgentiWallet (EVM + Solana) from a mnemonic.
 * Both addresses come from the same seed, accountIndex 0 by default.
 */
export function walletFromMnemonic(
  mnemonic: string,
  accountIndex?: number
): AgentiWallet

/**
 * Validate a BIP39 mnemonic phrase.
 */
export function validateMnemonic(mnemonic: string): boolean
```

### 3. Create `packages/sdk/src/signing.ts`

EIP-712 and EIP-191 signing utilities:

```ts
import { signTypedData, verifyTypedData, hashTypedData } from 'viem'

export interface TypedDataDomain {
  name?: string
  version?: string
  chainId?: number
  verifyingContract?: `0x${string}`
}

/**
 * Sign EIP-712 typed data with an EVM private key.
 * Returns the hex signature.
 */
export async function signEIP712(
  domain: TypedDataDomain,
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
  message: Record<string, unknown>,
  privateKey: `0x${string}`
): Promise<`0x${string}`>

/**
 * Verify an EIP-712 signature and recover the signer address.
 */
export function verifyEIP712(
  domain: TypedDataDomain,
  types: Record<string, Array<{ name: string; type: string }>>,
  primaryType: string,
  message: Record<string, unknown>,
  signature: `0x${string}`
): `0x${string}`  // signer address

/**
 * Sign a plain message (EIP-191 personal_sign).
 */
export async function signMessage(
  message: string,
  privateKey: `0x${string}`
): Promise<`0x${string}`>

/**
 * Verify a personal_sign signature.
 */
export function verifyMessage(
  message: string,
  signature: `0x${string}`
): `0x${string}`  // signer address
```

### 4. Add MCP tools to `packages/mcp/src/server.ts`

**`generate_mnemonic`**
- Input: `{ strength?: 128 | 256 }`
- Generates a new BIP39 mnemonic phrase
- Returns mnemonic + first EVM and Solana addresses derived from it

**`derive_wallet`**
- Input: `{ mnemonic: string, account_index?: number }`
- Derives EVM + Solana wallet from mnemonic at given index
- Useful for managing multiple agent wallets from one seed

**`sign_message`**
- Input: `{ message: string, evm_private_key?: string }`
- Signs a message with EIP-191 personal_sign
- Returns signature + signer address

### 5. Add dependencies to `packages/core/package.json`
```json
"dependencies": {
  "@scure/bip39": "^1.3.0",
  "@scure/bip32": "^1.4.0"
}
```

### 6. Export from packages
```ts
// packages/core/src/index.ts — add:
export { generateMnemonic, walletFromMnemonic, evmWalletFromMnemonic,
         solanaWalletFromMnemonic, validateMnemonic } from './wallet.js'

// packages/sdk/src/index.ts — add:
export { signEIP712, verifyEIP712, signMessage, verifyMessage } from './signing.js'
```

## Sensitivity check
ethereum-wallet-toolkit is MIT licensed. BIP39/BIP44 HD wallet derivation is a
published standard (Bitcoin Improvement Proposals). EIP-712/EIP-191 are Ethereum
Improvement Proposals. viem already implements these standards. Implement by
composing viem + @scure/bip39 + @scure/bip32 — no logic copy needed.

## Dependencies to add
- `@scure/bip39` (audited by Trail of Bits)
- `@scure/bip32` (audited by Trail of Bits)

## Output files
- Updated `packages/core/src/wallet.ts` (mnemonic functions)
- Updated `packages/core/package.json` (new deps)
- `packages/sdk/src/signing.ts`
- Updated `packages/mcp/src/server.ts` (3 new tools)
- Updated `packages/core/src/index.ts`
- Updated `packages/sdk/src/index.ts`

Mark this file's status as `complete` when done.
