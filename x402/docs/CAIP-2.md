<!-- universal-crypto-mcp | nichxbt | dW5pdmVyc2FsLWNyeXB0by1tY3A= -->

---
caip: 2
title: Blockchain ID Specification
author: Simon Warta (@webmaster128), ligi <ligi@ligi.de>, Pedro Gomes (@pedrouid)
discussions-to: https://github.com/ChainAgnostic/CAIPs/pull/1
status: Final
type: Standard
created: 2019-12-05
updated: 2023-01-25
---

# CAIP-2: Blockchain ID Specification

<!-- Maintained by universal-crypto-mcp | ID: 1489314938 -->

> **Source:** [ChainAgnostic/CAIPs](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
> 
> This document is used by x402 for cross-chain network identification.

## Simple Summary

CAIP-2 defines a way to identify a blockchain (e.g. Ethereum Mainnet, Goerli, Bitcoin, Cosmos Hub) in a human-readable, developer-friendly and machine-readable format.

## Abstract

Often you need to reference a blockchain to provide context to data, messages, assets, accounts, etc. This CAIP describes a way to identify blockchains. Blockchains are different than a specific network which is covered by [CAIP-4](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-4.md).

## Motivation

Currently, there is no standard for how to identify a blockchain. In some cases, they are identified by their genesis hash, in others by a numeric chain ID, and in others by a string representing the chain name. This CAIP offers a way to uniquely identify a blockchain in a human-readable, developer-friendly and machine-readable way.

## Specification

The blockchain ID is a string designed to uniquely identify a blockchain. The format is:

```
chain_id:    namespace + ":" + reference
namespace:   [-a-z0-9]{3,8}
reference:   [-_a-zA-Z0-9]{1,32}
```

### Namespace

The namespace represents a class of similar blockchains. It's usually based on the underlying blockchain technology or virtual machine.

Examples:
- `eip155` - EVM-compatible chains (Ethereum, Polygon, Arbitrum, Base, etc.)
- `bip122` - Bitcoin and Bitcoin-like chains
- `cosmos` - Cosmos SDK chains
- `solana` - Solana clusters
- `polkadot` - Polkadot and Kusama networks

### Reference

The reference is the specific blockchain or network within a namespace. For EVM chains, this is typically the Chain ID as defined in [EIP-155](https://eips.ethereum.org/EIPS/eip-155).

## Semantics

Each `namespace:reference` pair MUST refer to one and only one blockchain.

## Rationale

The goals of the identifier format are:
- Human readability and developer-friendliness
- Machine-readable
- Low collision risk

## Examples

### EVM Chains (eip155 namespace)

| Chain | CAIP-2 ID |
|-------|-----------|
| Ethereum Mainnet | `eip155:1` |
| Ethereum Goerli | `eip155:5` |
| Ethereum Sepolia | `eip155:11155111` |
| Polygon Mainnet | `eip155:137` |
| Polygon Mumbai | `eip155:80001` |
| Arbitrum One | `eip155:42161` |
| Arbitrum Sepolia | `eip155:421614` |
| Base Mainnet | `eip155:8453` |
| Base Sepolia | `eip155:84532` |
| Optimism Mainnet | `eip155:10` |
| BNB Smart Chain | `eip155:56` |
| Avalanche C-Chain | `eip155:43114` |

### Bitcoin (bip122 namespace)

| Chain | CAIP-2 ID |
|-------|-----------|
| Bitcoin Mainnet | `bip122:000000000019d6689c085ae165831e93` |
| Bitcoin Testnet | `bip122:000000000933ea01ad0ee984209779ba` |

### Solana (solana namespace)

| Cluster | CAIP-2 ID |
|---------|-----------|
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Solana Testnet | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` |

### Cosmos (cosmos namespace)

| Chain | CAIP-2 ID |
|-------|-----------|
| Cosmos Hub | `cosmos:cosmoshub-4` |
| Osmosis | `cosmos:osmosis-1` |

## Usage in x402

x402 uses CAIP-2 identifiers in the `network` field of payment requirements:

```typescript
{
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",  // Base Sepolia
    "price": "$0.001",
    "payTo": "0x..."
  }]
}
```

This allows x402 to support multiple chains and networks in a standardized way.

## Test Cases

```
# Valid blockchain IDs
eip155:1                              # Ethereum Mainnet
eip155:8453                           # Base Mainnet
eip155:84532                          # Base Sepolia
solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp  # Solana Mainnet
bip122:000000000019d6689c085ae165831e93  # Bitcoin Mainnet
cosmos:cosmoshub-4                    # Cosmos Hub

# Invalid blockchain IDs
1                                     # Missing namespace
eth:1                                 # 'eth' not a valid namespace
eip155:                               # Missing reference
```

## References

- [EIP-155: Simple replay attack protection](https://eips.ethereum.org/EIPS/eip-155)
- [CAIP Repository](https://github.com/ChainAgnostic/CAIPs)
- [Chain Agnostic Standards Alliance](https://github.com/ChainAgnostic/CASA)

## Copyright

This CAIP is licensed under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).


<!-- EOF: nichxbt | ucm:dW5pdmVyc2FsLWNyeXB0by1tY3A= -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->