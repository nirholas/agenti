# Keystore MCP Server

[![PyPI](https://img.shields.io/pypi/v/keystore-mcp-server)](https://pypi.org/project/keystore-mcp-server/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)

<!-- mcp-name: io.github.nirholas/keystore-mcp-server -->

A Model Context Protocol (MCP) server for Ethereum keystore encryption, decryption, and management following the Web3 Secret Storage Definition Version 3 standard.

## Features

### Tools (9)

- **`encrypt_keystore`** - Encrypt private key to Web3 Secret Storage V3 format
- **`decrypt_keystore`** - Decrypt keystore to recover private key
- **`save_keystore_file`** - Save keystore with standard Ethereum naming
- **`load_keystore_file`** - Load and validate keystore files
- **`get_keystore_info`** - Extract metadata without decryption
- **`validate_keystore`** - Validate keystore structure
- **`change_keystore_password`** - Change password and optionally upgrade KDF
- **`batch_encrypt_keystores`** - Encrypt multiple wallets
- **`keystore_to_private_key_file`** - Export decrypted private key (dangerous)

### Resources (4)

- **`keystore://specification`** - Web3 Secret Storage V3 specification
- **`keystore://security-guide`** - Security best practices
- **`keystore://kdf-comparison`** - Scrypt vs PBKDF2 comparison
- **`keystore://examples/{type}`** - Example keystores

### Prompts (4)

- **`secure_wallet_backup`** - Guided backup creation
- **`keystore_migration`** - Migration from legacy formats
- **`keystore_recovery`** - Recovery assistance
- **`keystore_security_audit`** - Security audit workflow

## Installation

```bash
pip install -e .

# Or with dev dependencies
pip install -e ".[dev]"
```

## Usage

### Running the Server

```bash
keystore-mcp-server
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "keystore": {
      "command": "keystore-mcp-server"
    }
  }
}
```

## Cryptographic Standards

### Web3 Secret Storage V3

- **KDF**: scrypt (recommended) or pbkdf2
- **Cipher**: AES-128-CTR
- **MAC**: Keccak-256
- **UUID**: Version 4

### Default Scrypt Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| N | 262144 (2^18) | CPU/memory cost |
| r | 8 | Block size |
| p | 1 | Parallelization |
| dklen | 32 | Derived key length |

### Default PBKDF2 Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| c | 262144 | Iterations |
| prf | hmac-sha256 | PRF |
| dklen | 32 | Derived key length |

## Security

⚠️ **Important Security Notes:**

1. **Never share keystore passwords** - Treat like private keys
2. **Use strong passwords** - Minimum 12 characters, mixed case, numbers, symbols
3. **Secure file storage** - Files created with 0600 permissions
4. **Air-gapped operations** - Use offline for high-value wallets
5. **Backup keystores** - Store encrypted backups in multiple locations

## Examples

### Encrypt a Private Key

```python
result = await encrypt_keystore(
    private_key="0x...",
    password="strong-password-123",
    kdf="scrypt"
)
```

### Decrypt a Keystore

```python
result = await decrypt_keystore(
    keystore=keystore_json,
    password="strong-password-123"
)
```

### Save Keystore File

```python
result = await save_keystore_file(
    keystore=keystore_json,
    directory="./keystores"
)
# Creates: UTC--2024-01-15T10-30-00.000Z--address.json
```

## Testing

```bash
pytest tests/ -v
```

## License

MIT License
