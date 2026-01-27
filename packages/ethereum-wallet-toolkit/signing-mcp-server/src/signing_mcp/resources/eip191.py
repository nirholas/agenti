"""
EIP-191 Specification Resource

Provides documentation on EIP-191 signed data standard.
"""

from mcp.server import Server


EIP191_SPECIFICATION = """
# EIP-191: Signed Data Standard

## Overview
EIP-191 defines a standard for signing arbitrary data in Ethereum to prevent
signed messages from being valid Ethereum transactions.

## Format

### Prefix
All signed data is prefixed with:
```
0x19 <version byte> <version specific data> <data to sign>
```

### Version Bytes
- `0x00` - Data with "intended validator" (validator address, data)
- `0x01` - Structured data (EIP-712)
- `0x45` (E) - personal_sign format

## personal_sign (Version 0x45)

The most common format, used by wallets for message signing.

### Format
```
0x19 Ethereum Signed Message:\n<length><message>
```

### Example
For message "Hello":
```
0x19Ethereum Signed Message:\n5Hello
```

### Process
1. Prefix message with "\\x19Ethereum Signed Message:\\n<length>"
2. Keccak-256 hash the prefixed message
3. Sign the hash with ECDSA

## Security Properties

### Transaction Replay Prevention
The `0x19` prefix ensures signed messages cannot be valid RLP-encoded transactions:
- RLP encoding of a transaction list starts with bytes in range [0xc0, 0xff]
- `0x19` is outside this range

### Deterministic
Same message + same key = same signature (for the same nonce)

## Code Example (Python)
```python
from eth_account import Account
from eth_account.messages import encode_defunct

# Encode message with EIP-191 prefix
message = encode_defunct(text="Hello, Ethereum!")

# Sign
account = Account.from_key(private_key)
signed = account.sign_message(message)

# Verify
recovered = Account.recover_message(message, signature=signed.signature)
```

## Code Example (JavaScript)
```javascript
const { ethers } = require("ethers");

// Sign
const signer = new ethers.Wallet(privateKey);
const signature = await signer.signMessage("Hello, Ethereum!");

// Verify
const recoveredAddress = ethers.verifyMessage("Hello, Ethereum!", signature);
```

## Related EIPs
- EIP-712: Typed structured data
- EIP-1271: Contract signature validation

## Reference
https://eips.ethereum.org/EIPS/eip-191
"""


def register_eip191_resources(server: Server) -> None:
    """Register EIP-191 specification resources."""
    
    @server.resource("eip191://specification")
    async def get_eip191_specification() -> str:
        """
        Get the EIP-191 signed data standard specification.
        
        Covers personal_sign format, prefix structure, and security properties.
        """
        return EIP191_SPECIFICATION
    
    @server.resource("eip191://personal-sign")
    async def get_personal_sign_format() -> str:
        """
        Get documentation on personal_sign format specifically.
        """
        return """
# personal_sign Format (EIP-191 Version 0x45)

## Format
```
\\x19Ethereum Signed Message:\\n<message length><message>
```

## Components
- `\\x19` - Single byte prefix (0x19)
- `Ethereum Signed Message:\\n` - Standard string
- `<message length>` - Decimal string of message byte length
- `<message>` - The actual message

## Examples

### Short message
Message: "Hello"
Prefixed: `\\x19Ethereum Signed Message:\\n5Hello`
Length: 5 (decimal string)

### Longer message
Message: "Hello, Ethereum!"
Prefixed: `\\x19Ethereum Signed Message:\\n16Hello, Ethereum!`
Length: 16 (decimal string)

### With special characters
Message: "💎 Diamond hands"
Length: Calculated as UTF-8 byte length, not character count

## Signing Process
1. Construct prefixed message
2. Calculate keccak256(prefixed_message)
3. Sign hash with ECDSA (produces v, r, s)
4. Concatenate as signature: r (32 bytes) + s (32 bytes) + v (1 byte)

## Common Errors
- Using character count instead of byte length
- Forgetting the newline character
- Not handling UTF-8 properly
"""
