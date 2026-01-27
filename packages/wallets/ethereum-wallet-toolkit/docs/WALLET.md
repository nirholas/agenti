# Wallet Operations

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses, keys, and mnemonics shown are FAKE - never use them for real funds.

This document covers the wallet generation and restoration features of the Ethereum Wallet Toolkit.

## Overview

The wallet module supports:
- Random key generation
- BIP39 mnemonic generation (12-24 words)
- HD wallet derivation (BIP32/BIP44)
- Wallet restoration from mnemonic or private key
- Multiple account derivation

## Wallet Types

### 1. Random Key Wallet

Simple wallet with just a private key:

```bash
python wallet.py generate
```

Output:
```
Address:     0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
Private Key: 0xaaa...
Public Key:  0x04abc...
```

### 2. HD Wallet (Mnemonic)

Hierarchical Deterministic wallet with BIP39 seed phrase:

```bash
python wallet.py generate --mnemonic --words 24
```

Output:
```
Address:     0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
Private Key: 0xbbb...
Public Key:  0x04def...

Mnemonic (24 words):
  word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12...

Derivation Path: m/44'/60'/0'/0/0
```

## CLI Usage

### Generate Wallets

```bash
# Simple random wallet
python wallet.py generate

# HD wallet with 12-word mnemonic
python wallet.py generate --mnemonic

# HD wallet with 24-word mnemonic
python wallet.py generate --mnemonic --words 24

# HD wallet with passphrase
python wallet.py generate --mnemonic --passphrase "my secret"

# HD wallet with custom path
python wallet.py generate --mnemonic --path "m/44'/60'/0'/0/5"

# Save to file
python wallet.py generate --mnemonic --output wallet.json
```

### Restore Wallets

```bash
# Restore from mnemonic
python wallet.py restore --mnemonic word1 word2 word3 ... word12

# Restore from mnemonic with passphrase
python wallet.py restore --mnemonic word1 word2 ... --passphrase "my secret"

# Restore from mnemonic with custom path
python wallet.py restore --mnemonic word1 word2 ... --path "m/44'/60'/0'/0/3"

# Restore from private key
python wallet.py restore --key 0x...
```

### Derive Multiple Accounts

```bash
# Derive 10 accounts from mnemonic
python wallet.py derive --mnemonic word1 word2 ... --count 10

# Show private keys
python wallet.py derive --mnemonic word1 word2 ... --count 10 --verbose

# Custom base path
python wallet.py derive --mnemonic word1 word2 ... --base-path "m/44'/60'/1'/0"
```

## Python API

```python
from wallet import (
    generate_wallet,
    restore_from_mnemonic,
    restore_from_private_key,
    derive_accounts,
    WalletResult
)

# Generate random wallet
wallet = generate_wallet()
print(f"Address: {wallet.address}")
print(f"Key: {wallet.private_key}")

# Generate HD wallet
wallet = generate_wallet(
    use_mnemonic=True,
    word_count=24,
    passphrase="optional passphrase"
)
print(f"Address: {wallet.address}")
print(f"Mnemonic: {wallet.mnemonic}")
print(f"Path: {wallet.derivation_path}")

# Restore from mnemonic
wallet = restore_from_mnemonic(
    "abandon ability able about above absent absorb abstract absurd abuse access accident",
    passphrase="",
    derivation_path="m/44'/60'/0'/0/0"
)

# Restore from private key
wallet = restore_from_private_key("0x...")

# Derive multiple accounts
accounts = derive_accounts(
    "word1 word2 word3...",
    count=10,
    passphrase="",
    base_path="m/44'/60'/0'/0"
)
for acc in accounts:
    print(f"[{acc['index']}] {acc['address']}")
```

## HD Derivation Paths

### Standard Ethereum Path (BIP44)

```
m/44'/60'/0'/0/0
```

Components:
- `m` - Master key
- `44'` - BIP44 purpose (hardened)
- `60'` - Ethereum coin type (hardened)
- `0'` - Account index (hardened)
- `0` - External chain (0) vs internal/change (1)
- `0` - Address index

### Common Paths

| Path | Description |
|------|-------------|
| `m/44'/60'/0'/0/0` | First Ethereum account (default) |
| `m/44'/60'/0'/0/1` | Second account |
| `m/44'/60'/1'/0/0` | First account on second HD account |
| `m/44'/60'/0'/0` | Base path for derivation |

### MetaMask Accounts

MetaMask uses the standard path:
```
m/44'/60'/0'/0/0  - Account 1
m/44'/60'/0'/0/1  - Account 2
m/44'/60'/0'/0/2  - Account 3
...
```

### Ledger Live

Ledger Live uses:
```
m/44'/60'/0'/0/0  - Account 1
m/44'/60'/1'/0/0  - Account 2
m/44'/60'/2'/0/0  - Account 3
...
```

## Mnemonic Word Counts

| Words | Entropy | Security |
|-------|---------|----------|
| 12 | 128 bits | Standard |
| 15 | 160 bits | Enhanced |
| 18 | 192 bits | High |
| 21 | 224 bits | Very High |
| 24 | 256 bits | Maximum |

For most users, 12 words (128 bits) is sufficient. Use 24 words for critical wallets.

## BIP39 Passphrase

The optional passphrase (sometimes called "25th word"):
- Adds extra security
- Creates completely different keys from same mnemonic
- NOT recoverable if forgotten
- Case-sensitive

```bash
# With passphrase
python wallet.py generate --mnemonic --passphrase "my secret phrase"

# Same mnemonic, different passphrase = different addresses
python wallet.py restore --mnemonic word1 word2 ... --passphrase "phrase1"
python wallet.py restore --mnemonic word1 word2 ... --passphrase "phrase2"
```

## Security Best Practices

### Mnemonic Storage

1. **Write it down physically** - Don't store digitally
2. **Use durable materials** - Metal backup plates
3. **Store in multiple locations** - Fire/flood protection
4. **Never share** - Anyone with mnemonic has full access
5. **Verify backup** - Test restoration before use

### Private Key Handling

1. **Never expose** - Keep off internet-connected devices
2. **Don't copy/paste** - Clipboard can be compromised
3. **Clear terminal history** - Remove from shell history
4. **Use keystore** - Encrypt with password for storage

### Generation Security

1. **Use air-gapped computer** - For high-value wallets
2. **Verify randomness** - Trust system entropy source
3. **Generate offline** - Disconnect from network
4. **Verify addresses** - Cross-check before use

## Wallet File Format

When saving to JSON:

```json
{
  "address": "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "private_key": "0xaaa...",
  "public_key": "0x04abc...",
  "mnemonic": "word1 word2 word3...",
  "derivation_path": "m/44'/60'/0'/0/0",
  "passphrase_used": false
}
```

**Warning**: This file contains sensitive data. Encrypt or delete after use.

## Testing Mnemonics

Standard test vectors exist for development (e.g., "abandon abandon..." repeated).
**DO NOT USE ANY PUBLICLY KNOWN MNEMONIC FOR REAL FUNDS.**

## Troubleshooting

### Wrong Address from Mnemonic

1. Check derivation path (MetaMask vs Ledger)
2. Verify passphrase (case-sensitive)
3. Confirm mnemonic spelling
4. Try with/without passphrase

### Invalid Mnemonic

1. Check word count (12, 15, 18, 21, 24)
2. Verify each word is in BIP39 wordlist
3. Check for typos (similar words: access/across)
4. Ensure correct word order

### Invalid Private Key

1. Must be 64 hex characters (32 bytes)
2. Can have optional 0x prefix
3. Only hex characters (0-9, a-f)
