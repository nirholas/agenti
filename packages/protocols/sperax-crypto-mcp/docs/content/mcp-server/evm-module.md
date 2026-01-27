# EVM Module

General Ethereum Virtual Machine tools for blockchain interaction.

!!! info "Looking for something else?"
    - **Sperax-specific tools?** → [Tools Reference](tools.md)
    - **More chains and features?** → [Universal EVM](universal-evm.md)
    - **Contract addresses/ABIs?** → [Contracts](../contracts/index.md)

---

## Overview

The EVM module provides universal tools for interacting with EVM-compatible blockchains. These tools work across multiple networks including Arbitrum, Ethereum, BSC, Polygon, and more.

---

## Blocks

Query block data from the blockchain.

### get_block

Get block information by number or hash.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| blockNumber | number | No | Block number |
| blockHash | string | No | Block hash |
| network | string | No | Network (default: arbitrum) |

**Returns:**
```json
{
  "number": 12345678,
  "hash": "0x...",
  "timestamp": 1234567890,
  "gasUsed": "15000000",
  "gasLimit": "30000000",
  "transactions": 150,
  "miner": "0x..."
}
```

---

### get_latest_block

Get the latest block.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network name |

---

### get_block_transactions

Get all transactions in a block.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| blockNumber | number | Yes | Block number |
| network | string | No | Network name |

---

## Contracts

Read smart contract state.

### read_contract

Call a read-only contract function.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Contract address |
| abi | array | Yes | Contract ABI |
| functionName | string | Yes | Function to call |
| args | array | No | Function arguments |
| network | string | No | Network name |

**Returns:**
```json
{
  "result": "1000000000000000000"
}
```

---

### get_contract_code

Get contract bytecode.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Contract address |
| network | string | No | Network name |

---

### verify_contract

Check if an address is a contract.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Address to check |
| network | string | No | Network name |

---

## Tokens

ERC20 token operations.

### get_erc20_token_info

Get token metadata.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | string | Yes | Token contract address |
| network | string | No | Network name |

**Returns:**
```json
{
  "name": "USD Coin",
  "symbol": "USDC",
  "decimals": 6,
  "totalSupply": "50000000000000"
}
```

---

### get_erc20_balance

Get token balance for an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| tokenAddress | string | Yes | Token contract |
| address | string | Yes | Wallet address |
| network | string | No | Network name |

**Returns:**
```json
{
  "balance": "1000000000",
  "formatted": "1000.00",
  "symbol": "USDC"
}
```

---

### get_native_balance

Get native token balance (ETH, BNB, etc.).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| network | string | No | Network name |

---

### create_erc20_token

Deploy a new ERC20 token.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Token name |
| symbol | string | Yes | Token symbol |
| network | string | No | Network name |
| privateKey | string | Yes | Deployer private key |

⚠️ **Requires private key for transaction signing.**

---

## NFT

ERC721/ERC1155 NFT operations.

### get_nft_info

Get NFT collection info.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | NFT contract |
| network | string | No | Network name |

**Returns:**
```json
{
  "name": "Bored Ape Yacht Club",
  "symbol": "BAYC",
  "totalSupply": 10000,
  "type": "ERC721"
}
```

---

### get_nft_owner

Get owner of a specific NFT.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | NFT contract |
| tokenId | string | Yes | Token ID |
| network | string | No | Network name |

---

### get_nft_metadata

Get NFT metadata (name, image, attributes).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| contractAddress | string | Yes | NFT contract |
| tokenId | string | Yes | Token ID |
| network | string | No | Network name |

---

### get_nfts_by_owner

Get all NFTs owned by an address.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| ownerAddress | string | Yes | Owner wallet |
| contractAddress | string | No | Filter by collection |
| network | string | No | Network name |

---

## Wallet

Wallet and balance operations.

### get_wallet_balance

Get all balances for a wallet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| network | string | No | Network name |

---

### get_wallet_transactions

Get recent transactions for a wallet.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| address | string | Yes | Wallet address |
| limit | number | No | Max transactions |
| network | string | No | Network name |

---

## Transactions

Transaction operations.

### get_transaction

Get transaction details by hash.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| txHash | string | Yes | Transaction hash |
| network | string | No | Network name |

**Returns:**
```json
{
  "hash": "0x...",
  "from": "0x...",
  "to": "0x...",
  "value": "1000000000000000000",
  "gasUsed": "21000",
  "status": "success",
  "blockNumber": 12345678
}
```

---

### get_transaction_receipt

Get transaction receipt with logs.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| txHash | string | Yes | Transaction hash |
| network | string | No | Network name |

---

### estimate_gas

Estimate gas for a transaction.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| to | string | Yes | Recipient address |
| data | string | No | Transaction data |
| value | string | No | ETH value |
| network | string | No | Network name |

---

## Network

Network information.

### get_network_info

Get current network details.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network name |

**Returns:**
```json
{
  "name": "Arbitrum One",
  "chainId": 42161,
  "blockNumber": 12345678,
  "gasPrice": "0.1"
}
```

---

### get_gas_price

Get current gas price.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| network | string | No | Network name |

---

## Supported Networks

| Network | Chain ID | Native Token |
|---------|----------|--------------|
| arbitrum | 42161 | ETH |
| ethereum | 1 | ETH |
| bsc | 56 | BNB |
| polygon | 137 | MATIC |
| optimism | 10 | ETH |
| avalanche | 43114 | AVAX |
| base | 8453 | ETH |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Default private key for write operations |
| `RPC_URL_ARBITRUM` | Custom Arbitrum RPC |
| `RPC_URL_ETHEREUM` | Custom Ethereum RPC |

---

## What's Next?

<div class="grid cards" markdown>

-   :material-link-variant:{ .lg .middle } **Universal EVM**

    ---

    Full multi-chain toolkit with more networks

    [:octicons-arrow-right-24: Universal EVM](universal-evm.md)

-   :material-wrench:{ .lg .middle } **Sperax Tools**

    ---

    Protocol-specific tools for USDs, SPA, Demeter

    [:octicons-arrow-right-24: Tools Reference](tools.md)

-   :material-file-code:{ .lg .middle } **Contract ABIs**

    ---

    Smart contract interfaces and addresses

    [:octicons-arrow-right-24: Contracts](../contracts/index.md)

</div>
