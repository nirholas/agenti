"""
Keystore Specification Resource

Provides Web3 Secret Storage V3 specification documentation.
"""

from mcp.server import Server


def register_specification_resources(server: Server) -> None:
    """Register specification resources with the MCP server."""
    
    @server.resource("keystore://specification")
    async def get_keystore_specification() -> str:
        """
        Complete Web3 Secret Storage Definition V3 specification.
        """
        return KEYSTORE_SPECIFICATION
    
    @server.resource("keystore://kdf-comparison")
    async def get_kdf_comparison() -> str:
        """
        Detailed comparison of scrypt vs pbkdf2.
        """
        return KDF_COMPARISON


KEYSTORE_SPECIFICATION = """# Web3 Secret Storage Definition V3

## Overview

The Web3 Secret Storage Definition specifies a format for encrypted storage
of Ethereum private keys. Version 3 is the current standard, widely supported
by all major Ethereum wallets and tools.

## JSON Schema

```json
{
  "version": 3,
  "id": "uuid-v4",
  "address": "hex-address-no-0x-lowercase",
  "crypto": {
    "ciphertext": "hex-encrypted-private-key",
    "cipherparams": {
      "iv": "hex-initialization-vector"
    },
    "cipher": "aes-128-ctr",
    "kdf": "scrypt|pbkdf2",
    "kdfparams": {
      // For scrypt:
      "n": 262144,
      "r": 8,
      "p": 1,
      "dklen": 32,
      "salt": "hex-random-salt"
      // For pbkdf2:
      "c": 262144,
      "prf": "hmac-sha256",
      "dklen": 32,
      "salt": "hex-random-salt"
    },
    "mac": "hex-keccak256-mac"
  }
}
```

## Field Descriptions

### Top Level

| Field | Type | Description |
|-------|------|-------------|
| version | integer | Must be 3 for V3 keystores |
| id | string | UUID v4 for keystore identification |
| address | string | Ethereum address (lowercase, no 0x prefix) |
| crypto | object | Encryption parameters and data |

### Crypto Section

| Field | Type | Description |
|-------|------|-------------|
| ciphertext | string | Hex-encoded encrypted private key |
| cipherparams | object | Cipher parameters |
| cipher | string | Cipher algorithm (always "aes-128-ctr") |
| kdf | string | Key derivation function ("scrypt" or "pbkdf2") |
| kdfparams | object | KDF-specific parameters |
| mac | string | Hex-encoded Keccak-256 MAC |

## Encryption Process

1. **Password Encoding**: Convert password to UTF-8 bytes
2. **Salt Generation**: Generate 32 random bytes
3. **Key Derivation**: Use scrypt or PBKDF2 to derive 32-byte key
4. **IV Generation**: Generate 16 random bytes for AES-CTR IV
5. **Encryption**: Encrypt private key with AES-128-CTR
   - Key: First 16 bytes of derived key
   - IV: Generated IV
6. **MAC Calculation**: 
   - MAC = Keccak256(derivedKey[16:32] + ciphertext)
7. **Assemble Keystore**: Combine all components into JSON

## Decryption Process

1. **Extract Parameters**: Parse KDF params, ciphertext, IV, MAC
2. **Derive Key**: Use same KDF with stored salt
3. **Verify MAC**: Compute and compare MAC
4. **Decrypt**: Use AES-128-CTR with derived key and IV

## Cipher Specification

### AES-128-CTR

- **Algorithm**: Advanced Encryption Standard
- **Key Size**: 128 bits (16 bytes)
- **Mode**: Counter (CTR)
- **IV Size**: 128 bits (16 bytes)

CTR mode converts AES into a stream cipher, allowing byte-level encryption
without padding requirements.

## MAC Specification

### Keccak-256

The MAC is calculated as:
```
MAC = Keccak256(derivedKey[16:32] || ciphertext)
```

- Uses the **last** 16 bytes of the derived key
- Concatenated with the ciphertext
- Ensures both password correctness and data integrity

## Security Considerations

### Recommended Parameters

| KDF | Parameter | Recommended Value |
|-----|-----------|-------------------|
| scrypt | N | 262144 (2^18) |
| scrypt | r | 8 |
| scrypt | p | 1 |
| pbkdf2 | c | 262144 |
| both | dklen | 32 |
| both | salt | 32 random bytes |

### Password Requirements

- Minimum 12 characters recommended
- Mix of character types
- Avoid dictionary words
- Use unique passwords per keystore

## File Naming Convention

Standard format:
```
UTC--YYYY-MM-DDTHH-MM-SS.sssZ--<address>
```

Example:
```
UTC--2024-01-15T10-30-00.000Z--1234567890abcdef1234567890abcdef12345678
```

## Compatibility Notes

- All major Ethereum wallets support V3 format
- geth, Parity, MetaMask, hardware wallets
- Cross-platform compatible
- Both scrypt and pbkdf2 widely supported

## References

- [Web3 Secret Storage Definition](https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition)
- [EIP-2335: BLS12-381 Keystore](https://eips.ethereum.org/EIPS/eip-2335)
"""


