"""
Typed Data Signing Workflow Prompts
"""

from mcp.server import Server


def register_typed_data_prompts(server: Server) -> None:
    """Register typed data workflow prompts."""
    
    @server.prompt()
    async def typed_data_workflow() -> str:
        """
        Guide through signing EIP-712 typed structured data.
        """
        return """
# EIP-712 Typed Data Signing Workflow

I'll help you sign structured data using EIP-712, the standard for human-readable signing.

## Common Use Cases:

1. **Permits** - Gasless token approvals
2. **DEX Orders** - Off-chain limit orders
3. **Delegation** - Voting power delegation
4. **Meta-transactions** - Gasless transactions

## What I need:

1. **Typed data structure** with:
   - `types` - Type definitions including EIP712Domain
   - `primaryType` - Main type being signed
   - `domain` - Context (name, version, chainId, verifyingContract)
   - `message` - The actual data to sign

2. **Private key** - Your 32-byte hex private key

## Getting Started:

**Option 1**: Use a template
- I can provide templates for common use cases
- Just tell me what you want to sign (permit, order, etc.)

**Option 2**: Provide your typed data
- If you have specific typed data, paste the JSON

## Example Domain:
```json
{
    "name": "My Protocol",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0x..."
}
```

What would you like to sign? I can help you build the typed data or use an existing structure.
"""
    
    @server.prompt()
    async def hash_typed_data_workflow() -> str:
        """
        Guide through computing EIP-712 hash without signing.
        """
        return """
# Compute EIP-712 Hash (No Signing)

I'll help you compute the EIP-712 hash of typed data without signing it.

## When to use this:

- Debugging signature issues
- Verifying hash computation matches on-chain
- Understanding what will be signed
- Testing typed data structure

## What I need:

Just the typed data structure (no private key needed):
```json
{
    "types": {...},
    "primaryType": "...",
    "domain": {...},
    "message": {...}
}
```

## What you'll get:

- The signing hash (what would be signed)
- Domain separator
- Struct hash
- Verification that your typed data is valid

Provide your typed data and I'll compute the hash.
"""
