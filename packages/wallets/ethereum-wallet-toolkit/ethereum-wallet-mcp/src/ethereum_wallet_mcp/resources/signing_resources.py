"""
Signing Resources for Ethereum Wallet MCP Server

This module implements MCP resources providing documentation and examples for:
- EIP-191 Signed Data Standard
- EIP-712 Typed Structured Data Standard
- Signing templates for common use cases
- Test vectors for signature verification

Resources provide static content that can be read by MCP clients for
reference and learning purposes.
"""

from mcp.server import Server
from mcp.types import Resource


# ============================================================================
# Documentation Content
# ============================================================================

EIP191_DOCUMENTATION = """# EIP-191: Signed Data Standard

## Overview

EIP-191 is a standard for encoding signed data in Ethereum. It defines how to prefix
data before signing to make the intent of the signature clear and prevent certain
attack vectors.

---

## What is EIP-191?

EIP-191 standardizes the format for signed data by prepending a version byte and
additional context. The most commonly used version is the "personal_sign" format.

### The Problem It Solves

Without a standard prefix, a signature on one type of data could potentially be
replayed as a signature on another type. For example, a signed message could be
confused with a signed transaction.

EIP-191 solves this by:
1. Adding a prefix that clearly identifies the data type
2. Including length information to prevent concatenation attacks
3. Ensuring signed messages can't be used as valid transactions

---

## Version Bytes

EIP-191 defines three version bytes:

| Version | Description | Format |
|---------|-------------|--------|
| 0x00 | Data with intended validator | `0x19 0x00 <validator> <data>` |
| 0x01 | Structured data (EIP-712) | `0x19 0x01 <domainSeparator> <hashStruct>` |
| 0x45 | Personal message ("E" = 0x45) | `0x19 Ethereum Signed Message:\\n<length><message>` |

---

## personal_sign (0x45)

The most common use of EIP-191 is the "personal_sign" format, which is used
by wallets when you sign a message.

### Format

```
"\\x19Ethereum Signed Message:\\n" + len(message) + message
```

### Example

For the message "Hello, Ethereum!" (16 characters):
```
\\x19Ethereum Signed Message:\\n16Hello, Ethereum!
```

This prefixed message is then hashed with Keccak-256 and signed.

### Code Example (Python)

```python
from eth_account import Account
from eth_account.messages import encode_defunct

message = "Hello, Ethereum!"
signable = encode_defunct(text=message)
signed = account.sign_message(signable)
```

---

## Security Properties

### Replay Protection
- The prefix ensures messages can't be replayed as transactions
- The length field prevents concatenation attacks

### Domain Separation
- Different applications can use different prefixes
- Signatures are scoped to their intended context

### Human Readable
- Users can see what they're signing in their wallet
- The "Ethereum Signed Message" text is recognizable

---

## Common Pitfalls

### 1. Signing Without Prefix
Never sign raw hashes without understanding what they represent. A raw hash
could be a transaction hash, allowing attackers to trick users into signing
transactions.

### 2. Length Manipulation
Always use the correct length in the prefix. Some implementations have had
bugs where length was computed incorrectly for multi-byte UTF-8 characters.

### 3. Encoding Issues
Ensure consistent encoding between signing and verification. The message
should be UTF-8 encoded before computing its length.

---

## Verification

To verify an EIP-191 signature:

1. Reconstruct the prefixed message
2. Hash it with Keccak-256
3. Recover the signer's address using ecrecover
4. Compare with the expected signer

```python
from eth_account.messages import encode_defunct

signable = encode_defunct(text=message)
recovered_address = Account.recover_message(signable, signature=sig)
```

---

## Use Cases

1. **Login/Authentication**: Sign-in with Ethereum (SIWE)
2. **Attestations**: Proving you control an address
3. **Off-chain voting**: Snapshot voting systems
4. **Message verification**: Proving message authenticity
5. **Terms acceptance**: Signing agreement to terms

---

## Related Standards

- **EIP-712**: Structured typed data signing (version byte 0x01)
- **EIP-4361**: Sign-In with Ethereum (SIWE)
- **EIP-1271**: Standard Signature Validation for Contracts

---

## References

- [EIP-191 Specification](https://eips.ethereum.org/EIPS/eip-191)
- [eth-account Documentation](https://eth-account.readthedocs.io/)
"""

