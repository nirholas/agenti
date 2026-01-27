"""
Keystore Validation Tools

Implements get_keystore_info and validate_keystore MCP tools.
"""

import json

from mcp.server import Server
from eth_utils import to_checksum_address

from ..crypto.kdf import assess_kdf_strength
from ..utils.validation import validate_keystore_structure, get_keystore_address


def get_keystore_info_impl(keystore: dict | str) -> dict:
    """
    Implementation of keystore info extraction.
    
    Args:
        keystore: Keystore JSON object or JSON string
    
    Returns:
        Dictionary with keystore metadata or error.
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
    
    # Basic validation
    validation = validate_keystore_structure(keystore)
    if not validation["is_valid"]:
        return {
            "error": True,
            "code": "INVALID_KEYSTORE",
            "message": f"Invalid keystore: {', '.join(validation['errors'])}"
        }
    
    # Get crypto section
    crypto = keystore.get("crypto") or keystore.get("Crypto", {})
    
    # Get address
    address = get_keystore_address(keystore)
    
    # Get KDF info
    kdf = crypto.get("kdf", "unknown").lower()
    kdfparams = crypto.get("kdfparams", {})
    
    # Format KDF params for display
    kdf_params_display = {}
    if kdf == "scrypt":
        kdf_params_display = {
            "n": kdfparams.get("n"),
            "r": kdfparams.get("r"),
            "p": kdfparams.get("p"),
            "dklen": kdfparams.get("dklen"),
            "salt": kdfparams.get("salt", "")[:16] + "..." if kdfparams.get("salt") else None
        }
    elif kdf == "pbkdf2":
        kdf_params_display = {
            "c": kdfparams.get("c"),
            "prf": kdfparams.get("prf"),
            "dklen": kdfparams.get("dklen"),
            "salt": kdfparams.get("salt", "")[:16] + "..." if kdfparams.get("salt") else None
        }
    
    # Assess security
    security = assess_kdf_strength(kdf, kdfparams)
    
    return {
        "address": address,
        "keystore_id": keystore.get("id"),
        "version": keystore.get("version"),
        "kdf": kdf,
        "kdf_params": kdf_params_display,
        "cipher": crypto.get("cipher"),
        "security_assessment": security
    }


def validate_keystore_impl(keystore: dict | str, strict: bool = False) -> dict:
    """
    Implementation of keystore validation.
    
    Args:
        keystore: Keystore to validate (JSON object or string)
        strict: If true, require recommended security parameters
    
    Returns:
        Dictionary with validation results.
    """
    # Parse keystore if string
    if isinstance(keystore, str):
        try:
            keystore = json.loads(keystore)
        except json.JSONDecodeError as e:
            return {
                "is_valid": False,
                "version": None,
                "errors": [f"Invalid JSON: {e}"],
                "warnings": [],
                "checks": {}
            }
    
    # Run validation
    result = validate_keystore_structure(keystore, strict=strict)
    
    # Add security assessment if valid enough
    if result["checks"].get("has_kdf") and result["checks"].get("has_kdfparams"):
        crypto = keystore.get("crypto") or keystore.get("Crypto", {})
        kdf = crypto.get("kdf", "").lower()
        kdfparams = crypto.get("kdfparams", {})
        
        security = assess_kdf_strength(kdf, kdfparams)
        
        # Add security warnings
        if security.get("kdf_strength") in ("light", "weak"):
            result["warnings"].append(
                f"KDF strength is '{security['kdf_strength']}' - "
                f"estimated crack time: {security['estimated_crack_time']}"
            )
        
        result["warnings"].extend(security.get("recommendations", []))
    
    return result


def register_validation_tools(server: Server) -> None:
    """Register validation tools with the MCP server."""
    
    @server.tool()
    async def get_keystore_info(keystore: dict | str) -> dict:
        """
        Extract metadata from keystore without decrypting.
        
        Provides detailed information about a keystore's structure,
        security parameters, and recommendations without requiring
        the password.
        
        Args:
            keystore: Keystore JSON object or JSON string
        
        Returns:
            Dictionary containing:
            - address: Checksummed Ethereum address
            - keystore_id: UUID v4 identifier
            - version: Keystore version (should be 3)
            - kdf: Key derivation function used
            - kdf_params: Full KDF parameters
            - cipher: Encryption cipher used
            - security_assessment: Security strength analysis
        """
        return get_keystore_info_impl(keystore)
    
    
    @server.tool()
    async def validate_keystore(
        keystore: dict | str,
        strict: bool = False
    ) -> dict:
        """
        Validate keystore structure and parameters.
        
        Performs comprehensive validation of a keystore file against
        the Web3 Secret Storage V3 specification.
        
        Args:
            keystore: Keystore to validate (JSON object or string)
            strict: If true, require recommended security parameters
        
        Returns:
            Dictionary containing:
            - is_valid: Overall validation result
            - version: Detected version
            - errors: List of critical errors
            - warnings: List of non-critical issues
            - checks: Detailed check results for each field
        
        Checks performed:
            - has_version: Version field exists
            - version_is_3: Version equals 3
            - has_id: UUID field exists
            - id_is_valid_uuid: UUID is valid format
            - has_address: Address field exists
            - address_is_valid: Address is valid hex
            - has_crypto: Crypto section exists
            - has_ciphertext: Ciphertext exists
            - has_cipherparams: Cipher params exist
            - has_iv: IV exists
            - iv_length_valid: IV is correct length
            - has_cipher: Cipher field exists
            - cipher_supported: Cipher is aes-128-ctr
            - has_kdf: KDF field exists
            - kdf_supported: KDF is scrypt or pbkdf2
            - has_kdfparams: KDF params exist
            - kdfparams_valid: KDF params are complete
            - has_mac: MAC field exists
            - mac_length_valid: MAC is correct length
        """
        return validate_keystore_impl(keystore, strict)
