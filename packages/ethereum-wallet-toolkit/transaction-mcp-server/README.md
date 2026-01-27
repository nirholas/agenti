# Transaction MCP Server

[![PyPI](https://img.shields.io/pypi/v/transaction-mcp-server)](https://pypi.org/project/transaction-mcp-server/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)

<!-- mcp-name: io.github.nirholas/transaction-mcp-server -->

An MCP (Model Context Protocol) server providing comprehensive Ethereum transaction capabilities including building, signing, decoding, and analysis for both legacy and EIP-1559 transactions.

## Features

### Tools (15 total)

#### Transaction Building & Signing
- **build_transaction** - Build an unsigned transaction
- **sign_transaction** - Sign a transaction with a private key
- **build_and_sign_transaction** - Build and sign in one step

#### Transaction Decoding
- **decode_raw_transaction** - Decode a signed raw transaction
- **decode_unsigned_transaction** - Decode an unsigned transaction
- **recover_transaction_signer** - Recover signer from signed transaction

#### Transaction Analysis
- **estimate_transaction_cost** - Estimate gas cost in ETH
- **validate_transaction** - Validate transaction fields
- **compare_transactions** - Compare two transactions

#### Gas Utilities
- **convert_gas_units** - Convert between wei, gwei, ether
- **calculate_max_cost** - Calculate maximum transaction cost

#### Data Encoding
- **encode_transfer** - Encode ERC-20 transfer calldata
- **encode_function_call** - Encode arbitrary function call
- **decode_calldata** - Decode transaction input data

#### Serialization
- **serialize_transaction** - RLP encode a transaction

### Resources (4 total)
- **transaction-types** - Documentation on transaction types (Legacy, EIP-2930, EIP-1559)
- **gas-estimation** - Guide to gas estimation and optimization
- **chain-ids** - Chain ID reference for all networks
- **eip-1559** - EIP-1559 fee mechanism explained

### Prompts (4 total)
- **build_transfer_workflow** - Guide through building an ETH transfer
- **token_transfer_workflow** - Guide through ERC-20 token transfers
- **decode_transaction_workflow** - Help decode and analyze transactions
- **gas_optimization_workflow** - Optimize transaction gas costs

## Installation

```bash
pip install transaction-mcp-server
```

Or install from source:

```bash
cd transaction-mcp-server
pip install -e .
```

## Usage

### Run the server

```bash
transaction-mcp-server
```

### Configure in Claude Desktop

```json
{
  "mcpServers": {
    "transaction": {
      "command": "transaction-mcp-server"
    }
  }
}
```

## Tool Examples

### Sign a Simple Transfer

```python
# Input
{
    "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f5b4E2",
    "value": "1000000000000000000",  # 1 ETH in wei
    "nonce": 0,
    "chain_id": 1,
    "max_fee_per_gas": "30000000000",
    "max_priority_fee_per_gas": "2000000000",
    "private_key": "0x..."
}

# Output
{
    "raw_transaction": "0x02f8...",
    "transaction_hash": "0x...",
    "from": "0xABC...",
    "to": "0x742...",
    "value_eth": "1.0",
    "type": "EIP-1559"
}
```

### Decode a Transaction

```python
# Input
{
    "raw_transaction": "0x02f8..."
}

# Output
{
    "type": "EIP-1559 (Type 2)",
    "chain_id": 1,
    "nonce": 0,
    "to": "0x742...",
    "value_wei": "1000000000000000000",
    "value_eth": "1.0",
    "max_fee_per_gas_gwei": "30.0",
    "max_priority_fee_per_gas_gwei": "2.0"
}
```

## Transaction Types

| Type | EIP | Description |
|------|-----|-------------|
| Legacy (0) | - | Original Ethereum transactions |
| Access List (1) | EIP-2930 | With access list for gas savings |
| Dynamic Fee (2) | EIP-1559 | Base fee + priority fee model |

## Security Notes

1. **Private keys are NEVER logged or persisted**
2. **Transactions are signed OFFLINE** - no network connection
3. **Raw transactions must be broadcast separately**
4. **For educational and development purposes only**

## Chain IDs

| Chain | ID |
|-------|-----|
| Ethereum Mainnet | 1 |
| Goerli | 5 |
| Sepolia | 11155111 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Optimism | 10 |
| Base | 8453 |

## License

MIT
