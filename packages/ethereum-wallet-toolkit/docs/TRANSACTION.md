# Offline Transaction Signing

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

This document covers the offline transaction signing features of the Ethereum Wallet Toolkit.

## Overview

Offline transaction signing allows you to create and sign transactions without an internet connection. This is essential for:

- **Air-gapped wallets**: Sign on an offline computer
- **Cold storage**: Keep private keys never exposed to the internet
- **Batch transactions**: Prepare multiple transactions for later broadcast
- **Deterministic testing**: Create known transactions for testing

## Transaction Types

### Legacy Transactions (Type 0)

Pre-EIP-1559 transactions with a single `gasPrice` field.

```bash
python transaction.py sign \
  --to 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA \
  --ether 1.5 \
  --nonce 0 \
  --gas-price 20000000000 \
  --key 0xaaa...
```

### EIP-1559 Transactions (Type 2)

Modern transactions with `maxFeePerGas` and `maxPriorityFeePerGas`.

```bash
python transaction.py sign \
  --to 0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB \
  --ether 1.5 \
  --nonce 0 \
  --max-fee 30000000000 \
  --priority-fee 2000000000 \
  --key 0xaaa...
```

## CLI Usage

### Basic Transfer

```bash
# Simple ETH transfer (EIP-1559, uses defaults)
python transaction.py sign \
  --to 0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC \
  --ether 0.5 \
  --nonce 0 \
  --key 0xaaa...

# Value in Wei
python transaction.py sign \
  --to 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA \
  --value 500000000000000000 \
  --nonce 0 \
  --key 0xaaa...
```

### Contract Interaction

```bash
# ERC-20 transfer (data is the encoded function call)
python transaction.py sign \
  --to 0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB \
  --value 0 \
  --nonce 5 \
  --gas 65000 \
  --data 0xa9059cbb000000000000000000000000... \
  --key 0xaaa...
```

### Different Networks

```bash
# Ethereum Mainnet (default)
python transaction.py sign ... --chain-id 1

# Polygon
python transaction.py sign ... --chain-id 137

# Arbitrum
python transaction.py sign ... --chain-id 42161

# Optimism
python transaction.py sign ... --chain-id 10

# Sepolia Testnet
python transaction.py sign ... --chain-id 11155111
```

### Decode Transactions

```bash
# Decode a signed raw transaction
python transaction.py decode --raw 0x02f873...

# Output:
# Type:            EIP-1559 (Type 2)
# Chain Id:        1
# Nonce:           5
# Max Fee Per Gas: 30000000000
# ...
```

### Recover Signer

```bash
# Recover the signer address from a raw transaction
python transaction.py recover --raw 0x02f873...

# Output:
# Signer Address: 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

## Parameters Explained

### Required Parameters

| Parameter | Description |
|-----------|-------------|
| `--to` | Recipient address (or contract address) |
| `--nonce` | Transaction counter (must match on-chain value) |
| `--key` | Your private key |

### Value Parameters

| Parameter | Description |
|-----------|-------------|
| `--ether` | Value in Ether (e.g., 1.5) |
| `--value` | Value in Wei (e.g., 1500000000000000000) |

### Gas Parameters (EIP-1559)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--max-fee` | Maximum total fee per gas (Wei) | 30 Gwei |
| `--priority-fee` | Tip for validators (Wei) | 2 Gwei |
| `--gas` | Gas limit | 21000 |

### Gas Parameters (Legacy)

| Parameter | Description |
|-----------|-------------|
| `--gas-price` | Gas price in Wei |
| `--gas` | Gas limit |

### Other Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--chain-id` | Network chain ID | 1 (mainnet) |
| `--data` | Hex-encoded call data | 0x |
| `--output` | Save to JSON file | - |

## Chain IDs

| Network | Chain ID |
|---------|----------|
| Ethereum Mainnet | 1 |
| Goerli Testnet | 5 |
| Sepolia Testnet | 11155111 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Optimism | 10 |
| Base | 8453 |
| Avalanche C-Chain | 43114 |
| BNB Smart Chain | 56 |

## Python API

```python
from transaction import (
    sign_transaction,
    decode_transaction,
    recover_transaction_signer,
    GWEI,
    ETHER
)

# Sign a transaction
result = sign_transaction(
    to='0x742d35Cc6634C0532925a3b844Bc9e7595f...',
    value=int(0.5 * ETHER),
    nonce=0,
    gas=21000,
    chain_id=1,
    max_fee_per_gas=30 * GWEI,
    max_priority_fee_per_gas=2 * GWEI,
    private_key='0x...'
)

print(f"Raw TX: {result['raw_transaction']}")
print(f"TX Hash: {result['transaction_hash']}")

# Decode a transaction
decoded = decode_transaction('0x02f873...')
print(f"To: {decoded['to']}")
print(f"Value: {decoded['value_ether']} ETH")

# Recover signer
signer = recover_transaction_signer('0x02f873...')
print(f"Signer: {signer}")
```

## Workflow: Air-Gapped Signing

### Step 1: Get Nonce (Online)

On your online computer:
```bash
curl -X POST https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionCount","params":["YOUR_ADDRESS","latest"],"id":1}'
```

### Step 2: Sign (Offline)

On your air-gapped computer:
```bash
python transaction.py sign \
  --to 0x742d35Cc6634C0532925a3b844Bc9e7595f... \
  --ether 1.0 \
  --nonce 5 \
  --max-fee 30000000000 \
  --priority-fee 2000000000 \
  --key 0x... \
  --output signed_tx.json
```

### Step 3: Broadcast (Online)

Transfer the signed transaction via USB and broadcast:
```bash
curl -X POST https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_sendRawTransaction","params":["0x02f873..."],"id":1}'
```

## Gas Estimation Guidelines

### Simple ETH Transfer
- Gas Limit: 21000 (exact)

### ERC-20 Token Transfer
- Gas Limit: 65000 - 100000

### Uniswap Swap
- Gas Limit: 150000 - 300000

### NFT Mint
- Gas Limit: 100000 - 500000

### Complex DeFi
- Gas Limit: 300000 - 1000000

## Best Practices

### Security

1. **Air-gap signing**: Keep private keys on offline computer
2. **Verify addresses**: Double-check recipient before signing
3. **Test on testnet**: Always test transactions on Sepolia first
4. **Check chain ID**: Wrong chain ID can lead to replay attacks

### Gas Management

1. **Check current gas prices**: Use etherscan.io/gastracker
2. **Set reasonable max fee**: Don't overpay during low congestion
3. **Include priority fee**: Ensures timely inclusion

### Nonce Management

1. **Get fresh nonce**: Always query right before signing
2. **Don't skip nonces**: Transactions must be sequential
3. **Replace stuck tx**: Use same nonce with higher gas

## Error Handling

### Invalid Nonce
```
Error: nonce too low
```
Solution: Get the current nonce from the blockchain

### Insufficient Funds
```
Error: insufficient funds for gas * price + value
```
Solution: Ensure balance covers value + (gas * maxFeePerGas)

### Gas Too Low
```
Error: intrinsic gas too low
```
Solution: Increase gas limit (minimum 21000 for transfers)

## Testing

Always verify transactions before broadcasting:

```bash
# 1. Sign the transaction
python transaction.py sign --to 0x... --ether 0.1 --nonce 0 --key 0x...

# 2. Decode to verify
python transaction.py decode --raw 0x02f873...

# 3. Recover signer to verify key
python transaction.py recover --raw 0x02f873...
```
