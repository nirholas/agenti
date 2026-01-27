# MCP Server Integration Guide

This guide explains how to integrate the Ethereum Wallet Toolkit MCP servers with various AI assistants and applications.

## Table of Contents

- [Claude Desktop Setup](#claude-desktop-setup)
- [Configuration Options](#configuration-options)
- [Server Selection Guide](#server-selection-guide)
- [Development Integration](#development-integration)
- [Best Practices](#best-practices)

---

## Claude Desktop Setup

### Configuration File Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

### Full Configuration (All Servers)

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "ethereum-wallet-mcp",
      "args": [],
      "env": {}
    },
    "signing": {
      "command": "signing-mcp-server",
      "args": [],
      "env": {}
    },
    "keystore": {
      "command": "keystore-mcp-server",
      "args": [],
      "env": {}
    },
    "transaction": {
      "command": "transaction-mcp-server",
      "args": [],
      "env": {}
    },
    "validation": {
      "command": "validation-mcp-server",
      "args": [],
      "env": {}
    }
  }
}
```

### Minimal Configuration (Essential Only)

For basic wallet operations, you only need:

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "ethereum-wallet-mcp"
    },
    "validation": {
      "command": "validation-mcp-server"
    }
  }
}
```

### Using UV/UVX

If installed with `uv`:

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "uvx",
      "args": ["--from", "ethereum-wallet-mcp", "ethereum-wallet-mcp"]
    }
  }
}
```

### Using Python Module

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "python",
      "args": ["-m", "ethereum_wallet_mcp"]
    }
  }
}
```

### Using Absolute Paths

For development or when commands aren't in PATH:

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "/home/user/.local/bin/ethereum-wallet-mcp"
    }
  }
}
```

---

## Configuration Options

### Environment Variables

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "ethereum-wallet-mcp",
      "env": {
        "LOG_LEVEL": "DEBUG",
        "PYTHONPATH": "/custom/path"
      }
    }
  }
}
```

### Working Directory

```json
{
  "mcpServers": {
    "keystore": {
      "command": "keystore-mcp-server",
      "cwd": "/path/to/keystores"
    }
  }
}
```

### Multiple Instances

For different configurations:

```json
{
  "mcpServers": {
    "wallet-mainnet": {
      "command": "ethereum-wallet-mcp",
      "env": { "DEFAULT_CHAIN": "1" }
    },
    "wallet-testnet": {
      "command": "ethereum-wallet-mcp",
      "env": { "DEFAULT_CHAIN": "11155111" }
    }
  }
}
```

---

## Server Selection Guide

### Choose Your Servers Based on Use Case

| Use Case | Required Servers |
|----------|------------------|
| Generate wallets | `ethereum-wallet` |
| Store wallets securely | `ethereum-wallet` + `keystore` |
| Sign messages | `signing` |
| Send transactions | `ethereum-wallet` + `transaction` |
| Validate addresses | `validation` |
| Full DApp development | All 5 servers |

### Server Capabilities Overview

#### ethereum-wallet-mcp (Wallet Generation)
```
✅ Generate random wallets
✅ HD wallet derivation (BIP39/BIP44)
✅ Mnemonic phrase generation and recovery
✅ Vanity address generation
✅ Multiple account derivation
```

#### signing-mcp-server (Message Signing)
```
✅ EIP-191 personal_sign messages
✅ EIP-712 typed structured data
✅ Signature verification
✅ Signer recovery
✅ Signature decomposition (v, r, s)
```

#### keystore-mcp-server (Encrypted Storage)
```
✅ Web3 Secret Storage V3 encryption
✅ Scrypt and PBKDF2 key derivation
✅ Password changes
✅ File I/O operations
✅ Keystore validation
```

#### transaction-mcp-server (Transactions)
```
✅ Legacy and EIP-1559 transactions
✅ Transaction signing
✅ Raw transaction decoding
✅ Calldata encoding/decoding
✅ Gas estimation utilities
```

#### validation-mcp-server (Validation)
```
✅ Address validation and checksums
✅ Private key validation
✅ Function selector encoding
✅ Keccak256 hashing
✅ Storage slot calculation
```

---

## Development Integration

### Local Development

