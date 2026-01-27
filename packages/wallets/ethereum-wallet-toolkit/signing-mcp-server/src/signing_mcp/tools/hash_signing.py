"""
Hash Signing Tools

Dangerous tool for signing raw hashes - requires acknowledgement.
"""

import re
from typing import Any, Dict

from eth_account import Account
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

HEX_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]*$')

RISK_ACKNOWLEDGEMENT = "I understand signing raw hashes is dangerous"


# ============================================================================
# Helpers
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
    
    return key


def _validate_hash(hash_value: str) -> str:
    """Validate and normalize a 32-byte hash."""
    if not hash_value:
        raise ValueError("Hash is required")
    
    h = _normalize_hex(hash_value)
    h_hex = h[2:]
    
    if not HEX_PATTERN.match(h_hex):
        raise ValueError("Hash must be hexadecimal")
    
    if len(h_hex) != 64:
        raise ValueError(f"Hash must be 32 bytes (64 hex chars), got {len(h_hex)}")
    
    return h


# ============================================================================
# Core Functions
# ============================================================================

def sign_hash_impl(
    message_hash: str,
    private_key: str,
    risk_acknowledgement: str
) -> Dict[str, Any]:
    """
    Sign a raw 32-byte hash.
    
    WARNING: This is DANGEROUS! Signing arbitrary hashes can authorize
    transactions or other actions. Only use if you know what you're signing.
    """
    # Require risk acknowledgement
    if risk_acknowledgement != RISK_ACKNOWLEDGEMENT:
        return {
            'error': True,
            'code': 'RISK_ACKNOWLEDGEMENT_REQUIRED',
            'message': f"You must provide the exact risk acknowledgement: '{RISK_ACKNOWLEDGEMENT}'",
            'warning': [
                "Signing raw hashes is DANGEROUS!",
                "A hash could represent a transaction that drains your wallet.",
                "Only sign hashes if you computed them yourself and understand what they represent.",
                "For normal message signing, use sign_message instead."
            ]
        }
    
    try:
        hash_val = _validate_hash(message_hash)
        key = _validate_private_key(private_key)
        
        account = Account.from_key(key)
        hash_bytes = bytes.fromhex(hash_val[2:])
        
        # Sign the hash using unsafe_sign_hash (previously signHash)
        signed = account.unsafe_sign_hash(hash_bytes)
        
        signature_hex = '0x' + signed.signature.hex()
        
        return {
            'warning': "You signed a raw hash. Ensure you understand what this hash represents!",
            'hash': hash_val,
            'signer': account.address,
            'signature': signature_hex,
            'v': signed.v,
            'r': hex(signed.r),
            's': hex(signed.s)
        }
    except ValueError as e:
        return {
            'error': True,
            'code': 'VALIDATION_ERROR',
            'message': str(e)
        }
    except Exception as e:
        return {
            'error': True,
            'code': 'SIGNING_FAILED',
            'message': str(e)
        }


def verify_hash_signature_impl(
    message_hash: str,
    signature: str,
    expected_signer: str = None
) -> Dict[str, Any]:
    """
    Verify a signature over a raw hash.
    
    Args:
        message_hash: The 32-byte hash that was signed (hex)
        signature: The signature to verify (hex)
        expected_signer: Optional expected signer address
        
    Returns:
        Verification result with recovered signer
    """
    try:
        hash_val = _validate_hash(message_hash)
        sig = _normalize_hex(signature)
        
        hash_bytes = bytes.fromhex(hash_val[2:])
        sig_bytes = bytes.fromhex(sig[2:])
        
        # Recover signer from signature using internal API
        recovered = Account._recover_hash(hash_bytes, signature=sig_bytes)
        
        result = {
            'message_hash': hash_val,
            'recovered_signer': recovered,
            'signature': sig
        }
        
        if expected_signer:
            expected = expected_signer.lower()
            actual = recovered.lower()
            result['expected_signer'] = expected_signer
            result['is_valid'] = (expected == actual)
        else:
            result['is_valid'] = True  # Just recovered successfully
        
        return result
        
    except Exception as e:
        return {
            'error': True,
            'message': f"Verification failed: {str(e)}",
            'is_valid': False
        }


# ============================================================================
# Tool Registration
# ============================================================================

def register_hash_signing_tools(server: Server) -> None:
    """Register hash signing tools with the MCP server."""
    
    @server.tool()
    async def sign_hash(
        message_hash: str,
        private_key: str,
        risk_acknowledgement: str
    ) -> Dict[str, Any]:
        """
        Sign a raw 32-byte hash (DANGEROUS - requires acknowledgement).
        
        WARNING: Signing arbitrary hashes can authorize transactions or
        other actions. Only use if you computed the hash yourself and
        understand exactly what it represents.
        
        Args:
            message_hash: 32-byte hash to sign (hex)
            private_key: Private key (hex)
            risk_acknowledgement: Must be exactly "I understand signing raw hashes is dangerous"
            
        Returns:
            Signature and warning message
        """
        try:
            return sign_hash_impl(message_hash, private_key, risk_acknowledgement)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store reference for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['sign_hash'] = sign_hash
