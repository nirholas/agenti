"""
Signature Validation Tools

Implements validate_signature tool for ECDSA signature components.
"""

from mcp.server.fastmcp import FastMCP


# secp256k1 curve order
SECP256K1_ORDER = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
SECP256K1_HALF_ORDER = SECP256K1_ORDER // 2


def validate_signature_impl(v: int, r: str, s: str, strict: bool = True) -> dict:
    """
    Validate ECDSA signature components.
    
    Validates v, r, s signature values for correctness, checking ranges
    and optionally enforcing EIP-2 low-s requirement.
    
    Args:
        v: Recovery ID (27, 28, or EIP-155 encoded with chain ID)
        r: Signature r value (hex string with or without 0x)
        s: Signature s value (hex string with or without 0x)
        strict: If true, enforce EIP-2 low-s requirement
    
    Returns:
        Dictionary containing:
        - is_valid: Whether signature components are valid
        - v: Detailed v value info (value, recovery_id, is_eip155, chain_id)
        - r: Detailed r value info (value, byte_length, is_valid_range)
        - s: Detailed s value info (value, byte_length, is_valid_range, is_low_s)
        - validation_details: Individual validation checks
        - eip2_compliant: Whether signature meets EIP-2 requirements
        - warnings: Any warnings about the signature
    """
    warnings = []
    validation_details = {
        "r_not_zero": False,
        "s_not_zero": False,
        "r_below_curve_order": False,
        "s_below_curve_order": False,
        "s_is_low": False,
        "v_is_valid": False
    }
    
    # Parse r value
    r_hex = r.strip() if r else ""
    if r_hex.startswith('0x') or r_hex.startswith('0X'):
        r_hex = r_hex[2:]
    
    try:
        r_int = int(r_hex, 16) if r_hex else 0
        r_bytes = len(r_hex) // 2
    except ValueError:
        return {
            "is_valid": False,
            "error": "Invalid r value: not valid hex",
            "v": None,
            "r": None,
            "s": None,
            "validation_details": validation_details,
            "eip2_compliant": False,
            "warnings": ["r value is not valid hex"]
        }
    
    # Parse s value
    s_hex = s.strip() if s else ""
    if s_hex.startswith('0x') or s_hex.startswith('0X'):
        s_hex = s_hex[2:]
    
    try:
        s_int = int(s_hex, 16) if s_hex else 0
        s_bytes = len(s_hex) // 2
    except ValueError:
        return {
            "is_valid": False,
            "error": "Invalid s value: not valid hex",
            "v": None,
            "r": None,
            "s": None,
            "validation_details": validation_details,
            "eip2_compliant": False,
            "warnings": ["s value is not valid hex"]
        }
    
    # Validate r
    if r_int > 0:
        validation_details["r_not_zero"] = True
    else:
        warnings.append("r value is zero")
    
    if r_int < SECP256K1_ORDER:
        validation_details["r_below_curve_order"] = True
    else:
        warnings.append("r value exceeds curve order")
    
    r_valid_range = r_int > 0 and r_int < SECP256K1_ORDER
    
    # Validate s
    if s_int > 0:
        validation_details["s_not_zero"] = True
    else:
        warnings.append("s value is zero")
    
    if s_int < SECP256K1_ORDER:
        validation_details["s_below_curve_order"] = True
    else:
        warnings.append("s value exceeds curve order")
    
    s_valid_range = s_int > 0 and s_int < SECP256K1_ORDER
    
    # Check low-s (EIP-2)
    is_low_s = s_int <= SECP256K1_HALF_ORDER
    validation_details["s_is_low"] = is_low_s
    
    if not is_low_s and strict:
        warnings.append("s value is high (not EIP-2 compliant)")
    
    # Validate v
    recovery_id = None
    is_eip155 = False
    chain_id = None
    
    if v == 27 or v == 28:
        # Standard recovery id
        validation_details["v_is_valid"] = True
        recovery_id = v - 27
        is_eip155 = False
    elif v >= 35:
        # EIP-155 encoded
        # v = chain_id * 2 + 35 + recovery_id
        # recovery_id is 0 or 1
        validation_details["v_is_valid"] = True
        is_eip155 = True
        
        # Determine recovery_id and chain_id
        if (v - 35) % 2 == 0:
            recovery_id = 0
            chain_id = (v - 35) // 2
        else:
            recovery_id = 1
            chain_id = (v - 36) // 2
    else:
        warnings.append(f"Invalid v value: {v} (expected 27, 28, or >= 35)")
    
    # Determine overall validity
    is_valid = (
        validation_details["r_not_zero"] and
        validation_details["s_not_zero"] and
        validation_details["r_below_curve_order"] and
        validation_details["s_below_curve_order"] and
        validation_details["v_is_valid"]
    )
    
    if strict and not is_low_s:
        is_valid = False
    
    return {
        "is_valid": is_valid,
        "v": {
            "value": v,
            "recovery_id": recovery_id,
            "is_eip155": is_eip155,
            "chain_id": chain_id
        },
        "r": {
            "value": "0x" + r_hex,
            "byte_length": r_bytes,
            "is_valid_range": r_valid_range
        },
        "s": {
            "value": "0x" + s_hex,
            "byte_length": s_bytes,
            "is_valid_range": s_valid_range,
            "is_low_s": is_low_s
        },
        "validation_details": validation_details,
        "eip2_compliant": is_low_s and is_valid,
        "warnings": warnings
    }


def register_signature_tools(server: FastMCP) -> None:
    """Register signature validation tools with the MCP server."""
    
    @server.tool()
    async def validate_signature(
        v: int,
        r: str,
        s: str,
        strict: bool = True
    ) -> dict:
        """
        Validate ECDSA signature components.
        
        Validates v, r, s signature values for correctness, checking ranges
        and optionally enforcing EIP-2 low-s requirement.
        
        Args:
            v: Recovery ID (27, 28, or EIP-155 encoded with chain ID)
            r: Signature r value (hex string with or without 0x)
            s: Signature s value (hex string with or without 0x)
            strict: If true, enforce EIP-2 low-s requirement
        
        Returns:
            Dictionary containing:
            - is_valid: Whether signature components are valid
            - v: Detailed v value info (value, recovery_id, is_eip155, chain_id)
            - r: Detailed r value info (value, byte_length, is_valid_range)
            - s: Detailed s value info (value, byte_length, is_valid_range, is_low_s)
            - validation_details: Individual validation checks
            - eip2_compliant: Whether signature meets EIP-2 requirements
            - warnings: Any warnings about the signature
        """
        return validate_signature_impl(v, r, s, strict)