KDF_COMPARISON = """# KDF Comparison: Scrypt vs PBKDF2

## Overview

Both scrypt and PBKDF2 are key derivation functions (KDFs) used to derive
encryption keys from passwords. They serve the same purpose but have
different security characteristics.

## Quick Comparison

| Feature | Scrypt | PBKDF2 |
|---------|--------|--------|
| Memory Hardness | Yes (high) | No |
| CPU Hardness | Yes | Yes |
| GPU Resistance | Strong | Weak |
| ASIC Resistance | Strong | Weak |
| Speed | Slower | Faster |
| Memory Usage | High | Low |
| Standard | RFC 7914 | RFC 2898 |

## Scrypt

### How It Works

Scrypt uses a memory-hard function that requires large amounts of memory
to compute. This makes it resistant to parallel attacks using GPUs or ASICs.

### Parameters

| Parameter | Name | Description | Default |
|-----------|------|-------------|---------|
| N | CPU/Memory Cost | Must be power of 2 | 262144 (2^18) |
| r | Block Size | Memory factor | 8 |
| p | Parallelization | CPU factor | 1 |
| dklen | Key Length | Output bytes | 32 |

### Memory Requirement

```
Memory = 128 * N * r bytes
```

With defaults: 128 * 262144 * 8 = 256 MB

### Security Analysis

**Strengths:**
- Memory-hard: Requires substantial RAM
- GPU-resistant: High memory makes GPU attacks inefficient
- ASIC-resistant: Custom hardware provides limited advantage
- Well-analyzed: Used in Litecoin, proven over years

**Weaknesses:**
- Slower than PBKDF2
- Higher resource requirements
- May be too slow for mobile/embedded devices

### Recommended For

- Desktop applications
- High-security requirements
- Protection against hardware attacks
- Long-term storage

## PBKDF2

### How It Works

PBKDF2 (Password-Based Key Derivation Function 2) applies a pseudorandom
function (HMAC-SHA256) repeatedly to the password and salt.

### Parameters

| Parameter | Name | Description | Default |
|-----------|------|-------------|---------|
| c | Iterations | Number of rounds | 262144 |
| prf | PRF | Hash function | HMAC-SHA256 |
| dklen | Key Length | Output bytes | 32 |

### Memory Requirement

Minimal - only needs hash state (< 1 KB)

### Security Analysis

**Strengths:**
- Fast and efficient
- Low memory requirements
- Widely implemented
- Hardware acceleration available (SHA-256)
- NIST recommended

**Weaknesses:**
- Not memory-hard
- Vulnerable to GPU attacks
- ASIC attacks possible
- Requires more iterations for equivalent security

### Recommended For

- Mobile applications
- Resource-constrained devices
- Quick operations needed
- When hardware attacks are unlikely

## Performance Benchmarks

Typical times on modern hardware (standard parameters):

| Operation | Scrypt | PBKDF2 |
|-----------|--------|--------|
| Key Derivation | 1-3 seconds | 0.1-0.5 seconds |
| Memory Peak | 256 MB | < 1 MB |
| CPU Usage | High | Moderate |

## Attack Resistance

### Brute Force Attack Costs

Assuming $0.01 per hash on cloud GPU:

| KDF | Cost per Billion | Time Estimate |
|-----|------------------|---------------|
| Scrypt (N=262144) | $100,000+ | Years |
| PBKDF2 (c=262144) | $1,000 | Days |

### Hardware Attack Comparison

| Attacker | Scrypt Advantage | PBKDF2 Advantage |
|----------|------------------|------------------|
| CPU | 1x | 1x |
| GPU | 1x-10x | 100x-1000x |
| ASIC | 10x | 10000x |

## Recommendations

### Use Scrypt When:

1. Security is paramount
2. Protecting high-value keys
3. Desktop/server environment
4. Long-term storage
5. Protection against state-level attackers

### Use PBKDF2 When:

1. Mobile or embedded device
2. Quick unlock needed
3. Memory is limited
4. Hardware attacks unlikely
5. Compliance requires NIST standard

## Migration Path

If upgrading from PBKDF2 to scrypt:

1. Decrypt with old password/PBKDF2
2. Re-encrypt with scrypt
3. Use `change_keystore_password` with `new_kdf="scrypt"`

## Parameter Tuning

### Scrypt N Value

| N Value | Memory | Security | Use Case |
|---------|--------|----------|----------|
| 2^14 | 16 MB | Light | Development |
| 2^16 | 64 MB | Moderate | Mobile |
| 2^18 | 256 MB | Standard | Desktop |
| 2^20 | 1 GB | Maximum | Server |

### PBKDF2 Iterations

| Iterations | Time | Security | Use Case |
|------------|------|----------|----------|
| 10,000 | <0.1s | Light | Testing |
| 100,000 | ~0.2s | Moderate | Mobile |
| 262,144 | ~0.5s | Standard | Desktop |
| 1,000,000 | ~2s | Maximum | High-value |
"""
