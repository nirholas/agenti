"""
Transaction Decode Workflow Prompts

Guided prompts for transaction analysis.
"""

from mcp.server import Server


def register_decode_prompts(server: Server) -> None:
    """Register transaction decode workflow prompts."""
    
    @server.prompt()
    async def decode_transaction_guide() -> str:
        """
        Guide for decoding and understanding raw transactions.
        """
        return """# Transaction Decoding Guide

## Overview

Raw transactions are RLP-encoded hex strings. Decoding reveals:
- Transaction type
- Sender/recipient
- Value and gas settings
- Calldata
- Signature

## Step 1: Identify Transaction Type

By prefix:
- No prefix (starts with 0xf8...): Legacy (Type 0)
- Starts with 0x01: EIP-2930 (Type 1)
- Starts with 0x02: EIP-1559 (Type 2)

## Step 2: Decode with Tool

Use `decode_raw_transaction` with the raw hex:
```
raw_tx: "0x02f8..."
```

## Step 3: Interpret Results

### Basic Fields
- **nonce**: Transaction sequence number
- **to**: Recipient (null = contract creation)
- **value**: ETH amount in wei
- **data**: Input data (calldata)

### Gas Fields (Legacy)
- **gasPrice**: Price per gas unit

### Gas Fields (EIP-1559)
- **maxFeePerGas**: Maximum total fee
- **maxPriorityFeePerGas**: Tip for validator

### Signature
- **v, r, s** or **yParity, r, s**: ECDSA signature
- Can recover sender address

## Step 4: Analyze Calldata

If data field is not empty:
1. First 4 bytes = function selector
2. Remaining = encoded parameters

Use `decode_calldata` to identify function.

## Common Patterns

### Simple ETH Transfer
- data: "0x" (empty)
- value: > 0
- to: recipient address

### Token Transfer
- data: "0xa9059cbb..." (transfer selector)
- value: 0
- to: token contract

### Contract Interaction
- data: function calldata
- value: may or may not be 0
- to: contract address

## Verification Checklist

✓ Sender matches expected
✓ Recipient correct
✓ Value/amount correct
✓ Gas settings reasonable
✓ Chain ID matches network
✓ Nonce is current
"""
    
    @server.prompt()
    async def analyze_suspicious_transaction() -> str:
        """
        Guide for analyzing potentially suspicious transactions.
        """
        return """# Suspicious Transaction Analysis

## Red Flags to Check

### 1. Recipient Analysis
- Is it a known contract?
- Is it a fresh address?
- Has it received funds before?

### 2. Value Analysis
- Unexpectedly large amount?
- Draining entire balance?
- Round numbers vs exact amounts?

### 3. Calldata Analysis
- What function is being called?
- Are parameters reasonable?
- Infinite approval?

### 4. Gas Analysis
- Unusually high gas limit?
- Very high gas price (front-running)?
- Very low gas (will fail)?

## Decoding Steps

### Step 1: Decode Transaction
Use `decode_raw_transaction` to see all fields.

### Step 2: Identify Function
Use `decode_calldata` on the data field.

### Step 3: Verify Addresses
Check sender and recipient:
- Expected addresses?
- Contract or EOA?

### Step 4: Check Amounts
Verify value and token amounts:
- Convert from wei
- Account for decimals

## Common Attack Patterns

### Approval Phishing
- approve() to attacker's address
- Unlimited amount (2^256-1)
- Allows draining tokens

### Address Swap
- Looks like legitimate tx
- But recipient is different
- Check every character!

### Fake Token
- Transfer looks normal
- But token contract is fake
- Verify contract address

### High Gas Scam
- Sets very high gas limit
- Drains ETH through gas
- Check gas limit is reasonable

## Safe Practices

1. ALWAYS decode before signing
2. Verify ALL addresses character by character
3. Check function being called
4. Verify amounts match expectations
5. When in doubt, don't sign
"""
    
    @server.prompt()
    async def transaction_history_analysis() -> str:
        """
        Guide for analyzing transaction patterns.
        """
        return """# Transaction History Analysis

## Purpose

Analyzing past transactions helps:
- Understand account activity
- Identify patterns
- Detect anomalies
- Audit token flows

## Analysis Workflow

### Step 1: Collect Transactions
Gather raw transactions from:
- Block explorer APIs
- Node RPC calls
- Transaction hashes

### Step 2: Decode Each Transaction
Use `decode_raw_transaction` for each.

### Step 3: Categorize
Group by type:
- ETH transfers
- Token transfers
- Contract deployments
- DeFi interactions

### Step 4: Identify Patterns
Look for:
- Regular intervals
- Recurring recipients
- Consistent amounts
- Gas spending trends

## Common Patterns

### Normal User
- Occasional transfers
- Various recipients
- Mixed amounts
- Reasonable gas

### DeFi User
- Many contract interactions
- Swap operations
- Approval transactions
- Higher gas usage

### Bot Activity
- Precise intervals
- Programmatic patterns
- Front-running indicators
- Very high gas bids

### Suspicious Activity
- Draining transactions
- Many approvals
- Unknown contracts
- Unusual timing

## Metrics to Track

| Metric | What It Shows |
|--------|--------------|
| Tx count | Activity level |
| Unique recipients | Network size |
| Total value | Volume moved |
| Avg gas price | Urgency patterns |
| Failed tx ratio | User experience |

## Red Flags

⚠️ Sudden increase in approvals
⚠️ Transfers to new addresses
⚠️ High-value transactions at unusual times
⚠️ Transactions to known scam addresses
⚠️ Approve followed immediately by transferFrom
"""
