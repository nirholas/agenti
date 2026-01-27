"""
Validation Workflow Prompts

Provides guided workflows for address validation.
"""

from mcp.server.fastmcp import FastMCP
from mcp.types import Prompt, PromptMessage, TextContent


def register_validation_prompts(server: FastMCP) -> None:
    """Register validation workflow prompts."""
    
    @server.prompt()
    async def address_validation_workflow() -> list[PromptMessage]:
        """
        Guide user through comprehensive address validation.
        
        Provides a step-by-step workflow for validating Ethereum addresses,
        including format detection, checksum verification, and normalization.
        """
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text="""I need to validate Ethereum addresses. Please help me with:

1. **Single Address Validation**
   - Check if an address is valid
   - Verify EIP-55 checksum if present
   - Return the properly checksummed version

2. **Batch Validation**
   - Validate multiple addresses at once
   - Identify any invalid addresses
   - Return all valid addresses in checksum format

3. **Address Comparison**
   - Compare two addresses for equality
   - Handle different case formats

Please provide the address(es) you'd like me to validate.

**Tools available:**
- `validate_address` - Validate a single address
- `batch_validate_addresses` - Validate multiple addresses
- `compare_addresses` - Compare two addresses
- `to_checksum_address` - Convert to checksum format"""
                )
            )
        ]
    
    @server.prompt()
    async def contract_interaction_prep() -> list[PromptMessage]:
        """
        Prepare for contract interaction.
        
        Guides through address validation, function selector encoding,
        and parameter preparation for contract calls.
        """
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text="""I want to prepare a contract interaction. Help me with:

1. **Contract Address Validation**
   - Validate the contract address
   - Ensure proper checksum format

2. **Function Selector**
   - Encode the function signature to a 4-byte selector
   - Or decode an existing selector to find the function

3. **Parameter Types**
   - Identify parameter types for the function
   - Help with encoding if needed

4. **Storage Slots** (if reading storage directly)
   - Calculate storage slot positions
   - Handle mappings and arrays

**Please provide:**
- Contract address
- Function name/signature OR selector to decode
- Any parameters to encode

**Tools available:**
- `validate_address` - Validate contract address
- `encode_function_selector` - Get function selector
- `decode_function_selector` - Decode selector to function
- `calculate_storage_slot` - Calculate storage positions"""
                )
            )
        ]
