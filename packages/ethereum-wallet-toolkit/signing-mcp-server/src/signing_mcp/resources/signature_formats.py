"""
Signature Formats Resource

Documentation on Ethereum signature formats and conventions.
"""

from mcp.server import Server


SIGNATURE_FORMATS = """
# Ethereum Signature Formats

## Standard 65-byte Signature

### Structure
| Component | Size | Position |
|-----------|------|----------|
| r | 32 bytes | 0-31 |
| s | 32 bytes | 32-63 |
| v | 1 byte | 64 |

### Example
```
0x + r(64 hex) + s(64 hex) + v(2 hex)
```
Total: 130 hex characters (65 bytes)

## V Value Conventions

### Recovery ID (0/1)
- `0` - Even y-coordinate
- `1` - Odd y-coordinate
- Used by some libraries internally

### Standard (27/28)
- `27` - Even y-coordinate (0 + 27)
- `28` - Odd y-coordinate (1 + 27)
- Most common format
- Used by personal_sign, eth_sign

### EIP-155 (Chain-specific)
- `v = chainId * 2 + 35 + recovery_id`
- For transactions with replay protection
- Ethereum Mainnet: v ∈ {37, 38}

### Conversion
```python
# Recovery ID to Standard
v_standard = v_recovery + 27

# Standard to Recovery ID
v_recovery = v_standard - 27

# EIP-155 to Recovery ID
v_recovery = (v_eip155 - 35) % 2
```

## Signature Encoding

### Compact (64 bytes)
Some systems use 64-byte signatures:
- r: 32 bytes
- s: 32 bytes (with v encoded in high bit)

### Concatenated
Standard format: `r || s || v`

### JSON
```json
{
    "v": 28,
    "r": "0x...",
    "s": "0x..."
}
```

## EIP-2: Low S Requirement

### Background
Each signature has two valid forms (s, n-s).
This created malleability issues.

### Requirement
Valid signatures must have: `s <= secp256k1n/2`

Where `secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141`

### Normalization
```python
if s > secp256k1n // 2:
    s = secp256k1n - s
    v = 27 if v == 28 else 28
```

## Signature Recovery

### ECDSA Recovery
Given hash `h` and signature `(r, s, v)`:
1. Calculate point R from r value
2. Use recovery parameter v to select correct R
3. Compute public key: `Q = r^(-1) * (s*R - h*G)`
4. Derive address from public key

### Code Example
```python
from eth_account import Account
from eth_account.messages import encode_defunct

message = encode_defunct(text="Hello")
address = Account.recover_message(message, signature=sig)
```

## Common Issues

### Wrong V Value
- Symptom: Recovered address is wrong
- Fix: Try v ± 27 or toggle between 27/28

### High S Value
- Symptom: Signature rejected by some contracts
- Fix: Normalize to low-s form

### Missing 0x Prefix
- Symptom: Parsing errors
- Fix: Ensure consistent hex formatting

### Length Mismatch
- Symptom: Invalid signature errors
- Fix: Verify 65 bytes / 130 hex chars
"""


def register_signature_format_resources(server: Server) -> None:
    """Register signature format documentation resources."""
    
    @server.resource("signatures://formats")
    async def get_signature_formats() -> str:
        """
        Get comprehensive documentation on Ethereum signature formats.
        """
        return SIGNATURE_FORMATS
    
    @server.resource("signatures://v-values")
    async def get_v_values() -> str:
        """
        Get documentation on signature v value conventions.
        """
        return """
# Signature V Value Reference

## Summary Table

| Format | V Values | Usage |
|--------|----------|-------|
| Recovery ID | 0, 1 | Internal/Libraries |
| Standard | 27, 28 | personal_sign, eth_sign |
| EIP-155 | chainId*2+35+{0,1} | Transaction signatures |

## By Chain ID (EIP-155)

| Chain | V Values |
|-------|----------|
| Mainnet (1) | 37, 38 |
| Goerli (5) | 45, 46 |
| Sepolia (11155111) | 22310257, 22310258 |
| Polygon (137) | 309, 310 |
| Arbitrum (42161) | 84357, 84358 |
| Optimism (10) | 55, 56 |

## Formula
```
v_eip155 = chainId * 2 + 35 + recovery_id
```

## Detection
```python
def detect_v_format(v):
    if v in (0, 1):
        return "recovery_id"
    elif v in (27, 28):
        return "standard"
    elif v >= 35:
        return "eip155"
    else:
        return "unknown"
```
"""
    
    @server.resource("signatures://eip2")
    async def get_eip2_info() -> str:
        """
        Get documentation on EIP-2 signature malleability fix.
        """
        return """
# EIP-2: Homestead Hard-fork Changes

## Signature Malleability Fix

### The Problem
For any valid ECDSA signature (r, s, v), there exists another valid signature:
- `(r, secp256k1n - s, flip(v))`

This allowed transaction malleability attacks.

### The Solution
Only accept signatures where:
```
s <= secp256k1n / 2
```

### Constants
```python
secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
half_n = secp256k1n // 2
# = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
```

### Normalization Code
```python
def normalize_low_s(r, s, v):
    secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    half_n = secp256k1n // 2
    
    if s > half_n:
        s = secp256k1n - s
        # Flip v
        if v == 27:
            v = 28
        elif v == 28:
            v = 27
        else:
            v = v ^ 1  # For recovery_id format
    
    return r, s, v
```

### Verification
```python
def is_low_s(s):
    half_n = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
    return s <= half_n
```
"""
