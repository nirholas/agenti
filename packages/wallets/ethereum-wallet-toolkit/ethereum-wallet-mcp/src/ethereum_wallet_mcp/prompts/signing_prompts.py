"""
Signing Prompts for Ethereum Wallet MCP Server

This module implements MCP prompts (prompt templates) for guided signing operations:
- sign_permit: Guide users through creating ERC-20 permit signatures
- verify_signature_guide: Help users verify any type of signature
- explain_signature: Explain what a signature represents

These prompts provide step-by-step guidance for common signing operations
with embedded security best practices.
"""

import time
from typing import Optional
from mcp.server import Server
from mcp.types import Prompt, PromptMessage, TextContent, PromptArgument


def register_signing_prompts(server: Server) -> None:
    """
    Register all signing-related prompts with the MCP server.
    
    Args:
        server: MCP Server instance to register prompts with
    """
    
    @server.prompt()
    async def sign_permit(
        token_address: str = "",
        spender: str = "",
        amount: str = "",
        deadline: str = "1day"
    ) -> list[PromptMessage]:
        """
        Guided prompt for creating an ERC-20 permit signature.
        
        This prompt helps users create EIP-2612 permit signatures for gasless
        token approvals. It guides through building the typed data structure
        and explains how to use the resulting signature.
        
        Args:
            token_address: ERC-20 token contract address (e.g., USDC)
            spender: Address being approved to spend tokens
            amount: Amount to approve (in wei or with decimals notation)
            deadline: Unix timestamp or relative time ("1hour", "1day", "1week")
        
        Returns:
            List of prompt messages guiding the permit creation process
        """
        # Calculate deadline based on input
        current_time = int(time.time())
        deadline_value = ""
        deadline_explanation = ""
        
        if deadline.lower() in ("1hour", "1 hour"):
            deadline_value = str(current_time + 3600)
            deadline_explanation = "1 hour from now"
        elif deadline.lower() in ("1day", "1 day"):
            deadline_value = str(current_time + 86400)
            deadline_explanation = "1 day from now"
        elif deadline.lower() in ("1week", "1 week"):
            deadline_value = str(current_time + 604800)
            deadline_explanation = "1 week from now"
        elif deadline.lower() in ("1month", "1 month"):
            deadline_value = str(current_time + 2592000)
            deadline_explanation = "1 month from now"
        elif deadline.lower() == "max":
            deadline_value = "115792089237316195423570985008687907853269984665640564039457584007913129639935"
            deadline_explanation = "maximum (never expires)"
        else:
            # Assume it's a timestamp
            deadline_value = deadline
            deadline_explanation = f"Unix timestamp {deadline}"
        
        template = f"""# ERC-20 Permit Signature Guide

## What is a Permit?

A **permit** is a signature-based approval mechanism defined in EIP-2612. Instead of
calling the `approve()` function (which costs gas), you sign a message that grants
approval. Anyone can then submit this signature to the blockchain.

### Benefits
- ✅ **Gasless approval** - No transaction needed to approve
- ✅ **One-step operations** - Approve and use in a single transaction
- ✅ **Revocable** - Can be revoked by changing nonce or before deadline

### Security Notes
- ⚠️ Always verify the spender address is correct
- ⚠️ Set reasonable deadlines - don't use "max" unless necessary
- ⚠️ Review the amount carefully - unlimited approvals are risky

---

## Step 1: Gather Information

You'll need the following information:

| Field | Your Value | Description |
|-------|------------|-------------|
| Token Address | `{token_address or "0x..."}` | The ERC-20 token contract |
| Your Address | `(your wallet address)` | Owner granting approval |
| Spender | `{spender or "0x..."}` | Address receiving approval |
| Amount | `{amount or "(in wei)"}` | Amount to approve |
| Deadline | `{deadline_value}` | {deadline_explanation} |
| Nonce | `(from contract)` | Current nonce for your address |

### Getting the Nonce

The nonce must be queried from the token contract. Use:

```
nonce = contract.nonces(your_address)
```

Or use a block explorer to check your current nonce.

---

## Step 2: Build the Typed Data

```json
{{
  "types": {{
    "EIP712Domain": [
      {{"name": "name", "type": "string"}},
      {{"name": "version", "type": "string"}},
      {{"name": "chainId", "type": "uint256"}},
      {{"name": "verifyingContract", "type": "address"}}
    ],
    "Permit": [
      {{"name": "owner", "type": "address"}},
      {{"name": "spender", "type": "address"}},
      {{"name": "value", "type": "uint256"}},
      {{"name": "nonce", "type": "uint256"}},
      {{"name": "deadline", "type": "uint256"}}
    ]
  }},
  "primaryType": "Permit",
  "domain": {{
    "name": "TOKEN_NAME",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "{token_address or '0xTOKEN_ADDRESS'}"
  }},
  "message": {{
    "owner": "YOUR_ADDRESS",
    "spender": "{spender or '0xSPENDER_ADDRESS'}",
    "value": "{amount or 'AMOUNT_IN_WEI'}",
    "nonce": 0,
    "deadline": {deadline_value or 'DEADLINE_TIMESTAMP'}
  }}
}}
```

**Important**: Get the token name and version from the contract or documentation.
Common tokens:
- USDC: name="USD Coin", version="2"
- DAI: name="Dai Stablecoin", version="1"
- UNI: name="Uniswap", version="1"

---

## Step 3: Sign the Typed Data

Use the `sign_typed_data` tool with your completed typed data:

```
sign_typed_data(typed_data=<your typed data>, private_key=<your key>)
```

**Never share your private key!** The signing happens locally.

---

## Step 4: Use the Signature

The resulting signature can be submitted to a contract that supports permits.
Common patterns:

### Direct Permit Call
```solidity
token.permit(owner, spender, value, deadline, v, r, s)
```

### Permit + Action (e.g., Uniswap)
```solidity
router.swapWithPermit(
    swapParams,
    permitParams  // includes signature
)
```

---

## Common Issues

### "Invalid signature"
- Check that domain values match the contract exactly
- Verify nonce is correct (hasn't been used)
- Ensure deadline hasn't passed

### "Permit not supported"
- Not all ERC-20 tokens support permits
- Check if the token implements EIP-2612

### "Deadline expired"
- The signature deadline has passed
- Create a new signature with a future deadline

---

## Next Steps

1. Fill in your specific values in the template above
2. Use `sign_typed_data` to create the signature
3. Submit the signature along with your transaction

Need help? Use `generate_typed_data_template("permit")` for a fillable template.
"""
        
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=template
                )
            )
        ]
    
    
    @server.prompt()
    async def verify_signature_guide(
        signature_type: str = "personal"
    ) -> list[PromptMessage]:
        """
        Guided prompt for verifying any type of Ethereum signature.
        
        This prompt helps users understand and verify different types of
        signatures, including personal messages and typed data.
        
        Args:
            signature_type: Type of signature to verify:
                - "personal": EIP-191 personal_sign message
                - "typed_data": EIP-712 typed structured data
                - "transaction": Transaction signature
        
        Returns:
            List of prompt messages guiding the verification process
        """
        sig_type = signature_type.lower().strip()
        
        if sig_type == "typed_data":
            guide = """# EIP-712 Typed Data Signature Verification Guide

## What You're Verifying

EIP-712 signatures are used for structured data like:
- Token permits (approvals)
- DEX orders
- Meta-transactions
- Governance votes

---

## Required Information

To verify an EIP-712 signature, you need:

1. **The original typed data** (complete JSON structure)
2. **The signature** (65-byte hex string starting with 0x)
3. **Expected signer address** (optional, for validation)

---

## Verification Steps

### Step 1: Check You Have Complete Typed Data

Ensure your typed data includes:
```json
{
  "types": { ... },      // Type definitions
  "primaryType": "...",  // Main type being signed
  "domain": { ... },     // Domain separator
  "message": { ... }     // Signed message
}
```

### Step 2: Verify the Signature

Use `verify_typed_data`:
```
verify_typed_data(
    typed_data=<your typed data>,
    signature="0x...",
    expected_address="0x..."
)
```

Or recover the signer without an expected address:
```
recover_typed_data_signer(
    typed_data=<your typed data>,
    signature="0x..."
)
```

### Step 3: Interpret Results

The verification returns:
- `is_valid`: True if signature matches expected address
- `recovered_address`: Address that created the signature
- `domain`: Domain context of the signature

---

## Security Considerations

1. **Verify the domain** - Ensure chainId and contract match expectations
2. **Check expiration** - Many typed data include deadlines
3. **Validate the message** - Ensure signed data matches intended action
4. **Confirm signer** - The recovered address should be who you expect

---

## Common Issues

### Different Hash
If hash doesn't match expected:
- Types might be in different order
- Field values might be encoded differently
- Domain values might not match exactly

### Wrong Chain
Signatures are chain-specific. A signature for mainnet won't verify on Polygon.

---

## Example Verification

```python
result = await verify_typed_data(
    typed_data={
        "types": {...},
        "primaryType": "Permit",
        "domain": {...},
        "message": {...}
    },
    signature="0x4355c47d...",
    expected_address="0x742d35Cc..."
)

if result["is_valid"]:
    print("Signature is valid!")
else:
    print(f"Invalid! Expected {result['expected_address']}, got {result['recovered_address']}")
```
"""
        elif sig_type == "transaction":
            guide = """# Transaction Signature Verification Guide

## What You're Verifying

Transaction signatures authorize:
- ETH transfers
- Contract interactions
- Token transfers
- Any on-chain operation

---

## Understanding Transaction Signatures

Ethereum transactions are signed using ECDSA. The signature authorizes the
transaction to be executed and pays gas from the signer's account.

### Transaction Fields That Are Signed

- `nonce`: Transaction counter
- `gasPrice` or `maxFeePerGas`: Gas pricing
- `gasLimit`: Maximum gas
- `to`: Recipient address
- `value`: ETH amount
- `data`: Contract call data
- `chainId`: Network identifier

---

## Verification Approach

Transaction signatures are typically verified by:

1. **RLP encoding** the transaction fields
2. **Hashing** the encoded transaction
3. **Recovering** the signer from the signature

### Using eth-account

```python
from eth_account import Account

# Recover signer from signed transaction
tx_hash = Account.recover_transaction(signed_tx_bytes)
```

---

## Security Notes

⚠️ **Be very careful with transaction signatures!**

- A valid signature authorizes spending from the signer's account
- Always verify the transaction details before accepting
- Check nonce to prevent replay attacks
- Verify chainId matches expected network

---

## EIP-155 Replay Protection

Modern transactions include chainId in the signature:
- `v = chainId * 2 + 35 + recovery_bit`

This prevents signatures from being replayed on other chains.
"""
        else:  # personal
            guide = """# EIP-191 Personal Message Signature Verification Guide

## What You're Verifying

Personal message signatures (EIP-191) are used for:
- Sign-in with Ethereum (SIWE)
- Proving address ownership
- Off-chain agreements
- Message authentication

---

## Required Information

To verify a personal message signature, you need:

1. **The original message** (exact text that was signed)
2. **The signature** (65-byte hex string starting with 0x)
3. **Expected signer address** (optional, for validation)

---

## Verification Steps

### Step 1: Get the Exact Message

The message must be **exactly** as it was signed:
- Same text, same encoding
- Same whitespace and newlines
- Case-sensitive

### Step 2: Verify the Signature

Use `verify_message`:
```
verify_message(
    message="Hello, Ethereum!",
    signature="0x4355c47d...",
    expected_address="0x742d35Cc..."
)
```

Or recover the signer:
```
recover_signer(
    message="Hello, Ethereum!",
    signature="0x4355c47d..."
)
```

### Step 3: Interpret Results

The verification returns:
- `is_valid`: True if signature matches expected address
- `recovered_address`: Address that signed the message
- `match_details`: Detailed comparison results

---

## How EIP-191 Works

Before signing, the message is prefixed:
```
"\\x19Ethereum Signed Message:\\n" + len(message) + message
```

This:
1. Prevents message being used as a transaction
2. Makes it clear this is a signed message
3. Shows the message length

---

## Security Considerations

1. **Verify message content** - Read what was actually signed
2. **Check for replay** - Same message can be signed multiple times
3. **Time-bound when possible** - Include timestamps or nonces
4. **Context matters** - Understand why the message was signed

---

## Common Issues

### "Signature doesn't match"
- Message might have different encoding
- Whitespace or newlines might differ
- Make sure you have the exact original message

### "Invalid signature format"
- Signature should be 65 bytes (130 hex chars + 0x)
- Check v value is valid (27, 28, or EIP-155)

---

## Example Verification

```python
# Verify a signed message
result = await verify_message(
    message="I agree to the terms of service",
    signature="0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b915621c",
    expected_address="0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00"
)

if result["is_valid"]:
    print("Signature verified! User agreed to terms.")
else:
    print(f"Invalid signature. Got address: {result['recovered_address']}")
```

---

## Tools Available

- `verify_message` - Verify against expected address
- `recover_signer` - Get signer without expected address
- `decompose_signature` - Break down signature components
"""
        
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=guide
                )
            )
        ]
    
    
    @server.prompt()
    async def explain_signature(
        signature: str = "",
        context: str = ""
    ) -> list[PromptMessage]:
        """
        Guided prompt to explain what a signature represents.
        
        This prompt helps users understand the components of an Ethereum
        signature and what it might represent.
        
        Args:
            signature: The signature to analyze (65-byte hex)
            context: Optional context about what was signed
        
        Returns:
            List of prompt messages explaining the signature
        """
        # Analyze signature if provided
        sig_analysis = ""
        if signature:
            sig = signature[2:] if signature.startswith('0x') else signature
            if len(sig) == 130:
                r = sig[0:64]
                s = sig[64:128]
                v = int(sig[128:130], 16)
                
                # Interpret v value
                v_interpretation = ""
                if v in (27, 28):
                    v_interpretation = "Standard recovery ID"
                elif v in (0, 1):
                    v_interpretation = "Compact form (add 27 for standard)"
                elif v >= 35:
                    chain_id = (v - 35) // 2
                    v_interpretation = f"EIP-155 format (chainId: {chain_id})"
                else:
                    v_interpretation = "Unusual value"
                
                sig_analysis = f"""
## Your Signature Analysis

**Signature**: `{signature[:20]}...{signature[-8:]}`

### Components

| Component | Value | Notes |
|-----------|-------|-------|
| **r** | `0x{r[:16]}...` | First 32 bytes - ECDSA r value |
| **s** | `0x{s[:16]}...` | Second 32 bytes - ECDSA s value |
| **v** | `{v}` | {v_interpretation} |

### Length Check
- Total: {len(sig) // 2} bytes ({len(sig)} hex characters)
- Expected: 65 bytes (130 hex characters)
- Status: {"✅ Valid length" if len(sig) == 130 else "❌ Invalid length"}
"""
            else:
                sig_analysis = f"""
## Signature Analysis

**Provided**: `{signature[:30]}...`
**Length**: {len(sig)} hex characters ({len(sig) // 2} bytes)

⚠️ **Warning**: Standard Ethereum signatures are 65 bytes (130 hex characters).
Your signature appears to be {len(sig) // 2} bytes.
"""
        
        context_section = ""
        if context:
            context_section = f"""
## Provided Context

{context}

Based on this context, the signature likely represents:
- An authorization or agreement related to the described action
- A cryptographic proof of the signer's intent
"""
        
        template = f"""# Understanding Ethereum Signatures

{sig_analysis}
{context_section}

## What is an Ethereum Signature?

An Ethereum signature is a cryptographic proof that someone with a specific
private key approved a message or transaction. It consists of three components:

### Components

| Component | Size | Description |
|-----------|------|-------------|
| **r** | 32 bytes | X-coordinate of the curve point |
| **s** | 32 bytes | Signature proof value |
| **v** | 1 byte | Recovery identifier |

### The `v` Value

The `v` component helps recover the public key:

| Value | Meaning |
|-------|---------|
| 27 or 28 | Standard recovery IDs |
| 0 or 1 | Compact form |
| 35+ | EIP-155 with chain ID |

For EIP-155: `v = chainId * 2 + 35 + recoveryBit`

---

## Signature Types

### 1. Personal Message (EIP-191)
Used for signing text messages:
- Login/authentication
- Agreements
- Attestations

### 2. Typed Data (EIP-712)
Used for structured data:
- Token permits
- DEX orders
- Governance votes

### 3. Transaction
Used for blockchain transactions:
- ETH transfers
- Contract calls
- Token transfers

---

## Security Properties

A valid signature proves:

1. **Authenticity** - The signer controlled the private key
2. **Integrity** - The signed data hasn't been modified
3. **Non-repudiation** - The signer can't deny signing

⚠️ **A signature does NOT prove**:
- When it was created
- The signer's identity (only their address)
- That the signer understood what they signed

---

## Analyzing Unknown Signatures

To understand what a signature represents:

1. **Get the original data** - You need what was signed
2. **Recover the signer** - Use `recover_signer` or `recover_typed_data_signer`
3. **Verify context** - Understand why it was signed
4. **Check validity** - Ensure it hasn't expired or been revoked

---

## Tools to Use

- `decompose_signature` - Break into v, r, s
- `compose_signature` - Build from components
- `recover_signer` - Get signer from personal message
- `recover_typed_data_signer` - Get signer from typed data
- `verify_message` - Verify personal message signature
- `verify_typed_data` - Verify typed data signature

---

## Common Questions

### Can I tell what was signed from just the signature?
No. The signature is derived from a hash, which is one-way. You need the
original data to verify the signature.

### Can signatures be reused?
Yes, unless they include time limits, nonces, or other replay protection.
This is why proper signature schemes include these elements.

### Are signatures unique?
The same data + key will always produce the same signature (deterministic
signing). Different data or keys produce different signatures.
"""
        
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=template
                )
            )
        ]
