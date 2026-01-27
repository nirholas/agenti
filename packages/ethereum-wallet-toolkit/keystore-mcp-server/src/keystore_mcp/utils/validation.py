"""
Validation Utilities for Keystore Operations

Input validation for private keys, keystores, and passwords.
"""

import re
import uuid
from typing import Any

from eth_utils import is_hex, is_checksum_address, to_checksum_address


# Regex patterns
HEX_PATTERN = re.compile(r'^[0-9a-fA-F]+$')
PRIVATE_KEY_LENGTH = 64  # 32 bytes = 64 hex chars


def validate_private_key(private_key: str) -> tuple[bool, str, bytes | None]:
    """
    Validate and normalize a private key.
    
    Args:
        private_key: Hex-encoded private key (with or without 0x prefix)
        
    Returns:
        Tuple of (is_valid, error_message, normalized_bytes)
    """
    if not private_key or not isinstance(private_key, str):
        return False, "Private key must be a non-empty string", None
    
    key = private_key.strip()
    
    # Remove 0x prefix if present
    if key.startswith("0x") or key.startswith("0X"):
        key = key[2:]
    
    # Check length
    if len(key) != PRIVATE_KEY_LENGTH:
        return False, f"Private key must be {PRIVATE_KEY_LENGTH} hex characters, got {len(key)}", None
    
    # Check hex characters
    if not HEX_PATTERN.match(key):
        return False, "Private key must contain only hex characters (0-9, a-f)", None
    
    # Convert to bytes
    try:
        key_bytes = bytes.fromhex(key)
        return True, "", key_bytes
    except ValueError as e:
        return False, f"Invalid hex encoding: {e}", None


def normalize_private_key(private_key: str) -> str:
    """
    Normalize private key to 0x-prefixed lowercase hex.
    
    Args:
        private_key: Private key string
        
    Returns:
        Normalized private key (0x-prefixed, lowercase)
    """
    key = private_key.strip()
    if key.startswith("0x") or key.startswith("0X"):
        key = key[2:]
    return "0x" + key.lower()


def validate_password(password: str, min_length: int = 8) -> tuple[bool, list[str]]:
    """
    Validate password strength.
    
    Args:
        password: Password to validate
        min_length: Minimum required length
        
    Returns:
        Tuple of (is_valid, list_of_warnings)
    """
    warnings = []
    
    if not password:
        return False, ["Password cannot be empty"]
    
    if len(password) < min_length:
        warnings.append(f"Password should be at least {min_length} characters")
    
    if len(password) < 12:
        warnings.append("Consider using 12+ characters for better security")
    
    if not any(c.isupper() for c in password):
        warnings.append("Consider adding uppercase letters")
    
    if not any(c.islower() for c in password):
        warnings.append("Consider adding lowercase letters")
    
    if not any(c.isdigit() for c in password):
        warnings.append("Consider adding numbers")
    
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        warnings.append("Consider adding special characters")
    
    # Password is valid if it meets minimum length
    is_valid = len(password) >= min_length
    
    return is_valid, warnings


