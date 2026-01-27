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
