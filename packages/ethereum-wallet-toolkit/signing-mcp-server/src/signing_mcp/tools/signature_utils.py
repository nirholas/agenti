"""
Signature Utility Tools

Tools for signature manipulation: decompose, compose, normalize.
"""

import re
from typing import Any, Dict

from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

HEX_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]*$')


# ============================================================================
# Helpers
# ============================================================================

def _normalize_hex(value: str) -> str:
    """Normalize hex string to have 0x prefix."""
    if value.startswith('0x') or value.startswith('0X'):
        return '0x' + value[2:].lower()
    return '0x' + value.lower()


def _validate_signature(signature: str) -> str:
    """Validate and normalize a signature."""
    if not signature:
        raise ValueError("Signature is required")
    
    sig = _normalize_hex(signature)
    sig_hex = sig[2:]
    
    if not HEX_PATTERN.match(sig_hex):
        raise ValueError("Signature must be hexadecimal")
    
    if len(sig_hex) != 130:
        raise ValueError(f"Signature must be 65 bytes (130 hex chars), got {len(sig_hex) // 2} bytes")
    
    return sig


# ============================================================================
# Core Functions
# ============================================================================

def decompose_signature_impl(signature: str) -> Dict[str, Any]:
    """
    Decompose a 65-byte signature into v, r, s components.
    """
    sig = _validate_signature(signature)
    sig_bytes = bytes.fromhex(sig[2:])
    
    # Split into r (32 bytes), s (32 bytes), v (1 byte)
    r = int.from_bytes(sig_bytes[0:32], 'big')
    s = int.from_bytes(sig_bytes[32:64], 'big')
    v = sig_bytes[64]
    
    # Determine v format
    if v in (0, 1):
        v_format = "recovery_id (0/1)"
        v_standard = v + 27
    elif v in (27, 28):
        v_format = "standard (27/28)"
        v_standard = v
    else:
        v_format = "EIP-155"
        v_standard = v
    
    return {
        'signature': sig,
        'v': v,
        'v_standard': v_standard,
        'v_format': v_format,
        'r': hex(r),
        's': hex(s),
        'r_bytes': 32,
        's_bytes': 32,
        'total_bytes': 65
    }


def compose_signature_impl(
    v: int,
    r: str,
    s: str,
    output_format: str = "standard"
) -> Dict[str, Any]:
    """
    Compose a signature from v, r, s components.
    """
    # Parse r and s
    r_hex = _normalize_hex(r)
    s_hex = _normalize_hex(s)
    
    r_int = int(r_hex, 16)
    s_int = int(s_hex, 16)
    
    # Normalize v
    if output_format == "recovery_id":
        if v >= 27:
            v_out = v - 27
        else:
            v_out = v
    else:  # standard
        if v < 27:
            v_out = v + 27
        else:
            v_out = v
    
    # Compose signature bytes
    r_bytes = r_int.to_bytes(32, 'big')
    s_bytes = s_int.to_bytes(32, 'big')
    v_byte = v_out.to_bytes(1, 'big')
    
    signature = '0x' + (r_bytes + s_bytes + v_byte).hex()
    
    return {
        'signature': signature,
        'v': v_out,
        'v_input': v,
        'output_format': output_format,
        'r': hex(r_int),
        's': hex(s_int),
        'bytes': 65
    }


def normalize_signature_impl(
    signature: str,
    target_format: str = "standard"
) -> Dict[str, Any]:
    """
    Normalize a signature to a specific v format.
    
    target_format: "standard" (27/28) or "recovery_id" (0/1)
    """
    sig = _validate_signature(signature)
    sig_bytes = bytes.fromhex(sig[2:])
    
    r = sig_bytes[0:32]
    s = sig_bytes[32:64]
    v = sig_bytes[64]
    
    # Convert v
    if target_format == "recovery_id":
        if v >= 27:
            v_new = v - 27
        else:
            v_new = v
        target_desc = "0/1 (recovery_id)"
    else:  # standard
        if v < 27:
            v_new = v + 27
        else:
            v_new = v
        target_desc = "27/28 (standard)"
    
    # Recompose
    new_sig = '0x' + (r + s + bytes([v_new])).hex()
    
    return {
        'original_signature': sig,
        'normalized_signature': new_sig,
        'original_v': v,
        'normalized_v': v_new,
        'target_format': target_desc,
        'changed': v != v_new
    }


def validate_signature_format_impl(signature: str) -> Dict[str, Any]:
    """
    Validate and analyze a signature's format.
    """
    try:
        sig = _validate_signature(signature)
    except ValueError as e:
        return {
            'is_valid': False,
            'error': str(e)
        }
    
    sig_bytes = bytes.fromhex(sig[2:])
    v = sig_bytes[64]
    r = int.from_bytes(sig_bytes[0:32], 'big')
    s = int.from_bytes(sig_bytes[32:64], 'big')
    
    # secp256k1 curve order
    n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    half_n = n // 2
    
    # Check s value (EIP-2)
    is_low_s = s <= half_n
    
    # Determine format
    if v in (0, 1):
        v_format = "recovery_id"
    elif v in (27, 28):
        v_format = "standard"
    else:
        v_format = "eip155"
    
    return {
        'is_valid': True,
        'signature': sig,
        'v': v,
        'v_format': v_format,
        'r_value': hex(r),
        's_value': hex(s),
        'is_low_s': is_low_s,
        's_status': "canonical (low-s)" if is_low_s else "non-canonical (high-s)",
        'eip2_compliant': is_low_s,
        'length_bytes': 65
    }


# ============================================================================
# Tool Registration
# ============================================================================

def register_signature_utils(server: Server) -> None:
    """Register signature utility tools with the MCP server."""
    
    @server.tool()
    async def decompose_signature(signature: str) -> Dict[str, Any]:
        """
        Decompose a 65-byte signature into v, r, s components.
        
        Args:
            signature: 65-byte signature in hex format
            
        Returns:
            Dictionary with v, r, s values and format information
        """
        try:
            return decompose_signature_impl(signature)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def compose_signature(
        v: int,
        r: str,
        s: str,
        output_format: str = "standard"
    ) -> Dict[str, Any]:
        """
        Compose a signature from v, r, s components.
        
        Args:
            v: Recovery parameter (0, 1, 27, or 28)
            r: 32-byte r value in hex
            s: 32-byte s value in hex
            output_format: "standard" (v=27/28) or "recovery_id" (v=0/1)
            
        Returns:
            Composed 65-byte signature
        """
        try:
            return compose_signature_impl(v, r, s, output_format)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def normalize_signature(
        signature: str,
        target_format: str = "standard"
    ) -> Dict[str, Any]:
        """
        Normalize a signature to a specific v format.
        
        Args:
            signature: 65-byte signature in hex
            target_format: "standard" (27/28) or "recovery_id" (0/1)
            
        Returns:
            Normalized signature
        """
        try:
            return normalize_signature_impl(signature, target_format)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def validate_signature_format(signature: str) -> Dict[str, Any]:
        """
        Validate and analyze a signature's format.
        
        Checks length, v value format, and EIP-2 compliance (low-s).
        
        Args:
            signature: Signature to validate
            
        Returns:
            Detailed validation results
        """
        try:
            return validate_signature_format_impl(signature)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['decompose_signature'] = decompose_signature
    server._tools['compose_signature'] = compose_signature
    server._tools['normalize_signature'] = normalize_signature
    server._tools['validate_signature_format'] = validate_signature_format