def validate_keystore_structure(keystore: dict, strict: bool = False) -> dict:
    """
    Validate keystore JSON structure.
    
    Args:
        keystore: Keystore dictionary
        strict: If True, require recommended security parameters
        
    Returns:
        Validation result dictionary
    """
    checks = {}
    errors = []
    warnings = []
    
    # Version check
    checks["has_version"] = "version" in keystore
    if checks["has_version"]:
        checks["version_is_3"] = keystore["version"] == 3
        if not checks["version_is_3"]:
            errors.append(f"Unsupported version: {keystore['version']} (expected 3)")
    else:
        errors.append("Missing 'version' field")
        checks["version_is_3"] = False
    
    # ID check
    checks["has_id"] = "id" in keystore
    if checks["has_id"]:
        try:
            uuid.UUID(keystore["id"])
            checks["id_is_valid_uuid"] = True
        except (ValueError, TypeError):
            checks["id_is_valid_uuid"] = False
            warnings.append("Invalid UUID format for 'id' field")
    else:
        warnings.append("Missing 'id' field (optional but recommended)")
        checks["id_is_valid_uuid"] = False
    
    # Address check
    checks["has_address"] = "address" in keystore
    if checks["has_address"]:
        addr = keystore["address"]
        # Address in keystore is lowercase without 0x
        if isinstance(addr, str) and len(addr) == 40 and HEX_PATTERN.match(addr):
            checks["address_is_valid"] = True
        else:
            checks["address_is_valid"] = False
            errors.append("Invalid address format")
    else:
        errors.append("Missing 'address' field")
        checks["address_is_valid"] = False
    
    # Crypto section
    checks["has_crypto"] = "crypto" in keystore or "Crypto" in keystore
    crypto = keystore.get("crypto") or keystore.get("Crypto", {})
    
    if checks["has_crypto"]:
        # Ciphertext
        checks["has_ciphertext"] = "ciphertext" in crypto
        if not checks["has_ciphertext"]:
            errors.append("Missing 'ciphertext' in crypto section")
        
        # Cipherparams and IV
        checks["has_cipherparams"] = "cipherparams" in crypto
        if checks["has_cipherparams"]:
            checks["has_iv"] = "iv" in crypto["cipherparams"]
            if checks["has_iv"]:
                iv = crypto["cipherparams"]["iv"]
                checks["iv_length_valid"] = len(iv) == 32  # 16 bytes = 32 hex
                if not checks["iv_length_valid"]:
                    errors.append(f"Invalid IV length: {len(iv)} (expected 32 hex chars)")
            else:
                errors.append("Missing 'iv' in cipherparams")
                checks["iv_length_valid"] = False
        else:
            errors.append("Missing 'cipherparams' in crypto section")
            checks["has_iv"] = False
            checks["iv_length_valid"] = False
        
        # Cipher
        checks["has_cipher"] = "cipher" in crypto
        if checks["has_cipher"]:
            checks["cipher_supported"] = crypto["cipher"].lower() == "aes-128-ctr"
            if not checks["cipher_supported"]:
                errors.append(f"Unsupported cipher: {crypto['cipher']}")
        else:
            errors.append("Missing 'cipher' in crypto section")
            checks["cipher_supported"] = False
        
        # KDF
        checks["has_kdf"] = "kdf" in crypto
        if checks["has_kdf"]:
            kdf = crypto["kdf"].lower()
            checks["kdf_supported"] = kdf in ("scrypt", "pbkdf2")
            if not checks["kdf_supported"]:
                errors.append(f"Unsupported KDF: {crypto['kdf']}")
        else:
            errors.append("Missing 'kdf' in crypto section")
            checks["kdf_supported"] = False
        
        # KDF params
        checks["has_kdfparams"] = "kdfparams" in crypto
        if checks["has_kdfparams"]:
            kdfparams = crypto["kdfparams"]
            kdf = crypto.get("kdf", "").lower()
            
            if kdf == "scrypt":
                required = ["n", "r", "p", "dklen", "salt"]
                missing = [p for p in required if p not in kdfparams]
                checks["kdfparams_valid"] = len(missing) == 0
                if missing:
                    errors.append(f"Missing scrypt params: {missing}")
                
                if strict and checks["kdfparams_valid"]:
                    n = kdfparams.get("n", 0)
                    if n < 262144:
                        warnings.append(f"Scrypt N={n} is below recommended 262144")
            
            elif kdf == "pbkdf2":
                required = ["c", "dklen", "prf", "salt"]
                missing = [p for p in required if p not in kdfparams]
                checks["kdfparams_valid"] = len(missing) == 0
                if missing:
                    errors.append(f"Missing pbkdf2 params: {missing}")
                
                if strict and checks["kdfparams_valid"]:
                    c = kdfparams.get("c", 0)
                    if c < 262144:
                        warnings.append(f"PBKDF2 iterations={c} is below recommended 262144")
            else:
                checks["kdfparams_valid"] = False
        else:
            errors.append("Missing 'kdfparams' in crypto section")
            checks["kdfparams_valid"] = False
        
        # MAC
        checks["has_mac"] = "mac" in crypto
        if checks["has_mac"]:
            mac = crypto["mac"]
            checks["mac_length_valid"] = len(mac) == 64  # 32 bytes = 64 hex
            if not checks["mac_length_valid"]:
                errors.append(f"Invalid MAC length: {len(mac)} (expected 64 hex chars)")
        else:
            errors.append("Missing 'mac' in crypto section")
            checks["mac_length_valid"] = False
    else:
        errors.append("Missing 'crypto' section")
        for key in ["has_ciphertext", "has_cipherparams", "has_iv", "iv_length_valid",
                    "has_cipher", "cipher_supported", "has_kdf", "kdf_supported",
                    "has_kdfparams", "kdfparams_valid", "has_mac", "mac_length_valid"]:
            checks[key] = False
    
    is_valid = len(errors) == 0
    
    return {
        "is_valid": is_valid,
        "version": keystore.get("version"),
        "errors": errors,
        "warnings": warnings,
        "checks": checks
    }


def get_keystore_address(keystore: dict) -> str | None:
    """
    Extract address from keystore and convert to checksum format.
    
    Args:
        keystore: Keystore dictionary
        
    Returns:
        Checksummed address or None if not found
    """
    address = keystore.get("address")
    if not address:
        return None
    
    # Add 0x prefix and convert to checksum
    if not address.startswith("0x"):
        address = "0x" + address
    
    try:
        return to_checksum_address(address)
    except Exception:
        return None
