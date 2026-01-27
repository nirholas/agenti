# Common Workflows & Recipes

Real-world workflows combining multiple MCP server capabilities.

## Table of Contents

- [New User Onboarding](#new-user-onboarding)
- [Daily Operations](#daily-operations)
- [DeFi Workflows](#defi-workflows)
- [Security & Recovery](#security--recovery)
- [Development Patterns](#development-patterns)

---

## New User Onboarding

### Create Your First Wallet

```
Step 1: Generate a wallet with seed phrase
"Generate a new Ethereum wallet with a 12-word seed phrase"

Step 2: Verify the seed phrase
"Restore the wallet from this seed phrase to confirm: [your 12 words]"

Step 3: Create encrypted backup
"Create an encrypted keystore file for this wallet with password [your password]"

Step 4: Record your details
- Save the seed phrase OFFLINE (paper, metal plate)
- Save the keystore file to secure storage
- Note your public address for receiving funds
```

### Import an Existing Wallet

```
# From MetaMask/other wallet
"Import this private key and show me the address: 0x..."

# From hardware wallet export
"Restore wallet from seed phrase and derive the first 3 accounts"

# From old keystore
"Decrypt this keystore file: [paste JSON], password: [password]"
```

---

## Daily Operations

### Check an Address Before Sending

```
"Validate this address and convert to checksum format: 0x..."

Expected: Confirmation of validity + checksummed address
```

### Verify You Own an Address

```
"Sign this message with my private key to prove ownership:
Message: 'I own address 0xABC at timestamp 1234567890'
Private key: 0x..."

# Then verify
"Verify this signature matches address 0xABC:
Message: 'I own address 0xABC at timestamp 1234567890'
Signature: 0x..."
```

### Decode a Transaction

```
"Decode this raw transaction and tell me:
1. Who is the sender?
2. Who is the recipient?
3. How much ETH/tokens?
4. What function is being called?

Transaction: 0x02f8730180..."
```

---

## DeFi Workflows

### Uniswap Token Approval (Traditional)

```
Step 1: Build the approval transaction
"Build an ERC-20 approve transaction:
- Token: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC)
- Spender: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D (Uniswap V2 Router)
- Amount: unlimited (max uint256)
- From: 0x... (my address)
- Chain ID: 1
- Nonce: [your nonce]
- Gas: 50000
- Max fee: 30 gwei"

Step 2: Sign and get raw transaction
"Sign this transaction with private key: 0x..."

Step 3: Review before broadcast
"Decode the signed transaction to verify it's correct"
```

### Gasless Approval with EIP-712 Permit

```
Step 1: Create permit signature
"Sign an EIP-712 permit for USDC:
- Owner: 0x... (my address)
- Spender: 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
- Value: 1000000000 (1000 USDC)
- Nonce: 0
- Deadline: 1735689600
- Private key: 0x...
- USDC address: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- Chain ID: 1"

Result: You get v, r, s values to submit with your swap transaction
No separate approval transaction needed = No gas spent on approval!
```

### Multi-Sig Preparation

```
"I need to prepare a transaction for a 2-of-3 multisig:

Transaction details:
- To: 0x...
- Value: 5 ETH
- Data: 0x (simple transfer)

Please:
1. Build the transaction
2. Compute the transaction hash
3. Sign with signer 1 key: 0x...
4. Sign with signer 2 key: 0x...

Return the signatures separately for submission"
```

---

## Security & Recovery

### Emergency Key Rotation

```
Step 1: Generate new wallet
"Generate a new secure wallet with 24-word mnemonic"

Step 2: Create encrypted backup
"Encrypt this new wallet to keystore with a strong password"

Step 3: Verify recovery
"Restore the wallet from the mnemonic to verify it works"

Step 4: Plan fund migration
"Build an unsigned transaction to send all ETH from old address to new address"
```

### Audit a Private Key

```
"Perform a security audit on this private key:
0x...

Check:
1. Is it a valid secp256k1 key?
2. Is it a known weak key?
3. What address does it derive to?
4. Any security concerns?"
```

### Verify a Seed Phrase Backup

```
"Verify this seed phrase is valid and show me:
1. Is it a valid BIP39 mnemonic?
2. What is the checksum word?
3. The address at standard path m/44'/60'/0'/0/0
4. The address at path m/44'/60'/0'/0/1

Mnemonic: [your 12/24 words]"
```

### Recover from Partial Information

```
"I have a mnemonic but forgot which derivation path I used.
Derive addresses for these common paths and tell me which matches 0xABC:
- m/44'/60'/0'/0/0 (standard)
- m/44'/60'/0'/0/1
- m/44'/60'/1'/0/0
- m/44'/60'/0'/0 (legacy MEW)

Mnemonic: [words]"
```

---

## Development Patterns

### Smart Contract Testing Setup

```
"Set up 5 test wallets for smart contract testing:
1. Deployer account
2. Admin account
3. User 1
4. User 2
5. Attacker (for security testing)

Generate from a single seed phrase so I can recreate them.
Return all addresses and private keys."
```

### Signature Testing

```
"I need to test my signature verification contract.

Generate test vectors:
1. Sign message 'test' with key 0x01...01
2. Sign message 'test' with key 0x02...02
3. Sign empty message with key 0x01...01
4. Sign very long message (1000 chars) with key 0x01...01

Return each signature with its components (v, r, s)"
```

### Transaction Fuzzing Setup

```
"Generate 10 different transaction types for testing:
1. Simple ETH transfer
2. ERC-20 transfer
3. Contract deployment (empty bytecode)
4. Legacy transaction (type 0)
5. EIP-2930 transaction (type 1)
6. EIP-1559 transaction (type 2)
7. Transaction with high nonce
8. Transaction with zero gas price
9. Transaction to zero address
10. Transaction with max value

Use test key 0x... and return raw signed transactions"
```

### Function Selector Database

```
"Decode these function selectors and tell me what they do:
- 0xa9059cbb
- 0x095ea7b3
- 0x23b872dd
- 0x70a08231
- 0x18160ddd
- 0x313ce567

Also compute selectors for:
- transfer(address,uint256)
- approve(address,uint256)
- balanceOf(address)"
```

---

## Batch Operations

### Airdrop Preparation

```
"I need to send tokens to 100 addresses. Help me prepare:

1. Validate all addresses in this list: [addresses]
2. Compute total gas needed (65000 per transfer)
3. Build unsigned transactions for each
4. Sign all with key: 0x...

Return summary and all raw transactions"
```

### Multi-Chain Deployment

```
"I need the same wallet on multiple chains:

Generate a wallet and show me:
1. The seed phrase (for backup)
2. Address (same on all EVM chains)
3. Signed test messages for:
   - Ethereum mainnet (chain 1)
   - Polygon (chain 137)
   - Arbitrum (chain 42161)
   
This proves I control the address on each chain"
```

---

## Quick Reference Prompts

### One-Liners

```
# Generate wallet
"Generate a new Ethereum wallet"

# Validate address
"Is 0x... a valid Ethereum address?"

# Sign message
"Sign 'Hello' with key 0x..."

# Decode transaction
"Decode transaction 0x02f8..."

# Get function selector
"Selector for transfer(address,uint256)"

# Convert address
"Checksum 0xabcd..."

# Derive address
"Address for private key 0x..."
```

### Common Patterns

```
# Create and backup
"Generate wallet → Create keystore → Verify recovery"

# Send tokens
"Build transaction → Sign → Decode to verify → [broadcast]"

# Approve and interact
"Create permit signature → Include in swap call"

# Verify ownership
"Sign message → Verify signature → Confirm address"

# Debug transaction
"Decode → Validate → Check signer → Analyze calldata"
```

---

## Error Recovery

### Transaction Failed - Debug

```
"My transaction failed. Help me understand why:

Raw transaction: 0x...

Please:
1. Decode the transaction
2. Check if nonce seems correct
3. Verify the signature
4. Check gas parameters
5. Decode and analyze the calldata"
```

### Signature Rejected - Debug

```
"A dApp is rejecting my signature. Debug it:

Message that was signed: 'Hello'
My address: 0x...
Signature: 0x...

Please:
1. Verify the signature format
2. Recover the signer
3. Compare to my address
4. Check if v value is 27/28 or 0/1"
```

### Wrong Address Derived - Debug

```
"I'm getting a different address than expected.

Seed: [12 words]
Expected address: 0xABC...
Getting address: 0xDEF...

Please derive using:
1. Standard Ethereum path
2. Legacy paths
3. Different account indices
4. Both checksummed and lowercase"
```
