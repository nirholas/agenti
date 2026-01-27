"""
Encoding Helper Prompts

Provides guided workflows for encoding/decoding Ethereum data.
"""

from mcp.server.fastmcp import FastMCP
from mcp.types import PromptMessage, TextContent


def register_encoding_prompts(server: FastMCP) -> None:
    """Register encoding helper prompts."""
    
    @server.prompt()
    async def data_encoding_helper() -> list[PromptMessage]:
        """
        Help with encoding/decoding various Ethereum data types.
        
        Supports addresses, function selectors, hashes, and storage slots.
        """
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text="""I need help encoding or decoding Ethereum data.

## Supported Operations:

### 1. Address Operations
- Validate address format
- Convert to checksum format
- Compare addresses

### 2. Function Selectors
- Encode: `transfer(address,uint256)` → `0xa9059cbb`
- Decode: `0xa9059cbb` → `transfer(address,uint256)`

### 3. Hashing
- Compute keccak256 hash of data
- Hash text strings or hex data
- Compute ENS namehash

### 4. Storage Slots
- Simple slot positions
- Mapping slot calculation: `keccak256(key . slot)`
- Dynamic array slot calculation

### 5. Hex Data Validation
- Validate hex format
- Detect data type from length
- Get byte statistics

**What would you like to encode or decode?**

**Tools available:**
- `to_checksum_address` - Checksum conversion
- `encode_function_selector` - Signature → selector
- `decode_function_selector` - Selector → signature
- `keccak256_hash` - Compute hash
- `validate_ens_name` - ENS validation and namehash
- `calculate_storage_slot` - Storage positions
- `validate_hex_data` - Hex validation"""
                )
            )
        ]
    
    @server.prompt()
    async def function_selector_lookup() -> list[PromptMessage]:
        """
        Look up or compute function selectors.
        
        Helps find function signatures from selectors or compute
        selectors from signatures.
        """
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text="""I need help with Ethereum function selectors.

## What I Can Help With:

### Encode Signature → Selector
Given a function signature like:
```
transfer(address,uint256)
```
I'll compute the 4-byte selector: `0xa9059cbb`

### Decode Selector → Signature
Given a selector like:
```
0xa9059cbb
```
I'll look up known function signatures.

### Common Selectors Reference
- ERC-20: transfer, approve, transferFrom, balanceOf
- ERC-721: safeTransferFrom, ownerOf, tokenURI
- ERC-1155: safeTransferFrom, balanceOf
- DeFi: swap, addLiquidity, removeLiquidity
- Permit: permit, nonces, DOMAIN_SEPARATOR

**Please provide:**
- A function signature to encode, OR
- A selector to decode

**Tools available:**
- `encode_function_selector` - Compute selector
- `decode_function_selector` - Look up signature
- Resource: `validation://function-selectors-db` - Full database"""
                )
            )
        ]
