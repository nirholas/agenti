# Ethereum Wallet MCP Server

[![PyPI](https://img.shields.io/pypi/v/ethereum-wallet-mcp)](https://pypi.org/project/ethereum-wallet-mcp/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)

<!-- mcp-name: io.github.nirholas/ethereum-wallet-mcp -->

A Model Context Protocol (MCP) server providing Ethereum wallet generation and HD wallet functionality. This server enables AI assistants like Claude to securely generate Ethereum wallets, work with BIP39 mnemonics, and derive multiple accounts from a single seed phrase.

## Features

### Tools

- **`generate_wallet`** - Generate a new random Ethereum wallet
- **`generate_wallet_with_mnemonic`** - Generate a wallet with BIP39 seed phrase
- **`restore_wallet_from_mnemonic`** - Restore wallet from existing mnemonic
- **`restore_wallet_from_private_key`** - Restore wallet from private key
- **`derive_multiple_accounts`** - Derive multiple HD wallet accounts
- **`generate_vanity_address`** - Generate address matching a pattern

### Prompts

- **`create_secure_wallet`** - Guided secure wallet creation
- **`backup_wallet_guide`** - Wallet backup instructions
- **`recover_wallet_help`** - Wallet recovery assistance

### Resources

- **`wallet://documentation/bip39`** - BIP39 standard documentation
- **`wallet://documentation/derivation-paths`** - HD derivation path docs
- **`wallet://wordlist/{language}`** - BIP39 wordlists by language

## Installation

```bash
# Install from source
pip install -e .

# Or with dev dependencies
pip install -e ".[dev]"
```

## Usage

### Running the Server

```bash
# Run directly
ethereum-wallet-mcp

# Or via Python
python -m ethereum_wallet_mcp.server
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "ethereum-wallet-mcp"
    }
  }
}
```

### Example Interactions

```
User: "Generate a new Ethereum wallet for me"
→ Returns: address, private_key, public_key

User: "Create a wallet with a 24-word seed phrase"
→ Returns: address, private_key, mnemonic (24 words), derivation_path

User: "Restore my wallet from this seed: abandon abandon abandon..."
→ Returns: restored wallet details

User: "Derive 10 accounts from my seed phrase"
→ Returns: list of 10 accounts with addresses and keys

User: "Generate a vanity address starting with 'cafe'"
→ Returns: matching address with generation stats
```

## Security Considerations

⚠️ **IMPORTANT SECURITY WARNINGS:**

1. **Never share private keys or mnemonic phrases** - These give full access to funds
2. **This server does not persist sensitive data** - Keys exist only in memory during operation
3. **Use hardware wallets for real funds** - Software wallets are inherently less secure
4. **Vanity addresses carry risks** - Never use for high-value storage
5. **Verify addresses independently** - Always double-check derived addresses

## Development

### Running Tests

```bash
pytest tests/ -v
```

### Code Formatting

```bash
black src/ tests/
isort src/ tests/
```

### Type Checking

```bash
mypy src/
```

## API Reference

### Tool: generate_wallet

Generate a new random Ethereum wallet with no mnemonic.

**Parameters:** None

**Returns:**
- `address` (str): Checksummed Ethereum address
- `private_key` (str): Hex-encoded private key (0x prefixed)
- `public_key` (str): Hex-encoded public key

### Tool: generate_wallet_with_mnemonic

Generate a new wallet with BIP39 mnemonic seed phrase.

**Parameters:**
- `word_count` (int, optional): 12, 15, 18, 21, or 24. Default: 12
- `language` (str, optional): Mnemonic language. Default: "english"
- `passphrase` (str, optional): BIP39 passphrase. Default: ""
- `derivation_path` (str, optional): HD path. Default: "m/44'/60'/0'/0/0"

**Returns:**
- `address`, `private_key`, `public_key`
- `mnemonic` (str): Space-separated seed words
- `derivation_path` (str): Path used
- `passphrase_used` (bool): Whether passphrase was applied

### Tool: restore_wallet_from_mnemonic

Restore a wallet from an existing BIP39 mnemonic.

**Parameters:**
- `mnemonic` (str, required): Space-separated mnemonic phrase
- `passphrase` (str, optional): BIP39 passphrase. Default: ""
- `derivation_path` (str, optional): HD path. Default: "m/44'/60'/0'/0/0"

**Returns:** Same as `generate_wallet_with_mnemonic` (without mnemonic field)

### Tool: restore_wallet_from_private_key

Restore a wallet from a private key.

**Parameters:**
- `private_key` (str, required): Hex private key (with or without 0x prefix)

**Returns:**
- `address`, `private_key` (normalized), `public_key`

### Tool: derive_multiple_accounts

Derive multiple accounts from a single mnemonic.

**Parameters:**
- `mnemonic` (str, required): BIP39 mnemonic
- `count` (int, optional): Number of accounts (1-100). Default: 5
- `start_index` (int, optional): Starting index. Default: 0
- `passphrase` (str, optional): BIP39 passphrase. Default: ""
- `base_path` (str, optional): Base HD path. Default: "m/44'/60'/0'/0"

**Returns:**
- `accounts` (list): List of {index, derivation_path, address, private_key, public_key}
- `total_derived` (int): Number of accounts derived
- `base_path` (str): Base path used

### Tool: generate_vanity_address

Generate an address matching a vanity pattern.

**Parameters:**
- `prefix` (str, optional): Desired prefix after 0x (hex chars)
- `suffix` (str, optional): Desired suffix (hex chars)
- `case_sensitive` (bool, optional): Match case exactly. Default: false
- `timeout_seconds` (int, optional): Max search time. Default: 60

**Returns:**
- `address`, `private_key`, `public_key`
- `pattern_matched` (str): Matched pattern
- `attempts` (int): Addresses tried
- `time_seconds` (float): Time taken
- `difficulty` (int): Estimated 1-in-N difficulty

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please read the contributing guidelines and submit pull requests.
