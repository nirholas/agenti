# Validation Module

Ethereum address, key, and data validation utilities using official Ethereum Foundation libraries.

## CLI Usage

```bash
python validate.py <command> [options]
```

## Commands

### Address Validation

```bash
# Validate an address
python validate.py address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Output:
# ✓ Valid Ethereum address
# Format: checksummed (EIP-55)
# Address: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

### Checksum Conversion

```bash
# Convert to checksummed address
python validate.py checksum 0xd8da6bf26964af9d7eed9e03e53415d37aa96045

# Output:
# 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

### Private Key Validation

```bash
# Validate a private key (hex format)
python validate.py key 0x4c0883a69102937d6231471b5dbb6204fe5129d2e7a1f3e8e4e2c3d0b1a2f3e4

# Output:
# ✓ Valid private key
# Derived address: 0x...
```

### Derive Address from Key

```bash
# Derive address from private key
python validate.py derive 0x4c0883a69102937d6231471b5dbb6204fe5129d2e7a1f3e8e4e2c3d0b1a2f3e4

# Output:
# Address: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

### Keccak-256 Hash

```bash
# Hash data
python validate.py hash "Hello, Ethereum!"

# Hash hex data
python validate.py hash 0x48656c6c6f --hex
```

### Function Selector

```bash
# Encode function signature to selector
python validate.py selector "transfer(address,uint256)"

# Output:
# Selector: 0xa9059cbb
```

## Python API

```python
from validate import (
    validate_address,
    validate_private_key,
    to_checksum_address,
    derive_address,
    keccak256,
    encode_selector
)

# Validate address
is_valid, info = validate_address("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")

# Check if properly checksummed
from eth_utils import is_checksum_address
is_checksummed = is_checksum_address(address)

# Convert to checksum
checksummed = to_checksum_address("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")

# Validate private key
is_valid, address = validate_private_key(private_key_hex)

# Derive address from private key
address = derive_address(private_key_hex)

# Compute Keccak-256 hash
hash_bytes = keccak256(b"Hello, Ethereum!")
hash_hex = hash_bytes.hex()

# Function selector
selector = encode_selector("transfer(address,uint256)")  # 0xa9059cbb
```

## EIP-55 Checksum

The EIP-55 checksum encodes validity information in the case of each hex character:

```
Original:  0xd8da6bf26964af9d7eed9e03e53415d37aa96045
Checksummed: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
              ^^ ^^^    ^ ^  ^      ^      ^^
```

Algorithm:
1. Take lowercase address without 0x prefix
2. Compute keccak256 hash of the lowercase address
3. For each character at position i:
   - If address[i] is a letter (a-f) AND hash[i] >= 8, uppercase it

```python
from eth_utils import keccak

def checksum_encode(address: str) -> str:
    address = address.lower().replace('0x', '')
    hash_bytes = keccak(text=address)
    hash_hex = hash_bytes.hex()
    
    result = '0x'
    for i, char in enumerate(address):
        if char in '0123456789':
            result += char
        elif int(hash_hex[i], 16) >= 8:
            result += char.upper()
        else:
            result += char
    return result
```

## Private Key Validation

Valid Ethereum private keys must be:
- 32 bytes (64 hex characters)
- In range [1, secp256k1_n - 1]

```python
# secp256k1 curve order
SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141

def is_valid_private_key(key_hex: str) -> bool:
    key_int = int(key_hex, 16)
    return 1 <= key_int < SECP256K1_N
```

## Storage Slot Calculation

Calculate contract storage slots for accessing state:

```python
from eth_utils import keccak

def calculate_mapping_slot(key: str, base_slot: int) -> str:
    """Calculate storage slot for mapping[key]"""
    # slot = keccak256(key . base_slot)
    key_bytes = bytes.fromhex(key.replace('0x', '').zfill(64))
    slot_bytes = base_slot.to_bytes(32, 'big')
    return '0x' + keccak(key_bytes + slot_bytes).hex()

def calculate_array_slot(base_slot: int, index: int) -> str:
    """Calculate storage slot for array[index]"""
    # Data starts at keccak256(base_slot)
    # slot = keccak256(base_slot) + index
    slot_bytes = base_slot.to_bytes(32, 'big')
    data_start = int.from_bytes(keccak(slot_bytes), 'big')
    return hex(data_start + index)
```

## Common Patterns

### Zero Address
```
0x0000000000000000000000000000000000000000
```
Used for: ETH burns, contract creation, null address

### Dead Address
```
0x000000000000000000000000000000000000dEaD
```
Used for: Token burns (verifiable)

### Create2 Factory
```
0x4e59b44847b379578588920cA78FbF26c0B4956C
```
Deterministic deployment factory

## MCP Server

For AI assistant integration, see [validation-mcp-server](../validation-mcp-server/):

```bash
pip install -e ./validation-mcp-server
validation-mcp
```

Provides 15 validation tools accessible via Model Context Protocol.

## Security Notes

1. **Never log private keys** - Even for validation
2. **Validate before use** - Always validate addresses/keys before transactions
3. **Checksum matters** - Using checksummed addresses prevents typo losses
4. **Key range** - Invalid keys outside secp256k1 range will fail silently in some libraries

## See Also

- [EIP-55: Mixed-case checksum address encoding](https://eips.ethereum.org/EIPS/eip-55)
- [secp256k1 curve](https://en.bitcoin.it/wiki/Secp256k1)
- [Solidity Storage Layout](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
