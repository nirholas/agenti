# Signing MCP Server

[![PyPI](https://img.shields.io/pypi/v/signing-mcp-server)](https://pypi.org/project/signing-mcp-server/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)

<!-- mcp-name: io.github.nirholas/signing-mcp-server -->

An MCP (Model Context Protocol) server providing comprehensive Ethereum message signing capabilities including EIP-191 personal_sign and EIP-712 typed structured data.

## Features

### Tools (12 total)

#### EIP-191 Message Signing
- **sign_message** - Sign a text message using EIP-191 personal_sign format
- **sign_message_hex** - Sign hex-encoded bytes using EIP-191 format
- **verify_message** - Verify an EIP-191 signed message
- **recover_signer** - Recover signer address from a signed message

#### EIP-712 Typed Data
- **sign_typed_data** - Sign EIP-712 typed structured data
- **verify_typed_data** - Verify an EIP-712 typed data signature
- **recover_typed_data_signer** - Recover signer from typed data signature
- **hash_typed_data** - Compute EIP-712 hash without signing

#### Signature Utilities
- **decompose_signature** - Break down signature into v, r, s components
- **compose_signature** - Compose signature from v, r, s components
- **normalize_signature** - Convert between signature formats (27/28 vs 0/1 for v)

#### Advanced Operations
- **sign_hash** - Sign a raw 32-byte hash (requires acknowledgement)

### Resources (4 total)
- **eip191-specification** - Complete EIP-191 signed data standard
- **eip712-specification** - Complete EIP-712 typed data standard
- **signature-formats** - Documentation on Ethereum signature formats
- **common-typed-data** - Templates for common EIP-712 structures

### Prompts (4 total)
- **sign_message_workflow** - Guide through message signing process
- **typed_data_workflow** - Guide through EIP-712 typed data signing
- **signature_verification** - Help verify and debug signatures
- **permit_signing** - Specialized workflow for ERC-20 permits

## Installation

```bash
pip install signing-mcp-server
```

Or install from source:

```bash
cd signing-mcp-server
pip install -e .
```

## Usage

### Run the server

```bash
signing-mcp-server
```

### Configure in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "signing": {
      "command": "signing-mcp-server"
    }
  }
}
```

## Tool Examples

### Sign a Message (EIP-191)

```python
# Input
{
    "message": "Hello, Ethereum!",
    "private_key": "0x..."
}

# Output
{
    "message": "Hello, Ethereum!",
    "signer": "0xABC123...",
    "signature": "0x...",
    "v": 28,
    "r": "0x...",
    "s": "0x...",
    "message_hash": "0x..."
}
```

### Sign Typed Data (EIP-712)

```python
# Input
{
    "typed_data": {
        "types": {...},
        "primaryType": "Permit",
        "domain": {...},
        "message": {...}
    },
    "private_key": "0x..."
}

# Output
{
    "signer": "0xABC123...",
    "signature": "0x...",
    "domain_separator": "0x...",
    "struct_hash": "0x...",
    "signing_hash": "0x..."
}
```

### Verify a Signature

```python
# Input
{
    "message": "Hello, Ethereum!",
    "signature": "0x...",
    "expected_address": "0xABC123..."
}

# Output
{
    "is_valid": true,
    "recovered_address": "0xABC123...",
    "expected_address": "0xABC123...",
    "match": true
}
```

## Security Notes

1. **Private keys are NEVER logged or persisted**
2. **sign_hash requires explicit risk acknowledgement** - signing raw hashes can be dangerous
3. **All operations use eth-account's secure implementations**
4. **For educational and development purposes only**

## EIP-712 Templates

The server includes templates for common typed data structures:
- **Permit** - ERC-20 token permits (EIP-2612)
- **Permit2** - Uniswap's universal permit system
- **Order** - DEX limit orders
- **Delegation** - Voting power delegation
- **Mail** - EIP-712 specification example

## License

MIT
