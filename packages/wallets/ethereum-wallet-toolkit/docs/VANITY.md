# Vanity Address Guide

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses shown are FAKE illustrative patterns - never use them for real funds.

A comprehensive guide to generating Ethereum vanity addresses with the toolkit.

## Table of Contents

- [What is a Vanity Address](#what-is-a-vanity-address)
- [Pattern Types](#pattern-types)
- [Difficulty and Time Estimates](#difficulty-and-time-estimates)
- [Command Reference](#command-reference)
- [Advanced Patterns](#advanced-patterns)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)

---

## What is a Vanity Address

A vanity address is an Ethereum address containing a custom pattern, making it recognizable or memorable. Ethereum addresses are 40 hexadecimal characters (after the `0x` prefix), using only `0-9` and `a-f`.

**Examples:**
```
0xDEAD000000000000000000000000000000000000  (starts with DEAD)
0x000000000000000000000000000000000000BEEF  (ends with BEEF)
0xCAFE00000000000000000000000000000000CAFE  (starts and ends with CAFE)
```

### Why Use Vanity Addresses?

1. **Gas Optimization**: Addresses with leading zeros cost less gas. According to the Ethereum yellowpaper, zero bytes are cheaper in transaction data.

2. **Protocol Branding**: Companies use recognizable addresses for trust. For example, protocols often use addresses starting with `0x1111...` or similar patterns.

3. **Multichain Reproducibility**: Using CREATE2 deployment, protocols can have identical addresses across all EVM chains, simplifying documentation and integrations.

> **Reference**: foobar. "Vanity Addresses." 0xfoobar Substack, January 2023.

---

## Pattern Types

### Prefix Matching

Find addresses that start with a specific pattern.

```bash
python eth_toolkit.py vanity --prefix dead
# Result: 0xdead7f3c8a1b...
```

### Suffix Matching

Find addresses that end with a specific pattern.

```bash
python eth_toolkit.py vanity --suffix beef
# Result: 0x...4a2c3beef
```

### Combined Prefix and Suffix

Find addresses matching both prefix and suffix.

```bash
python eth_toolkit.py vanity --prefix aa --suffix bb
# Result: 0xaa...bb
```

### Contains Pattern

Find addresses containing a pattern anywhere.

```bash
python eth_toolkit.py vanity --contains cafe
# Result: 0x1234cafe5678...
```

### Case-Sensitive (EIP-55 Checksum)

Ethereum addresses use mixed-case for checksum validation (EIP-55). This mode matches exact case.

```bash
python eth_toolkit.py vanity --prefix ABC --case-sensitive
# Result: 0xABC... (exact case match)
```

**Note:** Case-sensitive matching is significantly harder because the checksum case is determined by the address hash.

### Letters Only

Find addresses containing only letters (a-f).

```bash
python eth_toolkit.py vanity --letters
# Result: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```

### Numbers Only

Find addresses containing only numbers (0-9).

```bash
python eth_toolkit.py vanity --numbers
# Result: 0x1234123451234567890d91123456789012345678
```

### Mirror Pattern

Find addresses where the first half mirrors the second half (reversed).

```bash
python eth_toolkit.py vanity --mirror
# Result: 0x1234567890...0987654321
```

### Leading Character Pattern

Find addresses with a specific leading character repeated N times.

```bash
# 6 leading zeros
python eth_toolkit.py vanity --leading 0 --leading-count 6
# Result: 0x000000...

# 5 leading 'f's
python eth_toolkit.py vanity --leading f --leading-count 5
# Result: 0xfffff...
```

### Leading Doubles

Find addresses starting with double pairs (aa, bb, cc, etc.).

```bash
python eth_toolkit.py vanity --doubles
# Result: 0xaabb... or 0x1122... (at least 2 leading pairs)
```

### Zeros Pattern

Find addresses containing many zeros (8 or more).

```bash
python eth_toolkit.py vanity --zeros
# Result: 0x0012003400560078009000ab00cd00ef00gh0000
```

### Regex Pattern Matching

Use regular expressions for complex pattern matching.

```bash
# Start with dead, end with beef
python eth_toolkit.py vanity --regex "^dead.*beef$"

# Any repeating pattern
python eth_toolkit.py vanity --regex "(.)\1{3}"  # 4 same chars in a row
```

### Contract Address Generation

Generate vanity addresses for the first contract that an account would deploy.

```bash
# Find deployer that creates contract starting with "cafe"
python eth_toolkit.py vanity --prefix cafe --contract

# Output shows both deployer and contract addresses
# Contract Address: 0xcafe...
# Deployer Address: 0x1234...
# Private Key: (key for deployer)
```

When you deploy a contract using the generated account with nonce 0, the contract will have the vanity address.

---

## Difficulty and Time Estimates

### Calculation

The difficulty of finding a vanity address grows exponentially with pattern length.

| Characters | Probability | Average Attempts | Est. Time (8 cores) |
|------------|-------------|------------------|---------------------|
| 1 | 1/16 | 16 | Instant |
| 2 | 1/256 | 256 | < 1 second |
| 3 | 1/4,096 | 4,096 | ~1 second |
| 4 | 1/65,536 | 65,536 | ~10 seconds |
| 5 | 1/1,048,576 | 1M | ~2 minutes |
| 6 | 1/16,777,216 | 16M | ~30 minutes |
| 7 | 1/268,435,456 | 268M | ~8 hours |
| 8 | 1/4,294,967,296 | 4B | ~5 days |
| 9 | 1/68,719,476,736 | 68B | ~80 days |
| 10 | 1/1,099,511,627,776 | 1T | ~3 years |

### Formula

```
Difficulty = 16^n  (case-insensitive)
Difficulty ≈ 22^n  (case-sensitive, due to checksum)

where n = total pattern characters (prefix + suffix + contains)
```

### Combined Patterns

When combining prefix and suffix, difficulties multiply:

```
4-char prefix + 2-char suffix = 6 total characters
Difficulty = 16^6 = 16,777,216
```

---

## Command Reference

### Basic Options

```bash
python eth_toolkit.py vanity [OPTIONS]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--prefix` | `-p` | Desired prefix (after 0x) |
| `--suffix` | `-s` | Desired suffix |
| `--contains` | `-c` | Pattern anywhere in address |
| `--case-sensitive` | | Match exact case (EIP-55) |
| `--letters` | | Only letters (a-f) |
| `--numbers` | | Only numbers (0-9) |
| `--mirror` | | Mirror pattern |

### Performance Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--threads` | `-t` | CPU cores | Parallel workers |
| `--count` | `-n` | 1 | Number of addresses to find |
| `--quiet` | `-q` | | Minimal output |

### Output Options

| Option | Short | Description |
|--------|-------|-------------|
| `--output` | `-o` | Save results to JSON file |
| `--verbose` | `-v` | Show additional statistics |

### Examples

```bash
# Simple prefix
python eth_toolkit.py vanity --prefix dead

# Prefix and suffix with 8 threads
python eth_toolkit.py vanity --prefix aa --suffix bb --threads 8

# Generate 5 addresses matching pattern
python eth_toolkit.py vanity --prefix abc --count 5 --output wallets.json

# Case-sensitive with quiet mode
python eth_toolkit.py vanity --prefix DeAd --case-sensitive --quiet
```

---

## Advanced Patterns

### Hex Character Optimization

Some patterns are impossible because Ethereum addresses only use hex characters:

**Valid characters:** `0 1 2 3 4 5 6 7 8 9 a b c d e f`

**Invalid patterns:**
- `hello` (contains 'h', 'l', 'o')
- `world` (contains 'w', 'r', 'l', 'o')

**Popular valid patterns:**
- `dead`, `beef`, `cafe`, `face`, `babe`
- `0000`, `1234`, `abcd`, `ffff`
- `ace`, `bad`, `bed`, `cab`, `dad`, `fad`

### Practical Recommendations

| Use Case | Recommended Pattern | Difficulty |
|----------|---------------------|------------|
| Personal wallet | 3-4 char prefix | Minutes |
| Business address | 4-5 char prefix | Hours |
| Marketing address | 5-6 char prefix | Days |
| Collector address | 6+ chars | Weeks+ |

---

## Performance Optimization

### Multi-threading

Use all available CPU cores for faster generation:

```bash
# Use all cores
python eth_toolkit.py vanity --prefix dead --threads $(nproc)

# Or specify manually
python eth_toolkit.py vanity --prefix dead --threads 16
```

### Hardware Recommendations

| CPU Cores | Est. Speed | 6-char Pattern |
|-----------|------------|----------------|
| 1 | ~15,000/sec | ~18 hours |
| 4 | ~60,000/sec | ~4.5 hours |
| 8 | ~120,000/sec | ~2 hours |
| 16 | ~240,000/sec | ~1 hour |
| 32 | ~480,000/sec | ~30 min |

### Batch Generation

For multiple addresses, use `--count`:

```bash
# Generate 10 addresses with "ab" prefix
python eth_toolkit.py vanity --prefix ab --count 10 --threads 8
```

---

## Security Considerations

### ⚠️ CRITICAL: EOA vs Smart Contract Safety

**This distinction could save you millions of dollars.**

| Address Type | Vanity Generation | Risk Level |
|--------------|-------------------|------------|
| EOA (Externally Owned Account) | DANGEROUS if done incorrectly | Can lose all funds |
| Smart Contract (via CREATE2) | SAFE | Salt is public knowledge |

**Why the difference?**

- **EOAs**: The vanity generation process cycles through private keys. If the randomness is compromised, attackers can recreate your private key and steal everything.
  
- **Smart Contracts**: CREATE2 deployment uses a public salt to find vanity addresses. The salt grants no control over the contract—it's just a search parameter.

As security researcher foobar states: *"EOA vanity is the road to bankruptcy, smart contract vanity is the road to success."*

### The $160 Million Lesson: Profanity Vulnerability

In September 2022, **Wintermute lost $160 million** because they used the Profanity vanity generator for an EOA. The vulnerability:

1. Profanity used `mt19937` PRNG with only a **4-byte seed**
2. This reduced keyspace from 2^256 to 2^32 (easily brutable)
3. Attackers computed all possible starting keys in hours
4. They matched keys to known vanity addresses and drained wallets

**Another victim**: The Indexed Finance exploiter who stole $16M used an address starting with `0xba5ed...` ("based"). In September 2022, their funds were stolen by another attacker exploiting the same Profanity bug.

> **References**: 
> - James. "Fixing Other People's Code." Oregon State University Blogs, February 2023.
> - foobar. "Vanity Addresses." 0xfoobar Substack, January 2023.

### This Toolkit's Approach

⚠️ **FOR EDUCATIONAL PURPOSES ONLY - USE AT YOUR OWN RISK** ⚠️

This toolkit avoids the specific Profanity vulnerability by:

1. **Fresh entropy per generation**: Each `Account.create()` call uses new randomness from the OS CSPRNG
2. **No incremental search**: We don't increment a weak seed—each attempt is independently random
3. **Official libraries**: `eth-account` from Ethereum Foundation handles all cryptography
4. **Auditable code**: ~300 lines you can review yourself

**However, this does NOT guarantee safety.** Vanity address generation for EOAs carries inherent risks that cannot be fully mitigated. Other vulnerabilities may exist. Do not use for high-value wallets. Always audit the code yourself before any use.

### Address Poisoning Warning

Vanity addresses are sometimes used maliciously in **address poisoning attacks**:

1. Attackers create addresses matching the first/last characters of addresses you use
2. They send small transactions to "poison" your transaction history
3. You might accidentally copy the wrong (attacker's) address

**May 2024 Incident**: A victim lost **1,155 WBTC (~$72 million)** this way.

**Protection**:
- Always verify the **complete** address
- Use address books/contacts in your wallet
- Don't trust addresses from transaction history alone

> **Reference**: CertiK. "Vanity Address and Address Poisoning." CertiK Resources, July 2024.

### Vanity Address Risks

**1. Reduced Entropy Perception**

Vanity addresses are generated from the same 256-bit key space as regular addresses. The pattern is found by brute force, not by weakening the key.

**2. Address Confusion Attacks**

Attackers may create similar-looking addresses. Always verify the complete address, not just the vanity portion.

```
Your address:    0xdead1234567890abcdef1234567890abcdef1234
Attacker address: 0xdead9876543210fedcba9876543210fedcba5678
                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                       Different middle section!
```

**3. Pattern Collision**

Multiple valid addresses exist for any pattern. Save your private key securely; you cannot regenerate the same address.

### Best Practices

1. **Verify the complete address** before use, not just the vanity portion
2. **Generate offline** for high-value addresses
3. **Test with small amounts** before depositing significant funds
4. **Backup the private key** immediately after generation
5. **Use hardware wallets** for long-term storage

### Comparison with GPU Tools

This toolkit uses CPU-based generation with official Ethereum libraries. For faster generation, GPU-based tools exist but have trade-offs:

| Tool | Speed | Security | Ease of Use |
|------|-------|----------|-------------|
| This toolkit | Moderate | Highest (official libs) | Easy |
| Profanity2 | Very fast (GPU) | Vulnerable* | Complex |
| Vanity-ETH | Moderate (browser) | Good | Easy |

*Note: The original Profanity tool was found to have a critical vulnerability in its key generation. Always verify the security of any tool before use.

---

## Legacy Vanity Generator

A simpler standalone vanity generator is available:

```bash
python vanity.py --prefix abc --suffix 123 --threads 4
```

This provides basic functionality without the full toolkit features.
