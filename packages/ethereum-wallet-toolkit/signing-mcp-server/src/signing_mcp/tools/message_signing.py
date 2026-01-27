"""
EIP-191 Message Signing Tools

Implements personal_sign (EIP-191) message signing operations.
"""

import re
from typing import Any, Dict

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import to_checksum_address
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

HEX_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]*$')


# ============================================================================
# Validation Helpers
# ============================================================================

def _normalize_hex(value: str) -> str:
    """Normalize hex string to have 0x prefix."""
    if value.startswith('0x') or value.startswith('0X'):
        return '0x' + value[2:].lower()
    return '0x' + value.lower()


def _validate_private_key(private_key: str) -> str:
    """Validate and normalize a private key."""
    if not private_key:
        raise ValueError("Private key is required")
    
    key = _normalize_hex(private_key)
    key_hex = key[2:]
    
    if not HEX_PATTERN.match(key_hex):
        raise ValueError("Private key must be hexadecimal")
    
    if len(key_hex) != 64:
        raise ValueError(f"Private key must be 32 bytes (64 hex chars), got {len(key_hex)}")
    
    # Validate it's a valid secp256k1 private key
    key_int = int(key_hex, 16)
    secp256k1_n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    
    if key_int == 0:
        raise ValueError("Private key cannot be zero")
    if key_int >= secp256k1_n:
        raise ValueError("Private key must be less than secp256k1 curve order")
    
    return key


def _validate_signature(signature: str) -> str:
    """Validate and normalize a signature."""
    if not signature:
        raise ValueError("Signature is required")
    
    sig = _normalize_hex(signature)
    sig_hex = sig[2:]
    
    if not HEX_PATTERN.match(sig_hex):
        raise ValueError("Signature must be hexadecimal")
    
    if len(sig_hex) != 130:  # 65 bytes = 130 hex chars
        raise ValueError(f"Signature must be 65 bytes (130 hex chars), got {len(sig_hex) // 2} bytes")
    
    return sig


def _validate_address(address: str) -> str:
    """Validate and normalize an Ethereum address."""
    if not address:
        raise ValueError("Address is required")
    
    addr = _normalize_hex(address)
    addr_hex = addr[2:]
    
    if not HEX_PATTERN.match(addr_hex):
        raise ValueError("Address must be hexadecimal")
    
    if len(addr_hex) != 40:
        raise ValueError(f"Address must be 20 bytes (40 hex chars), got {len(addr_hex)}")
    
    try:
        return to_checksum_address(addr)
    except Exception as e:
        raise ValueError(f"Invalid address format: {e}")


# ============================================================================
# Core Signing Functions
# ============================================================================

def sign_message_impl(message: str, private_key: str) -> Dict[str, Any]:
    """
    Sign a message using EIP-191 (personal_sign) format.
    
    This prefixes the message with "\\x19Ethereum Signed Message:\\n<length>"
    before signing, preventing signed messages from being used as transactions.
    """
    key = _validate_private_key(private_key)
    
    account = Account.from_key(key)
    message_encoded = encode_defunct(text=message)
    signed = account.sign_message(message_encoded)
    
    # Get signature hex
    signature_hex = '0x' + signed.signature.hex()
    
    # Get message hash
    message_hash_attr = getattr(signed, 'message_hash', None) or getattr(signed, 'messageHash', None)
    message_hash_hex = '0x' + message_hash_attr.hex() if message_hash_attr else ''
    
    return {
        'message': message,
        'message_length': len(message),
        'signer': account.address,
        'signature': signature_hex,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s),
        'message_hash': message_hash_hex,
        'eip191_prefix': f"\\x19Ethereum Signed Message:\\n{len(message)}"
    }


def sign_message_hex_impl(message_hex: str, private_key: str) -> Dict[str, Any]:
    """
    Sign hex-encoded bytes using EIP-191 format.
    """
    key = _validate_private_key(private_key)
    
    # Validate and convert hex to bytes
    msg_hex = _normalize_hex(message_hex)
    try:
        message_bytes = bytes.fromhex(msg_hex[2:])
    except ValueError:
        raise ValueError("Invalid hex message format")
    
    account = Account.from_key(key)
    message_encoded = encode_defunct(primitive=message_bytes)
    signed = account.sign_message(message_encoded)
    
    signature_hex = '0x' + signed.signature.hex()
    message_hash_attr = getattr(signed, 'message_hash', None) or getattr(signed, 'messageHash', None)
    message_hash_hex = '0x' + message_hash_attr.hex() if message_hash_attr else ''
    
    return {
        'message_hex': msg_hex,
        'message_length_bytes': len(message_bytes),
        'signer': account.address,
        'signature': signature_hex,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s),
        'message_hash': message_hash_hex
    }


