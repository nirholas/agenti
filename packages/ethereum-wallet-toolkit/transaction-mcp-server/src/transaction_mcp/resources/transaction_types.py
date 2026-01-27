"""
Transaction Types Resources

Documentation about Ethereum transaction types.
"""

from mcp.server import Server


TRANSACTION_TYPES_CONTENT = """
# Ethereum Transaction Types

## Overview

Ethereum supports multiple transaction types, each with different features and gas pricing mechanisms.

## Type 0 - Legacy Transactions

The original transaction format, still supported for backward compatibility.

### Structure
```
{
    nonce: uint64,           // Transaction count from sender
    gasPrice: uint256,       // Price per gas unit in wei
    gasLimit: uint64,        // Maximum gas for this transaction
    to: address,             // Recipient (null for contract creation)
    value: uint256,          // ETH value in wei
    data: bytes,             // Input data
    v, r, s: signature       // ECDSA signature components
}
```

### Key Points
- Simple gas model: `total_cost = gasPrice * gasUsed`
- Full gas price goes to miner
- No priority mechanism
- Still widely supported

---

## Type 1 - EIP-2930 (Access Lists)

Introduced in Berlin hard fork. Adds access lists for storage access optimization.

### Structure
```
0x01 || rlp([
    chainId,
    nonce,
    gasPrice,
    gasLimit,
    to,
    value,
    data,
    accessList,              // List of addresses and storage keys
    signatureYParity, signatureR, signatureS
])
```

### Access List Format
```
[
    [address1, [storageKey1, storageKey2, ...]],
    [address2, [storageKey1, ...]],
    ...
]
```

### Key Points
- Prefix: 0x01
- Pre-declares storage slots to access
- Can reduce gas costs for known access patterns
- Same gas pricing as legacy

---

## Type 2 - EIP-1559 (Dynamic Fee)

Introduced in London hard fork. New fee market mechanism.

### Structure
```
0x02 || rlp([
    chainId,
    nonce,
    maxPriorityFeePerGas,    // Max tip to validator
    maxFeePerGas,            // Max total fee per gas
    gasLimit,
    to,
    value,
    data,
    accessList,
    signatureYParity, signatureR, signatureS
])
```

### Fee Calculation
```
baseFee = block.baseFee                           // Protocol-determined
priorityFee = min(maxPriorityFee, maxFee - baseFee)
effectiveGasPrice = baseFee + priorityFee
totalCost = effectiveGasPrice * gasUsed
```

### Key Points
- Prefix: 0x02
- Base fee is burned (deflationary)
- Priority fee goes to validator
- More predictable fees
- Better UX with "max fee" guarantee

---

## Comparison Table

| Feature | Type 0 | Type 1 | Type 2 |
|---------|--------|--------|--------|
| Prefix | None | 0x01 | 0x02 |
| Chain ID | In v | Explicit | Explicit |
| Gas Pricing | gasPrice | gasPrice | baseFee + priorityFee |
| Access List | No | Yes | Yes |
| Fee Burning | No | No | Yes (baseFee) |
| EIP | Original | EIP-2930 | EIP-1559 |

---

## When to Use Each Type

### Use Type 0 (Legacy)
- Maximum compatibility
- Simple tooling requirements
- When interacting with older contracts

### Use Type 1 (Access List)
- Known storage access patterns
- Gas optimization for repeated patterns
- Cross-contract calls to specific storage

### Use Type 2 (EIP-1559)
- Modern Ethereum (recommended)
- Better fee prediction
- Most wallet support
- Post-London transactions
"""


def register_transaction_types_resources(server: Server) -> None:
    """Register transaction types documentation resources."""
    
    @server.resource("transaction://types/overview")
    async def get_transaction_types() -> str:
        """
        Overview of Ethereum transaction types (Legacy, EIP-2930, EIP-1559).
        """
        return TRANSACTION_TYPES_CONTENT
