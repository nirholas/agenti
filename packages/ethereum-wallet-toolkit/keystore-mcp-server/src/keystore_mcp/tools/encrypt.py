"""
Keystore Encryption Tool

Implements the encrypt_keystore MCP tool for creating Web3 Secret Storage V3 keystores.
All core logic is in *_impl functions for testability.
"""

import uuid
import secrets
from typing import Literal, Optional, Dict, Any

from mcp.server import Server
from eth_account import Account
from eth_utils import to_checksum_address

from ..crypto.kdf import (
    derive_key_scrypt,
    derive_key_pbkdf2,
    SCRYPT_N_STANDARD,
    SCRYPT_N_LIGHT,
    SCRYPT_R,
    SCRYPT_P,
    SCRYPT_DKLEN,
    PBKDF2_ITERATIONS_STANDARD,
    PBKDF2_ITERATIONS_LIGHT,
    PBKDF2_DKLEN,
)
from ..crypto.cipher import encrypt_aes_ctr
from ..crypto.mac import compute_mac
from ..utils.validation import validate_private_key


# =============================================================================
# Implementation Functions (testable without async)
# =============================================================================

def encrypt_keystore_impl(
    private_key: str,
    password: str,
    kdf: str = "scrypt",
    iterations: Optional[int] = None,
    work_factor: Optional[int] = None
) -> Dict[str, Any]:
    """
    Encrypt a private key into Web3 Secret Storage V3 keystore format.
    
    Args:
        private_key: Hex-encoded private key (with or without 0x prefix)
        password: Password for encryption (will be UTF-8 encoded)
        kdf: Key derivation function - "scrypt" or "pbkdf2"
        iterations: For pbkdf2 - number of iterations
        work_factor: For scrypt - N parameter as power of 2
    
    Returns:
        Dictionary containing keystore, address, kdf_used, security_level
    """
    # Validate private key
    is_valid, error, key_bytes = validate_private_key(private_key)
    if not is_valid:
        return {"error": True, "code": "INVALID_KEY", "message": error}
    
    # Validate password
    if not password:
        return {"error": True, "code": "INVALID_PASSWORD", "message": "Password cannot be empty"}
    
    # Derive address from private key
    try:
        account = Account.from_key(key_bytes)
        address = account.address
        address_lower = address[2:].lower()
    except Exception as e:
        return {"error": True, "code": "INVALID_KEY", "message": f"Cannot derive address: {e}"}
    
    # Determine security level and parameters
    kdf = kdf.lower()
    security_level = "standard"
    
    try:
        if kdf == "scrypt":
            if work_factor is not None:
                n = 2 ** work_factor
                if n < SCRYPT_N_STANDARD:
                    security_level = "light" if n >= SCRYPT_N_LIGHT else "custom"
                elif n > SCRYPT_N_STANDARD:
                    security_level = "custom"
            else:
                n = SCRYPT_N_STANDARD
            
            derived_key, kdf_params = derive_key_scrypt(
                password=password,
                n=n,
                r=SCRYPT_R,
                p=SCRYPT_P,
                dklen=SCRYPT_DKLEN
            )
            
            kdfparams = {
                "n": kdf_params.n,
                "r": kdf_params.r,
                "p": kdf_params.p,
                "dklen": kdf_params.dklen,
                "salt": kdf_params.salt.hex()
            }
            
        elif kdf == "pbkdf2":
            if iterations is not None:
                c = iterations
                if c < PBKDF2_ITERATIONS_STANDARD:
                    security_level = "light" if c >= PBKDF2_ITERATIONS_LIGHT else "custom"
                elif c > PBKDF2_ITERATIONS_STANDARD:
                    security_level = "custom"
            else:
                c = PBKDF2_ITERATIONS_STANDARD
            
            derived_key, kdf_params = derive_key_pbkdf2(
                password=password,
                iterations=c,
                dklen=PBKDF2_DKLEN
            )
            
            kdfparams = {
                "c": kdf_params.c,
                "dklen": kdf_params.dklen,
                "prf": kdf_params.prf,
                "salt": kdf_params.salt.hex()
            }
            
        else:
            return {
                "error": True,
                "code": "INVALID_KDF",
                "message": f"Unsupported KDF: {kdf}. Use 'scrypt' or 'pbkdf2'"
            }
        
        # Encrypt private key
        ciphertext, iv = encrypt_aes_ctr(key_bytes, derived_key)
        
        # Compute MAC
        mac = compute_mac(derived_key, ciphertext)
        
        # Generate UUID
        keystore_id = str(uuid.uuid4())
        
        # Build keystore object
        keystore = {
            "version": 3,
            "id": keystore_id,
            "address": address_lower,
            "crypto": {
                "ciphertext": ciphertext.hex(),
                "cipherparams": {
                    "iv": iv.hex()
                },
                "cipher": "aes-128-ctr",
                "kdf": kdf,
                "kdfparams": kdfparams,
                "mac": mac.hex()
            }
        }
        
        return {
            "keystore": keystore,
            "address": to_checksum_address(address),
            "kdf_used": kdf,
            "security_level": security_level
        }
        
    except Exception as e:
        return {
            "error": True,
            "code": "ENCRYPTION_FAILED",
            "message": f"Failed to encrypt keystore: {str(e)}"
        }


# =============================================================================
# Tool Registration
# =============================================================================

def register_encrypt_tools(server: Server) -> None:
    """Register encryption tools with the MCP server."""
    
    @server.tool()
    async def encrypt_keystore(
        private_key: str,
        password: str,
        kdf: str = "scrypt",
        iterations: int | None = None,
        work_factor: int | None = None
    ) -> dict:
        """
        Encrypt a private key into Web3 Secret Storage V3 keystore format.
        
        Creates a standard Ethereum keystore file that can be used with any
        Ethereum wallet software. The keystore is encrypted using AES-128-CTR
        with a key derived from your password using either scrypt or PBKDF2.
        
        Args:
            private_key: Hex-encoded private key (with or without 0x prefix)
            password: Password for encryption (will be UTF-8 encoded)
            kdf: Key derivation function - "scrypt" (more secure, slower) or 
                 "pbkdf2" (faster, less memory-intensive)
            iterations: For pbkdf2 - number of iterations (default: 262144)
            work_factor: For scrypt - N parameter as power of 2 (default: 18 = 2^18 = 262144)
        
        Returns:
            Dictionary containing:
            - keystore: Complete Web3 V3 keystore JSON object
            - address: Checksummed Ethereum address (0x prefixed)
            - kdf_used: KDF that was used
            - security_level: "standard", "light", or "custom"
        """
        return encrypt_keystore_impl(private_key, password, kdf, iterations, work_factor)
    
    # Store reference for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['encrypt_keystore'] = encrypt_keystore
