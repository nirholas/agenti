"""
Documentation Resources for Ethereum Wallet MCP Server

This module implements MCP resources providing documentation:
- BIP39 standard documentation
- HD derivation path documentation  
- BIP39 wordlists by language

Resources provide static content that can be read by MCP clients.
"""

from mcp.server import Server
from mcp.types import Resource, TextContent

# BIP39 wordlists - English only included inline, others loaded dynamically
SUPPORTED_LANGUAGES = [
    "english", "spanish", "french", "italian",
    "japanese", "korean", "chinese_simplified", "chinese_traditional",
    "czech", "portuguese"
]


def register_documentation_resources(server: Server) -> None:
    """
    Register all documentation resources with the MCP server.
    
    Args:
        server: MCP Server instance to register resources with
    """
    
    @server.resource("wallet://documentation/bip39")
    async def get_bip39_documentation() -> str:
        """
        Resource providing BIP39 standard documentation.
        
        Returns comprehensive documentation about the BIP39 mnemonic
        standard used for wallet seed phrases.
        """
        return BIP39_DOCUMENTATION
    
    @server.resource("wallet://documentation/derivation-paths")
    async def get_derivation_paths_documentation() -> str:
        """
        Resource providing HD derivation path documentation.
        
        Returns documentation about BIP44 standard paths and
        Ethereum-specific derivation conventions.
        """
        return DERIVATION_PATHS_DOCUMENTATION
    
    @server.resource("wallet://wordlist/{language}")
    async def get_wordlist(language: str) -> str:
        """
        Resource providing BIP39 wordlists by language.
        
        Args:
            language: Language code (english, spanish, french, etc.)
            
        Returns:
            Complete BIP39 wordlist for the specified language
        """
        language = language.lower().strip()
        
        if language not in SUPPORTED_LANGUAGES:
            return f"Error: Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        
        try:
            from mnemonic import Mnemonic
            mnemo = Mnemonic(language)
            words = mnemo.wordlist
            
            header = f"# BIP39 Wordlist: {language.title()}\n\n"
            header += f"Total words: {len(words)}\n\n"
            header += "---\n\n"
            
            # Format as numbered list
            word_list = "\n".join(f"{i+1}. {word}" for i, word in enumerate(words))
            
            return header + word_list
            
        except Exception as e:
            return f"Error loading wordlist for '{language}': {str(e)}"


# ============================================================================
# Documentation Content
# ============================================================================

