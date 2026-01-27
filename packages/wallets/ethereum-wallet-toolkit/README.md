# Offline Build - Official Ethereumjs Libraries

This directory contains the build system to create `offline1.html` using **official ethereumjs libraries**.

## Libraries Used

All libraries are from the official Ethereum ecosystem:

- `@ethereumjs/tx` - Transaction signing (legacy + EIP-1559)
- `@ethereumjs/util` - Utilities (address validation, checksums, etc.)
- `@ethereumjs/rlp` - RLP encoding
- `@ethereumjs/wallet` - Wallet utilities
- `ethereum-cryptography` - Official cryptographic primitives (secp256k1, keccak256)
- `@scure/bip39` - BIP39 mnemonic (used by ethereumjs)
- `@scure/bip32` - BIP32 HD derivation (used by ethereumjs)

## Build Instructions

```bash
# Navigate to this directory
cd offline-build

# Install dependencies
npm install

# Build offline1.html
npm run build
```

The output file `offline1.html` will be created in the parent directory.

## What Gets Bundled

The build process uses `esbuild` to:
1. Bundle all ethereumjs libraries and their dependencies
2. Minify the code for smaller file size
3. Inline everything into a single HTML file

Typical bundle size: ~400-600 KB (varies by version)

## Features

All features match the CLI tool:

- **Wallet Generation** - Random keypair generation
- **Mnemonic Support** - Create/restore BIP39 mnemonics, derive accounts
- **Vanity Addresses** - All vanity options (prefix, suffix, regex, etc.)
- **Message Signing** - EIP-191 personal_sign
- **Signature Verification** - Recover signer from signature
- **Validation** - Address and key validation
- **Keystore** - V3 keystore encrypt/decrypt (PBKDF2)
- **Transactions** - Sign legacy and EIP-1559 transactions offline
- **EIP-712** - Typed data signing and verification

## Security

- The generated HTML file is completely self-contained
- No external network requests
- Can be saved and used on an air-gapped machine
- Uses official, audited Ethereum libraries



# MCP Servers

This repository includes 5 Model Context Protocol (MCP) servers that expose Ethereum wallet functionality to AI assistants like Claude.

## Documentation

- **[Prompt Examples](PROMPT_EXAMPLES.md)** - Real-world prompts for interacting with the servers
- **[Testing Guide](TESTING.md)** - How to run and write tests
- **[Integration Guide](INTEGRATION.md)** - Setting up with Claude Desktop and other tools
- **[Workflows & Recipes](WORKFLOWS.md)** - Common workflows combining multiple servers

## Overview

| Server | Purpose | Tools | Tests |
|--------|---------|-------|-------|
| [ethereum-wallet-mcp](../ethereum-wallet-mcp/) | Wallet generation, HD wallets, mnemonics | 6 | 111 |
| [keystore-mcp-server](../keystore-mcp-server/) | Encrypted keystore files (Web3 Secret Storage) | 9 | 74 |
| [signing-mcp-server](../signing-mcp-server/) | Message signing, EIP-191, EIP-712 | 12 | 34 |
| [transaction-mcp-server](../transaction-mcp-server/) | Transaction building, encoding, signing | 15 | 65 |
| [validation-mcp-server](../validation-mcp-server/) | Address/key validation, checksums, hashing | 15 | 64 |

**Total: 57 tools, 348 tests**

## Quick Start

### Installation

Each server is a standalone Python package:

```bash
# Install all servers
pip install -e ./ethereum-wallet-mcp
pip install -e ./keystore-mcp-server
pip install -e ./signing-mcp-server
pip install -e ./transaction-mcp-server
pip install -e ./validation-mcp-server
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ethereum-wallet": {
      "command": "ethereum-wallet-mcp"
    },
    "keystore": {
      "command": "keystore-mcp-server"
    },
    "signing": {
      "command": "signing-mcp-server"
    },
    "transaction": {
      "command": "transaction-mcp-server"
    },
    "validation": {
      "command": "validation-mcp-server"
    }
  }
}
```

## Server Details

### ethereum-wallet-mcp

**Wallet Generation & HD Wallets**

Tools:
- `generate_wallet` - Random Ethereum wallet
- `generate_wallet_with_mnemonic` - BIP39 mnemonic wallet
- `restore_wallet_from_mnemonic` - Restore from seed phrase
- `restore_wallet_from_private_key` - Restore from private key
- `derive_multiple_accounts` - HD wallet derivation
- `generate_vanity_address` - Custom prefix/suffix addresses

Resources:
- `wallet://documentation/bip39` - BIP39 spec
- `wallet://documentation/derivation-paths` - HD paths
- `wallet://wordlist/{language}` - BIP39 wordlists

### keystore-mcp-server

**Encrypted Keystore Files (Web3 Secret Storage)**

Tools:
- `encrypt_keystore` - Create encrypted keystore from private key
- `decrypt_keystore` - Decrypt keystore to get private key
- `change_keystore_password` - Re-encrypt with new password
- `validate_keystore` - Verify keystore structure
- `get_keystore_address` - Extract address without decryption
- `generate_encrypted_wallet` - Create new wallet as keystore
- `read_keystore_file` - Read keystore from filesystem
- `write_keystore_file` - Save keystore to filesystem

Supports:
- scrypt and pbkdf2 key derivation
- AES-128-CTR encryption
- UUID and version validation

### signing-mcp-server

**Message & Data Signing**

Tools:
- `sign_message` - EIP-191 personal_sign
- `verify_message` - Verify signed message
- `hash_message` - Create message hash
- `sign_typed_data` - EIP-712 structured data
- `verify_typed_data` - Verify typed data signature
- `encode_typed_data` - Encode without signing
- `recover_signer` - Recover address from signature

### transaction-mcp-server

**Transaction Building & Signing**

Tools:
- `build_transaction` - Create unsigned transaction
- `sign_transaction` - Sign with private key
- `decode_transaction` - Parse raw transaction
- `encode_transaction` - RLP encode transaction
- `estimate_gas` - Calculate gas requirements
- `calculate_transaction_hash` - Pre-signing hash
- `build_eip1559_transaction` - Type 2 transactions
- `build_legacy_transaction` - Type 0 transactions
- `build_access_list_transaction` - Type 1 transactions
- `serialize_transaction` - Convert to wire format
- `parse_transaction_input` - Decode calldata
- `validate_transaction` - Check transaction validity

### validation-mcp-server

**Validation & Cryptographic Utilities**

Tools:
- `validate_address` - EIP-55 checksum validation
- `validate_private_key` - Key range checking
- `to_checksum_address` - Convert to checksummed
- `derive_address_from_private_key` - Key → address
- `derive_address_from_public_key` - Pubkey → address
- `validate_signature` - Check v, r, s values
- `validate_hex_data` - Hex string validation
- `compare_addresses` - Address equality
- `batch_validate_addresses` - Bulk validation
- `generate_vanity_check` - Pattern matching
- `keccak256_hash` - Compute Keccak-256
- `encode_function_selector` - Signature → selector
- `decode_function_selector` - Lookup selectors
- `validate_ens_name` - ENS format validation
- `calculate_storage_slot` - Storage slot computation

Resources:
- `validation://eip55-specification` - EIP-55 docs
- `validation://secp256k1-constants` - Curve params
- `validation://function-selectors-db` - 500+ selectors
- `validation://address-patterns` - Known patterns

## Testing

Run all server tests:

```bash
# Individual servers
pytest ethereum-wallet-mcp/tests/ -v
pytest keystore-mcp-server/tests/ -v
pytest signing-mcp-server/tests/ -v
pytest transaction-mcp-server/tests/ -v
pytest validation-mcp-server/tests/ -v

# All at once
./run_all_tests.sh
```

## Architecture

All servers follow a consistent pattern:

```
server-name/
├── pyproject.toml          # Package config
├── README.md               # Server docs
├── src/
│   └── package_name/
│       ├── __init__.py
│       ├── __main__.py     # Entry point
│       ├── server.py       # MCP server setup
│       ├── tools/          # Tool implementations
│       ├── resources/      # Static resources
│       └── prompts/        # Interactive prompts
└── tests/
    └── test_*.py           # Pytest tests
```

Each tool has:
1. An `*_impl()` function with pure business logic (for testing)
2. A registered async wrapper for MCP compatibility

## Security Considerations

- **No network calls** - All operations are offline
- **No key storage** - Keys are passed through, never persisted
- **Auditable** - All code uses official Ethereum Foundation libraries
- **Test coverage** - 348 tests across all servers

⚠️ **Warning**: These tools handle sensitive cryptographic material. Review the code and understand the implications before using with real assets.

## Dependencies

All servers use official Ethereum Foundation libraries:

