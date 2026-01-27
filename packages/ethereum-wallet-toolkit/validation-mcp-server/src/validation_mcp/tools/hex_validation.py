"""
Hex Data Validation Tools

Implements validate_hex_data tool.
"""

import re
from mcp.server.fastmcp import FastMCP


HEX_PATTERN = re.compile(r'^[0-9a-fA-F]+$')

# Common byte lengths for different types
TYPE_LENGTHS = {
    "address": 20,
    "private_key": 32,
    "public_key_compressed": 33,
    "public_key_uncompressed": 64,
    "public_key_uncompressed_prefixed": 65,
    "transaction_hash": 32,
    "block_hash": 32,
    "keccak_hash": 32,
    "signature_r": 32,
    "signature_s": 32,
    "function_selector": 4,
}


def validate_hex_impl(
    data: str,
    expected_type: str = "auto",
    expected_length: int = None
) -> dict:
    """
    Validate hexadecimal data for Ethereum use.
    
    Validates hex strings and attempts to identify their type based on
    length and format patterns.
    
    Args:
        data: Hex string to validate
        expected_type: Expected type - "auto", "address", "private_key", 
                      "public_key", "transaction_hash", "signature", "calldata"
        expected_length: Expected byte length (optional)
    
    Returns:
        Dictionary containing:
        - is_valid: Whether data is valid hex
        - input: Original input
        - normalized: Normalized lowercase with 0x prefix
        - has_0x_prefix: Whether input had 0x prefix
        - byte_length: Length in bytes
        - bit_length: Length in bits
        - detected_type: Auto-detected type
        - type_confidence: Confidence level (high/medium/low)
        - validation_details: Detailed validation checks
        - statistics: Byte statistics (zero_bytes, non_zero_bytes, etc.)
    """
    # Clean input
    hex_str = data.strip() if data else ""
        
    # Check for 0x prefix
    has_prefix = hex_str.startswith('0x') or hex_str.startswith('0X')
    if has_prefix:
        hex_str = hex_str[2:]
    
    # Validate hex characters
    if not hex_str:
        return {
            "is_valid": False,
            "input": data,
            "normalized": None,
            "has_0x_prefix": has_prefix,
            "byte_length": 0,
            "bit_length": 0,
            "detected_type": None,
            "type_confidence": "none",
            "validation_details": {
                "valid_hex_chars": False,
                "even_length": False,
                "matches_expected_length": False
            },
            "statistics": None
        }
    
    valid_hex = bool(HEX_PATTERN.match(hex_str))
    if not valid_hex:
        return {
            "is_valid": False,
            "input": data,
            "normalized": None,
            "has_0x_prefix": has_prefix,
            "byte_length": 0,
            "bit_length": 0,
            "detected_type": None,
            "type_confidence": "none",
            "validation_details": {
                "valid_hex_chars": False,
                "even_length": len(hex_str) % 2 == 0,
                "matches_expected_length": False
            },
            "statistics": None
        }
    
    # Check even length
    even_length = len(hex_str) % 2 == 0
    
    # Normalize (pad if odd length)
    if not even_length:
        hex_str = "0" + hex_str
    
    normalized = "0x" + hex_str.lower()
    byte_length = len(hex_str) // 2
    bit_length = byte_length * 8
    
    # Check expected length
    matches_expected = True
    if expected_length is not None:
        matches_expected = byte_length == expected_length
    
    # Detect type
    detected_type = None
    type_confidence = "low"
    
    if expected_type != "auto":
        detected_type = expected_type
        if expected_type in TYPE_LENGTHS:
            if byte_length == TYPE_LENGTHS[expected_type]:
                type_confidence = "high"
            else:
                type_confidence = "low"
        else:
            type_confidence = "medium"
    else:
        # Auto-detect based on length
        if byte_length == 20:
            detected_type = "address"
            type_confidence = "high"
        elif byte_length == 32:
            detected_type = "hash_or_key"  # Could be hash, private key, etc.
            type_confidence = "medium"
        elif byte_length == 33:
            detected_type = "public_key_compressed"
            type_confidence = "high"
        elif byte_length == 64:
            detected_type = "public_key_uncompressed"
            type_confidence = "medium"
        elif byte_length == 65:
            detected_type = "signature_or_pubkey"
            type_confidence = "medium"
        elif byte_length == 4:
            detected_type = "function_selector"
            type_confidence = "high"
        elif byte_length > 4 and byte_length % 32 == 4:
            detected_type = "calldata"
            type_confidence = "medium"
        else:
            detected_type = "unknown"
            type_confidence = "low"
    
    # Calculate statistics
    bytes_data = bytes.fromhex(hex_str.lower())
    zero_bytes = sum(1 for b in bytes_data if b == 0)
    non_zero_bytes = byte_length - zero_bytes
    
    # Count leading zeros
    leading_zeros = 0
    for b in bytes_data:
        if b == 0:
            leading_zeros += 1
        else:
            break
    
    return {
        "is_valid": True,
        "input": data,
        "normalized": normalized,
        "has_0x_prefix": has_prefix,
        "byte_length": byte_length,
        "bit_length": bit_length,
        "detected_type": detected_type,
        "type_confidence": type_confidence,
        "validation_details": {
            "valid_hex_chars": True,
            "even_length": even_length,
            "matches_expected_length": matches_expected
        },
        "statistics": {
            "zero_bytes": zero_bytes,
            "non_zero_bytes": non_zero_bytes,
            "leading_zeros": leading_zeros
        }
    }


def register_hex_tools(server: FastMCP) -> None:
    """Register hex validation tools with the MCP server."""
    
    @server.tool()
    async def validate_hex_data(
        data: str,
        expected_type: str = "auto",
        expected_length: int = None
    ) -> dict:
        """
        Validate hexadecimal data for Ethereum use.
        
        Validates hex strings and attempts to identify their type based on
        length and format patterns.
        
        Args:
            data: Hex string to validate
            expected_type: Expected type - "auto", "address", "private_key", 
                          "public_key", "transaction_hash", "signature", "calldata"
            expected_length: Expected byte length (optional)
        
        Returns:
            Dictionary containing:
            - is_valid: Whether data is valid hex
            - input: Original input
            - normalized: Normalized lowercase with 0x prefix
            - has_0x_prefix: Whether input had 0x prefix
            - byte_length: Length in bytes
            - bit_length: Length in bits
            - detected_type: Auto-detected type
            - type_confidence: Confidence level (high/medium/low)
            - validation_details: Detailed validation checks
            - statistics: Byte statistics (zero_bytes, non_zero_bytes, etc.)
        """
        return validate_hex_impl(data, expected_type, expected_length)
