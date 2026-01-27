# MCP Servers

This repository includes 5 Model Context Protocol (MCP) servers that expose Ethereum wallet functionality to AI assistants like Claude.

## Documentation

- **[Prompt Examples](PROMPT_EXAMPLES.md)** - Real-world prompts for interacting with the servers
- **[Testing Guide](TESTING.md)** - How to run and write tests
- **[Integration Guide](INTEGRATION.md)** - Setting up with Claude Desktop and other tools
- **[Workflows & Recipes](WORKFLOWS.md)** - Common workflows combining multiple servers

## Overview

| Server | Purpose | Tools | Tests |
|--------|---------|-------|-------|
| [ethereum-wallet-mcp](../ethereum-wallet-mcp/) | Wallet generation, HD wallets, mnemonics | 6 | 111 |
| [keystore-mcp-server](../keystore-mcp-server/) | Encrypted keystore files (Web3 Secret Storage) | 9 | 74 |
| [signing-mcp-server](../signing-mcp-server/) | Message signing, EIP-191, EIP-712 | 12 | 34 |
| [transaction-mcp-server](../transaction-mcp-server/) | Transaction building, encoding, signing | 15 | 65 |
| [validation-mcp-server](../validation-mcp-server/) | Address/key validation, checksums, hashing | 15 | 64 |

**Total: 57 tools, 348 tests**

## Quick Start

### Installation

Each server is a standalone Python package:

```bash
# Install all servers
pip install -e ./ethereum-wallet-mcp
pip install -e ./keystore-mcp-server
pip install -e ./signing-mcp-server
pip install -e ./transaction-mcp-server
pip install -e ./validation-mcp-server
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "ethereum-wallet-mcp"
    },
    "keystore": {
      "command": "keystore-mcp-server"
    },
    "signing": {
      "command": "signing-mcp-server"
    },
    "transaction": {
      "command": "transaction-mcp-server"
    },
    "validation": {
      "command": "validation-mcp-server"
    }
  }
}
```

## Server Details

### ethereum-wallet-mcp

**Wallet Generation & HD Wallets**

Tools:
- `generate_wallet` - Random Ethereum wallet
- `generate_wallet_with_mnemonic` - BIP39 mnemonic wallet
- `restore_wallet_from_mnemonic` - Restore from seed phrase
- `restore_wallet_from_private_key` - Restore from private key
- `derive_multiple_accounts` - HD wallet derivation
- `generate_vanity_address` - Custom prefix/suffix addresses

Resources:
- `wallet://documentation/bip39` - BIP39 spec
- `wallet://documentation/derivation-paths` - HD paths
- `wallet://wordlist/{language}` - BIP39 wordlists

### keystore-mcp-server

**Encrypted Keystore Files (Web3 Secret Storage)**

Tools:
- `encrypt_keystore` - Create encrypted keystore from private key
- `decrypt_keystore` - Decrypt keystore to get private key
- `change_keystore_password` - Re-encrypt with new password
- `validate_keystore` - Verify keystore structure
- `get_keystore_address` - Extract address without decryption
- `generate_encrypted_wallet` - Create new wallet as keystore
- `read_keystore_file` - Read keystore from filesystem
- `write_keystore_file` - Save keystore to filesystem

Supports:
- scrypt and pbkdf2 key derivation
- AES-128-CTR encryption
- UUID and version validation

### signing-mcp-server

**Message & Data Signing**

Tools:
- `sign_message` - EIP-191 personal_sign
- `verify_message` - Verify signed message
- `hash_message` - Create message hash
- `sign_typed_data` - EIP-712 structured data
- `verify_typed_data` - Verify typed data signature
- `encode_typed_data` - Encode without signing
- `recover_signer` - Recover address from signature

### transaction-mcp-server

**Transaction Building & Signing**

Tools:
- `build_transaction` - Create unsigned transaction
- `sign_transaction` - Sign with private key
- `decode_transaction` - Parse raw transaction
- `encode_transaction` - RLP encode transaction
- `estimate_gas` - Calculate gas requirements
- `calculate_transaction_hash` - Pre-signing hash
- `build_eip1559_transaction` - Type 2 transactions
- `build_legacy_transaction` - Type 0 transactions
- `build_access_list_transaction` - Type 1 transactions
- `serialize_transaction` - Convert to wire format
- `parse_transaction_input` - Decode calldata
- `validate_transaction` - Check transaction validity

### validation-mcp-server

**Validation & Cryptographic Utilities**

Tools:
- `validate_address` - EIP-55 checksum validation
- `validate_private_key` - Key range checking
- `to_checksum_address` - Convert to checksummed
- `derive_address_from_private_key` - Key → address
- `derive_address_from_public_key` - Pubkey → address
- `validate_signature` - Check v, r, s values
- `validate_hex_data` - Hex string validation
- `compare_addresses` - Address equality
- `batch_validate_addresses` - Bulk validation
- `generate_vanity_check` - Pattern matching
- `keccak256_hash` - Compute Keccak-256
- `encode_function_selector` - Signature → selector
- `decode_function_selector` - Lookup selectors
- `validate_ens_name` - ENS format validation
- `calculate_storage_slot` - Storage slot computation

Resources:
- `validation://eip55-specification` - EIP-55 docs
- `validation://secp256k1-constants` - Curve params
- `validation://function-selectors-db` - 500+ selectors
- `validation://address-patterns` - Known patterns

## Testing

Run all server tests:

```bash
# Individual servers
pytest ethereum-wallet-mcp/tests/ -v
pytest keystore-mcp-server/tests/ -v
pytest signing-mcp-server/tests/ -v
pytest transaction-mcp-server/tests/ -v
pytest validation-mcp-server/tests/ -v

# All at once
./run_all_tests.sh
```

## Architecture

All servers follow a consistent pattern:

```
server-name/
├── pyproject.toml          # Package config
├── README.md               # Server docs
├── src/
│   └── package_name/
│       ├── __init__.py
│       ├── __main__.py     # Entry point
│       ├── server.py       # MCP server setup
│       ├── tools/          # Tool implementations
│       ├── resources/      # Static resources
│       └── prompts/        # Interactive prompts
└── tests/
    └── test_*.py           # Pytest tests
```

Each tool has:
1. An `*_impl()` function with pure business logic (for testing)
2. A registered async wrapper for MCP compatibility

## Security Considerations

- **No network calls** - All operations are offline
- **No key storage** - Keys are passed through, never persisted
- **Auditable** - All code uses official Ethereum Foundation libraries
- **Test coverage** - 348 tests across all servers

⚠️ **Warning**: These tools handle sensitive cryptographic material. Review the code and understand the implications before using with real assets.

## Dependencies

All servers use official Ethereum Foundation libraries:

- `eth-account` - Key generation, signing
- `eth-keys` - ECDSA operations  
- `eth-utils` - Utility functions
- `eth-rlp` - RLP encoding
- `mnemonic` - BIP39 implementation
- `mcp` - Model Context Protocol SDK

## License

MIT License - See [LICENSE](../LICENSE)
