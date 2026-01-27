"""
Signature Verification Workflow Prompts
"""

from mcp.server import Server


def register_verification_prompts(server: Server) -> None:
    """Register signature verification workflow prompts."""
    
    @server.prompt()
    async def verify_signature_workflow() -> str:
        """
        Guide through verifying a signature.
        """
        return """
# Signature Verification Workflow

I'll help you verify an Ethereum signature and recover the signer.

## Two Options:

### Option 1: Verify against expected signer
- I'll check if the signature matches a specific address
- Use when you know who should have signed

### Option 2: Recover signer only
- I'll tell you which address created the signature
- Use when you don't know who signed

## What I need:

1. **Original message** - Exact text that was signed
2. **Signature** - 65-byte hex signature (0x...)
3. **Expected address** (optional) - If verifying specific signer

## Common Issues I Can Help Debug:

- Wrong message (even a space matters!)
- Signature format issues (v value)
- Checksummed vs lowercase addresses
- Hex encoding mismatches

## Example:
```
Message: "Hello, Ethereum!"
Signature: 0x...
Expected: 0xABC...
```

What would you like to verify?
"""
    
    @server.prompt()
    async def debug_signature_workflow() -> str:
        """
        Help debug signature issues.
        """
        return """
# Debug Signature Issues

I'll help you troubleshoot signature problems.

## Common Issues:

### 1. Wrong Address Recovered
Possible causes:
- Message doesn't match exactly (whitespace, encoding)
- Signature v value is wrong format
- Using typed data but verifying as personal_sign

### 2. Invalid Signature Error
Possible causes:
- Signature length incorrect (should be 65 bytes / 130 hex chars)
- Non-hex characters in signature
- Corrupted signature data

### 3. Verification Fails On-Chain but Works Off-Chain
Possible causes:
- Different EIP-191 implementation
- String encoding differences
- Contract expects different signature format

## Debugging Steps:

1. **Check signature format** - I'll decompose and validate
2. **Verify message encoding** - Exact bytes matter
3. **Test v value formats** - Try 27/28 vs 0/1
4. **Compare hashes** - Ensure same hash off-chain and on-chain

## What I need:

- The signature
- The original message or typed data
- Any error messages you're seeing

Let me help you debug!
"""
    
    @server.prompt()
    async def signature_analysis_workflow() -> str:
        """
        Analyze a signature in detail.
        """
        return """
# Signature Analysis

I'll provide a complete analysis of an Ethereum signature.

## Analysis includes:

1. **Format validation**
   - Correct length (65 bytes)
   - Valid hex encoding

2. **Component breakdown**
   - r value (32 bytes)
   - s value (32 bytes)
   - v value (recovery parameter)

3. **V format detection**
   - Recovery ID (0/1)
   - Standard (27/28)
   - EIP-155 (chain-specific)

4. **EIP-2 compliance**
   - Is s in the low range?
   - Signature malleability check

5. **Normalization options**
   - Convert between v formats
   - Ensure low-s compliance

Just paste your signature and I'll analyze it!
"""
