"""
Message Signing Workflow Prompts
"""

from mcp.server import Server


def register_message_prompts(server: Server) -> None:
    """Register message signing workflow prompts."""
    
    @server.prompt()
    async def sign_message_workflow() -> str:
        """
        Guide through signing a message with EIP-191.
        """
        return """
# Message Signing Workflow (EIP-191)

I'll help you sign a message using the EIP-191 personal_sign standard.

## What I need from you:

1. **The message** - What text do you want to sign?
2. **Your private key** - The 32-byte hex private key (I'll keep this secure)

## What happens:

1. Your message will be prefixed with `\\x19Ethereum Signed Message:\\n<length>`
2. The prefixed message will be hashed with keccak256
3. The hash will be signed with your private key
4. You'll receive a 65-byte signature

## Security notes:

- Your private key is NEVER logged or stored
- The EIP-191 prefix prevents this signature from being used as a transaction
- The same message + key will always produce the same signature

## Example:

Message: "Hello, Ethereum!"
Result: A signature that proves you control your wallet address

Ready? Please provide your message and private key, and I'll use the `sign_message` tool.
"""
    
    @server.prompt()
    async def sign_hex_message_workflow() -> str:
        """
        Guide through signing hex-encoded bytes.
        """
        return """
# Sign Hex Data Workflow

I'll help you sign hex-encoded bytes using EIP-191.

## When to use this:

- Signing raw bytes instead of text
- Signing data that isn't valid UTF-8
- Matching signatures from systems that encode as hex

## What I need:

1. **Hex data** - The bytes to sign in hex format (0x... or without prefix)
2. **Private key** - Your 32-byte hex private key

## Example:

Hex data: `0x48656c6c6f` (this is "Hello" in hex)

Ready? Provide your hex data and private key.
"""
