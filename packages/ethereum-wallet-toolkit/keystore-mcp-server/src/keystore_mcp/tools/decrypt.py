"""
Keystore Decryption Tools

Implements decrypt_keystore and change_keystore_password MCP tools.
"""

import json
import uuid
import base64
from typing import Any

from mcp.server import Server
from eth_account import Account
from eth_utils import to_checksum_address

from ..crypto.kdf import derive_key_scrypt, derive_key_pbkdf2
from ..crypto.cipher import decrypt_aes_ctr, encrypt_aes_ctr
from ..crypto.mac import verify_mac, compute_mac
from ..utils.validation import validate_keystore_structure


def decrypt_keystore_impl(
    keystore: dict | str,
    password: str,
    return_format: str = "hex"
) -> dict:
    """
    Implementation of keystore decryption.
    
    Args:
        keystore: Keystore JSON object or JSON string
        password: Decryption password
        return_format: "hex" (0x-prefixed) or "bytes" (base64-encoded)
    
    Returns:
        Dictionary with decryption results or error.
    """
    # Parse keystore if string
    if isinstance(keystore, str):
        try:
            keystore = json.loads(keystore)
        except json.JSONDecodeError as e:
            return {
                "error": True,
                "code": "INVALID_JSON",
                "message": f"Invalid JSON: {e}"
            }
    
    # Validate keystore structure
    validation = validate_keystore_structure(keystore)
    if not validation["is_valid"]:
        return {
            "error": True,
            "code": "CORRUPTED_KEYSTORE",
            "message": f"Invalid keystore: {', '.join(validation['errors'])}"
        }
    
    # Check version
    if keystore.get("version") != 3:
        return {
            "error": True,
            "code": "UNSUPPORTED_VERSION",
            "message": f"Unsupported keystore version: {keystore.get('version')}"
        }
    
    # Get crypto section
    crypto = keystore.get("crypto") or keystore.get("Crypto")
    
    try:
        # Extract parameters
        kdf = crypto["kdf"].lower()
        kdfparams = crypto["kdfparams"]
        ciphertext = bytes.fromhex(crypto["ciphertext"])
        iv = bytes.fromhex(crypto["cipherparams"]["iv"])
        expected_mac = bytes.fromhex(crypto["mac"])
        salt = bytes.fromhex(kdfparams["salt"])
        
        # Derive key based on KDF
        if kdf == "scrypt":
            derived_key, _ = derive_key_scrypt(
                password=password,
                salt=salt,
                n=kdfparams["n"],
                r=kdfparams["r"],
                p=kdfparams["p"],
                dklen=kdfparams["dklen"]
            )
        elif kdf == "pbkdf2":
            derived_key, _ = derive_key_pbkdf2(
                password=password,
                salt=salt,
                iterations=kdfparams["c"],
                dklen=kdfparams["dklen"]
            )
        else:
            return {
                "error": True,
                "code": "UNSUPPORTED_KDF",
                "message": f"Unsupported KDF: {kdf}"
            }
        
        # Verify MAC
        if not verify_mac(derived_key, ciphertext, expected_mac):
            return {
                "error": True,
                "code": "INVALID_PASSWORD",
                "message": "MAC verification failed - incorrect password"
            }
        
        # Decrypt private key
        private_key_bytes = decrypt_aes_ctr(ciphertext, derived_key, iv)
        
        # Verify key by deriving address
        account = Account.from_key(private_key_bytes)
        derived_address = account.address[2:].lower()
        stored_address = keystore.get("address", "").lower()
        
        if derived_address != stored_address:
            return {
                "error": True,
                "code": "ADDRESS_MISMATCH",
                "message": "Decrypted key does not match stored address"
            }
        
        # Format private key
        if return_format == "hex":
            private_key = "0x" + private_key_bytes.hex()
        elif return_format == "bytes":
            private_key = base64.b64encode(private_key_bytes).decode('ascii')
        else:
            private_key = "0x" + private_key_bytes.hex()
        
        return {
            "private_key": private_key,
            "address": to_checksum_address(account.address),
            "keystore_id": keystore.get("id"),
            "kdf_used": kdf,
            "decryption_successful": True
        }
        
    except Exception as e:
        return {
            "error": True,
            "code": "DECRYPTION_FAILED",
            "message": f"Failed to decrypt keystore: {str(e)}"
        }


