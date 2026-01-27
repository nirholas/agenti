# Security Guidelines

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses shown are FAKE illustrative examples.

This document outlines security best practices for using the Ethereum Wallet Toolkit.

## Table of Contents

- [Cryptographic Security](#cryptographic-security)
- [Operational Security](#operational-security)
- [Key Management](#key-management)
- [Threat Model](#threat-model)
- [Auditing the Code](#auditing-the-code)

---

## Cryptographic Security

### Random Number Generation

The toolkit uses Python's `secrets` module and the operating system's cryptographically secure pseudorandom number generator (CSPRNG) for all key generation:

- **Linux/macOS:** `/dev/urandom`
- **Windows:** `CryptGenRandom`

The eth-account library handles entropy generation internally using these secure sources.

### Key Derivation

**BIP39 Mnemonic:**
- Entropy: 128-256 bits (12-24 words)
- Checksum: SHA-256 hash of entropy
- Seed derivation: PBKDF2-HMAC-SHA512 with 2048 iterations

**BIP32 HD Wallet:**
- Master key: HMAC-SHA512 of seed
- Child keys: HMAC-SHA512 chain derivation
- Hardened derivation for account-level keys

### Elliptic Curve Operations

- Curve: secp256k1 (same as Bitcoin)
- Private key: 256-bit integer
- Public key: Compressed or uncompressed point
- Address: Last 20 bytes of Keccak-256(public key)

---

## Operational Security

### Running Offline

For maximum security when generating wallets:

1. **Disconnect from the internet** before running the toolkit
2. **Boot from a live USB** (e.g., Tails OS) for sensitive operations
3. **Use an air-gapped computer** for high-value wallets
4. **Verify checksums** of the toolkit before use

### Environment Isolation

```bash
# Create isolated virtual environment
python -m venv --copies venv
source venv/bin/activate

# Verify no network-capable packages are installed
pip list

# Run the toolkit
python eth_toolkit.py generate --mnemonic
```

### Memory Security

- Private keys exist in memory during operation
- Close the terminal immediately after use
- Consider using memory-wiping tools on sensitive systems
- Avoid running other applications during key generation

---

## Key Management

### Storage Best Practices

| Storage Method | Security Level | Use Case |
|----------------|----------------|----------|
| Hardware wallet | Highest | Large holdings |
| Encrypted USB | High | Cold storage |
| Paper wallet | High | Long-term backup |
| Password manager | Medium | Day-to-day access |
| Plain text file | Dangerous | Never recommended |

### Mnemonic Backup

1. Write the mnemonic on paper (not digitally)
2. Use metal backup plates for fire/water resistance
3. Split using Shamir's Secret Sharing for high-value wallets
4. Store copies in multiple secure locations
5. Never photograph or digitize the mnemonic

### Private Key Handling

```bash
# Generate wallet and save to encrypted file
python eth_toolkit.py generate --mnemonic --output wallet.json

# The output file should be:
# 1. Encrypted with a strong password
# 2. Stored on encrypted storage
# 3. Backed up securely
# 4. Deleted from unencrypted storage
```

---

## Known Vulnerabilities in Other Tools

### The Profanity Vulnerability (September 2022)

The open-source vanity address generator "Profanity" contained a critical flaw that led to **$160 million in losses** for Wintermute and other victims.

**Root Cause**: Profanity used `mt19937` pseudo-random number generator with only a 4-byte seed. Since Ethereum private keys are 32 bytes, this reduced the keyspace from 2^256 to 2^32 possible keys—easily brute-forceable.

**How Attackers Exploited It**:
1. Generated all possible starting private keys (fits in <2TB storage)
2. Replayed the search iteration to recreate (private key, address) pairs
3. Drained wallets matching known vanity addresses

**This toolkit avoids the specific Profanity vulnerability** by:
- Using `eth-account` which relies on OS CSPRNG (`/dev/urandom` on Linux, `CryptGenRandom` on Windows)
- Each wallet generation uses fresh, cryptographically secure randomness
- No incremental key derivation from a weak seed

**However, this does NOT guarantee safety.** Other vulnerabilities may exist. This toolkit is for EDUCATIONAL PURPOSES ONLY. Always audit the code yourself and use at your own risk.

> **Reference**: James. "Fixing Other People's Code." Oregon State University Blogs, February 2023.

### Address Poisoning Attacks

Address poisoning is a social engineering attack where attackers:

1. Create vanity addresses resembling your frequently-used addresses
2. Send you small transactions (or fake tokens) from these lookalike addresses
3. Hope you copy the wrong address from your transaction history

**Example** (FAKE illustrative addresses):
- Legitimate: `0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234`
- Attacker:   `0xABCD5678000056780000567800005678ABCD5678`

(Notice the first 4 and last 4 characters match, middle is different)

**Notable Incident**: Address poisoning attacks have resulted in millions of dollars in losses.

**Protection**:
- Always verify the FULL address, not just first/last characters
- Use address books and whitelists
- Be suspicious of unexpected token transfers in your history

> **Reference**: CertiK. "Vanity Address and Address Poisoning." CertiK Resources, July 2024.

---

## Threat Model

### Threats Addressed

| Threat | Mitigation |
|--------|------------|
| Weak RNG | Uses OS CSPRNG via eth-account |
| Network interception | Run offline |
| Malicious dependencies | Uses only official Ethereum Foundation libs |
| Memory inspection | User responsibility (air-gapped system) |
| Supply chain attack | Verify source code before use |
| Profanity-style vulnerability | Fresh CSPRNG entropy per generation |

### Threats NOT Addressed

| Threat | User Responsibility |
|--------|---------------------|
| Compromised OS | Use trusted operating system |
| Hardware keyloggers | Verify physical security |
| Shoulder surfing | Ensure private environment |
| Social engineering | Verify all instructions |
| Malware on system | Run on clean system |

### Attack Vectors

**1. Compromised Random Number Generator**
- Risk: Predictable private keys
- Mitigation: eth-account uses OS CSPRNG
- Verification: Audit eth-account source code

**2. Modified Source Code**
- Risk: Backdoored key generation
- Mitigation: Verify git commits and signatures
- Verification: Compare with official repository

**3. Dependency Confusion**
- Risk: Malicious package substitution
- Mitigation: Use official PyPI packages only
- Verification: Check package hashes

---

## Auditing the Code

### Code Review Checklist

Before using this toolkit for valuable assets, review:

1. **Key Generation (`eth_toolkit.py`)**
   - Verify `Account.create()` is used for random generation
   - Verify `Account.create_with_mnemonic()` for mnemonic generation
   - Check no hardcoded values in key generation

2. **Dependencies (`requirements.txt`)**
   - Verify all packages are from Ethereum Foundation
   - Check package versions for known vulnerabilities
   - Review package source code if needed

3. **Output Handling**
   - Verify keys are not logged or transmitted
   - Check file output is not cached
   - Ensure no telemetry or analytics

### Verification Commands

```bash
# Verify eth-account is official
pip show eth-account
# Check homepage: https://github.com/ethereum/eth-account

# Verify package integrity
pip hash eth-account

# Count lines of code (should be ~600-800)
wc -l eth_toolkit.py vanity.py

# Search for suspicious patterns
grep -r "http\|https\|request\|socket\|urllib" *.py
```

### Recommended Audit Process

1. Clone the repository locally
2. Disconnect from the internet
3. Review all Python files manually
4. Verify dependencies against official sources
5. Test with non-valuable addresses first
6. Use for production only after full review

---

## Security Contacts

If you discover a security vulnerability:

1. Do NOT create a public issue
2. Contact the maintainers privately
3. Allow reasonable time for a fix before disclosure

---

## Disclaimer

This toolkit is provided as-is for educational and personal use. The authors are not responsible for:

- Loss of funds due to improper use
- Security breaches on compromised systems
- Errors in generated addresses or keys

Always verify generated addresses before depositing significant funds.