EIP712_DOCUMENTATION = """# EIP-712: Typed Structured Data Hashing and Signing

## Overview

EIP-712 is a standard for hashing and signing typed structured data. It enables
human-readable signing requests, showing users exactly what they're signing rather
than just a meaningless hash.

---

## What is EIP-712?

EIP-712 defines:
1. A type system for structured data
2. A hashing algorithm for this typed data
3. A standard way to present data for signing

### The Problem It Solves

Before EIP-712, users saw opaque hashes when signing. They had no way to verify
what they were actually signing. EIP-712 allows wallets to show structured,
human-readable data.

---

## Type System

### Domain Types

Every EIP-712 message includes a domain separator with these optional fields:

```javascript
{
  "EIP712Domain": [
    {"name": "name", "type": "string"},           // App/protocol name
    {"name": "version", "type": "string"},        // App version
    {"name": "chainId", "type": "uint256"},       // Chain ID
    {"name": "verifyingContract", "type": "address"}, // Contract address
    {"name": "salt", "type": "bytes32"}           // Disambiguation salt
  ]
}
```

### Supported Types

- **Atomic types**: `address`, `bool`, `bytes`, `string`, `uint256`, `int256`, etc.
- **Dynamic types**: `bytes`, `string`
- **Fixed-size arrays**: `uint256[3]`
- **Dynamic arrays**: `uint256[]`
- **Structs**: Custom types defined in `types`

---

## Structure

An EIP-712 message has four parts:

```javascript
{
  "types": {
    "EIP712Domain": [...],  // Domain type definition
    "Permit": [...]         // Your custom types
  },
  "primaryType": "Permit",  // Which type is being signed
  "domain": {...},          // Domain values
  "message": {...}          // Data being signed
}
```

---

## Hashing Algorithm

### 1. encodeType(typeName)
Encodes a type as: `TypeName(type1 name1,type2 name2,...)`

### 2. typeHash(typeName)
`keccak256(encodeType(typeName))`

### 3. encodeData(typeName, data)
`typeHash || encodedMember1 || encodedMember2 || ...`

### 4. hashStruct(typeName, data)
`keccak256(encodeData(typeName, data))`

### 5. Final Hash
```
keccak256(
  "\\x19\\x01" ||
  domainSeparator ||
  hashStruct(primaryType, message)
)
```

---

## Common Use Cases

### 1. ERC-20 Permits (EIP-2612)

Gasless token approvals:

```javascript
{
  "types": {
    "EIP712Domain": [...],
    "Permit": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "nonce", "type": "uint256"},
      {"name": "deadline", "type": "uint256"}
    ]
  },
  "primaryType": "Permit",
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 1,
    "verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  },
  "message": {
    "owner": "0x...",
    "spender": "0x...",
    "value": "1000000000000000000",
    "nonce": 0,
    "deadline": 1893456000
  }
}
```

### 2. DEX Orders

Limit orders for decentralized exchanges:

```javascript
{
  "types": {
    "EIP712Domain": [...],
    "Order": [
      {"name": "maker", "type": "address"},
      {"name": "makerToken", "type": "address"},
      {"name": "takerToken", "type": "address"},
      {"name": "makerAmount", "type": "uint256"},
      {"name": "takerAmount", "type": "uint256"}
    ]
  },
  "primaryType": "Order"
}
```

### 3. Permit2 (Uniswap)

Universal token approvals:

```javascript
{
  "types": {
    "EIP712Domain": [...],
    "PermitSingle": [
      {"name": "details", "type": "PermitDetails"},
      {"name": "spender", "type": "address"},
      {"name": "sigDeadline", "type": "uint256"}
    ],
    "PermitDetails": [
      {"name": "token", "type": "address"},
      {"name": "amount", "type": "uint160"},
      {"name": "expiration", "type": "uint48"},
      {"name": "nonce", "type": "uint48"}
    ]
  }
}
```

---

## Security Considerations

### 1. Domain Separation
Always include chainId to prevent cross-chain replay attacks.

### 2. Verifying Contract
Include the contract address to scope signatures to specific contracts.

### 3. Expiration/Deadline
Always include time limits to prevent indefinite signature validity.

### 4. Nonce
Use nonces to prevent replay attacks within the same contract.

### 5. Human Verification
Users should carefully review the data shown in their wallet before signing.

---

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

signable = encode_typed_data(full_message=typed_data)
signed = account.sign_message(signable)
```

---

## Wallet Display

When signing EIP-712 data, wallets typically show:
- Domain name and contract address
- Primary type being signed
- All fields in the message
- Chain ID to confirm network

---

## References

- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-2612: Permit Extension](https://eips.ethereum.org/EIPS/eip-2612)
- [Uniswap Permit2](https://github.com/Uniswap/permit2)
"""

