"""
Batch Keystore Operations Tool

Implements batch_encrypt_keystores MCP tool.
"""

import json
from typing import Any

from mcp.server import Server
from eth_account import Account
from eth_utils import to_checksum_address

from ..crypto.kdf import derive_key_scrypt, derive_key_pbkdf2, SCRYPT_N_STANDARD, PBKDF2_ITERATIONS_STANDARD
from ..crypto.cipher import encrypt_aes_ctr
from ..crypto.mac import compute_mac
from ..utils.validation import validate_private_key
import uuid


def register_batch_tools(server: Server) -> None:
    """Register batch operation tools with the MCP server."""
    
    @server.tool()
    async def batch_encrypt_keystores(
        wallets: list[dict],
        password: str = "",
        unique_passwords: bool = False,
        kdf: str = "scrypt"
    ) -> dict:
        """
        Encrypt multiple wallets into keystores in a single operation.
        
        Efficiently encrypts multiple private keys into keystore format.
        Can use a single password for all wallets or unique passwords
        for each.
        
        Args:
            wallets: List of wallet objects, each containing:
                - private_key: Required - hex private key
                - password: Optional - per-wallet password (if unique_passwords=True)
            password: Default password for all wallets (if unique_passwords=False)
            unique_passwords: If true, each wallet must have its own password
            kdf: Key derivation function - "scrypt" or "pbkdf2"
        
        Returns:
            Dictionary containing:
            - keystores: List of {address, keystore} objects
            - total_encrypted: Number of successfully encrypted wallets
            - kdf_used: KDF that was used
            - errors: List of any errors encountered
        
        Example:
            batch_encrypt_keystores(
                wallets=[
                    {"private_key": "0x..."},
                    {"private_key": "0x...", "password": "custom_pass"}
                ],
                password="default_pass",
                unique_passwords=False
            )
        """
        if not wallets:
            return {
                "error": True,
                "code": "NO_WALLETS",
                "message": "No wallets provided"
            }
        
        if not unique_passwords and not password:
            return {
                "error": True,
                "code": "NO_PASSWORD",
                "message": "Password required when unique_passwords=False"
            }
        
        kdf = kdf.lower()
        if kdf not in ("scrypt", "pbkdf2"):
            return {
                "error": True,
                "code": "INVALID_KDF",
                "message": f"Invalid KDF: {kdf}. Use 'scrypt' or 'pbkdf2'"
            }
        
        keystores = []
        errors = []
        
        for i, wallet in enumerate(wallets):
            try:
                # Get private key
                private_key = wallet.get("private_key")
                if not private_key:
                    errors.append({"index": i, "error": "Missing private_key"})
                    continue
                
                # Get password
                if unique_passwords:
                    wallet_password = wallet.get("password")
                    if not wallet_password:
                        errors.append({"index": i, "error": "Missing password (unique_passwords=True)"})
                        continue
                else:
                    wallet_password = wallet.get("password", password)
                
                # Validate private key
                is_valid, error, key_bytes = validate_private_key(private_key)
                if not is_valid:
                    errors.append({"index": i, "error": error})
                    continue
                
                # Get address
                account = Account.from_key(key_bytes)
                address = account.address
                address_lower = address[2:].lower()
                
                # Derive key and encrypt
                if kdf == "scrypt":
                    derived_key, kdf_params = derive_key_scrypt(password=wallet_password)
                    kdfparams = {
                        "n": kdf_params.n, "r": kdf_params.r, "p": kdf_params.p,
                        "dklen": kdf_params.dklen, "salt": kdf_params.salt.hex()
                    }
                else:
                    derived_key, kdf_params = derive_key_pbkdf2(password=wallet_password)
                    kdfparams = {
                        "c": kdf_params.c, "dklen": kdf_params.dklen,
                        "prf": kdf_params.prf, "salt": kdf_params.salt.hex()
                    }
                
                # Encrypt
                ciphertext, iv = encrypt_aes_ctr(key_bytes, derived_key)
                mac = compute_mac(derived_key, ciphertext)
                
                # Build keystore
                keystore = {
                    "version": 3,
                    "id": str(uuid.uuid4()),
                    "address": address_lower,
                    "crypto": {
                        "ciphertext": ciphertext.hex(),
                        "cipherparams": {"iv": iv.hex()},
                        "cipher": "aes-128-ctr",
                        "kdf": kdf,
                        "kdfparams": kdfparams,
                        "mac": mac.hex()
                    }
                }
                
                keystores.append({
                    "address": to_checksum_address(address),
                    "keystore": keystore
                })
                
            except Exception as e:
                errors.append({"index": i, "error": str(e)})
        
        return {
            "keystores": keystores,
            "total_encrypted": len(keystores),
            "kdf_used": kdf,
            "errors": errors
        }
