"""
Keystore File Operations Tools

Implements save_keystore_file, load_keystore_file, and keystore_to_private_key_file MCP tools.
"""

import json
from pathlib import Path
from datetime import datetime, timezone

from mcp.server import Server
from eth_utils import to_checksum_address

from ..utils.file_utils import (
    secure_write_file,
    secure_read_file,
    generate_keystore_filename,
    validate_filepath,
    list_keystore_files,
)
from ..utils.validation import validate_keystore_structure, get_keystore_address


def register_file_tools(server: Server) -> None:
    """Register file operation tools with the MCP server."""
    
    @server.tool()
    async def save_keystore_file(
        keystore: dict,
        directory: str = ".",
        filename: str | None = None,
        use_standard_naming: bool = True
    ) -> dict:
        """
        Save keystore JSON to file with standard Ethereum naming convention.
        
        Writes the keystore to a file with secure permissions (0600).
        Uses the standard Ethereum keystore naming format by default.
        
        Args:
            keystore: Keystore JSON object from encrypt_keystore
            directory: Target directory path (default: current directory)
            filename: Custom filename (overrides standard naming if provided)
            use_standard_naming: Use UTC--timestamp--address format (default: true)
        
        Returns:
            Dictionary containing:
            - filepath: Absolute path to saved file
            - filename: Name of the file
            - address: Checksummed Ethereum address
            - file_size_bytes: Size of saved file
            - permissions: File permissions (0600)
        
        Standard Naming Format:
            UTC--YYYY-MM-DDTHH-MM-SS.sssZ--<address-lowercase-no-0x>
            Example: UTC--2024-01-15T10-30-00.000Z--1234567890abcdef...
        
        Security:
            - File created with 0600 permissions (owner read/write only)
            - Directory created with 0700 if it doesn't exist
        """
        # Validate keystore structure
        validation = validate_keystore_structure(keystore)
        if not validation["is_valid"]:
            return {
                "error": True,
                "code": "INVALID_KEYSTORE",
                "message": f"Invalid keystore: {', '.join(validation['errors'])}"
            }
        
        # Get address
        address = get_keystore_address(keystore)
        if not address:
            return {
                "error": True,
                "code": "NO_ADDRESS",
                "message": "Keystore does not contain valid address"
            }
        
        # Generate filename
        if filename:
            final_filename = filename
            if not final_filename.endswith('.json'):
                final_filename += '.json'
        elif use_standard_naming:
            final_filename = generate_keystore_filename(address) + '.json'
        else:
            final_filename = f"keystore-{address[2:8].lower()}.json"
        
        # Build full path
        dir_path = Path(directory).expanduser().resolve()
        file_path = dir_path / final_filename
        
        # Validate path
        is_valid, error = validate_filepath(file_path)
        if not is_valid:
            return {
                "error": True,
                "code": "INVALID_PATH",
                "message": error
            }
        
        try:
            # Write file securely
            result = secure_write_file(file_path, keystore)
            result["address"] = address
            return result
            
        except Exception as e:
            return {
                "error": True,
                "code": "WRITE_FAILED",
                "message": f"Failed to save keystore: {str(e)}"
            }
    
    
    @server.tool()
    async def load_keystore_file(
        filepath: str,
        validate: bool = True
    ) -> dict:
        """
        Load and optionally validate a keystore file.
        
        Reads a keystore JSON file from disk and optionally validates
        its structure according to Web3 Secret Storage V3 specification.
        
        Args:
            filepath: Path to keystore JSON file
            validate: Whether to validate keystore structure (default: true)
        
        Returns:
            Dictionary containing:
            - keystore: Full keystore JSON object
            - filepath: Absolute path to file
            - filename: Name of the file
            - address: Checksummed Ethereum address
            - version: Keystore version (should be 3)
            - kdf: Key derivation function used
            - is_valid: Validation result (if validate=true)
            - validation_details: Detailed validation checks
        """
        # Validate path exists
        is_valid, error = validate_filepath(filepath, must_exist=True)
        if not is_valid:
            return {
                "error": True,
                "code": "FILE_NOT_FOUND",
                "message": error
            }
        
        try:
            # Read file
            file_info = secure_read_file(filepath)
            
            # Check if JSON
            keystore = file_info.get("content_json")
            if keystore is None:
                return {
                    "error": True,
                    "code": "INVALID_JSON",
                    "message": "File does not contain valid JSON"
                }
            
            # Get basic info
            crypto = keystore.get("crypto") or keystore.get("Crypto", {})
            address = get_keystore_address(keystore)
            
            result = {
                "keystore": keystore,
                "filepath": file_info["filepath"],
                "filename": file_info["filename"],
                "address": address,
                "version": keystore.get("version"),
                "kdf": crypto.get("kdf")
            }
            
            # Validate if requested
            if validate:
                validation = validate_keystore_structure(keystore)
                result["is_valid"] = validation["is_valid"]
                result["validation_details"] = {
                    "has_required_fields": validation["is_valid"],
                    "version_supported": validation["checks"].get("version_is_3", False),
                    "kdf_supported": validation["checks"].get("kdf_supported", False),
                    "cipher_supported": validation["checks"].get("cipher_supported", False),
                    "errors": validation["errors"],
                    "warnings": validation["warnings"]
                }
            
            return result
            
        except Exception as e:
            return {
                "error": True,
                "code": "READ_FAILED",
                "message": f"Failed to read keystore: {str(e)}"
            }
    
    
    @server.tool()
    async def keystore_to_private_key_file(
        keystore: dict | str,
        password: str,
        output_format: str = "hex",
        filepath: str | None = None
    ) -> dict:
        """
        Decrypt keystore and save private key to file.
        
        ⚠️ DANGEROUS OPERATION - use with extreme caution!
        
        This exports the private key in UNENCRYPTED form. The resulting
        file should be securely deleted immediately after use.
        
        Args:
            keystore: Keystore to decrypt (JSON object or string)
            password: Decryption password
            output_format: "hex" (0x-prefixed) or "raw_bytes"
            filepath: Output file path (default: ./private_key_<address>.txt)
        
        Returns:
            Dictionary containing:
            - filepath: Path to saved private key file
            - address: Ethereum address
            - format: Format used for export
            - file_permissions: File permissions (0600)
            - warning: Security warning message
        
        Security Warning:
            🔴 Private key saved in plaintext - secure or delete immediately!
            🔴 Anyone with access to this file has full control of the wallet
            🔴 Consider using encrypted backup methods instead
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
        
        # Decrypt keystore using decrypt tool
        from .decrypt import register_decrypt_tools
        
        # We need to call decrypt directly
        from ..crypto.kdf import derive_key_scrypt, derive_key_pbkdf2
        from ..crypto.cipher import decrypt_aes_ctr
        from ..crypto.mac import verify_mac
        from ..utils.validation import validate_keystore_structure
        from eth_account import Account
        
        # Validate keystore
        validation = validate_keystore_structure(keystore)
        if not validation["is_valid"]:
            return {
                "error": True,
                "code": "INVALID_KEYSTORE",
                "message": f"Invalid keystore: {', '.join(validation['errors'])}"
            }
        
        crypto = keystore.get("crypto") or keystore.get("Crypto")
        
        try:
            # Extract parameters
            kdf = crypto["kdf"].lower()
            kdfparams = crypto["kdfparams"]
            ciphertext = bytes.fromhex(crypto["ciphertext"])
            iv = bytes.fromhex(crypto["cipherparams"]["iv"])
            expected_mac = bytes.fromhex(crypto["mac"])
            salt = bytes.fromhex(kdfparams["salt"])
            
            # Derive key
            if kdf == "scrypt":
                derived_key, _ = derive_key_scrypt(
                    password=password, salt=salt,
                    n=kdfparams["n"], r=kdfparams["r"],
                    p=kdfparams["p"], dklen=kdfparams["dklen"]
                )
            elif kdf == "pbkdf2":
                derived_key, _ = derive_key_pbkdf2(
                    password=password, salt=salt,
                    iterations=kdfparams["c"], dklen=kdfparams["dklen"]
                )
            else:
                return {"error": True, "code": "UNSUPPORTED_KDF", "message": f"Unsupported KDF: {kdf}"}
            
            # Verify MAC
            if not verify_mac(derived_key, ciphertext, expected_mac):
                return {"error": True, "code": "INVALID_PASSWORD", "message": "Wrong password"}
            
            # Decrypt
            private_key_bytes = decrypt_aes_ctr(ciphertext, derived_key, iv)
            
            # Get address
            account = Account.from_key(private_key_bytes)
            address = to_checksum_address(account.address)
            
            # Format private key
            if output_format == "hex":
                content = "0x" + private_key_bytes.hex()
            elif output_format == "raw_bytes":
                content = private_key_bytes
            else:
                content = "0x" + private_key_bytes.hex()
            
            # Determine filepath
            if not filepath:
                filepath = f"./private_key_{address[2:10].lower()}.txt"
            
            # Write file
            result = secure_write_file(filepath, content if isinstance(content, bytes) else content.encode())
            
            return {
                "filepath": result["filepath"],
                "address": address,
                "format": output_format,
                "file_permissions": result["permissions"],
                "warning": "🔴 DANGER: Private key saved in plaintext! Secure or delete this file immediately. Anyone with access has full control of the wallet."
            }
            
        except Exception as e:
            return {
                "error": True,
                "code": "EXPORT_FAILED",
                "message": f"Failed to export private key: {str(e)}"
            }