SIGNATURE_EXAMPLES = """# Signature Test Vectors

## Overview

These test vectors can be used to verify your signature implementation is correct.
All signatures use deterministic signing, so the same inputs should always produce
the same outputs.

---

## Test Private Key

**WARNING**: This is a well-known test key. NEVER use it for real funds!

```
Private Key: 0x4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a
Address:     0x2c7536E3605D9C16a7a3D7b1898e529396a65c23
```

---

## EIP-191 Test Vectors

### Vector 1: Simple Message

```
Message: "Hello, Ethereum!"
Private Key: 0x4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a

Expected:
  Signer: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23
  
Prefixed Message: "\\x19Ethereum Signed Message:\\n16Hello, Ethereum!"
```

### Vector 2: Empty Message

```
Message: ""
Private Key: 0x4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a

Prefixed Message: "\\x19Ethereum Signed Message:\\n0"
```

### Vector 3: Numeric Message

```
Message: "12345"
Private Key: 0x4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a

Prefixed Message: "\\x19Ethereum Signed Message:\\n512345"
```

---

## Signature Components

A 65-byte Ethereum signature consists of:

```
| r (32 bytes) | s (32 bytes) | v (1 byte) |
|    0-31      |    32-63     |    64      |
```

### v Values

- **27 or 28**: Standard recovery IDs
- **0 or 1**: Compact form (add 27 to get standard)
- **chainId * 2 + 35 or 36**: EIP-155 format

---

## EIP-712 Test Vectors

### Mail Example (from EIP-712 spec)

```javascript
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Person": [
      {"name": "name", "type": "string"},
      {"name": "wallet", "type": "address"}
    ],
    "Mail": [
      {"name": "from", "type": "Person"},
      {"name": "to", "type": "Person"},
      {"name": "contents", "type": "string"}
    ]
  },
  "primaryType": "Mail",
  "domain": {
    "name": "Ether Mail",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
  },
  "message": {
    "from": {
      "name": "Cow",
      "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
    },
    "to": {
      "name": "Bob",
      "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
    },
    "contents": "Hello, Bob!"
  }
}
```

---

## Verification Test

To verify your implementation:

1. Sign the test message with the test private key
2. Verify the signer address matches
3. Decompose the signature into v, r, s
4. Recompose and verify it matches

```python
# Test your implementation
result = await sign_message("Hello, Ethereum!", TEST_PRIVATE_KEY)
assert result["signer_address"] == "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"
```

---

## Invalid Signatures

These should be rejected:

```
# Too short (64 bytes instead of 65)
0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b9156

# Invalid v value (0x00)
0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915600
```

---

## References

- [eth-account test vectors](https://github.com/ethereum/eth-account/tree/main/tests)
- [EIP-712 test cases](https://github.com/ethereum/EIPs/blob/master/assets/eip-712/Example.js)
"""


