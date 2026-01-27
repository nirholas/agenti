"""
Chain IDs Resources

Documentation about Ethereum chain IDs.
"""

from mcp.server import Server


CHAIN_IDS_CONTENT = """
# Ethereum Chain IDs

## Mainnet and Major Networks

| Chain | Chain ID | Currency | Type |
|-------|----------|----------|------|
| Ethereum Mainnet | 1 | ETH | Production |
| Goerli Testnet | 5 | GoerliETH | Testnet (deprecated) |
| Sepolia Testnet | 11155111 | SepoliaETH | Testnet |
| Holesky Testnet | 17000 | HoleskyETH | Testnet |

## Layer 2 Networks

| Chain | Chain ID | Currency | Type |
|-------|----------|----------|------|
| Arbitrum One | 42161 | ETH | L2 |
| Arbitrum Nova | 42170 | ETH | L2 |
| Arbitrum Goerli | 421613 | ArbGoerliETH | L2 Testnet |
| Optimism | 10 | ETH | L2 |
| Optimism Goerli | 420 | GoerliETH | L2 Testnet |
| Base | 8453 | ETH | L2 |
| Base Goerli | 84531 | GoerliETH | L2 Testnet |
| zkSync Era | 324 | ETH | L2 |
| Polygon zkEVM | 1101 | ETH | L2 |

## Other EVM Chains

| Chain | Chain ID | Currency | Type |
|-------|----------|----------|------|
| BNB Smart Chain | 56 | BNB | Production |
| BNB Testnet | 97 | tBNB | Testnet |
| Polygon | 137 | MATIC | Production |
| Polygon Mumbai | 80001 | MATIC | Testnet |
| Avalanche C-Chain | 43114 | AVAX | Production |
| Avalanche Fuji | 43113 | AVAX | Testnet |
| Fantom | 250 | FTM | Production |
| Gnosis | 100 | xDAI | Production |

## Historical Testnets (Deprecated)

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ropsten | 3 | Deprecated |
| Rinkeby | 4 | Deprecated |
| Kovan | 42 | Deprecated |

## Importance of Chain ID

### Replay Protection

Chain ID prevents transaction replay attacks between networks:
- A transaction signed for Ethereum mainnet (chain ID 1) won't work on Polygon (chain ID 137)
- EIP-155 introduced chain ID in transaction signing

### In Transaction Signing

Legacy (pre-EIP-155):
```
sign(keccak256(rlp([nonce, gasPrice, gasLimit, to, value, data])))
```

EIP-155 (with chain ID):
```
sign(keccak256(rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])))
```

### Recovery (v value)

For EIP-155 transactions:
```
v = chainId * 2 + 35 + recovery_id
```

To recover chain ID:
```
chainId = (v - 35) / 2  (if v >= 35)
```

## Best Practices

1. **Always specify chain ID** in transaction objects
2. **Verify chain ID** matches expected network before signing
3. **Use testnet chain IDs** for development
4. **Check chain ID** from RPC before broadcasting

## RPC Methods

Get chain ID from node:
```javascript
eth_chainId  // Returns hex-encoded chain ID
```

Example:
```
"0x1" -> 1 (Mainnet)
"0x89" -> 137 (Polygon)
```
"""


def register_chain_resources(server: Server) -> None:
    """Register chain ID documentation resources."""
    
    @server.resource("transaction://chains/ids")
    async def get_chain_ids() -> str:
        """
        Reference for Ethereum and EVM-compatible chain IDs.
        """
        return CHAIN_IDS_CONTENT
