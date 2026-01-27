"""
Security Audit Prompts

Provides guided workflows for security auditing keys and signatures.
"""

from mcp.server.fastmcp import FastMCP
from mcp.types import PromptMessage, TextContent


def register_security_prompts(server: FastMCP) -> None:
    """Register security audit prompts."""
    
    @server.prompt()
    async def key_security_audit() -> list[PromptMessage]:
        """
        Audit key material for security issues.
        
        Comprehensive security check for private keys including
        format validation, entropy assessment, and weak key detection.
        """
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text="""I need to audit a private key for security issues.

## Security Checks to Perform:

1. **Format Validation**
   - Correct length (32 bytes / 64 hex chars)
   - Valid hexadecimal characters
   - Within valid curve range

2. **Entropy Assessment**
   - Check for low entropy patterns
   - Identify suspicious leading zeros
   - Flag keys that fit in fewer bits than expected

3. **Weak Key Detection**
   - Check against known weak keys
   - Identify sequential patterns
   - Flag potential brain wallet derivations

4. **Address Derivation**
   - Derive the corresponding address
   - Verify derivation is correct

## ⚠️ SECURITY WARNING

- Never share real private keys
- Use only for testing or audit purposes
- Clear sensitive data after use

**Please provide the private key to audit, or ask me to generate test cases.**

**Tools available:**
- `validate_private_key` - Comprehensive key validation
- `derive_address_from_private_key` - Derive address
- Resource: `validation://known-weak-keys` - Weak key info"""
                )
            )
        ]
    
    @server.prompt()
    async def signature_validation_workflow() -> list[PromptMessage]:
        """
        Validate ECDSA signature components.
        
        Guide through validating v, r, s signature values
        and checking EIP-2 compliance.
        """
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text="""I need to validate ECDSA signature components.

## Validation Checks:

1. **R Value**
   - Must be non-zero
   - Must be less than curve order n
   - Should be 32 bytes

2. **S Value**
   - Must be non-zero
   - Must be less than curve order n
   - Must be "low-s" (≤ n/2) for EIP-2 compliance

3. **V Value**
   - Standard: 27 or 28
   - EIP-155: chainId * 2 + 35 + recovery_id

4. **Recovery**
   - Verify signature can recover a valid public key
   - Check recovered address matches expected signer

**Please provide:**
- v: Recovery ID
- r: Signature r value (hex)
- s: Signature s value (hex)
- (Optional) expected signer address

**Tools available:**
- `validate_signature` - Validate v, r, s components
- `derive_address_from_public_key` - Derive address from recovered pubkey"""
                )
            )
        ]
