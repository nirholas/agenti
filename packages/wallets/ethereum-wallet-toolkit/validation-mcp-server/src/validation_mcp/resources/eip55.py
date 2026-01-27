"""
EIP-55 Specification Resource

Provides comprehensive EIP-55 checksum specification documentation.
"""

from mcp.server.fastmcp import FastMCP


EIP55_SPECIFICATION = """
# EIP-55: Mixed-case Checksum Address Encoding

## Overview
EIP-55 defines a checksum mechanism for Ethereum addresses using mixed-case hexadecimal encoding.

## Algorithm

1. Convert address to lowercase, removing the 0x prefix
2. Compute the keccak256 hash of the lowercase address (as ASCII)
3. For each character in the address:
   - If the corresponding hex digit in the hash is >= 8, uppercase the character
   - Otherwise, keep it lowercase
4. Prepend 0x

## Pseudocode

```python
def to_checksum_address(address):
    address = address[2:].lower()  # Remove 0x, lowercase
    hash = keccak256(address)
    result = '0x'
    for i, char in enumerate(address):
        if char in '0123456789':
            result += char
        elif int(hash[i], 16) >= 8:
            result += char.upper()
        else:
            result += char.lower()
    return result
```

## Test Vectors

| Input (lowercase) | Checksum Output |
|-------------------|-----------------|
| 0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed | 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed |
| 0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359 | 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359 |
| 0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb | 0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB |
| 0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb | 0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb |

## Validation Rules

1. All-lowercase addresses are valid but not checksummed
2. All-uppercase addresses are valid but not checksummed
3. Mixed-case addresses MUST match the EIP-55 checksum
4. Invalid checksum indicates potential address corruption

## Security Considerations

- Checksum provides ~15 bits of error detection
- Catches most typos and copy-paste errors
- Does NOT validate that an address exists or is controlled
- Always verify checksums when accepting addresses

## Reference
- EIP-55: https://eips.ethereum.org/EIPS/eip-55
"""


def register_eip55_resources(server: FastMCP) -> None:
    """Register EIP-55 specification resources."""
    
    @server.resource("validation://eip55-specification")
    async def get_eip55_specification() -> str:
        """
        Complete EIP-55 checksum specification.
        
        Returns comprehensive documentation including algorithm,
        test vectors, and security considerations.
        """
        return EIP55_SPECIFICATION
