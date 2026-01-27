"""
EIP-712 Specification Resource

Provides documentation on EIP-712 typed structured data standard.
"""

from mcp.server import Server


EIP712_SPECIFICATION = """
# EIP-712: Typed Structured Data Signing

## Overview
EIP-712 is a standard for hashing and signing typed structured data, providing:
- Human-readable data in wallet signing prompts
- Structured type system
- Domain separation to prevent cross-protocol replay attacks

## Structure

### Required Components
```json
{
    "types": {
        "EIP712Domain": [...],
        "PrimaryType": [...]
    },
    "primaryType": "PrimaryType",
    "domain": {...},
    "message": {...}
}
```

### EIP712Domain
Provides context about the signing domain:
```json
"EIP712Domain": [
    {"name": "name", "type": "string"},
    {"name": "version", "type": "string"},
    {"name": "chainId", "type": "uint256"},
    {"name": "verifyingContract", "type": "address"}
]
```

Optional fields: `salt` (bytes32)

### Type Definitions
Custom types are defined as arrays of {name, type} pairs:
```json
"Permit": [
    {"name": "owner", "type": "address"},
    {"name": "spender", "type": "address"},
    {"name": "value", "type": "uint256"},
    {"name": "nonce", "type": "uint256"},
    {"name": "deadline", "type": "uint256"}
]
```

## Supported Types

### Atomic Types
- `address` - Ethereum address
- `bool` - Boolean
- `bytes` - Dynamic byte array
- `bytes<N>` - Fixed byte array (N = 1-32)
- `int<N>` - Signed integer (N = 8, 16, ..., 256)
- `uint<N>` - Unsigned integer
- `string` - UTF-8 string

### Reference Types
- Custom struct types
- Arrays: `type[]` or `type[N]`

## Hash Computation

### Domain Separator
```
domainSeparator = keccak256(
    encodeType("EIP712Domain") || encodeData(domain)
)
```

### Struct Hash
```
structHash = keccak256(
    encodeType(primaryType) || encodeData(message)
)
```

### Final Hash (to be signed)
```
keccak256("\\x19\\x01" || domainSeparator || structHash)
```

## Common Use Cases

### ERC-20 Permit (EIP-2612)
Gasless token approvals:
```json
{
    "primaryType": "Permit",
    "message": {
        "owner": "0x...",
        "spender": "0x...",
        "value": "1000000000000000000",
        "nonce": 0,
        "deadline": 1893456000
    }
}
```

### DEX Orders
Off-chain limit orders:
```json
{
    "primaryType": "Order",
    "message": {
        "maker": "0x...",
        "makerToken": "0x...",
        "takerToken": "0x...",
        "makerAmount": "1000000000000000000",
        "takerAmount": "3000000000"
    }
}
```

### Delegation
Governance vote delegation:
```json
{
    "primaryType": "Delegation",
    "message": {
        "delegatee": "0x...",
        "nonce": 0,
        "expiry": 1893456000
    }
}
```

## Code Example (Python)
```python
from eth_account import Account
from eth_account.messages import encode_typed_data

typed_data = {
    "types": {...},
    "primaryType": "Permit",
    "domain": {...},
    "message": {...}
}

account = Account.from_key(private_key)
signed = account.sign_message(encode_typed_data(full_message=typed_data))
```

## Security Considerations

### Domain Separation
Always include `verifyingContract` and `chainId` to prevent:
- Cross-contract replay
- Cross-chain replay

### Deadlines
Include expiry timestamps for time-sensitive operations.

### Nonces
Use incrementing nonces to prevent signature replay.

## Reference
https://eips.ethereum.org/EIPS/eip-712
"""


def register_eip712_resources(server: Server) -> None:
    """Register EIP-712 specification resources."""
    
    @server.resource("eip712://specification")
    async def get_eip712_specification() -> str:
        """
        Get the full EIP-712 typed structured data specification.
        """
        return EIP712_SPECIFICATION
    
    @server.resource("eip712://type-system")
    async def get_type_system() -> str:
        """
        Get documentation on EIP-712 type system.
        """
        return """
# EIP-712 Type System

## Atomic Types

### Address
- Solidity: `address`
- Encoding: 32 bytes, left-padded with zeros
- Example: `0x1234...` → `0x000...1234`

### Boolean
- Solidity: `bool`
- Encoding: 32 bytes, 0 or 1

### Integer Types
- `int8` to `int256` (multiples of 8)
- `uint8` to `uint256` (multiples of 8)
- Encoding: 32 bytes, sign-extended or zero-padded

### Bytes Types
- `bytes1` to `bytes32` - Fixed size
- `bytes` - Dynamic size
- Encoding: Fixed are right-padded, dynamic are keccak256 hashed

### String
- Solidity: `string`
- Encoding: keccak256(UTF-8 bytes)

## Struct Types

### Definition
```json
"Person": [
    {"name": "name", "type": "string"},
    {"name": "wallet", "type": "address"}
]
```

### Nested Structs
```json
"Mail": [
    {"name": "from", "type": "Person"},
    {"name": "to", "type": "Person"},
    {"name": "contents", "type": "string"}
]
```

### Encoding
`typeHash || encodeData(field1) || encodeData(field2) || ...`

## Array Types

### Dynamic Arrays
- Type: `Person[]`
- Encoding: keccak256(concat(encodeData(item1), encodeData(item2), ...))

### Fixed Arrays
- Type: `uint256[3]`
- Encoding: Same as dynamic

## Type Hash

### Formula
```
typeHash = keccak256(encodeType(structName))
```

### encodeType
Alphabetically sorted dependencies:
```
"Mail(Person from,Person to,string contents)Person(string name,address wallet)"
```
"""
    
    @server.resource("eip712://hash-computation")
    async def get_hash_computation() -> str:
        """
        Get documentation on EIP-712 hash computation.
        """
        return """
# EIP-712 Hash Computation

## Overview
The final hash to sign is computed from domain separator and struct hash.

## Step 1: Domain Separator

### Compute Domain Type Hash
```
domainTypeHash = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
)
```

### Encode Domain Data
```
domainData = domainTypeHash ||
    keccak256(bytes(name)) ||
    keccak256(bytes(version)) ||
    uint256(chainId) ||
    uint256(verifyingContract)
```

### Domain Separator
```
domainSeparator = keccak256(domainData)
```

## Step 2: Struct Hash

### Compute Type Hash
```
typeHash = keccak256(encodeType(primaryType))
```

### Encode Message
```
messageData = typeHash ||
    encodeData(field1) ||
    encodeData(field2) ||
    ...
```

### Struct Hash
```
structHash = keccak256(messageData)
```

## Step 3: Final Hash

```
hashToSign = keccak256(
    "\\x19\\x01" ||
    domainSeparator ||
    structHash
)
```

The `\\x19\\x01` prefix indicates EIP-712 structured data (per EIP-191).

## Verification On-Chain

```solidity
function verify(
    address signer,
    bytes32 structHash,
    uint8 v,
    bytes32 r,
    bytes32 s
) public view returns (bool) {
    bytes32 digest = keccak256(
        abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR, structHash)
    );
    return ecrecover(digest, v, r, s) == signer;
}
```
"""