def verify_message_impl(message: str, signature: str, expected_address: str) -> Dict[str, Any]:
    """
    Verify a signed message.
    """
    sig = _validate_signature(signature)
    expected = _validate_address(expected_address)
    
    message_encoded = encode_defunct(text=message)
    
    try:
        recovered_address = Account.recover_message(message_encoded, signature=sig)
        recovered_checksum = to_checksum_address(recovered_address)
    except Exception as e:
        return {
            'is_valid': False,
            'error': f"Signature recovery failed: {str(e)}",
            'message': message,
            'expected_address': expected
        }
    
    is_match = recovered_checksum.lower() == expected.lower()
    
    return {
        'is_valid': is_match,
        'recovered_address': recovered_checksum,
        'expected_address': expected,
        'match': is_match,
        'message': message,
        'message_length': len(message)
    }


def recover_signer_impl(message: str, signature: str) -> Dict[str, Any]:
    """
    Recover the signer address from a signed message.
    """
    sig = _validate_signature(signature)
    
    message_encoded = encode_defunct(text=message)
    
    try:
        recovered_address = Account.recover_message(message_encoded, signature=sig)
        recovered_checksum = to_checksum_address(recovered_address)
    except Exception as e:
        return {
            'success': False,
            'error': f"Recovery failed: {str(e)}",
            'message': message
        }
    
    return {
        'success': True,
        'signer': recovered_checksum,
        'message': message,
        'signature': sig
    }


# ============================================================================
# Tool Registration
# ============================================================================

def register_message_signing_tools(server: Server) -> None:
    """Register EIP-191 message signing tools with the MCP server."""
    
    @server.tool()
    async def sign_message(
        message: str,
        private_key: str
    ) -> Dict[str, Any]:
        """
        Sign a text message using EIP-191 (personal_sign) format.
        
        This is the standard method for signing messages in Ethereum wallets.
        The message is prefixed with "\\x19Ethereum Signed Message:\\n<length>"
        to prevent signed messages from being used as transactions.
        
        Args:
            message: The text message to sign
            private_key: Hex-encoded 32-byte private key (with or without 0x prefix)
            
        Returns:
            Dictionary containing:
            - message: Original message
            - signer: Address that signed the message
            - signature: 65-byte signature in hex format
            - v, r, s: Signature components
            - message_hash: Hash that was actually signed
        """
        try:
            return sign_message_impl(message, private_key)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def sign_message_hex(
        message_hex: str,
        private_key: str
    ) -> Dict[str, Any]:
        """
        Sign hex-encoded bytes using EIP-191 format.
        
        Use this when signing raw bytes rather than text.
        
        Args:
            message_hex: Hex-encoded bytes to sign (with or without 0x prefix)
            private_key: Hex-encoded 32-byte private key
            
        Returns:
            Dictionary containing signature and related data
        """
        try:
            return sign_message_hex_impl(message_hex, private_key)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def verify_message(
        message: str,
        signature: str,
        expected_address: str
    ) -> Dict[str, Any]:
        """
        Verify an EIP-191 signed message.
        
        Recovers the signer from the signature and compares to the expected address.
        
        Args:
            message: Original message that was signed
            signature: 65-byte signature in hex format
            expected_address: Address expected to have signed the message
            
        Returns:
            Dictionary containing:
            - is_valid: True if signature is valid and from expected address
            - recovered_address: Address that actually signed
            - match: Whether addresses match
        """
        try:
            return verify_message_impl(message, signature, expected_address)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def recover_signer(
        message: str,
        signature: str
    ) -> Dict[str, Any]:
        """
        Recover the signer address from a signed message.
        
        Args:
            message: Original message that was signed
            signature: 65-byte signature in hex format
            
        Returns:
            Dictionary containing:
            - signer: Address that signed the message
            - success: Whether recovery was successful
        """
        try:
            return recover_signer_impl(message, signature)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['sign_message'] = sign_message
    server._tools['sign_message_hex'] = sign_message_hex
    server._tools['verify_message'] = verify_message
    server._tools['recover_signer'] = recover_signer
