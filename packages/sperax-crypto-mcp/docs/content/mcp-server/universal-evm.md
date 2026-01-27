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
- IoTeX
- + All testnets

---

## Core Modules

| Module | Description |
|--------|-------------|
| **Blocks** | Query and manage blockchain blocks |
| **Contracts** | Interact with smart contracts |
| **Network** | Network information and management |
| **NFT** | NFT (ERC721/ERC1155) operations |
| **Tokens** | Token (ERC20) operations |
| **Transactions** | Transaction management |
| **Wallet** | Wallet operations and management |
| **Common** | Shared utilities and types |

---

## Integration with Cursor

To connect to the MCP server from Cursor:

1. Open Cursor and go to Settings (gear icon in the top right)
2. Click on "MCP" in the left sidebar
3. Click "Add new global MCP server"
4. Enter the following details:

### Default mode

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

### SSE mode

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest", "--sse"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here (optional)"
      }
    }
  }
}
```

---

## Integration with Claude Desktop

To connect to the MCP server from Claude Desktop:

1. Open Claude Desktop and go to Settings
2. Click on "Developer" in the left sidebar
3. Click the "Edit Config" Button
4. Add the following configuration to the `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        "PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

5. Save the file and restart Claude Desktop

Once connected, you can use all the MCP prompts and tools directly in your Claude Desktop conversations. For example:

- "Analyze this address: 0x123..."
- "Explain the EVM concept of gas"
- "Check the latest block on BSC"

---

## Local Development

### Prerequisites

- [bun](http://bun.sh/) v1.2.10 or higher
- [Node.js](https://nodejs.org/en/download) v17 or higher

### Quick Start

1. Clone the repository:

```bash
git clone https://github.com/nirholas/universal-crypto-mcp.git
cd universal-crypto-mcp
```

2. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Your wallet private key (required for transaction operations) |
| `LOG_LEVEL` | Set logging level (DEBUG, INFO, WARN, ERROR) |
| `PORT` | Server port number (default: 3001) |

3. Install dependencies and start development server:

```bash
# Install project dependencies
bun install

# Start the development server
bun dev:sse
```

### Testing with MCP Clients

Configure the local server in your MCP clients using this template:

```json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "url": "http://localhost:3001/sse",
      "env": {
        "PRIVATE_KEY": "your_private_key_here"
      }
    }
  }
}
```

### Testing with Web UI

We use [`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) for testing. Launch the test UI:

```bash
bun run test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun dev:sse` | Start development server with hot reload |
| `bun build` | Build the project |
| `bun test` | Run test suite |

---

## Prompts

| Name | Description |
|------|-------------|
| `analyze_block` | Analyze a block and provide detailed information about its contents |
| `analyze_transaction` | Analyze a specific transaction |
| `analyze_address` | Analyze an EVM address |
| `interact_with_contract` | Get guidance on interacting with a smart contract |
| `explain_evm_concept` | Get an explanation of an EVM concept |
| `compare_networks` | Compare different EVM-compatible networks |
| `analyze_token` | Analyze an ERC20 or NFT token |

---

## Tools

### Block Tools

| Name | Description |
|------|-------------|
| `get_block_by_hash` | Get a block by hash |
| `get_block_by_number` | Get a block by number |
| `get_latest_block` | Get the latest block |

### Transaction Tools

| Name | Description |
|------|-------------|
| `get_transaction` | Get detailed information about a specific transaction by its hash |
| `get_transaction_receipt` | Get a transaction receipt by its hash |
| `estimate_gas` | Estimate the gas cost for a transaction |

### Transfer Tools

| Name | Description |
|------|-------------|
| `transfer_native_token` | Transfer native tokens (BNB, ETH, MATIC, etc.) to an address |
| `approve_token_spending` | Approve another address to spend your ERC20 tokens |
| `transfer_nft` | Transfer an NFT (ERC721 token) from one address to another |
| `transfer_erc1155` | Transfer ERC1155 tokens to another address |
| `transfer_erc20` | Transfer ERC20 tokens to an address |

### Wallet Tools

| Name | Description |
|------|-------------|
| `get_address_from_private_key` | Get the EVM address derived from a private key |

### Network Tools

| Name | Description |
|------|-------------|
| `get_chain_info` | Get chain information for a specific network |
| `get_supported_networks` | Get list of supported networks |
| `resolve_ens` | Resolve an ENS name to an EVM address |

### Contract Tools

| Name | Description |
|------|-------------|
| `is_contract` | Check if an address is a smart contract or an externally owned account (EOA) |
| `read_contract` | Read data from a smart contract by calling a view/pure function |
| `write_contract` | Write data to a smart contract by calling a state-changing function |

### Token Tools

| Name | Description |
|------|-------------|
| `get_erc20_token_info` | Get ERC20 token information |
| `get_native_balance` | Get native token balance for an address |
| `get_erc20_balance` | Get ERC20 token balance for an address |

### NFT Tools

| Name | Description |
|------|-------------|
| `get_nft_info` | Get detailed information about a specific NFT |
| `check_nft_ownership` | Check if an address owns a specific NFT |
| `get_erc1155_token_metadata` | Get the metadata for an ERC1155 token |
| `get_nft_balance` | Get the total number of NFTs owned by an address from a specific collection |
| `get_erc1155_balance` | Get the balance of a specific ERC1155 token ID owned by an address |

---

## Related Resources

- [EVM Module](evm-module.md) - General EVM operations

---

## What's Next?

<div class="grid cards" markdown>

-   :material-ethereum:{ .lg .middle } **EVM Module**

    ---

    Simplified EVM tools for common operations

    [:octicons-arrow-right-24: EVM Module](evm-module.md)

-   :material-wrench:{ .lg .middle } **Sperax Tools**

    ---

    Protocol-specific tools for USDs, SPA, Demeter

    [:octicons-arrow-right-24: Tools Reference](tools.md)

-   :material-code-braces:{ .lg .middle } **Development**

    ---

    Contribute and extend the MCP server

    [:octicons-arrow-right-24: Dev Guide](development.md)

</div>

---

## Credits

Built by **[nich](https://x.com/nichxbt)** ([:material-github: nirholas](https://github.com/nirholas))
