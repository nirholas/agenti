# Universal EVM MCP

A powerful toolkit for interacting with EVM-compatible networks through natural language processing and AI assistance.

---

## Overview

Universal EVM MCP enables seamless interaction with blockchain networks through AI-powered interfaces. It provides a comprehensive set of tools and resources for blockchain development, smart contract interaction, and network management.

**Supported Networks:**

- BNB Smart Chain (BSC)
- opBNB
- Arbitrum
- Ethereum
- Polygon
- Base
- Optimism
- + All testnets

---

## Core Modules

| Module | Description |
|--------|-------------|
| **Blocks** | Query and manage blockchain blocks |
| **Bridge** | Cross-chain transfers |
| **Contracts** | Interact with smart contracts |
| **Events** | Query and decode event logs |
| **Gas** | Gas price monitoring and optimization |
| **Governance** | DAO proposals and voting |
| **Lending** | DeFi lending protocols |
| **Multicall** | Batch operations |
| **Network** | Network information |
| **NFT** | NFT (ERC721/ERC1155) operations |
| **Portfolio** | Track holdings across chains |
| **Price Feeds** | Token prices and oracles |
| **Security** | Token and contract security checks |
| **Signatures** | Message signing and verification |
| **Staking** | Staking operations |
| **Swap** | DEX aggregator swaps |
| **Tokens** | Token (ERC20) operations |
| **Transactions** | Transaction management |
| **Wallet** | Wallet operations |

---

## Integration with Cursor

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## Integration with Claude Desktop

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## Local Development

```bash
git clone https://github.com/nirholas/universal-crypto-mcp
cd universal-crypto-mcp
bun install
bun dev:sse
```

---

## Available Tools

### Block Tools

| Name | Description |
|------|-------------|
| `get_block_by_hash` | Get a block by hash |
| `get_block_by_number` | Get a block by number |
| `get_latest_block` | Get the latest block |

### Transaction Tools

| Name | Description |
|------|-------------|
| `get_transaction` | Get transaction by hash |
| `get_transaction_receipt` | Get transaction receipt |
| `estimate_gas` | Estimate gas cost |

### Token Tools

| Name | Description |
|------|-------------|
| `get_erc20_token_info` | Get ERC20 token information |
| `get_native_balance` | Get native token balance |
| `get_erc20_balance` | Get ERC20 token balance |
| `transfer_native_token` | Transfer native tokens |
| `transfer_erc20` | Transfer ERC20 tokens |
| `approve_token_spending` | Approve token spending |

### NFT Tools

| Name | Description |
|------|-------------|
| `get_nft_info` | Get NFT information |
| `check_nft_ownership` | Check NFT ownership |
| `get_nft_balance` | Get NFT balance |
| `transfer_nft` | Transfer NFT |
| `get_erc1155_balance` | Get ERC1155 balance |
| `transfer_erc1155` | Transfer ERC1155 tokens |

### Contract Tools

| Name | Description |
|------|-------------|
| `read_contract` | Read from contract |
| `write_contract` | Write to contract |
| `is_contract` | Check if address is contract |

### Network Tools

| Name | Description |
|------|-------------|
| `get_chain_info` | Get chain information |
| `get_supported_networks` | List supported networks |
| `resolve_ens` | Resolve ENS name |

### Wallet Tools

| Name | Description |
|------|-------------|
| `get_address_from_private_key` | Get address from private key |

---

## Related Resources

- [EVM Module](evm-module.md) - General EVM operations

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([:material-github: nirholas](https://github.com/nirholas))
