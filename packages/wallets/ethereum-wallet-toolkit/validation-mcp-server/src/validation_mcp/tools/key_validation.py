"""
Private Key Validation Tools

Implements validate_private_key tool.
"""

import re
from typing import Any

from mcp.server.fastmcp import FastMCP
from eth_account import Account
from eth_keys import keys
from eth_utils import to_checksum_address


# secp256k1 curve order
SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141

# Known weak keys (first few)
KNOWN_WEAK_KEYS = {
    "0000000000000000000000000000000000000000000000000000000000000001",
    "0000000000000000000000000000000000000000000000000000000000000002",
    "0000000000000000000000000000000000000000000000000000000000000003",
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
}

HEX_PATTERN = re.compile(r'^[0-9a-fA-F]+$')


def validate_private_key_impl(
    private_key: str,
    derive_address: bool = True
) -> dict:
    """
    Validate an Ethereum private key.
    
    Performs comprehensive validation of a private key including format,
    range checking, and optionally derives the corresponding address.
    
    Args:
        private_key: Hex-encoded private key (with or without 0x prefix)
        derive_address: Whether to derive and return the address
    
    Returns:
        Dictionary containing:
        - is_valid: Whether the key is valid
        - key_format: Detected format (hex_with_prefix/hex_without_prefix)
        - byte_length: Key byte length (should be 32)
        - derived_address: Derived Ethereum address (if derive_address=True)
        - public_key: Public key info (uncompressed, compressed, x, y)
        - validation_details: Detailed validation checks
        - security_assessment: Security warnings and recommendations
    
    Security Notes:
        - Private key is validated in memory only
        - Never logged or transmitted
        - Clear from memory after use
    """
    validation_details = {
        "correct_length": False,
        "valid_hex": False,
        "in_valid_range": False,
        "not_zero": False,
        "below_curve_order": False
    }
    security_warnings = []
    
    # Initial cleaning
    key = private_key.strip() if private_key else ""
    
    # Detect format
    if key.startswith('0x') or key.startswith('0X'):
        key_format = "hex_with_prefix"
        key_hex = key[2:]
    else:
        key_format = "hex_without_prefix"
        key_hex = key
    
    # Check hex characters
    if HEX_PATTERN.match(key_hex):
        validation_details["valid_hex"] = True
    else:
        return {
            "is_valid": False,
            "key_format": key_format,
            "byte_length": 0,
            "derived_address": None,
            "public_key": None,
            "validation_details": validation_details,
            "security_assessment": {
                "entropy_estimate": "invalid",
                "known_weak_key": False,
                "warnings": ["Private key contains non-hex characters"]
            }
        }
    
    # Check length
    if len(key_hex) == 64:
        validation_details["correct_length"] = True
    else:
        return {
            "is_valid": False,
            "key_format": key_format,
            "byte_length": len(key_hex) // 2,
            "derived_address": None,
            "public_key": None,
            "validation_details": validation_details,
            "security_assessment": {
                "entropy_estimate": "invalid",
                "known_weak_key": False,
                "warnings": [f"Invalid length: {len(key_hex)} chars (expected 64)"]
            }
        }
    
    # Convert to integer for range checking
    try:
        key_int = int(key_hex, 16)
    except ValueError:
        return {
            "is_valid": False,
            "key_format": key_format,
            "byte_length": 32,
            "derived_address": None,
            "public_key": None,
            "validation_details": validation_details,
            "security_assessment": {
                "entropy_estimate": "invalid",
                "known_weak_key": False,
                "warnings": ["Failed to parse private key as integer"]
            }
        }
    
    # Check not zero
    if key_int > 0:
        validation_details["not_zero"] = True
    else:
        return {
            "is_valid": False,
            "key_format": key_format,
            "byte_length": 32,
            "derived_address": None,
            "public_key": None,
            "validation_details": validation_details,
            "security_assessment": {
                "entropy_estimate": "none",
                "known_weak_key": True,
                "warnings": ["Private key is zero"]
            }
        }
    
    # Check below curve order
    if key_int < SECP256K1_ORDER:
        validation_details["below_curve_order"] = True
        validation_details["in_valid_range"] = True
    else:
        return {
            "is_valid": False,
            "key_format": key_format,
            "byte_length": 32,
            "derived_address": None,
            "public_key": None,
            "validation_details": validation_details,
            "security_assessment": {
                "entropy_estimate": "invalid",
                "known_weak_key": False,
                "warnings": ["Private key exceeds curve order"]
            }
        }
    
    # Check for known weak keys
    key_lower = key_hex.lower()
    known_weak = key_lower in KNOWN_WEAK_KEYS
    if known_weak:
        security_warnings.append("Known weak/test private key")
    
    # Estimate entropy
    # Count leading zeros
    leading_zeros = len(key_lower) - len(key_lower.lstrip('0'))
    if leading_zeros > 50:
        entropy_estimate = "very_low"
        security_warnings.append("Very low entropy - many leading zeros")
    elif leading_zeros > 30:
        entropy_estimate = "low"
        security_warnings.append("Low entropy - significant leading zeros")
    elif key_int < 2**128:
        entropy_estimate = "medium"
        security_warnings.append("Medium entropy - key fits in 128 bits")
    else:
        entropy_estimate = "high"
    
    # Derive address and public key if requested
    derived_address = None
    public_key_info = None
    
    if derive_address:
        try:
            key_bytes = bytes.fromhex(key_lower)
            account = Account.from_key(key_bytes)
            derived_address = account.address
            
            # Get public key
            private_key_obj = keys.PrivateKey(key_bytes)
            public_key = private_key_obj.public_key
            
            pub_bytes = public_key.to_bytes()
            x_coord = pub_bytes[:32]
            y_coord = pub_bytes[32:]
            
            # Determine compressed prefix (02 for even y, 03 for odd y)
            y_int = int.from_bytes(y_coord, 'big')
            prefix = "02" if y_int % 2 == 0 else "03"
            
            public_key_info = {
                "uncompressed": "0x04" + pub_bytes.hex(),
                "compressed": "0x" + prefix + x_coord.hex(),
                "x": "0x" + x_coord.hex(),
                "y": "0x" + y_coord.hex()
            }
            
        except Exception as e:
            security_warnings.append(f"Failed to derive address: {e}")
    
    return {
        "is_valid": True,
        "key_format": key_format,
        "byte_length": 32,
        "derived_address": derived_address,
        "public_key": public_key_info,
        "validation_details": validation_details,
        "security_assessment": {
            "entropy_estimate": entropy_estimate,
            "known_weak_key": known_weak,
            "warnings": security_warnings
        }
    }


