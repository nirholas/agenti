"""
Checksum Conversion Tools

Implements to_checksum_address tool.
"""

from mcp.server.fastmcp import FastMCP
from eth_utils import to_checksum_address as eth_to_checksum, keccak


def to_checksum_impl(address: str) -> dict:
    """
    Convert any Ethereum address to EIP-55 checksummed format.
    
    Takes an address in any valid format and returns the properly
    checksummed version according to EIP-55 specification.
    
    Args:
        address: Any valid Ethereum address format
    
    Returns:
        Dictionary containing:
        - checksum_address: EIP-55 checksummed address
        - input_address: Original input
        - was_already_checksummed: Whether input was already checksummed
        - checksum_hash: Keccak256 hash used for checksumming
        - uppercase_positions: Indices of uppercase characters
        - lowercase_positions: Indices of lowercase characters
    """
    # Clean input
    addr = address.strip() if address else ""
    
    # Remove 0x prefix if present
    if addr.startswith('0x') or addr.startswith('0X'):
        addr_hex = addr[2:]
    else:
        addr_hex = addr
    
    # Validate length
    if len(addr_hex) != 40:
        return {
            "error": True,
            "code": "INVALID_LENGTH",
            "message": f"Invalid address length: {len(addr_hex)} (expected 40)"
        }
    
    # Validate hex
    try:
        int(addr_hex, 16)
    except ValueError:
        return {
            "error": True,
            "code": "INVALID_HEX",
            "message": "Address contains non-hex characters"
        }
    
    # Convert to lowercase for hashing
    addr_lower = addr_hex.lower()
    
    # Compute keccak256 hash of lowercase address
    hash_bytes = keccak(text=addr_lower)
    hash_hex = hash_bytes.hex()
    
    # Apply EIP-55 checksum
    checksum_chars = []
    uppercase_positions = []
    lowercase_positions = []
    
    for i, char in enumerate(addr_lower):
        if char.isalpha():
            if int(hash_hex[i], 16) >= 8:
                checksum_chars.append(char.upper())
                uppercase_positions.append(i)
            else:
                checksum_chars.append(char.lower())
                lowercase_positions.append(i)
        else:
            checksum_chars.append(char)
    
    checksum_address = "0x" + "".join(checksum_chars)
    
    # Check if input was already checksummed
    input_with_prefix = "0x" + addr_hex
    was_already_checksummed = (input_with_prefix == checksum_address)
    
    return {
        "checksum_address": checksum_address,
        "input_address": address,
        "was_already_checksummed": was_already_checksummed,
        "checksum_hash": "0x" + hash_hex,
        "uppercase_positions": uppercase_positions,
        "lowercase_positions": lowercase_positions
    }


# Aliases for consistency with naming convention
verify_checksum_impl = to_checksum_impl
is_checksum_address_impl = to_checksum_impl


def register_checksum_tools(server: FastMCP) -> None:
    """Register checksum tools with the MCP server."""
    
    @server.tool()
    async def to_checksum_address(
        address: str
    ) -> dict:
        """
        Convert any Ethereum address to EIP-55 checksummed format.
        
        Takes an address in any valid format and returns the properly
        checksummed version according to EIP-55 specification.
        
        Args:
            address: Any valid Ethereum address format
        
        Returns:
            Dictionary containing:
            - checksum_address: EIP-55 checksummed address
            - input_address: Original input
            - was_already_checksummed: Whether input was already checksummed
            - checksum_hash: Keccak256 hash used for checksumming
            - uppercase_positions: Indices of uppercase characters
            - lowercase_positions: Indices of lowercase characters
        """
        return to_checksum_impl(address)
