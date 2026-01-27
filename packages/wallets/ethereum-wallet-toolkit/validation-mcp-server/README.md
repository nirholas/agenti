# Validation MCP Server

[![PyPI](https://img.shields.io/pypi/v/validation-mcp-server)](https://pypi.org/project/validation-mcp-server/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)

<!-- mcp-name: io.github.nirholas/validation-mcp-server -->

A Model Context Protocol (MCP) server providing comprehensive Ethereum address validation, private key validation, checksum conversion, and cryptographic utilities.

## Features

### Tools (15 total)

1. **validate_address** - Comprehensive Ethereum address validation with EIP-55 checksum verification
2. **validate_private_key** - Private key validation with range checking
3. **to_checksum_address** - Convert any address to EIP-55 checksummed format
4. **derive_address_from_private_key** - Derive Ethereum address from private key
5. **derive_address_from_public_key** - Derive address from public key (compressed/uncompressed)
6. **validate_signature** - Validate ECDSA signature components (v, r, s)
7. **validate_hex_data** - Validate arbitrary hex data for Ethereum use
8. **compare_addresses** - Compare two addresses for equality
9. **batch_validate_addresses** - Validate multiple addresses at once
10. **generate_vanity_check** - Check if address matches vanity criteria
11. **keccak256_hash** - Compute Keccak-256 hash
12. **encode_function_selector** - Encode function signature to 4-byte selector
13. **decode_function_selector** - Decode selector to function signature
14. **validate_ens_name** - Validate ENS name format (offline)
15. **calculate_storage_slot** - Calculate contract storage slot positions

### Resources

- `validation://eip55-specification` - EIP-55 checksum specification
- `validation://secp256k1-constants` - Curve parameters
- `validation://function-selectors-db` - Common function selectors (500+)
- `validation://address-patterns` - Known address patterns
- `validation://known-weak-keys` - Weak key information

### Prompts

- Address validation workflow
- Key security audit
- Data encoding helper
- Contract interaction preparation

## Installation

```bash
pip install -e .
```

## Usage

### As MCP Server

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "validation-mcp-server": {
      "command": "validation-mcp-server"
    }
  }
}
```

### Example Tool Calls

```python
# Validate an address
result = await validate_address("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")

# Derive address from private key
wallet = await derive_address_from_private_key(
    "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
)

# Compute function selector
selector = await encode_function_selector("transfer(address,uint256)")
# Returns: 0xa9059cbb
```

## Security Notes

- Private keys are never logged or persisted
- All sensitive operations clear memory after use
- Uses established cryptographic libraries

## License

MIT