# ============================================================================
# Templates
# ============================================================================

def get_template(template_type: str) -> str:
    """Get a JSON template for the specified type."""
    templates = {
        "permit": """{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Permit": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "nonce", "type": "uint256"},
      {"name": "deadline", "type": "uint256"}
    ]
  },
  "primaryType": "Permit",
  "domain": {
    "name": "TOKEN_NAME",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xTOKEN_ADDRESS"
  },
  "message": {
    "owner": "0xOWNER_ADDRESS",
    "spender": "0xSPENDER_ADDRESS",
    "value": "AMOUNT_IN_WEI",
    "nonce": 0,
    "deadline": UNIX_TIMESTAMP
  }
}

# Instructions:
# 1. Replace TOKEN_NAME with the token name (e.g., "USD Coin")
# 2. Set chainId to your target chain (1=mainnet, 137=polygon, etc.)
# 3. Set verifyingContract to the token contract address
# 4. Set owner to your address
# 5. Set spender to the address you're approving
# 6. Set value to the amount in wei (or max uint256 for unlimited)
# 7. Set deadline to a future Unix timestamp""",

        "permit2": """{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "PermitSingle": [
      {"name": "details", "type": "PermitDetails"},
      {"name": "spender", "type": "address"},
      {"name": "sigDeadline", "type": "uint256"}
    ],
    "PermitDetails": [
      {"name": "token", "type": "address"},
      {"name": "amount", "type": "uint160"},
      {"name": "expiration", "type": "uint48"},
      {"name": "nonce", "type": "uint48"}
    ]
  },
  "primaryType": "PermitSingle",
  "domain": {
    "name": "Permit2",
    "chainId": 1,
    "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
  },
  "message": {
    "details": {
      "token": "0xTOKEN_ADDRESS",
      "amount": "MAX_AMOUNT",
      "expiration": EXPIRATION_TIMESTAMP,
      "nonce": 0
    },
    "spender": "0xSPENDER_ADDRESS",
    "sigDeadline": SIGNATURE_DEADLINE
  }
}

# Instructions:
# 1. Set chainId (Permit2 is deployed on all major chains)
# 2. Set details.token to the token you're approving
# 3. Set details.amount (max: 1461501637330902918203684832716283019655932542975)
# 4. Set details.expiration for when the approval expires
# 5. Set spender to the protocol using your tokens
# 6. Set sigDeadline for when this signature expires""",

        "order": """{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Order": [
      {"name": "maker", "type": "address"},
      {"name": "taker", "type": "address"},
      {"name": "makerToken", "type": "address"},
      {"name": "takerToken", "type": "address"},
      {"name": "makerAmount", "type": "uint256"},
      {"name": "takerAmount", "type": "uint256"},
      {"name": "expiry", "type": "uint256"},
      {"name": "salt", "type": "uint256"}
    ]
  },
  "primaryType": "Order",
  "domain": {
    "name": "Exchange",
    "version": "1.0",
    "chainId": 1,
    "verifyingContract": "0xEXCHANGE_ADDRESS"
  },
  "message": {
    "maker": "0xYOUR_ADDRESS",
    "taker": "0x0000000000000000000000000000000000000000",
    "makerToken": "0xTOKEN_YOU_SELL",
    "takerToken": "0xTOKEN_YOU_BUY",
    "makerAmount": "SELL_AMOUNT",
    "takerAmount": "BUY_AMOUNT",
    "expiry": EXPIRY_TIMESTAMP,
    "salt": RANDOM_NUMBER
  }
}

# Instructions:
# 1. Set domain for your exchange contract
# 2. maker is your address
# 3. taker is 0x0 for any taker, or specific address
# 4. Set token addresses and amounts
# 5. salt should be a random number for uniqueness""",

        "delegation": """{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Delegation": [
      {"name": "delegatee", "type": "address"},
      {"name": "nonce", "type": "uint256"},
      {"name": "expiry", "type": "uint256"}
    ]
  },
  "primaryType": "Delegation",
  "domain": {
    "name": "TOKEN_NAME",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xTOKEN_ADDRESS"
  },
  "message": {
    "delegatee": "0xDELEGATEE_ADDRESS",
    "nonce": 0,
    "expiry": EXPIRY_TIMESTAMP
  }
}

# Instructions:
# 1. Set domain for your governance token
# 2. delegatee is who receives your voting power
# 3. nonce from the contract (usually 0 for first delegation)
# 4. expiry is when the delegation signature expires""",

        "mail": """{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Person": [
      {"name": "name", "type": "string"},
      {"name": "wallet", "type": "address"}
    ],
    "Mail": [
      {"name": "from", "type": "Person"},
      {"name": "to", "type": "Person"},
      {"name": "contents", "type": "string"}
    ]
  },
  "primaryType": "Mail",
  "domain": {
    "name": "Ether Mail",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
  },
  "message": {
    "from": {
      "name": "Alice",
      "wallet": "0xSENDER_ADDRESS"
    },
    "to": {
      "name": "Bob",
      "wallet": "0xRECIPIENT_ADDRESS"
    },
    "contents": "Your message here"
  }
}

# This is the classic EIP-712 example demonstrating nested types."""
    }
    
    return templates.get(template_type, f"Unknown template type: {template_type}")