def change_keystore_password_impl(
    keystore: dict | str,
    old_password: str,
    new_password: str,
    new_kdf: str | None = None,
    upgrade_security: bool = False
) -> dict:
    """
    Implementation of changing keystore password.
    
    Args:
        keystore: Existing keystore JSON object or string
        old_password: Current password
        new_password: New password to set
        new_kdf: Optionally change KDF to "scrypt" or "pbkdf2"
        upgrade_security: If true, use maximum security parameters
    
    Returns:
        Dictionary with new keystore or error.
    """
    # Parse keystore if string
    if isinstance(keystore, str):
        try:
            keystore = json.loads(keystore)
        except json.JSONDecodeError as e:
            return {
                "error": True,
                "code": "INVALID_JSON",
                "message": f"Invalid JSON: {e}"
            }
    
    # Validate new password
    if not new_password:
        return {
            "error": True,
            "code": "INVALID_PASSWORD",
            "message": "New password cannot be empty"
        }
    
    # Decrypt with old password (using the impl function directly)
    decrypt_result = decrypt_keystore_impl(keystore, old_password)
    
    if decrypt_result.get("error"):
        return decrypt_result
    
    private_key = decrypt_result["private_key"]
    old_kdf_name = decrypt_result["kdf_used"]
    
    # Determine new KDF
    target_kdf = new_kdf
    if target_kdf:
        target_kdf = target_kdf.lower()
        if target_kdf not in ("scrypt", "pbkdf2"):
            return {
                "error": True,
                "code": "INVALID_KDF",
                "message": f"Invalid KDF: {target_kdf}"
            }
    else:
        target_kdf = old_kdf_name
    
    # Re-encrypt with new password
    try:
        # Get key bytes
        key_bytes = bytes.fromhex(private_key[2:])
        account = Account.from_key(key_bytes)
        address = account.address
        address_lower = address[2:].lower()
        
        # Derive new key
        if target_kdf == "scrypt":
            from ..crypto.kdf import SCRYPT_N_STANDARD
            n = 2 ** 18 if upgrade_security else SCRYPT_N_STANDARD
            derived_key, kdf_params = derive_key_scrypt(password=new_password, n=n)
            kdfparams = {
                "n": kdf_params.n,
                "r": kdf_params.r,
                "p": kdf_params.p,
                "dklen": kdf_params.dklen,
                "salt": kdf_params.salt.hex()
            }
        else:
            from ..crypto.kdf import PBKDF2_ITERATIONS_STANDARD
            c = 262144 if upgrade_security else PBKDF2_ITERATIONS_STANDARD
            derived_key, kdf_params = derive_key_pbkdf2(password=new_password, iterations=c)
            kdfparams = {
                "c": kdf_params.c,
                "dklen": kdf_params.dklen,
                "prf": kdf_params.prf,
                "salt": kdf_params.salt.hex()
            }
        
        # Encrypt with new key
        ciphertext, iv = encrypt_aes_ctr(key_bytes, derived_key)
        mac = compute_mac(derived_key, ciphertext)
        
        # Build new keystore
        result_keystore = {
            "version": 3,
            "id": str(uuid.uuid4()),
            "address": address_lower,
            "crypto": {
                "ciphertext": ciphertext.hex(),
                "cipherparams": {"iv": iv.hex()},
                "cipher": "aes-128-ctr",
                "kdf": target_kdf,
                "kdfparams": kdfparams,
                "mac": mac.hex()
            }
        }
        
        security_upgraded = upgrade_security or (old_kdf_name == "pbkdf2" and target_kdf == "scrypt")
        
        return {
            "new_keystore": result_keystore,
            "address": to_checksum_address(address),
            "old_kdf": old_kdf_name,
            "new_kdf": target_kdf,
            "security_upgraded": security_upgraded,
            "password_changed": True
        }
        
    except Exception as e:
        return {
            "error": True,
            "code": "RE_ENCRYPTION_FAILED",
            "message": f"Failed to re-encrypt: {str(e)}"
        }


def register_decrypt_tools(server: Server) -> None:
    """Register decryption tools with the MCP server."""
    
    @server.tool()
    async def decrypt_keystore(
        keystore: dict | str,
        password: str,
        return_format: str = "hex"
    ) -> dict:
        """
        Decrypt a Web3 Secret Storage V3 keystore to recover private key.
        
        Decrypts an encrypted keystore file to extract the original private key.
        The password must match the one used during encryption.
        
        Args:
            keystore: Keystore JSON object or JSON string
            password: Decryption password
            return_format: "hex" (0x-prefixed) or "bytes" (base64-encoded)
        
        Returns:
            Dictionary containing:
            - private_key: Decrypted private key in requested format
            - address: Checksummed Ethereum address
            - keystore_id: UUID from keystore
            - kdf_used: KDF that was used
            - decryption_successful: true
        
        Errors:
            - INVALID_PASSWORD: MAC verification failed (wrong password)
            - UNSUPPORTED_VERSION: Not version 3 keystore
            - UNSUPPORTED_KDF: Unknown key derivation function
            - CORRUPTED_KEYSTORE: Missing or malformed fields
        """
        return decrypt_keystore_impl(keystore, password, return_format)
    
    
    @server.tool()
    async def change_keystore_password(
        keystore: dict | str,
        old_password: str,
        new_password: str,
        new_kdf: str | None = None,
        upgrade_security: bool = False
    ) -> dict:
        """
        Change keystore password and optionally upgrade KDF parameters.
        
        Decrypts the keystore with the old password and re-encrypts with the
        new password. Optionally change the KDF or upgrade security parameters.
        
        Args:
            keystore: Existing keystore JSON object or string
            old_password: Current password
            new_password: New password to set
            new_kdf: Optionally change KDF to "scrypt" or "pbkdf2"
            upgrade_security: If true, use maximum security parameters
        
        Returns:
            Dictionary containing:
            - new_keystore: Updated keystore JSON object
            - address: Ethereum address (unchanged)
            - old_kdf: Previous KDF
            - new_kdf: New KDF used
            - security_upgraded: Whether security was upgraded
            - password_changed: true
        """
        return change_keystore_password_impl(
            keystore, old_password, new_password, new_kdf, upgrade_security
        )
