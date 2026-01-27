# EIP-712 Typed Data Signing

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

This document covers the EIP-712 typed structured data signing features of the Ethereum Wallet Toolkit.

## Overview

[EIP-712](https://eips.ethereum.org/EIPS/eip-712) defines a standard for hashing and signing typed structured data. It's widely used in DeFi for:

- **Permits**: Gasless token approvals (ERC-2612)
- **DEX Orders**: Off-chain order signing for exchanges
- **Meta-transactions**: Gasless transactions via relayers
- **Governance**: Off-chain voting signatures
- **NFT Listings**: Marketplace order signatures

## Key Benefits

1. **Human-readable signing**: Users see structured data, not hex blobs
2. **Domain separation**: Prevents cross-contract signature replay
3. **Type safety**: Structured validation of data types
4. **Standardized**: Consistent implementation across ecosystems

## Typed Data Structure

Every EIP-712 message has four components:

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

### 1. Types

Defines the structure of all types used:

```json
{
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
  }
}
```

### 2. Primary Type

The main type being signed:

```json
{
  "primaryType": "Permit"
}
```

### 3. Domain

Context that binds the signature to a specific contract:

```json
{
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 1,
    "verifyingContract": "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
  }
}
```

### 4. Message

The actual data being signed:

```json
{
  "message": {
    "owner": "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "spender": "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "value": "1000000000000000000",
    "nonce": 0,
    "deadline": 1893456000
  }
}
```

## CLI Usage

### Generate Example Data

```bash
# ERC-20 Permit example
python typed_data.py example --type permit --output permit.json

# DEX Order example
python typed_data.py example --type order --output order.json

# Mail example (EIP-712 spec)
python typed_data.py example --type mail --output mail.json
```

### Sign Typed Data

```bash
# Sign a permit
python typed_data.py sign --file permit.json --key 0xaaa...

# Sign with verbose output
python typed_data.py sign --file order.json --key 0xaaa... --verbose

# Save signature to file
python typed_data.py sign --file permit.json --key 0xaaa... --output signed.json
```

### Verify Signatures

```bash
# Verify a signature
python typed_data.py verify \
  --file permit.json \
  --signature 0xabc... \
  --address 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

### Calculate Hash

```bash
# Get the signing hash (for debugging)
python typed_data.py hash --file permit.json
```

## Python API

```python
from typed_data import (
    sign_typed_data,
    verify_typed_data,
    hash_typed_data,
    load_typed_data,
    EXAMPLES
)

# Load typed data from file
typed_data = load_typed_data('permit.json')

# Or use built-in examples
typed_data = EXAMPLES['permit']

# Sign
result = sign_typed_data(typed_data, '0xaaa...')
print(f"Signature: {result['signature']}")
print(f"v: {result['v']}, r: {result['r']}, s: {result['s']}")

# Verify
verification = verify_typed_data(
    typed_data,
    result['signature'],
    '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
)
print(f"Valid: {verification['is_valid']}")

# Calculate hash
hash_value = hash_typed_data(typed_data)
print(f"Hash: {hash_value}")
```

## Common Use Cases

### 1. ERC-20 Permit (Gasless Approval)

Instead of calling `approve()` (which costs gas), users sign a permit off-chain:

```json
{
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
    "name": "USD Coin",
    "version": "2",
    "chainId": 1,
    "verifyingContract": "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
  },
  "message": {
    "owner": "0xYourAddress",
    "spender": "0xSpenderContract",
    "value": "1000000000",
    "nonce": 0,
    "deadline": 1893456000
  }
}
```

### 2. DEX Order (0x-style)

Off-chain limit orders for decentralized exchanges:

```json
{
  "types": {
    "EIP712Domain": [...],
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
    "verifyingContract": "0xExchangeContract"
  },
  "message": {
    "maker": "0xYourAddress",
    "taker": "0x0000000000000000000000000000000000000000",
    "makerToken": "0xWETH",
    "takerToken": "0xUSDC",
    "makerAmount": "1000000000000000000",
    "takerAmount": "3000000000",
    "expiry": 1893456000,
    "salt": 12345
  }
}
```

### 3. Meta-Transaction

Allow relayers to pay gas on behalf of users:

```json
{
  "types": {
    "EIP712Domain": [...],
    "ForwardRequest": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "gas", "type": "uint256"},
      {"name": "nonce", "type": "uint256"},
      {"name": "data", "type": "bytes"}
    ]
  },
  "primaryType": "ForwardRequest",
  "message": {
    "from": "0xUserAddress",
    "to": "0xTargetContract",
    "value": "0",
    "gas": "100000",
    "nonce": 0,
    "data": "0x..."
  }
}
```

## Supported Types

| Solidity Type | EIP-712 Type |
|---------------|--------------|
| address | address |
| bool | bool |
| uint256 | uint256 |
| int256 | int256 |
| bytes32 | bytes32 |
| bytes | bytes |
| string | string |
| Custom struct | Custom type |
| Array | Type[] |

## Domain Separator

The domain separator prevents signature replay across:
- Different contracts (verifyingContract)
- Different chains (chainId)
- Different versions (version)
- Different applications (name)

```
domainSeparator = keccak256(
  encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(name),
    keccak256(version),
    chainId,
    verifyingContract
  )
)
```

## Security Considerations

### 1. Domain Verification

Always verify the domain matches the intended contract:
- Check `verifyingContract` is the correct address
- Check `chainId` matches your network
- Check `name` and `version` match the contract

### 2. Message Validation

Before signing:
- Verify all addresses are correct
- Check amounts and values
- Validate deadline hasn't passed
- Confirm nonce matches expected value

### 3. Signature Replay

EIP-712 prevents cross-domain replay, but:
- Same-domain replay requires nonce management
- Store and increment nonces properly
- Check expiry/deadline values

### 4. Phishing Risks

Malicious dApps may request signatures that:
- Approve unlimited token spending
- Transfer assets to attacker addresses
- Execute unexpected contract calls

Always review what you're signing!

## Integration with Smart Contracts

### Solidity Verification

```solidity
function verify(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    bytes32 structHash = keccak256(abi.encode(
        PERMIT_TYPEHASH,
        owner,
        spender,
        value,
        nonces[owner]++,
        deadline
    ));
    
    bytes32 hash = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(hash, v, r, s);
    
    require(signer == owner, "Invalid signature");
    require(block.timestamp <= deadline, "Expired");
}
```

### OpenZeppelin Integration

```solidity
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MyContract is EIP712 {
    constructor() EIP712("MyContract", "1") {}
    
    function _verify(bytes memory signature, bytes32 hash, address signer) 
        internal view returns (bool) 
    {
        return ECDSA.recover(_hashTypedDataV4(hash), signature) == signer;
    }
}
```

## Debugging

### Hash Mismatch

If signatures fail to verify:

1. Check domain separator matches contract
2. Verify type hash calculation
3. Ensure message encoding is correct
4. Compare struct hash with contract

### Tool Usage

```bash
# Calculate hash for comparison
python typed_data.py hash --file permit.json

# Compare with contract's domain separator
cast call 0xContract "DOMAIN_SEPARATOR()(bytes32)"
```

## References

- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-2612 Permit Extension](https://eips.ethereum.org/EIPS/eip-2612)
- [OpenZeppelin EIP712](https://docs.openzeppelin.com/contracts/4.x/api/utils#EIP712)