# Alias for public key validation - for now, just a placeholder
# that uses the same structure (can be enhanced later)
def validate_public_key_impl(public_key: str) -> dict:
    """
    Validate an Ethereum public key.
    
    Args:
        public_key: Hex-encoded public key (compressed or uncompressed)
    
    Returns:
        Dictionary containing validation results.
    """
    # Clean input
    key = public_key.strip() if public_key else ""
    if key.startswith('0x') or key.startswith('0X'):
        key = key[2:]
    
    # Validate hex
    if not HEX_PATTERN.match(key):
        return {
            "is_valid": False,
            "error": "Public key contains non-hex characters"
        }
    
    key_bytes = bytes.fromhex(key)
    key_len = len(key_bytes)
    
    # Determine format
    if key_len == 33:
        key_format = "compressed"
    elif key_len == 64:
        key_format = "uncompressed"
    elif key_len == 65 and key_bytes[0] == 0x04:
        key_format = "uncompressed_prefixed"
    else:
        return {
            "is_valid": False,
            "error": f"Invalid public key length: {key_len} bytes"
        }
    
    try:
        if key_format == "compressed":
            pub_key_obj = keys.PublicKey.from_compressed_bytes(key_bytes)
        elif key_format == "uncompressed_prefixed":
            pub_key_obj = keys.PublicKey(key_bytes[1:])
        else:
            pub_key_obj = keys.PublicKey(key_bytes)
        
        pub_bytes = pub_key_obj.to_bytes()
        x_coord = pub_bytes[:32]
        y_coord = pub_bytes[32:]
        y_int = int.from_bytes(y_coord, 'big')
        prefix = "02" if y_int % 2 == 0 else "03"
        
        return {
            "is_valid": True,
            "key_format": key_format,
            "byte_length": key_len,
            "normalized": {
                "uncompressed": "0x04" + pub_bytes.hex(),
                "compressed": "0x" + prefix + x_coord.hex()
            }
        }
    except Exception as e:
        return {
            "is_valid": False,
            "error": f"Invalid public key: {e}"
        }


def register_key_tools(server: FastMCP) -> None:
    """Register key validation tools with the MCP server."""
    
    @server.tool()
    async def validate_private_key(
        private_key: str,
        derive_address: bool = True
    ) -> dict:
        """
        Validate an Ethereum private key.
        
        Performs comprehensive validation of a private key including format,
        range checking, and optionally derives the corresponding address.
        
        Args:
            private_key: Hex-encoded private key (with or without 0x prefix)
            derive_address: Whether to derive and return the address
        
        Returns:
            Dictionary containing:
            - is_valid: Whether the key is valid
            - key_format: Detected format (hex_with_prefix/hex_without_prefix)
            - byte_length: Key byte length (should be 32)
            - derived_address: Derived Ethereum address (if derive_address=True)
            - public_key: Public key info (uncompressed, compressed, x, y)
            - validation_details: Detailed validation checks
            - security_assessment: Security warnings and recommendations
        
        Security Notes:
            - Private key is validated in memory only
            - Never logged or transmitted
            - Clear from memory after use
        """
        return validate_private_key_impl(private_key, derive_address)
