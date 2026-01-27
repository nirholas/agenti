"""
Signing Tools for Ethereum Wallet MCP Server

This module implements MCP tools for EIP-191 message signing operations:
- sign_message: Sign a message using EIP-191 personal_sign format
- sign_message_hex: Sign hex-encoded bytes using EIP-191 format
- verify_message: Verify an EIP-191 signed message
- recover_signer: Recover signer address from a signed message
- sign_hash: Sign a raw 32-byte hash (dangerous)
- decompose_signature: Break down a signature into v, r, s components
- compose_signature: Compose a signature from v, r, s components

Security Note: Private keys are never logged or persisted.
All operations use the eth-account library's secure implementations.
"""

import re
import hmac
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import to_checksum_address, is_hex, keccak
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

HEX_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]+$')
SIGNATURE_LENGTH_BYTES = 65
SIGNATURE_LENGTH_HEX = 130  # 65 bytes * 2


# ============================================================================
# Error Classes
# ============================================================================

class SigningError(Exception):
    """Base exception for signing operations."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
    
    def to_dict(self) -> dict:
        return {"error": True, "code": self.code, "message": self.message}


class InvalidSignatureError(SigningError):
    """Raised when a signature format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_SIGNATURE", message)


class InvalidKeyError(SigningError):
    """Raised when a private key format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_KEY", message)


class InvalidAddressError(SigningError):
    """Raised when an address format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_ADDRESS", message)


