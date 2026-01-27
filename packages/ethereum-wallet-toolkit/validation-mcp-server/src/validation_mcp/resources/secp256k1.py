"""
secp256k1 Constants Resource

Provides secp256k1 elliptic curve parameters and constants.
"""

from mcp.server.fastmcp import FastMCP


SECP256K1_CONSTANTS = """
# secp256k1 Elliptic Curve Parameters

## Overview
secp256k1 is the elliptic curve used by Ethereum (and Bitcoin) for public key cryptography.
The curve is defined over a prime finite field.

## Curve Equation
y² = x³ + 7 (mod p)

## Parameters

### Prime Field (p)
```
p = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
p = 2²⁵⁶ - 2³² - 977
p = 115792089237316195423570985008687907853269984665640564039457584007908834671663
```

### Curve Order (n)
The number of points on the curve (order of the generator point).
Private keys must be in range [1, n-1].
```
n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
n = 115792089237316195423570985008687907852837564279074904382605163141518161494337
```

### Generator Point (G)
The base point for key generation.
```
Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
```

### Cofactor (h)
```
h = 1
```

### Curve Coefficients
```
a = 0
b = 7
```

## Key Derivation

### Private Key
- Random 256-bit integer in range [1, n-1]
- Must be cryptographically secure random

### Public Key
- Point multiplication: P = k × G
- Uncompressed: 0x04 || x || y (65 bytes)
- Compressed: 0x02/0x03 || x (33 bytes)
  - 0x02 if y is even
  - 0x03 if y is odd

### Address Derivation
1. Take uncompressed public key (without 0x04 prefix): 64 bytes
2. Compute keccak256 hash: 32 bytes
3. Take last 20 bytes: address
4. Apply EIP-55 checksum

## Half Order (for EIP-2 low-s)
```
n/2 = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
```
Signatures must have s ≤ n/2 (low-s requirement).

## Security Notes
- secp256k1 provides ~128 bits of security
- Private keys must remain secret
- Use only cryptographically secure random number generators
- Verify signature components are in valid ranges
"""


def register_secp256k1_resources(server: FastMCP) -> None:
    """Register secp256k1 constants resources."""
    
    @server.resource("validation://secp256k1-constants")
    async def get_secp256k1_constants() -> str:
        """
        secp256k1 elliptic curve parameters and constants.
        
        Includes curve equation, field prime, order, generator point,
        and key derivation formulas.
        """
        return SECP256K1_CONSTANTS