```bash
# Clone repository
git clone https://github.com/nirholas/ethereum-wallet-toolkit
cd ethereum-wallet-toolkit

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install all servers in development mode
pip install -e "./ethereum-wallet-mcp[dev]"
pip install -e "./signing-mcp-server[dev]"
pip install -e "./keystore-mcp-server[dev]"
pip install -e "./transaction-mcp-server[dev]"
pip install -e "./validation-mcp-server[dev]"

# Run tests
./run_all_tests.sh
```

### Using as Library

You can also use the implementation functions directly:

```python
# Wallet generation
from ethereum_wallet_mcp.tools.wallet import generate_wallet_impl
wallet = generate_wallet_impl()
print(wallet['address'])

# Message signing
from signing_mcp.tools.message_signing import sign_message_impl
signature = sign_message_impl("Hello", private_key)

# Validation
from validation_mcp.tools.address_validation import validate_address_impl
result = validate_address_impl("0x...")
```

### API Server Wrapper

To expose as HTTP API:

```python
from fastapi import FastAPI
from ethereum_wallet_mcp.tools.wallet import generate_wallet_impl

app = FastAPI()

@app.post("/wallet/generate")
async def generate_wallet():
    return generate_wallet_impl()

# Run with: uvicorn server:app
```

---

## Best Practices

### Security

1. **Never expose private keys in logs**
   - All servers are designed to never log sensitive data
   - Don't enable debug logging in production

2. **Use test networks for development**
   ```json
   {
     "env": { "DEFAULT_CHAIN": "11155111" }  // Sepolia
   }
   ```

3. **Limit server access**
   - Run servers with minimum required permissions
   - Use separate configurations for dev vs production

4. **Rotate test keys**
   - Never use the same keys in development and production
   - Treat any key used in testing as compromised

### Performance

1. **Start only needed servers**
   - Don't configure all 5 if you only need 2
   - Reduces memory usage and startup time

2. **Use server restart sparingly**
   - Servers maintain no state between calls
   - No need to restart for new operations

3. **Batch operations when possible**
   - Use `batch_validate_addresses` instead of validating one at a time
   - Use `derive_multiple_accounts` instead of deriving individually

### Reliability

1. **Check server health**
   ```bash
   # Verify server starts
   timeout 5 ethereum-wallet-mcp && echo "OK" || echo "FAILED"
   ```

2. **Handle errors gracefully**
   - All tools return `{"error": true, "message": "..."}` on failure
   - Never assume operations succeed

3. **Validate outputs**
   - Always verify addresses before sending funds
   - Cross-check signatures with other tools

### Maintenance

1. **Keep servers updated**
   ```bash
   pip install --upgrade ethereum-wallet-toolkit
   ```

2. **Monitor for security updates**
   - Watch repository for security advisories
   - Update cryptographic dependencies promptly

3. **Test after updates**
   ```bash
   ./run_all_tests.sh
   ```

---

## Troubleshooting

### Server Won't Start

```bash
# Check if installed
which ethereum-wallet-mcp

# Check Python path
python -c "import ethereum_wallet_mcp; print('OK')"

# Run with debug output
PYTHONUNBUFFERED=1 ethereum-wallet-mcp 2>&1 | head -20
```

### Claude Doesn't See Tools

1. Restart Claude Desktop after config changes
2. Check config file is valid JSON
3. Verify server path is correct
4. Check Claude Desktop logs for errors

### Permission Errors

```bash
# Make server executable
chmod +x $(which ethereum-wallet-mcp)

# Check file permissions for keystores
ls -la ~/.ethereum/keystore/
```

### Import Errors

```bash
# Reinstall dependencies
pip install -e "./ethereum-wallet-mcp[dev]" --force-reinstall

# Clear caches
find . -type d -name '__pycache__' -exec rm -rf {} +
```

---

## Version Compatibility

| Component | Minimum Version |
|-----------|-----------------|
| Python | 3.10+ |
| MCP SDK | 1.0.0+ |
| eth-account | 0.11.0+ |
| eth-utils | 4.0.0+ |
| Claude Desktop | Latest |

---

## Getting Help

- **Documentation**: Check the [docs/](../docs) directory
- **Issues**: Open a GitHub issue
- **Tests**: Run `./run_all_tests.sh` to verify installation
- **Examples**: See [PROMPT_EXAMPLES.md](PROMPT_EXAMPLES.md)