- `eth-account` - Key generation, signing
- `eth-keys` - ECDSA operations  
- `eth-utils` - Utility functions
- `eth-rlp` - RLP encoding
- `mnemonic` - BIP39 implementation
- `mcp` - Model Context Protocol SDK

## License

MIT License - See [LICENSE](../LICENSE)

# Prompt Examples for Ethereum Wallet MCP Servers

This guide provides real-world prompt examples for interacting with the Ethereum Wallet Toolkit MCP servers through AI assistants like Claude.

## Table of Contents

- [Wallet Operations](#wallet-operations)
- [Message Signing](#message-signing)
- [EIP-712 Typed Data](#eip-712-typed-data)
- [Transaction Operations](#transaction-operations)
- [Keystore Management](#keystore-management)
- [Validation & Utilities](#validation--utilities)
- [Advanced Workflows](#advanced-workflows)

---

## Wallet Operations

### Generate a New Wallet

**Simple:**
```
Generate a new Ethereum wallet for me
```

**With mnemonic:**
```
Create a new Ethereum wallet with a 24-word seed phrase
```

**For development/testing:**
```
Generate a test wallet for Sepolia testnet development
```

### Restore Wallets

**From mnemonic:**
```
Restore my wallet from this seed phrase:
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

**From private key:**
```
Import this private key and show me the wallet address:
0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318
```

### HD Wallet Derivation

**Derive multiple accounts:**
```
Derive 5 accounts from this mnemonic using the standard Ethereum path:
[your 12/24 word mnemonic]
```

**Custom derivation path:**
```
Derive an account at path m/44'/60'/1'/0/0 from my seed phrase
```

### Vanity Address Generation

**Simple prefix:**
```
Generate a vanity address starting with "cafe"
```

**Case-insensitive suffix:**
```
Find me an address ending with "1337" (case insensitive)
```

---

## Message Signing

### Sign a Simple Message (EIP-191)

**Basic signing:**
```
Sign this message with my private key:
Message: "Hello, Ethereum!"
Private key: 0x...
```

**For verification:**
```
Sign a message that proves I own wallet 0xABC... 
The message should be: "I authorize login to MyDApp on 2024-01-15"
```

### Verify a Signature

**Verify message:**
```
Verify this signed message:
- Message: "Hello, Ethereum!"
- Signature: 0x...
- Expected signer: 0x...
```

**Recover signer:**
```
Who signed this message?
- Message: "I agree to the terms"
- Signature: 0x...
```

### Signature Operations

**Decompose signature:**
```
Break down this signature into v, r, s components:
0x...
```

**Normalize v value:**
```
Convert this signature's v value from 0/1 format to 27/28 format:
0x...
```

---

## EIP-712 Typed Data

### Sign EIP-712 Permit (ERC-20)

**Permit signature for token approval:**
```
Sign an EIP-712 permit for USDC on Ethereum mainnet:
- Owner: 0x... (my address)
- Spender: 0x... (Uniswap router)
- Value: 1000000000 (1000 USDC, 6 decimals)
- Nonce: 0
- Deadline: 1735689600 (Unix timestamp)
- Private key: 0x...
- Contract address: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

### Sign Custom Typed Data

**NFT marketplace order:**
```
Sign this EIP-712 typed data for an NFT listing:

Domain:
- Name: "OpenSea"
- Version: "1.4"
- Chain ID: 1
- Verifying Contract: 0x00000000006c3852cbEf3e08E8dF289169EdE581

Message (Order):
- offerer: 0x... (my address)
- zone: 0x0000000000000000000000000000000000000000
- offer: [{ token: 0x..., identifier: 1234, amount: 1 }]
- consideration: [{ token: 0x0, amount: 1000000000000000000 }]
- orderType: 0
- startTime: 1704067200
- endTime: 1735689600

Private key: 0x...
```

### Hash Typed Data (Without Signing)

```
Compute the EIP-712 hash for this typed data without signing:
[typed data structure]
```

---

## Transaction Operations

### Build and Sign Transactions

**Simple ETH transfer:**
```
Build and sign a transaction to send 0.5 ETH:
- To: 0x742d35Cc6634C0532925a3b844Bc9e7595f5b4E2
- Chain ID: 1 (mainnet)
- Nonce: 42
- Max fee per gas: 30 gwei
- Max priority fee: 2 gwei
- Private key: 0x...
```

**ERC-20 token transfer:**
```
Create a signed transaction to transfer 100 USDT:
- Token contract: 0xdAC17F958D2ee523a2206206994597C13D831ec7
- To: 0x...
- Amount: 100000000 (100 USDT with 6 decimals)
- From nonce: 5
- Chain ID: 1
- Gas limit: 65000
- Max fee: 50 gwei
- Private key: 0x...
```

**Contract interaction:**
```
Build a transaction to call the 'approve' function:
- Contract: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
- Function: approve(address spender, uint256 amount)
- Spender: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D (Uniswap)
- Amount: max uint256 (unlimited approval)
- Sign with: 0x...
```

### Decode Transactions

**Decode raw transaction:**
```
Decode this raw signed transaction and show me what it does:
0x02f8730180843b9aca00850...
```

**Decode calldata:**
```
Decode this calldata and tell me what function it calls:
0xa9059cbb000000000000000000000000...
```

### Analyze Transactions

**Estimate cost:**
```
Estimate the total cost in ETH for this transaction at current gas prices:
- Gas limit: 21000
- Max fee: 30 gwei
- Priority fee: 2 gwei
```

**Compare transactions:**
```
Compare these two transactions and highlight the differences:
Transaction 1: 0x...
Transaction 2: 0x...
```

---

## Keystore Management

### Create Encrypted Keystore

**From private key:**
```
Create an encrypted keystore file for this private key:
- Private key: 0x...
- Password: MySecurePassword123!
- Use scrypt (more secure)
```

**Generate new encrypted wallet:**
```
Generate a new wallet and immediately encrypt it as a keystore:
- Password: MySecurePassword123!
- Return the keystore JSON
```

### Decrypt Keystore

**Get private key:**
```
Decrypt this keystore to get the private key:
[paste keystore JSON]
Password: MySecurePassword123!
```

**Just get the address:**
```
What's the address in this keystore? (don't decrypt)
[paste keystore JSON]
```

### Keystore Operations

**Change password:**
```
Change the password on this keystore:
[paste keystore JSON]
Old password: OldPassword123
New password: NewSecurePassword456!
```

**Validate keystore:**
```
Is this a valid Web3 Secret Storage keystore?
[paste keystore JSON]
```

---

## Validation & Utilities

### Address Validation

**Single address:**
```
Is this a valid Ethereum address? 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed
```

**Check checksum:**
```
Does this address have a valid EIP-55 checksum?
0x5aaEB6053f3e94C9b9A09f33669435e7ef1beaed
```

**Convert to checksum:**
```
Convert this address to checksummed format:
0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed
```

**Batch validation:**
```
Check which of these addresses are valid:
- 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed
- 0x1234
- 0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359
- invalid
```

### Private Key Validation

**Validate key:**
```
Is this a valid Ethereum private key?
0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318
```

**Security check:**
```
Check if this private key is secure (not a known weak key):
0x0000000000000000000000000000000000000000000000000000000000000001
```

### Hashing & Selectors

**Keccak256 hash:**
```
Compute the keccak256 hash of "Hello, Ethereum!"
```

**Function selector:**
```
What's the function selector for transfer(address,uint256)?
```

**Decode selector:**
```
What function does selector 0xa9059cbb correspond to?
```

### Storage Slots

**Calculate mapping slot:**
```
Calculate the storage slot for a mapping at slot 2 with key 0xABC...
```

**Dynamic array slot:**
```
Calculate the storage slot for the first element of a dynamic array at slot 5
```

---

## Advanced Workflows

### Complete Wallet Backup Flow

```
Help me create a complete backup of my wallet:
1. Generate a new wallet with mnemonic
2. Create an encrypted keystore as additional backup
3. Show me how to verify I can restore from both
```

### Token Permit Flow (Gasless Approval)

```
Walk me through creating a gasless ERC-20 permit:
1. I want to approve Uniswap to spend my USDC
2. Generate the EIP-712 typed data
3. Sign it with my private key
4. Show me the permit parameters to submit on-chain
```

### Multi-Account Setup

```
Set up a hierarchical wallet structure:
1. Generate a master seed phrase (24 words)
2. Derive 3 accounts:
   - Account 0: Main spending wallet
   - Account 1: Savings (cold storage)
   - Account 2: DeFi interactions
3. Create keystores for each with different passwords
```

### Security Audit

```
Audit the security of this private key:
0x...

Check for:
- Known weak keys
- Proper entropy
- Valid curve point
```

### Transaction Debugging

```
I have a transaction that failed. Help me debug it:

Raw transaction: 0x...

Please:
1. Decode the transaction completely
2. Validate all fields
3. Identify potential issues
4. Suggest fixes
```

---

## Tips for Effective Prompting

### Be Specific About Networks
```
✅ "Sign a transaction for Ethereum mainnet (chain ID 1)"
❌ "Sign a transaction"
```

### Include All Required Data
```
✅ "Sign message 'Hello' with private key 0x..."
❌ "Sign a message"
```

### Specify Formats When Needed
```
✅ "Return the signature in v/r/s format as well as the packed format"
❌ "Sign and give me the signature"
```

### Use Appropriate Security Practices
```
✅ "Generate a test wallet for development"
❌ "Generate a wallet" (when just testing)
```

### Chain Operations When Useful
```
✅ "Generate a wallet, then create a signed message proving ownership"
❌ Two separate prompts that lose context
```

---

## Common Patterns

### Verification Pattern
1. Generate/import wallet
2. Sign a message
3. Verify the signature
4. Confirm the recovered address matches

### Safe Keystore Pattern
1. Generate wallet with mnemonic (backup #1)
2. Create encrypted keystore (backup #2)
3. Verify both backups work
4. Securely delete temporary private key

### Transaction Preparation Pattern
1. Build unsigned transaction
2. Validate all fields
3. Estimate gas costs
4. Sign transaction
5. Verify signed transaction decodes correctly

---

## Security Reminders

⚠️ **When using these prompts:**

1. **Never use real private keys in examples** - Always use test keys
2. **Clear conversation history** after sharing sensitive data
3. **Verify addresses independently** before sending real funds
4. **Use test networks first** (Sepolia, Goerli) for experimentation
5. **Keep seed phrases offline** - Only use encrypted keystores for regular access

# Vanity Address Research & Security Resources

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses shown are for illustrative purposes only.

A comprehensive compilation of research papers, technical articles, and security analyses related to cryptocurrency vanity addresses, their generation, vulnerabilities, and associated attack vectors.

---

## Table of Contents

1. [Introduction](#introduction)
2. [What Are Vanity Addresses?](#what-are-vanity-addresses)
3. [Generation Methods](#generation-methods)
4. [Security Vulnerabilities](#security-vulnerabilities)
5. [Address Poisoning Attacks](#address-poisoning-attacks)
6. [Arbitrage Ecosystem Context](#arbitrage-ecosystem-context)
7. [Cryptocurrency Derivatives & Market Context](#cryptocurrency-derivatives--market-context)
8. [Safe Usage Guidelines](#safe-usage-guidelines)
9. [Notable Incidents](#notable-incidents)
10. [Works Cited](#works-cited)

---

## Introduction

Vanity addresses are custom cryptocurrency wallet addresses created using specific algorithms to incorporate user-chosen character sequences. While they serve legitimate purposes such as gas optimization, protocol branding, and multichain reproducibility, they have also been associated with significant security vulnerabilities and attack vectors.

This document compiles research from academic papers, security analyses, and technical blog posts to provide a comprehensive understanding of vanity addresses in the cryptocurrency ecosystem.

---

## What Are Vanity Addresses?

### Definition

When generating a cryptocurrency wallet, the system produces an address composed of a random string of characters. These default addresses lack personal significance. A vanity address is a custom address generated using specific algorithms that incorporate a user-chosen sequence of characters into the wallet address.

### Common Use Cases

1. **Gas Optimization**: Transaction gas costs decrease if an address has leading zeros. According to the Ethereum yellowpaper, leading zeros are cheaper for gas calculations. Wintermute reportedly saved $15,000 in gas costs due to their EOA having leading zeros (foobar).

2. **Protocol Branding**: Companies use vanity addresses for easy recognition. For example, protocols often use addresses starting with recognizable patterns like `0x1111...` or `0x0000...` for branding.

3. **Multichain Reproducibility**: Protocols can deploy to multiple EVM chains with the same contract address, simplifying documentation and user experience.

### Technical Characteristics

Creating vanity addresses is computationally intensive. The algorithm must try many combinations before finding an address that includes the chosen string of characters. The higher the number of prefixes and suffixes requested, the more time and computational resources required.

For reference, using optimized GPU mining (RTX 3090 at ~2 billion attempts/second):
- 5-leading-zero-byte address: ~8 minutes
- 6-leading-zero-byte address: ~36 hours  
- 7-leading-zero-byte address: ~387 days

---

## Generation Methods

### Profanity Generator

Profanity is an open-source vanity address generator. The basic workflow:
1. A "random" private key is generated
2. The corresponding Ethereum address is calculated
3. The address is compared against the user's desired pattern
4. If not matched, the private key is incremented by one and the process repeats
5. GPUs accelerate this process to hundreds of millions of checks per second

**Critical Flaw**: The profanity code uses a pseudo-random number generator called `mt19937`, which only outputs 8 bytes at a time and takes a 4-byte unsigned int seed (fed by a `random_device` call). Since Ethereum private keys are 32 bytes, the code must combine 4 outputs. The `mt19937_64` generator is only seeded once, so outputs don't change if the input seed is reused. This reduces complexity from 2^256 to 2^32 (James).

### CREATE vs CREATE2 Deployment

**CREATE (Default)**:
```
new_address = hash(sender, nonce)
```
- Address determined by hashing contract creator address with creator nonce
- Nonce increments with each transaction
- Vulnerable to ordering mistakes across chains

**CREATE2 (Recommended for Vanity)**:
```
new_address = hash(0xFF, sender, salt, bytecode)
```
- Uses a user-chosen salt for vanity address generation
- Salt can be made public without security risk
- Enables permissionless deployment across chains
- Bytecode parameter ensures identical functionality across chains

### Safe Generation Tools

- **create2crunch**: GPU-optimized tool for finding CREATE2 salts
- **CREATE2 Factory**: A common CREATE2 factory contract is deployed on many EVM chains

---

## Security Vulnerabilities

### The Profanity Vulnerability (CVE-2022-XXXXX)

The fundamental flaw in Profanity's random number generation:

```cpp
// Vulnerable code from Dispatcher.cpp
// Uses mt19937 with only 4-byte seed
// Reduces keyspace from 2^256 to 2^32
```

**Impact**: All starting private keys that could be generated by this program can be generated and saved in just a few hours using less than 2TB of hard drive space (James).

### EOA vs Smart Contract Safety

**EOAs (Externally Owned Accounts)**: 
- **UNSAFE** for vanity generation
- Private key controls funds
- If randomness is compromised, entire account is ruined

**Smart Contract Accounts**:
- **SAFE** for vanity generation
- Only requires iterating through public seeds
- Seeds do not grant admin permissions

As stated by foobar: "EOA vanity is the road to bankruptcy, smart contract vanity is the road to success."

### Exchange Attribution in Arbitrage Research

Research from UCSB identified 50,081 addresses as decentralized exchanges through arbitrage detection. Attribution was done by:
- Checking for smart contract source code
- Vanity address labels added to Etherscan
- Automated scanning for Uniswap v2 clone factory event logs

This research revealed 180 unique Uniswap v2 factories, demonstrating how vanity addresses can be used for exchange identification (McLaughlin et al. 3299).

---

## Address Poisoning Attacks

### Overview

Address poisoning aims to create a vanity address resembling a legitimate wallet that the target frequently interacts with. The attacker then:
1. Transfers scam tokens mimicking legitimate ones
2. Or sends low/no value coin transfers
3. These transactions "poison" the target's transaction history
4. The victim may copy the wrong address for future transactions

Typically, the first 4-6 characters and last 4-6 characters are made to resemble the target address.

**Example** (FAKE illustrative addresses):
- Legitimate: `0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234`
- Attacker: `0xABCD5678000056780000567800005678ABCD5678`

(Notice first 4 and last 4 characters match)

### Attack Techniques

#### Fake Token Transfers

Attackers send fake tokens (e.g., fake USDT) to wallets with addresses similar to ones that received legitimate tokens. These fake token contracts may:
- Allow transfers without owning the token
- Have token balances stored in contract storage without mint transactions
- Use unverified contracts

#### Zero Value Spam

With tokens like USDT, transferring 0 amount records on the ledger. Scammers:
1. Spoof transactions to appear as if the target is sending zero value
2. Create vanity addresses mimicking legitimate recipients
3. Sometimes send small amounts (<$10 USDC) to avoid detection flags

### Major Incident: May 3, 2024

A victim lost 1,155 WBTC (~$72M) by copying the wrong address from their transaction history. Remarkably, the stolen funds were eventually returned to the victim (CertiK).

---

## Arbitrage Ecosystem Context

### DEX Arbitrage and Vanity Addresses

Research from McLaughlin et al. at UCSB conducted a 28-month study (February 2020 - July 2022) analyzing the Ethereum arbitrage ecosystem. Key findings relevant to vanity addresses:

#### Exchange Identification
- 50,081 addresses identified as DEXs
- Manual examination used vanity address labels on Etherscan
- 180 unique Uniswap v2 factories discovered

#### Arbitrage Statistics
- 3.8 million arbitrages identified
- $321 million in total profit
- 4 billion arbitrage opportunities detected
- Weekly profit potential: 395 Ether (~$500,000)

#### Exchange Distribution (by frequency in arbitrage)
| Exchange | Usage % |
|----------|---------|
| Uniswap v2 | 44.9% |
| Uniswap v3 | 15.2% |
| Sushi Swap | 13.5% |
| Balancer v1 | 10.8% |
| Unknown | 5.4% |

#### Arbitrage Cycle Properties
- 98% contain exactly one exchange cycle
- 91% use either two or three exchanges
- 92% use Wrapped Ether (WETH) as profit token

### Security Implications

The research identified threats to consensus stability:
- Increasing percentage of arbitrage revenue paid to miners/validators
- This could incentivize "time-bandit attacks" where block producers fork the blockchain to capture high-value MEV blocks

---

## Cryptocurrency Derivatives & Market Context

### BitMEX Case Study

Research from Soska et al. at Carnegie Mellon University provides context on how vanity addresses are used in the broader cryptocurrency trading ecosystem.

#### Platform Characteristics
- Trades over $3 billion daily volume
- Up to 100x leverage on Bitcoin
- Over 600,000 trader accounts
- All operations in Bitcoin (no fiat conversion)

#### Vanity Address Usage
BitMEX uses vanity addresses for customer deposit accounts:
- Unique `3BMEX` prefix for all customer addresses
- 610,000+ addresses with this prefix identified
- Used for automated account identification and filtering

#### Clustering Analysis
The researchers developed methods to cluster BitMEX accounts:
1. Rule-based clustering using deposit transaction patterns
2. Community detection via Label Propagation algorithm
3. Service detection to filter exchanges and dusters

Results showed sophisticated traders operating multiple accounts:
- 90% of accounts are singletons
- <1% belong to clusters of 5+ accounts
- Largest clusters contain 50+ accounts

### Trader Sophistication Indicators

Analysis of vanity address clusters revealed:
- Larger clusters have higher average deposits
- Multiple accounts used to circumvent leverage restrictions
- API rate limit multiplexing
- Flow obfuscation to prevent front-running

---

## Safe Usage Guidelines

### For EOAs (Externally Owned Accounts)

**DO NOT use vanity generators for EOAs**. The only truly reliable method is to generate addresses yourself with cryptographically secure randomness. Even then, vulnerabilities in generation software can compromise security.

### For Smart Contracts

Smart contract vanity addresses are safe when using CREATE2:

1. Use a CREATE2 factory contract
2. Choose a salt that produces desired address characteristics
3. Salt can be made public without security implications
4. Verify bytecode matches across all chain deployments

### Proper Random Number Generation Fix

To fix the Profanity vulnerability, proper seeding is required:

```cpp
// Instead of single 4-byte seed
// Use 624-word seed for mt19937
// Or use cryptographically secure RNG
```

The fix requires feeding a random seed sequence of at least 32 bits to ensure mt19937 produces cryptographically secure outputs (James).

### User Protection Against Address Poisoning

1. **Always double-check full addresses** before sending funds
2. Use address books/whitelists in wallet software
3. Be suspicious of unfamiliar tokens in transaction history
4. Verify addresses through multiple sources
5. Use blockchain explorers that flag suspicious addresses

---

## Notable Incidents

### Wintermute Hack (September 2022)
- **Loss**: $160 million
- **Cause**: Bad randomness in Profanity vanity address generator
- **Method**: Attacker replayed search iteration to recreate (private key, public address) pair
- **Target**: EOA with leading zeros for gas optimization

### Indexed Finance Exploiter (October 2021 → September 2022)
- **Initial Exploit**: $16 million stolen
- **Address**: Started with `0xba5ed...` ("based")
- **Irony**: Same Profanity vulnerability exploited
- **Result**: All funds stolen again by another attacker

### Address Poisoning Victim (May 3, 2024)
- **Loss**: 1,155 WBTC (~$72 million)
- **Cause**: Copied wrong address from transaction history
- **Outcome**: Funds eventually returned

---

## Technical Appendix

### CREATE2 Salt Mining

Using create2crunch on vast.ai (RTX 3090):

```bash
# Install
sudo apt install build-essential -y
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
git clone https://github.com/0age/create2crunch && cd create2crunch
sed -i 's/0x4/0x40/g' src/lib.rs

# Run search
export FACTORY="0xYourFactoryAddress"
export CALLER="0xYourCallerAddress"
export INIT_CODE_HASH="0xYourInitCodeHash"
export LEADING=5
export TOTAL=7
cargo run --release $FACTORY $CALLER $INIT_CODE_HASH 0 $LEADING $TOTAL
```

### Keyless Transaction Deployment

The CREATE2 Factory uses ENS founder Nick Johnson's "keyless transaction" approach:
1. Create deployment transaction
2. Generate fake signature (e.g., all 2's)
3. Recover public address from signature
4. Send ETH to that address
5. Submit signed transaction to mempool

This creates a single-use EOA that can only ever deploy one transaction.

---

## Works Cited

CertiK. "Vanity Address and Address Poisoning." *CertiK Resources*, 29 July 2024, www.certik.com/resources/blog/vanity-address-and-address-poisoning.

foobar. "Vanity Addresses: The Only Safe Way to Do Permissionless Multichain Deployments." *0xfoobar Substack*, 10 Jan. 2023, 0xfoobar.substack.com/p/vanity-addresses.

Garreau, Marc. "Web3.py Patterns: Address Mining." *Snake Charmers (Ethereum Foundation)*, 4 Oct. 2021, snakecharmers.ethereum.org/web3-py-patterns-address-mining/.

James. "Fixing Other People's Code." *Oregon State University Blogs*, 6 Feb. 2023, blogs.oregonstate.edu/james/2023/02/.

McLaughlin, Robert, et al. "A Large Scale Study of the Ethereum Arbitrage Ecosystem." *32nd USENIX Security Symposium*, 9-11 Aug. 2023, Anaheim, CA, USA, pp. 3295-3312. USENIX Association, www.usenix.org/conference/usenixsecurity23/presentation/mclaughlin.

Soska, Kyle, et al. "Towards Understanding Cryptocurrency Derivatives: A Case Study of BitMEX." *Proceedings of the Web Conference 2021 (WWW '21)*, 19-23 Apr. 2021, Ljubljana, Slovenia. ACM, New York, NY, USA, doi.org/10.1145/3442381.3450059.

---

## Additional References

### From McLaughlin et al. Paper

- Daian, Philip, et al. "Flash Boys 2.0: Frontrunning in Decentralized Exchanges, Miner Extractable Value, and Consensus Instability." *2020 IEEE Symposium on Security and Privacy (SP)*, 2020, pp. 910-927.

- Qin, Kaihua, et al. "Quantifying Blockchain Extractable Value: How Dark Is the Forest?" *2022 IEEE Symposium on Security and Privacy (SP)*, 2022, pp. 198-214.

- Wang, Ye, et al. "Cyclic Arbitrage in Decentralized Exchanges." *Companion Proceedings of the Web Conference 2022 (WWW '22)*, 2022, pp. 12-19. ACM.

- Zhou, Liyi, et al. "On the Just-in-Time Discovery of Profit-Generating Transactions in DeFi Protocols." *2021 IEEE Symposium on Security and Privacy (SP)*, 2021, pp. 919-936.

### From Soska et al. Paper

- Gandal, Neil, et al. "Price Manipulation in the Bitcoin Ecosystem." *Journal of Monetary Economics*, vol. 95, 2018, pp. 86-96.

- Meiklejohn, Sarah, et al. "A Fistful of Bitcoins: Characterizing Payments Among Men with No Names." *Proceedings of the 2013 Internet Measurement Conference*, 2013, pp. 127-140.

- Nakamoto, Satoshi. "Bitcoin: A Peer-to-Peer Electronic Cash System." 2008.

---

*Document compiled: January 2026*

*For the ethereum-wallet-toolkit project*

# Keystore Operations

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

This document covers the keystore encryption and decryption features of the Ethereum Wallet Toolkit.

## Overview

Keystores are encrypted JSON files that securely store private keys. They follow the [Web3 Secret Storage Definition](https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition) (Version 3) and are compatible with all major Ethereum wallets including MetaMask, Geth, and MyEtherWallet.

## Security Model

### Key Derivation Functions

The toolkit supports two KDF algorithms:

| KDF | Security | Speed | Recommended |
|-----|----------|-------|-------------|
| scrypt | Higher | Slower | Yes (default) |
| pbkdf2 | Good | Faster | For compatibility |

**scrypt** (default):
- Memory-hard function resistant to ASIC attacks
- Parameters: N=262144, r=8, p=1
- More secure against brute-force attacks

**pbkdf2**:
- Uses HMAC-SHA256
- Default iterations: 262144
- Faster but less resistant to hardware attacks

### Encryption

- Cipher: AES-128-CTR
- Key derivation produces a 256-bit key
- First 128 bits used for encryption
- Last 128 bits used for MAC verification

## CLI Usage

### Using keystore.py (Standalone)

```bash
# Encrypt a private key
python keystore.py encrypt --key 0x... --password mypassword --output wallet.json

# Encrypt with secure password prompt
python keystore.py encrypt --key 0x... --output wallet.json

# Use PBKDF2 instead of scrypt
python keystore.py encrypt --key 0x... --password secret --kdf pbkdf2 --output wallet.json

# Decrypt a keystore
python keystore.py decrypt --file wallet.json --password mypassword

# Decrypt with password prompt (more secure)
python keystore.py decrypt --file wallet.json

# View keystore info without decryption
python keystore.py info --file wallet.json

# Change keystore password
python keystore.py change-password --file wallet.json
```

### Using eth_toolkit.py (Main Toolkit)

```bash
# Encrypt
python eth_toolkit.py keystore --encrypt --key 0x... --password secret --output wallet.json

# Decrypt
python eth_toolkit.py keystore --decrypt --file wallet.json --password secret
```

## Keystore File Format

```json
{
  "version": 3,
  "id": "uuid-here",
  "address": "abcdefghijkabcdefghijklmnopqrstuvwxyz",
  "crypto": {
    "ciphertext": "encrypted-private-key",
    "cipherparams": {
      "iv": "initialization-vector"
    },
    "cipher": "aes-128-ctr",
    "kdf": "scrypt",
    "kdfparams": {
      "dklen": 32,
      "salt": "random-salt",
      "n": 262144,
      "r": 8,
      "p": 1
    },
    "mac": "message-authentication-code"
  }
}
```

## Python API

```python
from keystore import (
    encrypt_keystore,
    decrypt_keystore,
    save_keystore,
    load_keystore,
    get_keystore_info
)

# Encrypt a private key
keystore = encrypt_keystore(
    private_key='0x...',
    password='my-secure-password',
    kdf='scrypt'
)

# Save to file
filepath = save_keystore(keystore, 'my-wallet.json')

# Load from file
keystore = load_keystore('my-wallet.json')

# Get info without decryption
info = get_keystore_info(keystore)
print(f"Address: {info['address']}")
print(f"KDF: {info['kdf']}")

# Decrypt
private_key = decrypt_keystore(keystore, 'my-secure-password')
```

## Best Practices

### Password Security

1. **Use strong passwords**: Minimum 12 characters with mixed case, numbers, symbols
2. **Never reuse passwords**: Each keystore should have a unique password
3. **Use a password manager**: Store passwords securely
4. **Avoid command-line passwords**: Use the prompt feature instead of `--password`

```bash
# Good - password prompted securely
python keystore.py encrypt --key 0x... --output wallet.json

# Avoid - password visible in shell history
python keystore.py encrypt --key 0x... --password secret --output wallet.json
```

### File Storage

1. **Backup keystores**: Keep multiple copies in secure locations
2. **Encrypt backups**: Use additional encryption for cloud storage
3. **Control access**: Restrict file permissions (chmod 600)
4. **Never share**: Keystore + password = full access to funds

### Testing

Always test decryption after creating a keystore:

```bash
# Create keystore
python keystore.py encrypt --key 0x... --output test.json

# Verify decryption works
python keystore.py decrypt --file test.json

# Check the derived address matches expected
python keystore.py info --file test.json
```

## Integration Examples

### MetaMask Import

MetaMask can import keystore files directly:
1. Open MetaMask
2. Click account icon > Import Account
3. Select "JSON File"
4. Upload your keystore file
5. Enter the password

### Geth Import

```bash
geth account import --datadir /path/to/data wallet.json
```

### Web3.py Integration

```python
from web3 import Web3

with open('wallet.json', 'r') as f:
    keystore = f.read()

private_key = Web3().eth.account.decrypt(keystore, 'password')
```

## Error Handling

### Common Errors

**Incorrect Password**
```
Error: Failed to decrypt keystore - MAC mismatch
Check that the password is correct.
```

**Corrupted File**
```
Error: Invalid keystore format
```

**Wrong KDF Parameters**
```
Error: Unsupported KDF algorithm
```

### Recovery

If you forget your password:
- There is **no recovery mechanism**
- Strong encryption means brute-force is impractical
- Always keep secure password backups

## Security Audit Checklist

- [ ] Using scrypt KDF (not pbkdf2)
- [ ] Password is 12+ characters
- [ ] Password is unique to this keystore
- [ ] Keystore is backed up in multiple locations
- [ ] Decryption tested after creation
- [ ] File permissions restricted
- [ ] Password stored in password manager

# EIP-712 Typed Data Signing

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

This document covers the EIP-712 typed structured data signing features of the Ethereum Wallet Toolkit.

## Overview

[EIP-712](https://eips.ethereum.org/EIPS/eip-712) defines a standard for hashing and signing typed structured data. It's widely used in DeFi for:

- **Permits**: Gasless token approvals (ERC-2612)
- **DEX Orders**: Off-chain order signing for exchanges
- **Meta-transactions**: Gasless transactions via relayers
- **Governance**: Off-chain voting signatures
- **NFT Listings**: Marketplace order signatures

## Key Benefits

1. **Human-readable signing**: Users see structured data, not hex blobs
2. **Domain separation**: Prevents cross-contract signature replay
3. **Type safety**: Structured validation of data types
4. **Standardized**: Consistent implementation across ecosystems

## Typed Data Structure

Every EIP-712 message has four components:

```json
{
  "types": {
    "EIP712Domain": [...],
    "PrimaryType": [...]
  },
  "primaryType": "PrimaryType",
  "domain": {...},
  "message": {...}
}
```

### 1. Types

Defines the structure of all types used:

```json
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Permit": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "nonce", "type": "uint256"},
      {"name": "deadline", "type": "uint256"}
    ]
  }
}
```

### 2. Primary Type

The main type being signed:

```json
{
  "primaryType": "Permit"
}
```

### 3. Domain

Context that binds the signature to a specific contract:

```json
{
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 1,
    "verifyingContract": "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
  }
}
```

### 4. Message

The actual data being signed:

```json
{
  "message": {
    "owner": "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "spender": "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    "value": "1000000000000000000",
    "nonce": 0,
    "deadline": 1893456000
  }
}
```

## CLI Usage

### Generate Example Data

```bash
# ERC-20 Permit example
python typed_data.py example --type permit --output permit.json

# DEX Order example
python typed_data.py example --type order --output order.json

# Mail example (EIP-712 spec)
python typed_data.py example --type mail --output mail.json
```

### Sign Typed Data

```bash
# Sign a permit
python typed_data.py sign --file permit.json --key 0xaaa...

# Sign with verbose output
python typed_data.py sign --file order.json --key 0xaaa... --verbose

# Save signature to file
python typed_data.py sign --file permit.json --key 0xaaa... --output signed.json
```

### Verify Signatures

```bash
# Verify a signature
python typed_data.py verify \
  --file permit.json \
  --signature 0xabc... \
  --address 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

### Calculate Hash

```bash
# Get the signing hash (for debugging)
python typed_data.py hash --file permit.json
```

## Python API

```python
from typed_data import (
    sign_typed_data,
    verify_typed_data,
    hash_typed_data,
    load_typed_data,
    EXAMPLES
)

# Load typed data from file
typed_data = load_typed_data('permit.json')

# Or use built-in examples
typed_data = EXAMPLES['permit']

# Sign
result = sign_typed_data(typed_data, '0xaaa...')
print(f"Signature: {result['signature']}")
print(f"v: {result['v']}, r: {result['r']}, s: {result['s']}")

# Verify
verification = verify_typed_data(
    typed_data,
    result['signature'],
    '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
)
print(f"Valid: {verification['is_valid']}")

# Calculate hash
hash_value = hash_typed_data(typed_data)
print(f"Hash: {hash_value}")
```

## Common Use Cases

### 1. ERC-20 Permit (Gasless Approval)

Instead of calling `approve()` (which costs gas), users sign a permit off-chain:

```json
{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Permit": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "nonce", "type": "uint256"},
      {"name": "deadline", "type": "uint256"}
    ]
  },
  "primaryType": "Permit",
  "domain": {
    "name": "USD Coin",
    "version": "2",
    "chainId": 1,
    "verifyingContract": "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
  },
  "message": {
    "owner": "0xYourAddress",
    "spender": "0xSpenderContract",
    "value": "1000000000",
    "nonce": 0,
    "deadline": 1893456000
  }
}
```

### 2. DEX Order (0x-style)

Off-chain limit orders for decentralized exchanges:

```json
{
  "types": {
    "EIP712Domain": [...],
    "Order": [
      {"name": "maker", "type": "address"},
      {"name": "taker", "type": "address"},
      {"name": "makerToken", "type": "address"},
      {"name": "takerToken", "type": "address"},
      {"name": "makerAmount", "type": "uint256"},
      {"name": "takerAmount", "type": "uint256"},
      {"name": "expiry", "type": "uint256"},
      {"name": "salt", "type": "uint256"}
    ]
  },
  "primaryType": "Order",
  "domain": {
    "name": "Exchange",
    "version": "1.0",
    "chainId": 1,
    "verifyingContract": "0xExchangeContract"
  },
  "message": {
    "maker": "0xYourAddress",
    "taker": "0x0000000000000000000000000000000000000000",
    "makerToken": "0xWETH",
    "takerToken": "0xUSDC",
    "makerAmount": "1000000000000000000",
    "takerAmount": "3000000000",
    "expiry": 1893456000,
    "salt": 12345
  }
}
```

### 3. Meta-Transaction

Allow relayers to pay gas on behalf of users:

```json
{
  "types": {
    "EIP712Domain": [...],
    "ForwardRequest": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "gas", "type": "uint256"},
      {"name": "nonce", "type": "uint256"},
      {"name": "data", "type": "bytes"}
    ]
  },
  "primaryType": "ForwardRequest",
  "message": {
    "from": "0xUserAddress",
    "to": "0xTargetContract",
    "value": "0",
    "gas": "100000",
    "nonce": 0,
    "data": "0x..."
  }
}
```

## Supported Types

| Solidity Type | EIP-712 Type |
|---------------|--------------|
| address | address |
| bool | bool |
| uint256 | uint256 |
| int256 | int256 |
| bytes32 | bytes32 |
| bytes | bytes |
| string | string |
| Custom struct | Custom type |
| Array | Type[] |

## Domain Separator

The domain separator prevents signature replay across:
- Different contracts (verifyingContract)
- Different chains (chainId)
- Different versions (version)
- Different applications (name)

```
domainSeparator = keccak256(
  encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(name),
    keccak256(version),
    chainId,
    verifyingContract
  )
)
```

## Security Considerations

### 1. Domain Verification

Always verify the domain matches the intended contract:
- Check `verifyingContract` is the correct address
- Check `chainId` matches your network
- Check `name` and `version` match the contract

### 2. Message Validation

Before signing:
- Verify all addresses are correct
- Check amounts and values
- Validate deadline hasn't passed
- Confirm nonce matches expected value

### 3. Signature Replay

EIP-712 prevents cross-domain replay, but:
- Same-domain replay requires nonce management
- Store and increment nonces properly
- Check expiry/deadline values

### 4. Phishing Risks

Malicious dApps may request signatures that:
- Approve unlimited token spending
- Transfer assets to attacker addresses
- Execute unexpected contract calls

Always review what you're signing!

## Integration with Smart Contracts

### Solidity Verification

```solidity
function verify(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    bytes32 structHash = keccak256(abi.encode(
        PERMIT_TYPEHASH,
        owner,
        spender,
        value,
        nonces[owner]++,
        deadline
    ));
    
    bytes32 hash = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(hash, v, r, s);
    
    require(signer == owner, "Invalid signature");
    require(block.timestamp <= deadline, "Expired");
}
```

### OpenZeppelin Integration

```solidity
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MyContract is EIP712 {
    constructor() EIP712("MyContract", "1") {}
    
    function _verify(bytes memory signature, bytes32 hash, address signer) 
        internal view returns (bool) 
    {
        return ECDSA.recover(_hashTypedDataV4(hash), signature) == signer;
    }
}
```

## Debugging

### Hash Mismatch

If signatures fail to verify:

1. Check domain separator matches contract
2. Verify type hash calculation
3. Ensure message encoding is correct
4. Compare struct hash with contract

### Tool Usage

```bash
# Calculate hash for comparison
python typed_data.py hash --file permit.json

# Compare with contract's domain separator
cast call 0xContract "DOMAIN_SEPARATOR()(bytes32)"
```

## References

- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-2612 Permit Extension](https://eips.ethereum.org/EIPS/eip-2612)
- [OpenZeppelin EIP712](https://docs.openzeppelin.com/contracts/4.x/api/utils#EIP712)

# Security Guidelines

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses shown are FAKE illustrative examples.

This document outlines security best practices for using the Ethereum Wallet Toolkit.

## Table of Contents

- [Cryptographic Security](#cryptographic-security)
- [Operational Security](#operational-security)
- [Key Management](#key-management)
- [Threat Model](#threat-model)
- [Auditing the Code](#auditing-the-code)

---

## Cryptographic Security

### Random Number Generation

The toolkit uses Python's `secrets` module and the operating system's cryptographically secure pseudorandom number generator (CSPRNG) for all key generation:

- **Linux/macOS:** `/dev/urandom`
- **Windows:** `CryptGenRandom`

The eth-account library handles entropy generation internally using these secure sources.

### Key Derivation

**BIP39 Mnemonic:**
- Entropy: 128-256 bits (12-24 words)
- Checksum: SHA-256 hash of entropy
- Seed derivation: PBKDF2-HMAC-SHA512 with 2048 iterations

**BIP32 HD Wallet:**
- Master key: HMAC-SHA512 of seed
- Child keys: HMAC-SHA512 chain derivation
- Hardened derivation for account-level keys

### Elliptic Curve Operations

- Curve: secp256k1 (same as Bitcoin)
- Private key: 256-bit integer
- Public key: Compressed or uncompressed point
- Address: Last 20 bytes of Keccak-256(public key)

---

## Operational Security

### Running Offline

For maximum security when generating wallets:

1. **Disconnect from the internet** before running the toolkit
2. **Boot from a live USB** (e.g., Tails OS) for sensitive operations
3. **Use an air-gapped computer** for high-value wallets
4. **Verify checksums** of the toolkit before use

### Environment Isolation

```bash
# Create isolated virtual environment
python -m venv --copies venv
source venv/bin/activate

# Verify no network-capable packages are installed
pip list

# Run the toolkit
python eth_toolkit.py generate --mnemonic
```

### Memory Security

- Private keys exist in memory during operation
- Close the terminal immediately after use
- Consider using memory-wiping tools on sensitive systems
- Avoid running other applications during key generation

---

## Key Management

### Storage Best Practices

| Storage Method | Security Level | Use Case |
|----------------|----------------|----------|
| Hardware wallet | Highest | Large holdings |
| Encrypted USB | High | Cold storage |
| Paper wallet | High | Long-term backup |
| Password manager | Medium | Day-to-day access |
| Plain text file | Dangerous | Never recommended |

### Mnemonic Backup

1. Write the mnemonic on paper (not digitally)
2. Use metal backup plates for fire/water resistance
3. Split using Shamir's Secret Sharing for high-value wallets
4. Store copies in multiple secure locations
5. Never photograph or digitize the mnemonic

### Private Key Handling

```bash
# Generate wallet and save to encrypted file
python eth_toolkit.py generate --mnemonic --output wallet.json

# The output file should be:
# 1. Encrypted with a strong password
# 2. Stored on encrypted storage
# 3. Backed up securely
# 4. Deleted from unencrypted storage
```

---

## Known Vulnerabilities in Other Tools

### The Profanity Vulnerability (September 2022)

The open-source vanity address generator "Profanity" contained a critical flaw that led to **$160 million in losses** for Wintermute and other victims.

**Root Cause**: Profanity used `mt19937` pseudo-random number generator with only a 4-byte seed. Since Ethereum private keys are 32 bytes, this reduced the keyspace from 2^256 to 2^32 possible keys—easily brute-forceable.

**How Attackers Exploited It**:
1. Generated all possible starting private keys (fits in <2TB storage)
2. Replayed the search iteration to recreate (private key, address) pairs
3. Drained wallets matching known vanity addresses

**This toolkit avoids the specific Profanity vulnerability** by:
- Using `eth-account` which relies on OS CSPRNG (`/dev/urandom` on Linux, `CryptGenRandom` on Windows)
- Each wallet generation uses fresh, cryptographically secure randomness
- No incremental key derivation from a weak seed

**However, this does NOT guarantee safety.** Other vulnerabilities may exist. This toolkit is for EDUCATIONAL PURPOSES ONLY. Always audit the code yourself and use at your own risk.

> **Reference**: James. "Fixing Other People's Code." Oregon State University Blogs, February 2023.

### Address Poisoning Attacks

Address poisoning is a social engineering attack where attackers:

1. Create vanity addresses resembling your frequently-used addresses
2. Send you small transactions (or fake tokens) from these lookalike addresses
3. Hope you copy the wrong address from your transaction history

**Example** (FAKE illustrative addresses):
- Legitimate: `0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234`
- Attacker:   `0xABCD5678000056780000567800005678ABCD5678`

(Notice the first 4 and last 4 characters match, middle is different)

**Notable Incident**: Address poisoning attacks have resulted in millions of dollars in losses.

**Protection**:
- Always verify the FULL address, not just first/last characters
- Use address books and whitelists
- Be suspicious of unexpected token transfers in your history

> **Reference**: CertiK. "Vanity Address and Address Poisoning." CertiK Resources, July 2024.

---

## Threat Model

### Threats Addressed

| Threat | Mitigation |
|--------|------------|
| Weak RNG | Uses OS CSPRNG via eth-account |
| Network interception | Run offline |
| Malicious dependencies | Uses only official Ethereum Foundation libs |
| Memory inspection | User responsibility (air-gapped system) |
| Supply chain attack | Verify source code before use |
| Profanity-style vulnerability | Fresh CSPRNG entropy per generation |

### Threats NOT Addressed

| Threat | User Responsibility |
|--------|---------------------|
| Compromised OS | Use trusted operating system |
| Hardware keyloggers | Verify physical security |
| Shoulder surfing | Ensure private environment |
| Social engineering | Verify all instructions |
| Malware on system | Run on clean system |

### Attack Vectors

**1. Compromised Random Number Generator**
- Risk: Predictable private keys
- Mitigation: eth-account uses OS CSPRNG
- Verification: Audit eth-account source code

**2. Modified Source Code**
- Risk: Backdoored key generation
- Mitigation: Verify git commits and signatures
- Verification: Compare with official repository

**3. Dependency Confusion**
- Risk: Malicious package substitution
- Mitigation: Use official PyPI packages only
- Verification: Check package hashes

---

## Auditing the Code

### Code Review Checklist

Before using this toolkit for valuable assets, review:

1. **Key Generation (`eth_toolkit.py`)**
   - Verify `Account.create()` is used for random generation
   - Verify `Account.create_with_mnemonic()` for mnemonic generation
   - Check no hardcoded values in key generation

2. **Dependencies (`requirements.txt`)**
   - Verify all packages are from Ethereum Foundation
   - Check package versions for known vulnerabilities
   - Review package source code if needed

3. **Output Handling**
   - Verify keys are not logged or transmitted
   - Check file output is not cached
   - Ensure no telemetry or analytics

### Verification Commands

```bash
# Verify eth-account is official
pip show eth-account
# Check homepage: https://github.com/ethereum/eth-account

# Verify package integrity
pip hash eth-account

# Count lines of code (should be ~600-800)
wc -l eth_toolkit.py vanity.py

# Search for suspicious patterns
grep -r "http\|https\|request\|socket\|urllib" *.py
```

### Recommended Audit Process

1. Clone the repository locally
2. Disconnect from the internet
3. Review all Python files manually
4. Verify dependencies against official sources
5. Test with non-valuable addresses first
6. Use for production only after full review

---

## Security Contacts

If you discover a security vulnerability:

1. Do NOT create a public issue
2. Contact the maintainers privately
3. Allow reasonable time for a fix before disclosure

---

## Disclaimer

This toolkit is provided as-is for educational and personal use. The authors are not responsible for:

- Loss of funds due to improper use
- Security breaches on compromised systems
- Errors in generated addresses or keys

Always verify generated addresses before depositing significant funds.

"""
Documentation Resources for Ethereum Wallet MCP Server

This module implements MCP resources providing documentation:
- BIP39 standard documentation
- HD derivation path documentation  
- BIP39 wordlists by language

Resources provide static content that can be read by MCP clients.
"""

from mcp.server import Server
from mcp.types import Resource, TextContent

# BIP39 wordlists - English only included inline, others loaded dynamically
SUPPORTED_LANGUAGES = [
    "english", "spanish", "french", "italian",
    "japanese", "korean", "chinese_simplified", "chinese_traditional",
    "czech", "portuguese"
]


def register_documentation_resources(server: Server) -> None:
    """
    Register all documentation resources with the MCP server.
    
    Args:
        server: MCP Server instance to register resources with
    """
    
    @server.resource("wallet://documentation/bip39")
    async def get_bip39_documentation() -> str:
        """
        Resource providing BIP39 standard documentation.
        
        Returns comprehensive documentation about the BIP39 mnemonic
        standard used for wallet seed phrases.
        """
        return BIP39_DOCUMENTATION
    
    @server.resource("wallet://documentation/derivation-paths")
    async def get_derivation_paths_documentation() -> str:
        """
        Resource providing HD derivation path documentation.
        
        Returns documentation about BIP44 standard paths and
        Ethereum-specific derivation conventions.
        """
        return DERIVATION_PATHS_DOCUMENTATION
    
    @server.resource("wallet://wordlist/{language}")
    async def get_wordlist(language: str) -> str:
        """
        Resource providing BIP39 wordlists by language.
        
        Args:
            language: Language code (english, spanish, french, etc.)
            
        Returns:
            Complete BIP39 wordlist for the specified language
        """
        language = language.lower().strip()
        
        if language not in SUPPORTED_LANGUAGES:
            return f"Error: Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        
        try:
            from mnemonic import Mnemonic
            mnemo = Mnemonic(language)
            words = mnemo.wordlist
            
            header = f"# BIP39 Wordlist: {language.title()}\n\n"
            header += f"Total words: {len(words)}\n\n"
            header += "---\n\n"
            
            # Format as numbered list
            word_list = "\n".join(f"{i+1}. {word}" for i, word in enumerate(words))
            
            return header + word_list
            
        except Exception as e:
            return f"Error loading wordlist for '{language}': {str(e)}"


# ============================================================================
# Documentation Content
# ============================================================================

BIP39_DOCUMENTATION = """# BIP39: Mnemonic Code for Generating Deterministic Keys

## Overview

BIP39 (Bitcoin Improvement Proposal 39) describes the implementation of a mnemonic 
code or mnemonic sentence -- a group of easy-to-remember words -- for the generation 
of deterministic wallets.

This standard is widely adopted across the cryptocurrency ecosystem and is the 
foundation for most modern wallet backup and recovery systems.

---

## How It Works

### 1. Entropy Generation

The process begins with generating random entropy:

| Word Count | Entropy Bits | Checksum Bits | Total Bits |
|------------|--------------|---------------|------------|
| 12 words   | 128 bits     | 4 bits        | 132 bits   |
| 15 words   | 160 bits     | 5 bits        | 165 bits   |
| 18 words   | 192 bits     | 6 bits        | 198 bits   |
| 21 words   | 224 bits     | 7 bits        | 231 bits   |
| 24 words   | 256 bits     | 8 bits        | 264 bits   |

### 2. Checksum Calculation

A checksum is computed by taking the first `entropy_bits / 32` bits of the 
SHA256 hash of the entropy. This checksum is appended to the entropy.

### 3. Word Selection

The combined entropy + checksum is split into 11-bit groups. Each 11-bit 
value (0-2047) maps to a word in the 2048-word BIP39 wordlist.

### 4. Seed Generation

The mnemonic is converted to a 512-bit seed using PBKDF2-HMAC-SHA512:
- Mnemonic phrase as the password
- "mnemonic" + optional passphrase as the salt
- 2048 iterations

---

## Security Considerations

### Entropy Quality

The security of your wallet depends entirely on the quality of entropy used:

- **Good**: Hardware random number generators, OS-level /dev/urandom
- **Bad**: Predictable sources, weak PRNGs, user-chosen words

**Never create your own mnemonic by picking words!** The checksum will be invalid, 
and human-chosen words are not random.

### Word Count Recommendations

| Use Case | Recommended | Security Level |
|----------|-------------|----------------|
| Testing/Development | 12 words | 128 bits |
| Personal Use | 12-24 words | 128-256 bits |
| High Value | 24 words | 256 bits |
| Institutional | 24 words + passphrase | 256+ bits |

### Passphrase (25th Word)

BIP39 supports an optional passphrase that provides:

1. **Additional Security**: Even if mnemonic is compromised, funds are safe
2. **Plausible Deniability**: Different passphrases derive different wallets
3. **Multi-wallet**: Single mnemonic can manage multiple separate wallets

**Warning**: Forgetting the passphrase means permanent loss of funds!

---

## Supported Languages

BIP39 defines wordlists in multiple languages:

1. **English** (most common, recommended)
2. **Spanish** (Español)
3. **French** (Français)
4. **Italian** (Italiano)
5. **Japanese** (日本語)
6. **Korean** (한국어)
7. **Chinese Simplified** (简体中文)
8. **Chinese Traditional** (繁體中文)
9. **Czech** (Čeština)
10. **Portuguese** (Português)

### Language Selection Tips

- **Use English** for maximum compatibility
- Same entropy with different language = different words, same seed
- Some wallets only support English
- Document which language was used!

---

## Wordlist Properties

Each BIP39 wordlist has specific properties:

1. **2048 words** exactly
2. **First 4 characters unique** - allows unambiguous abbreviation
3. **Similar words avoided** - reduces confusion
4. **Sorted** - allows binary search
5. **UTF-8 NFKD normalized** - consistent encoding

---

## Common Mistakes to Avoid

### 1. Digital Storage
❌ Storing mnemonic in:
- Cloud storage (iCloud, Google Drive, Dropbox)
- Password managers
- Email
- Photos
- Text files

### 2. Insecure Generation
❌ Generating mnemonic:
- On compromised devices
- Using weak randomness
- By manually selecting words

### 3. Sharing
❌ Entering mnemonic:
- On websites
- In apps from unknown sources
- When someone asks for "verification"

### 4. Single Copy
❌ Keeping only one backup:
- Fire, flood, theft can destroy it
- Always maintain redundant copies

---

## Verification and Validation

### Valid Mnemonic Checklist

1. ✅ Word count is 12, 15, 18, 21, or 24
2. ✅ All words are in the BIP39 wordlist
3. ✅ Words are in exact order
4. ✅ Checksum validates correctly
5. ✅ Derives expected address

### Testing Your Backup

1. Generate wallet, note the address
2. Clear wallet from device
3. Restore using your backup
4. Verify same address is derived
5. Send small test transaction

---

## References

- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP39 Wordlists](https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-wordlists.md)
- [Ian Coleman's BIP39 Tool](https://iancoleman.io/bip39/) (use offline only!)

---

## Related Standards

- **BIP32**: Hierarchical Deterministic Wallets
- **BIP44**: Multi-Account Hierarchy
- **BIP43**: Purpose Field
- **SLIP44**: Registered Coin Types
"""

DERIVATION_PATHS_DOCUMENTATION = """# HD Wallet Derivation Paths

## Overview

Hierarchical Deterministic (HD) wallets use derivation paths to generate 
multiple addresses from a single seed. This allows one mnemonic to manage 
unlimited addresses in a deterministic, recoverable way.

---

## Path Format

Derivation paths follow this format:

```
m / purpose' / coin_type' / account' / change / address_index
```

### Components

| Component | Description | Example |
|-----------|-------------|---------|
| `m` | Master node (root) | Always `m` |
| `purpose'` | BIP number defining structure | `44'` for BIP44 |
| `coin_type'` | Cryptocurrency identifier | `60'` for Ethereum |
| `account'` | Account index | `0'`, `1'`, etc. |
| `change` | External (0) or internal (1) chain | Usually `0` |
| `address_index` | Address within account | `0`, `1`, `2`, etc. |

### Hardened vs Non-Hardened

- **Hardened** (marked with `'` or `h`): More secure, cannot derive parent
- **Non-hardened**: Can derive child public keys from parent public key

Ethereum uses hardened derivation for purpose, coin_type, and account.

---

## Ethereum Standard Path

### BIP44 Standard (Most Common)

```
m/44'/60'/0'/0/x
```

Where:
- `44'` = BIP44 purpose
- `60'` = Ethereum coin type (SLIP44)
- `0'` = First account
- `0` = External chain
- `x` = Address index (0, 1, 2, ...)

### First 5 Addresses

| Index | Path | Description |
|-------|------|-------------|
| 0 | `m/44'/60'/0'/0/0` | First address |
| 1 | `m/44'/60'/0'/0/1` | Second address |
| 2 | `m/44'/60'/0'/0/2` | Third address |
| 3 | `m/44'/60'/0'/0/3` | Fourth address |
| 4 | `m/44'/60'/0'/0/4` | Fifth address |

---

## Wallet-Specific Paths

Different wallets may use slightly different paths:

### MetaMask / Most Web Wallets
```
m/44'/60'/0'/0/x
```
Standard BIP44 path, increments address_index.

### Ledger Live
```
m/44'/60'/0'/0/x
```
Same as MetaMask.

### Legacy Ledger (MEW)
```
m/44'/60'/0'/x
```
Note: Missing the change component.

### Legacy Ledger Live
```
m/44'/60'/x'/0/0
```
Increments account instead of address_index.

### Trezor
```
m/44'/60'/0'/0/x
```
Standard BIP44 path.

### Jaxx
```
m/44'/60'/0'/0/x
```
Standard BIP44 path.

### Exodus
```
m/44'/60'/0'/0/x
```
Standard BIP44 path.

---

## Multi-Account Usage

### Account vs Address Index

You can organize addresses in two ways:

**Method 1: Multiple Addresses in One Account**
```
m/44'/60'/0'/0/0  ← Address 0
m/44'/60'/0'/0/1  ← Address 1
m/44'/60'/0'/0/2  ← Address 2
```

**Method 2: Multiple Accounts**
```
m/44'/60'/0'/0/0  ← Account 0, Address 0
m/44'/60'/1'/0/0  ← Account 1, Address 0
m/44'/60'/2'/0/0  ← Account 2, Address 0
```

### When to Use Each

| Method | Use Case |
|--------|----------|
| Multiple addresses | Privacy, receiving payments |
| Multiple accounts | Organizational separation |

---

## Other Ethereum Networks

### EVM-Compatible Chains

Most EVM chains use the same path as Ethereum:
```
m/44'/60'/0'/0/x
```

This includes:
- Polygon
- Binance Smart Chain
- Avalanche C-Chain
- Arbitrum
- Optimism
- Fantom

### Different Coin Types (Less Common)

Some networks register their own coin type:
- Ethereum Classic: `m/44'/61'/0'/0/x`
- Binance Chain (Beacon): `m/44'/714'/0'/0/x`

---

## Custom Derivation Paths

### When to Use Custom Paths

1. **Privacy**: Separate funds from main path
2. **Organization**: Business vs personal
3. **Compatibility**: Matching legacy wallet
4. **Advanced**: Multi-sig setups

### Creating Custom Paths

Valid path examples:
```
m/44'/60'/0'/0/0     ← Standard
m/44'/60'/1'/0/0     ← Second account
m/44'/60'/0'/0/100   ← 101st address
m/44'/60'/0'/1/0     ← Internal/change address
```

**Warning**: Document custom paths! Non-standard paths may not be recovered 
by default wallet restore processes.

---

## Path Recovery

### If You Don't Know Your Path

Try these common paths in order:

1. `m/44'/60'/0'/0/0` - Standard BIP44
2. `m/44'/60'/0'/0` - Legacy Ledger (no index)
3. `m/44'/60'/0'/0/0` through `/9` - First 10 addresses
4. `m/44'/60'/0'/0/0` through `m/44'/60'/9'/0/0` - First 10 accounts

### Path Recovery Tools

Use tools like:
- `derive_multiple_accounts` - Try multiple indices
- Wallet discovery features in some wallets
- Block explorer address lookup

---

## Security Considerations

### Public Key Exposure

- Non-hardened paths allow deriving child public keys
- Never expose extended public key (xpub) at account level or higher
- Address-level xpub is generally safe to share

### Path Documentation

Always document:
1. Exact derivation path used
2. Which wallet created it
3. Any non-standard components

### Backup Includes Path

Your backup should include:
1. Mnemonic phrase
2. Passphrase (if used)
3. Derivation path (if non-standard)

---

## Common Mistakes

### 1. Wrong Path on Restore
**Problem**: Restoring with different path = different addresses
**Solution**: Document and verify paths

### 2. Hardened vs Non-Hardened Confusion
**Problem**: `0` vs `0'` are completely different!
**Solution**: Copy paths exactly, including apostrophes

### 3. Legacy Path Compatibility
**Problem**: Old wallet used non-standard path
**Solution**: Try known legacy paths, check wallet documentation

### 4. Lost Custom Path
**Problem**: Used custom path, didn't document it
**Solution**: Brute-force common variations (tedious but possible)

---

## Quick Reference

### Standard Ethereum Path
```
m/44'/60'/0'/0/0
```

### Derive 5 Addresses
```
m/44'/60'/0'/0/0
m/44'/60'/0'/0/1
m/44'/60'/0'/0/2
m/44'/60'/0'/0/3
m/44'/60'/0'/0/4
```

### Path Template
```
m / 44' / 60' / {account}' / 0 / {index}
```

---

## References

- [BIP32: HD Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP43: Purpose Field](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki)
- [BIP44: Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP44: Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
"""

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