BIP39_DOCUMENTATION = """# BIP39: Mnemonic Code for Generating Deterministic Keys

## Overview

BIP39 (Bitcoin Improvement Proposal 39) describes the implementation of a mnemonic 
code or mnemonic sentence -- a group of easy-to-remember words -- for the generation 
of deterministic wallets.

This standard is widely adopted across the cryptocurrency ecosystem and is the 
foundation for most modern wallet backup and recovery systems.

---

## How It Works

### 1. Entropy Generation

The process begins with generating random entropy:

| Word Count | Entropy Bits | Checksum Bits | Total Bits |
|------------|--------------|---------------|------------|
| 12 words   | 128 bits     | 4 bits        | 132 bits   |
| 15 words   | 160 bits     | 5 bits        | 165 bits   |
| 18 words   | 192 bits     | 6 bits        | 198 bits   |
| 21 words   | 224 bits     | 7 bits        | 231 bits   |
| 24 words   | 256 bits     | 8 bits        | 264 bits   |

### 2. Checksum Calculation

A checksum is computed by taking the first `entropy_bits / 32` bits of the 
SHA256 hash of the entropy. This checksum is appended to the entropy.

### 3. Word Selection

The combined entropy + checksum is split into 11-bit groups. Each 11-bit 
value (0-2047) maps to a word in the 2048-word BIP39 wordlist.

### 4. Seed Generation

The mnemonic is converted to a 512-bit seed using PBKDF2-HMAC-SHA512:
- Mnemonic phrase as the password
- "mnemonic" + optional passphrase as the salt
- 2048 iterations

---

## Security Considerations

### Entropy Quality

The security of your wallet depends entirely on the quality of entropy used:

- **Good**: Hardware random number generators, OS-level /dev/urandom
- **Bad**: Predictable sources, weak PRNGs, user-chosen words

**Never create your own mnemonic by picking words!** The checksum will be invalid, 
and human-chosen words are not random.

### Word Count Recommendations

| Use Case | Recommended | Security Level |
|----------|-------------|----------------|
| Testing/Development | 12 words | 128 bits |
| Personal Use | 12-24 words | 128-256 bits |
| High Value | 24 words | 256 bits |
| Institutional | 24 words + passphrase | 256+ bits |

### Passphrase (25th Word)

BIP39 supports an optional passphrase that provides:

1. **Additional Security**: Even if mnemonic is compromised, funds are safe
2. **Plausible Deniability**: Different passphrases derive different wallets
3. **Multi-wallet**: Single mnemonic can manage multiple separate wallets

**Warning**: Forgetting the passphrase means permanent loss of funds!

---

## Supported Languages

BIP39 defines wordlists in multiple languages:

1. **English** (most common, recommended)
2. **Spanish** (Español)
3. **French** (Français)
4. **Italian** (Italiano)
5. **Japanese** (日本語)
6. **Korean** (한국어)
7. **Chinese Simplified** (简体中文)
8. **Chinese Traditional** (繁體中文)
9. **Czech** (Čeština)
10. **Portuguese** (Português)

### Language Selection Tips

- **Use English** for maximum compatibility
- Same entropy with different language = different words, same seed
- Some wallets only support English
- Document which language was used!

---

## Wordlist Properties

Each BIP39 wordlist has specific properties:

1. **2048 words** exactly
2. **First 4 characters unique** - allows unambiguous abbreviation
3. **Similar words avoided** - reduces confusion
4. **Sorted** - allows binary search
5. **UTF-8 NFKD normalized** - consistent encoding

---

## Common Mistakes to Avoid

### 1. Digital Storage
❌ Storing mnemonic in:
- Cloud storage (iCloud, Google Drive, Dropbox)
- Password managers
- Email
- Photos
- Text files

### 2. Insecure Generation
❌ Generating mnemonic:
- On compromised devices
- Using weak randomness
- By manually selecting words

### 3. Sharing
❌ Entering mnemonic:
- On websites
- In apps from unknown sources
- When someone asks for "verification"

### 4. Single Copy
❌ Keeping only one backup:
- Fire, flood, theft can destroy it
- Always maintain redundant copies

---

## Verification and Validation

### Valid Mnemonic Checklist

1. ✅ Word count is 12, 15, 18, 21, or 24
2. ✅ All words are in the BIP39 wordlist
3. ✅ Words are in exact order
4. ✅ Checksum validates correctly
5. ✅ Derives expected address

### Testing Your Backup

1. Generate wallet, note the address
2. Clear wallet from device
3. Restore using your backup
4. Verify same address is derived
5. Send small test transaction

---

## References

- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP39 Wordlists](https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-wordlists.md)
- [Ian Coleman's BIP39 Tool](https://iancoleman.io/bip39/) (use offline only!)

---

## Related Standards

- **BIP32**: Hierarchical Deterministic Wallets
- **BIP44**: Multi-Account Hierarchy
- **BIP43**: Purpose Field
- **SLIP44**: Registered Coin Types
"""