class InvalidHashError(SigningError):
    """Raised when a hash format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_HASH", message)


class RiskAcknowledgementRequired(SigningError):
    """Raised when user must acknowledge risk for dangerous operations."""
    def __init__(self, message: str):
        super().__init__("RISK_ACKNOWLEDGEMENT_REQUIRED", message)


# ============================================================================
# Validation Functions
# ============================================================================

def _normalize_hex(value: str) -> str:
    """Normalize hex string to have 0x prefix."""
    if value.startswith('0x') or value.startswith('0X'):
        return '0x' + value[2:]
    return '0x' + value


def _validate_private_key(private_key: str) -> str:
    """
    Validate and normalize a private key.
    
    Returns the normalized private key with 0x prefix.
    Raises InvalidKeyError if invalid.
    """
    if not private_key:
        raise InvalidKeyError("Private key is required")
    
    # Normalize
    key = _normalize_hex(private_key)
    key_hex = key[2:]
    
    # Check format
    if not HEX_PATTERN.match(key_hex):
        raise InvalidKeyError("Private key must be hexadecimal")
    
    # Check length (32 bytes = 64 hex chars)
    if len(key_hex) != 64:
        raise InvalidKeyError(f"Private key must be 32 bytes (64 hex chars), got {len(key_hex)}")
    
    return key


def _validate_signature(signature: str) -> str:
    """
    Validate and normalize a signature.
    
    Returns the normalized signature with 0x prefix.
    Raises InvalidSignatureError if invalid.
    """
    if not signature:
        raise InvalidSignatureError("Signature is required")
    
    # Normalize
    sig = _normalize_hex(signature)
    sig_hex = sig[2:]
    
    # Check format
    if not HEX_PATTERN.match(sig_hex):
        raise InvalidSignatureError("Signature must be hexadecimal")
    
    # Check length (65 bytes = 130 hex chars)
    if len(sig_hex) != SIGNATURE_LENGTH_HEX:
        raise InvalidSignatureError(
            f"Signature must be 65 bytes (130 hex chars), got {len(sig_hex) // 2} bytes"
        )
    
    return sig


def _validate_address(address: str) -> str:
    """
    Validate and normalize an Ethereum address.
    
    Returns the checksummed address.
    Raises InvalidAddressError if invalid.
    """
    if not address:
        raise InvalidAddressError("Address is required")
    
    # Normalize
    addr = _normalize_hex(address)
    addr_hex = addr[2:]
    
    # Check format
    if not HEX_PATTERN.match(addr_hex):
        raise InvalidAddressError("Address must be hexadecimal")
    
    # Check length (20 bytes = 40 hex chars)
    if len(addr_hex) != 40:
        raise InvalidAddressError(f"Address must be 20 bytes (40 hex chars), got {len(addr_hex)}")
    
    try:
        return to_checksum_address(addr)
    except Exception as e:
        raise InvalidAddressError(f"Invalid address format: {e}")


def _validate_hash(hash_value: str) -> str:
    """
    Validate and normalize a 32-byte hash.
    
    Returns the normalized hash with 0x prefix.
    Raises InvalidHashError if invalid.
    """
    if not hash_value:
        raise InvalidHashError("Hash is required")
    
    # Normalize
    h = _normalize_hex(hash_value)
    h_hex = h[2:]
    
    # Check format
    if not HEX_PATTERN.match(h_hex):
        raise InvalidHashError("Hash must be hexadecimal")
    
    # Check length (32 bytes = 64 hex chars)
    if len(h_hex) != 64:
        raise InvalidHashError(f"Hash must be 32 bytes (64 hex chars), got {len(h_hex)}")
    
    return h


def _validate_hex_message(message_hex: str) -> bytes:
    """
    Validate and convert a hex message to bytes.
    
    Returns the message as bytes.
    Raises ValueError if invalid.
    """
    if not message_hex:
        raise ValueError("Hex message is required")
    
    # Normalize
    msg = _normalize_hex(message_hex)
    msg_hex = msg[2:]
    
    # Check format
    if not HEX_PATTERN.match(msg_hex):
        raise ValueError("Message must be hexadecimal")
    
    # Check even length
    if len(msg_hex) % 2 != 0:
        raise ValueError("Hex message must have even length")
    
    return bytes.fromhex(msg_hex)


def _constant_time_compare(a: str, b: str) -> bool:
    """
    Compare two strings in constant time to prevent timing attacks.
    """
    return hmac.compare_digest(a.lower(), b.lower())


# ============================================================================
# Result Extraction Helpers
# ============================================================================

def _extract_signature_components(signed) -> dict:
    """Extract signature components from a signed message object."""
    sig_hex = signed.signature.hex()
    if not sig_hex.startswith('0x'):
        sig_hex = '0x' + sig_hex
    
    return {
        "signature": sig_hex,
        "v": signed.v,
        "r": hex(signed.r),
        "s": hex(signed.s)
    }


def _extract_message_hash(signed) -> str:
    """Extract message hash from a signed message object (handles version differences)."""
    msg_hash = getattr(signed, 'message_hash', None) or getattr(signed, 'messageHash', None)
    if msg_hash:
        hash_hex = msg_hash.hex()
        if not hash_hex.startswith('0x'):
            hash_hex = '0x' + hash_hex
        return hash_hex
    return ""


# ============================================================================
# Tool Registration
# ============================================================================

def register_signing_tools(server: Server) -> None:
    """
    Register all signing tools with the MCP server.
    
    Args:
        server: MCP Server instance to register tools with
    """
    
    @server.tool()
    async def sign_message(message: str, private_key: str) -> dict:
        """
        Sign a message using EIP-191 (personal_sign) format.
        
        This prefixes the message with "\\x19Ethereum Signed Message:\\n<length>"
        before signing, which prevents signed messages from being used as transactions.
        
        Args:
            message: The message to sign (UTF-8 text)
            private_key: Hex-encoded private key (with or without 0x prefix)
        
        Returns:
            Dictionary containing:
            - message: Original message
            - signer_address: Address of the signing key
            - signature: Full signature (0x prefixed, 65 bytes)
            - signature_components: {v, r, s} values
            - message_hash: Keccak256 hash of the prefixed message
            - recovery_message: The prefixed message that was signed
        
        Security Notes:
            - Never sign messages you don't understand
            - EIP-191 prefix prevents transaction replay attacks
            - The same message and key will always produce the same signature
        
        Example:
            >>> result = await sign_message("Hello, Ethereum!", "0x...")
            >>> result["signature"]  # "0x4355c47d..."
        """
        try:
            # Validate private key
            key = _validate_private_key(private_key)
            
            # Create account and encode message
            account = Account.from_key(key)
            message_encoded = encode_defunct(text=message)
            
            # Sign the message
            signed = account.sign_message(message_encoded)
            
            # Extract components
            components = _extract_signature_components(signed)
            msg_hash = _extract_message_hash(signed)
            
            # Build recovery message (EIP-191 format)
            recovery_message = f"\\x19Ethereum Signed Message:\\n{len(message)}{message}"
            
            return {
                "message": message,
                "signer_address": account.address,
                "signature": components["signature"],
                "signature_components": {
                    "v": components["v"],
                    "r": components["r"],
                    "s": components["s"]
                },
                "message_hash": msg_hash,
                "recovery_message": recovery_message
            }
            
        except InvalidKeyError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "SIGNING_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def sign_message_hex(message_hex: str, private_key: str) -> dict:
        """
        Sign a hex-encoded message (raw bytes) using EIP-191 format.
        
        Use this when you have raw bytes to sign rather than text. The bytes
        are still prefixed with the EIP-191 header before signing.
        
        Args:
            message_hex: Hex-encoded message bytes (with or without 0x prefix)
            private_key: Hex-encoded private key (with or without 0x prefix)
        
        Returns:
            Dictionary containing:
            - message_hex: Original hex message
            - message_decoded: UTF-8 decoded string if valid, null otherwise
            - signer_address: Address of the signing key
            - signature: Full signature (0x prefixed, 65 bytes)
            - signature_components: {v, r, s} values
            - message_hash: Keccak256 hash of the prefixed message
        
        Example:
            >>> result = await sign_message_hex("0x48656c6c6f", "0x...")  # "Hello" in hex
        """
        try:
            # Validate inputs
            key = _validate_private_key(private_key)
            message_bytes = _validate_hex_message(message_hex)
            
            # Create account and encode message
            account = Account.from_key(key)
            message_encoded = encode_defunct(primitive=message_bytes)
            
            # Sign the message
            signed = account.sign_message(message_encoded)
            
            # Extract components
            components = _extract_signature_components(signed)
            msg_hash = _extract_message_hash(signed)
            
            # Try to decode as UTF-8
            message_decoded = None
            try:
                message_decoded = message_bytes.decode('utf-8')
            except UnicodeDecodeError:
                pass
            
            return {
                "message_hex": _normalize_hex(message_hex),
                "message_decoded": message_decoded,
                "signer_address": account.address,
                "signature": components["signature"],
                "signature_components": {
                    "v": components["v"],
                    "r": components["r"],
                    "s": components["s"]
                },
                "message_hash": msg_hash
            }
            
        except InvalidKeyError as e:
            return e.to_dict()
        except ValueError as e:
            return {"error": True, "code": "INVALID_MESSAGE", "message": str(e)}
        except Exception as e:
            return {"error": True, "code": "SIGNING_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def verify_message(message: str, signature: str, expected_address: str) -> dict:
        """
        Verify an EIP-191 signed message against an expected address.
        
        This recovers the signer address from the signature and compares it
        to the expected address to verify the signature is valid.
        
        Args:
            message: Original message that was signed
            signature: Signature to verify (0x prefixed hex, 65 bytes)
            expected_address: Address expected to have signed the message
        
        Returns:
            Dictionary containing:
            - message: Original message
            - expected_address: Normalized checksummed expected address
            - recovered_address: Address recovered from signature
            - is_valid: True if recovered matches expected (case-insensitive)
            - match_details: {exact_match, checksum_match} for detailed comparison
        
        Example:
            >>> result = await verify_message("Hello", "0x...", "0x742d...")
            >>> result["is_valid"]  # True or False
        """
        try:
            # Validate inputs
            sig = _validate_signature(signature)
            expected = _validate_address(expected_address)
            
            # Encode message and recover signer
            message_encoded = encode_defunct(text=message)
            recovered = Account.recover_message(message_encoded, signature=sig)
            recovered_normalized = to_checksum_address(recovered)
            
            # Compare addresses (constant time for security)
            is_valid = _constant_time_compare(expected, recovered_normalized)
            exact_match = expected == recovered_normalized
            
            return {
                "message": message,
                "expected_address": expected,
                "recovered_address": recovered_normalized,
                "is_valid": is_valid,
                "match_details": {
                    "exact_match": exact_match,
                    "checksum_match": is_valid
                }
            }
            
        except InvalidSignatureError as e:
            return e.to_dict()
        except InvalidAddressError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "VERIFICATION_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def recover_signer(message: str, signature: str) -> dict:
        """
        Recover the signer address from a signed message.
        
        Use this when you receive a signed message and want to know who
        signed it, without having an expected address to compare against.
        
        Args:
            message: Original message that was signed
            signature: The signature (0x prefixed hex, 65 bytes)
        
        Returns:
            Dictionary containing:
            - message: Original message
            - recovered_address: Address that signed the message
            - signature: The signature used
            - message_hash: Hash that was signed
        
        Example:
            >>> result = await recover_signer("Hello", "0x...")
            >>> result["recovered_address"]  # "0x742d35Cc..."
        """
        try:
            # Validate signature
            sig = _validate_signature(signature)
            
            # Encode message and recover signer
            message_encoded = encode_defunct(text=message)
            recovered = Account.recover_message(message_encoded, signature=sig)
            recovered_normalized = to_checksum_address(recovered)
            
            # Calculate message hash
            msg_hash = keccak(message_encoded.body)
            msg_hash_hex = '0x' + msg_hash.hex()
            
            return {
                "message": message,
                "recovered_address": recovered_normalized,
                "signature": sig,
                "message_hash": msg_hash_hex
            }
            
        except InvalidSignatureError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "RECOVERY_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def sign_hash(
        hash: str,
        private_key: str,
        acknowledge_risk: bool = False
    ) -> dict:
        """
        Sign a raw 32-byte hash directly.
        
        ⚠️ WARNING: This bypasses EIP-191 protection! Only use if you understand
        the security implications. Signing arbitrary hashes can be exploited
        to sign transactions or other sensitive data.
        
        Args:
            hash: 32-byte hash to sign (64 hex chars, 0x prefix optional)
            private_key: Hex-encoded private key
            acknowledge_risk: Must be True to proceed (safety check)
        
        Returns:
            Dictionary containing:
            - hash: The hash that was signed
            - signer_address: Address of signing key
            - signature: Full signature
            - signature_components: {v, r, s}
            - warning: Security warning message
        
        Raises:
            Error if acknowledge_risk is not True
        
        Example:
            >>> result = await sign_hash("0xabc...64chars", "0x...", True)
        """
        # Safety check - require explicit acknowledgment
        if not acknowledge_risk:
            return {
                "error": True,
                "code": "RISK_ACKNOWLEDGEMENT_REQUIRED",
                "message": (
                    "Signing raw hashes is dangerous! It bypasses EIP-191 protection "
                    "and could be used to trick you into signing transactions. "
                    "Set acknowledge_risk=True only if you understand the risks."
                )
            }
        
        try:
            # Validate inputs
            key = _validate_private_key(private_key)
            hash_value = _validate_hash(hash)
            
            # Create account
            account = Account.from_key(key)
            
            # Convert hash to bytes
            hash_bytes = bytes.fromhex(hash_value[2:])
            
            # Sign the hash directly using deprecated signHash
            # (This is intentionally dangerous - users must acknowledge)
            signed = account.unsafe_sign_hash(hash_bytes)
            
            # Extract components
            components = _extract_signature_components(signed)
            
            return {
                "hash": hash_value,
                "signer_address": account.address,
                "signature": components["signature"],
                "signature_components": {
                    "v": components["v"],
                    "r": components["r"],
                    "s": components["s"]
                },
                "warning": (
                    "⚠️ This signature was created without EIP-191 protection. "
                    "Be extremely careful about where you use it."
                )
            }
            
        except InvalidKeyError as e:
            return e.to_dict()
        except InvalidHashError as e:
            return e.to_dict()
        except AttributeError:
            # Fallback for older eth-account versions
            try:
                signed = account.signHash(hash_bytes)
                components = _extract_signature_components(signed)
                return {
                    "hash": hash_value,
                    "signer_address": account.address,
                    "signature": components["signature"],
                    "signature_components": {
                        "v": components["v"],
                        "r": components["r"],
                        "s": components["s"]
                    },
                    "warning": (
                        "⚠️ This signature was created without EIP-191 protection. "
                        "Be extremely careful about where you use it."
                    )
                }
            except Exception as e:
                return {"error": True, "code": "SIGNING_ERROR", "message": str(e)}
        except Exception as e:
            return {"error": True, "code": "SIGNING_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def decompose_signature(signature: str) -> dict:
        """
        Decompose a signature into its v, r, s components.
        
        This is useful for debugging signatures or preparing them for
        smart contract verification functions that require separate components.
        
        Args:
            signature: Full signature (65 bytes hex, 0x prefix optional)
        
        Returns:
            Dictionary containing:
            - signature: Original signature (normalized)
            - length_bytes: Signature length in bytes (should be 65)
            - components: {v, r, s} values
            - format: "standard" for 65-byte, "EIP-2098" for compact
            - valid_structure: Whether signature has valid structure
        
        Example:
            >>> result = await decompose_signature("0x4355c47d...")
            >>> result["components"]["v"]  # 28
        """
        try:
            # Validate signature
            sig = _validate_signature(signature)
            sig_bytes = bytes.fromhex(sig[2:])
            
            # Extract components (r: 32 bytes, s: 32 bytes, v: 1 byte)
            r = int.from_bytes(sig_bytes[0:32], 'big')
            s = int.from_bytes(sig_bytes[32:64], 'big')
            v = sig_bytes[64]
            
            # Determine format
            # Standard v values are 27 or 28
            # EIP-155 can have higher values
            # EIP-2098 compact format would be 64 bytes (not handled here)
            sig_format = "standard"
            if len(sig_bytes) == 64:
                sig_format = "EIP-2098"
            
            # Validate v value (should be 27, 28, or chain-specific)
            valid_v = v in (0, 1, 27, 28) or v >= 35  # EIP-155 v values
            
            # Validate r and s are within secp256k1 curve order
            secp256k1_n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
            valid_r = 0 < r < secp256k1_n
            valid_s = 0 < s < secp256k1_n
            
            return {
                "signature": sig,
                "length_bytes": len(sig_bytes),
                "components": {
                    "v": v,
                    "r": hex(r),
                    "s": hex(s)
                },
                "format": sig_format,
                "valid_structure": valid_v and valid_r and valid_s,
                "validation_details": {
                    "v_valid": valid_v,
                    "r_valid": valid_r,
                    "s_valid": valid_s
                }
            }
            
        except InvalidSignatureError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "DECOMPOSE_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def compose_signature(v: int, r: str, s: str) -> dict:
        """
        Compose a signature from v, r, s components.
        
        This is useful when you have signature components from a smart contract
        event or other source and need to create the full signature.
        
        Args:
            v: Recovery parameter (0, 1, 27, 28, or EIP-155 value)
            r: R component (hex string, 32 bytes)
            s: S component (hex string, 32 bytes)
        
        Returns:
            Dictionary containing:
            - signature: Composed signature (0x prefixed)
            - components: {v, r, s} normalized components
            - length_bytes: Signature length
        
        Example:
            >>> result = await compose_signature(28, "0x4355c47d...", "0x07299936...")
            >>> result["signature"]  # "0x4355c47d...1c"
        """
        try:
            # Normalize r and s
            r_hex = _normalize_hex(r)
            s_hex = _normalize_hex(s)
            
            # Remove 0x prefix and validate
            r_clean = r_hex[2:]
            s_clean = s_hex[2:]
            
            # Check lengths (should be 64 hex chars = 32 bytes each)
            if len(r_clean) > 64:
                return {
                    "error": True,
                    "code": "INVALID_R",
                    "message": f"R component too long: {len(r_clean)} hex chars (max 64)"
                }
            if len(s_clean) > 64:
                return {
                    "error": True,
                    "code": "INVALID_S",
                    "message": f"S component too long: {len(s_clean)} hex chars (max 64)"
                }
            
            # Pad to 32 bytes if needed
            r_padded = r_clean.zfill(64)
            s_padded = s_clean.zfill(64)
            
            # Normalize v to single byte
            if v in (0, 1):
                v_normalized = v + 27  # Convert to standard form
            elif v >= 27:
                v_normalized = v
            else:
                return {
                    "error": True,
                    "code": "INVALID_V",
                    "message": f"Invalid v value: {v}. Expected 0, 1, 27, 28, or EIP-155 value"
                }
            
            # For standard 65-byte signature, v should fit in 1 byte
            # But EIP-155 v values can be larger (e.g., chainId * 2 + 35)
            v_hex = format(v_normalized, '02x')
            
            # Compose signature
            signature = '0x' + r_padded + s_padded + v_hex
            
            return {
                "signature": signature,
                "components": {
                    "v": v_normalized,
                    "r": '0x' + r_padded,
                    "s": '0x' + s_padded
                },
                "length_bytes": 65
            }
            
        except Exception as e:
            return {"error": True, "code": "COMPOSE_ERROR", "message": str(e)}
