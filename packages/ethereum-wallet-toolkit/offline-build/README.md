# Offline Build - Official Ethereumjs Libraries

This directory contains the build system to create `offline1.html` using **official ethereumjs libraries**.

## Libraries Used

All libraries are from the official Ethereum ecosystem:

- `@ethereumjs/tx` - Transaction signing (legacy + EIP-1559)
- `@ethereumjs/util` - Utilities (address validation, checksums, etc.)
- `@ethereumjs/rlp` - RLP encoding
- `@ethereumjs/wallet` - Wallet utilities
- `ethereum-cryptography` - Official cryptographic primitives (secp256k1, keccak256)
- `@scure/bip39` - BIP39 mnemonic (used by ethereumjs)
- `@scure/bip32` - BIP32 HD derivation (used by ethereumjs)

## Build Instructions

```bash
# Navigate to this directory
cd offline-build

# Install dependencies
npm install

# Build offline1.html
npm run build
```

The output file `offline1.html` will be created in the parent directory.

## What Gets Bundled

The build process uses `esbuild` to:
1. Bundle all ethereumjs libraries and their dependencies
2. Minify the code for smaller file size
3. Inline everything into a single HTML file

Typical bundle size: ~400-600 KB (varies by version)

## Features

All features match the CLI tool:

- **Wallet Generation** - Random keypair generation
- **Mnemonic Support** - Create/restore BIP39 mnemonics, derive accounts
- **Vanity Addresses** - All vanity options (prefix, suffix, regex, etc.)
- **Message Signing** - EIP-191 personal_sign
- **Signature Verification** - Recover signer from signature
- **Validation** - Address and key validation
- **Keystore** - V3 keystore encrypt/decrypt (PBKDF2)
- **Transactions** - Sign legacy and EIP-1559 transactions offline
- **EIP-712** - Typed data signing and verification

## Security

- The generated HTML file is completely self-contained
- No external network requests
- Can be saved and used on an air-gapped machine
- Uses official, audited Ethereum libraries