DERIVATION_PATHS_DOCUMENTATION = """# HD Wallet Derivation Paths

## Overview

Hierarchical Deterministic (HD) wallets use derivation paths to generate 
multiple addresses from a single seed. This allows one mnemonic to manage 
unlimited addresses in a deterministic, recoverable way.

---

## Path Format

Derivation paths follow this format:

```
m / purpose' / coin_type' / account' / change / address_index
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| `m` | Master node (root) | Always `m` |
| `purpose'` | BIP number defining structure | `44'` for BIP44 |
| `coin_type'` | Cryptocurrency identifier | `60'` for Ethereum |
| `account'` | Account index | `0'`, `1'`, etc. |
| `change` | External (0) or internal (1) chain | Usually `0` |
| `address_index` | Address within account | `0`, `1`, `2`, etc. |

### Hardened vs Non-Hardened

- **Hardened** (marked with `'` or `h`): More secure, cannot derive parent
- **Non-hardened**: Can derive child public keys from parent public key

Ethereum uses hardened derivation for purpose, coin_type, and account.

---

## Ethereum Standard Path

### BIP44 Standard (Most Common)

```
m/44'/60'/0'/0/x
```

Where:
- `44'` = BIP44 purpose
- `60'` = Ethereum coin type (SLIP44)
- `0'` = First account
- `0` = External chain
- `x` = Address index (0, 1, 2, ...)

### First 5 Addresses

| Index | Path | Description |
|-------|------|-------------|
| 0 | `m/44'/60'/0'/0/0` | First address |
| 1 | `m/44'/60'/0'/0/1` | Second address |
| 2 | `m/44'/60'/0'/0/2` | Third address |
| 3 | `m/44'/60'/0'/0/3` | Fourth address |
| 4 | `m/44'/60'/0'/0/4` | Fifth address |

---

## Wallet-Specific Paths

Different wallets may use slightly different paths:

### MetaMask / Most Web Wallets
```
m/44'/60'/0'/0/x
```
Standard BIP44 path, increments address_index.

### Ledger Live
```
m/44'/60'/0'/0/x
```
Same as MetaMask.

### Legacy Ledger (MEW)
```
m/44'/60'/0'/x
```
Note: Missing the change component.

### Legacy Ledger Live
```
m/44'/60'/x'/0/0
```
Increments account instead of address_index.

### Trezor
```
m/44'/60'/0'/0/x
```
Standard BIP44 path.

### Jaxx
```
m/44'/60'/0'/0/x
```
Standard BIP44 path.

### Exodus
```
m/44'/60'/0'/0/x
```
Standard BIP44 path.

---

## Multi-Account Usage

### Account vs Address Index

You can organize addresses in two ways:

**Method 1: Multiple Addresses in One Account**
```
m/44'/60'/0'/0/0  ← Address 0
m/44'/60'/0'/0/1  ← Address 1
m/44'/60'/0'/0/2  ← Address 2
```

**Method 2: Multiple Accounts**
```
m/44'/60'/0'/0/0  ← Account 0, Address 0
m/44'/60'/1'/0/0  ← Account 1, Address 0
m/44'/60'/2'/0/0  ← Account 2, Address 0
```

### When to Use Each

| Method | Use Case |
|--------|----------|
| Multiple addresses | Privacy, receiving payments |
| Multiple accounts | Organizational separation |

---

## Other Ethereum Networks

### EVM-Compatible Chains

Most EVM chains use the same path as Ethereum:
```
m/44'/60'/0'/0/x
```

This includes:
- Polygon
- Binance Smart Chain
- Avalanche C-Chain
- Arbitrum
- Optimism
- Fantom

### Different Coin Types (Less Common)

Some networks register their own coin type:
- Ethereum Classic: `m/44'/61'/0'/0/x`
- Binance Chain (Beacon): `m/44'/714'/0'/0/x`

---

## Custom Derivation Paths

### When to Use Custom Paths

1. **Privacy**: Separate funds from main path
2. **Organization**: Business vs personal
3. **Compatibility**: Matching legacy wallet
4. **Advanced**: Multi-sig setups

### Creating Custom Paths

Valid path examples:
```
m/44'/60'/0'/0/0     ← Standard
m/44'/60'/1'/0/0     ← Second account
m/44'/60'/0'/0/100   ← 101st address
m/44'/60'/0'/1/0     ← Internal/change address
```

**Warning**: Document custom paths! Non-standard paths may not be recovered 
by default wallet restore processes.

---

## Path Recovery

### If You Don't Know Your Path

Try these common paths in order:

1. `m/44'/60'/0'/0/0` - Standard BIP44
2. `m/44'/60'/0'/0` - Legacy Ledger (no index)
3. `m/44'/60'/0'/0/0` through `/9` - First 10 addresses
4. `m/44'/60'/0'/0/0` through `m/44'/60'/9'/0/0` - First 10 accounts

### Path Recovery Tools

Use tools like:
- `derive_multiple_accounts` - Try multiple indices
- Wallet discovery features in some wallets
- Block explorer address lookup

---

## Security Considerations

### Public Key Exposure

- Non-hardened paths allow deriving child public keys
- Never expose extended public key (xpub) at account level or higher
- Address-level xpub is generally safe to share

### Path Documentation

Always document:
1. Exact derivation path used
2. Which wallet created it
3. Any non-standard components

### Backup Includes Path

Your backup should include:
1. Mnemonic phrase
2. Passphrase (if used)
3. Derivation path (if non-standard)

---

## Common Mistakes

### 1. Wrong Path on Restore
**Problem**: Restoring with different path = different addresses
**Solution**: Document and verify paths

### 2. Hardened vs Non-Hardened Confusion
**Problem**: `0` vs `0'` are completely different!
**Solution**: Copy paths exactly, including apostrophes

### 3. Legacy Path Compatibility
**Problem**: Old wallet used non-standard path
**Solution**: Try known legacy paths, check wallet documentation

### 4. Lost Custom Path
**Problem**: Used custom path, didn't document it
**Solution**: Brute-force common variations (tedious but possible)

---

## Quick Reference

### Standard Ethereum Path
```
m/44'/60'/0'/0/0
```

### Derive 5 Addresses
```
m/44'/60'/0'/0/0
m/44'/60'/0'/0/1
m/44'/60'/0'/0/2
m/44'/60'/0'/0/3
m/44'/60'/0'/0/4
```

### Path Template
```
m / 44' / 60' / {account}' / 0 / {index}
```

---

## References

- [BIP32: HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP43: Purpose Field](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki)
- [BIP44: Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP44: Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
"""