# ============================================================================
# Resource Registration
# ============================================================================

def register_signing_resources(server: Server) -> None:
    """
    Register all signing-related resources with the MCP server.
    
    Args:
        server: MCP Server instance to register resources with
    """
    
    @server.resource("signing://documentation/eip191")
    async def get_eip191_documentation() -> str:
        """
        EIP-191 Signed Data Standard documentation.
        
        Returns comprehensive documentation about:
        - What EIP-191 is and why it exists
        - personal_sign format explanation
        - Security properties
        - Version bytes (0x00, 0x01, 0x45)
        - Code examples
        - Common pitfalls
        """
        return EIP191_DOCUMENTATION
    
    @server.resource("signing://documentation/eip712")
    async def get_eip712_documentation() -> str:
        """
        EIP-712 Typed Structured Data documentation.
        
        Returns comprehensive documentation about:
        - Purpose of EIP-712
        - Type system explanation
        - Domain separator
        - Struct hashing algorithm
        - Common types (Permit, Order, etc.)
        - Security considerations
        - Implementation examples
        """
        return EIP712_DOCUMENTATION
    
    @server.resource("signing://templates/permit")
    async def get_permit_template() -> str:
        """
        EIP-712 Permit template for ERC-20 gasless approvals (EIP-2612).
        """
        return get_template("permit")
    
    @server.resource("signing://templates/permit2")
    async def get_permit2_template() -> str:
        """
        EIP-712 Permit2 template for Uniswap universal approvals.
        """
        return get_template("permit2")
    
    @server.resource("signing://templates/order")
    async def get_order_template() -> str:
        """
        EIP-712 Order template for DEX limit orders.
        """
        return get_template("order")
    
    @server.resource("signing://templates/delegation")
    async def get_delegation_template() -> str:
        """
        EIP-712 Delegation template for voting power delegation.
        """
        return get_template("delegation")
    
    @server.resource("signing://templates/mail")
    async def get_mail_template() -> str:
        """
        EIP-712 Mail template (classic example from the spec).
        """
        return get_template("mail")
    
    @server.resource("signing://examples/signatures")
    async def get_signature_examples() -> str:
        """
        Example signatures for testing and verification.
        
        Returns known test vectors:
        - Test private key
        - Test messages
        - Expected signatures
        - Expected recovered addresses
        
        For testing signature implementation correctness.
        """
        return SIGNATURE_EXAMPLES
