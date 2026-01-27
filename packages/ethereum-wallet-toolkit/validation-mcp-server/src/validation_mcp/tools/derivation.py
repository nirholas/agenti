"""
Address Derivation Tools

Implements derive_address_from_private_key and derive_address_from_public_key.
"""

from mcp.server.fastmcp import FastMCP
from eth_account import Account
from eth_keys import keys
from eth_utils import keccak, to_checksum_address


def derive_address_from_private_key_impl(
    private_key: str,
    include_public_key: bool = True
) -> dict:
    """
    Derive Ethereum address from a private key.
    
    Performs the full derivation chain: private key → public key → address,
    optionally returning the intermediate public key values.
    
    Args:
        private_key: Hex-encoded private key (with or without 0x prefix)
        include_public_key: Whether to include public key in response
    
    Returns:
        Dictionary containing:
        - address: Checksummed Ethereum address
        - address_lowercase: Lowercase address
        - public_key: Public key info (if include_public_key=True)
        - derivation_steps: Explanation of derivation process
    """
    # Clean input
    key = private_key.strip() if private_key else ""
    if key.startswith('0x') or key.startswith('0X'):
        key = key[2:]
    
    # Validate
    if len(key) != 64:
        return {
            "error": True,
            "code": "INVALID_KEY",
            "message": f"Invalid key length: {len(key)} (expected 64)"
        }
    
    try:
        key_bytes = bytes.fromhex(key)
    except ValueError as e:
        return {
            "error": True,
            "code": "INVALID_HEX",
            "message": f"Invalid hex: {e}"
        }
    
    try:
        # Derive using eth-account
        account = Account.from_key(key_bytes)
        address = account.address
        address_lowercase = address.lower()
        
        # Get public key
        private_key_obj = keys.PrivateKey(key_bytes)
        public_key = private_key_obj.public_key
        pub_bytes = public_key.to_bytes()
        
        result = {
            "address": address,
            "address_lowercase": address_lowercase,
            "derivation_steps": {
                "step1": "private_key → public_key (secp256k1 multiplication)",
                "step2": "keccak256(public_key_bytes)",
                "step3": "take last 20 bytes",
                "step4": "apply EIP-55 checksum"
            }
        }
        
        if include_public_key:
            x_coord = pub_bytes[:32]
            y_coord = pub_bytes[32:]
            y_int = int.from_bytes(y_coord, 'big')
            prefix = "02" if y_int % 2 == 0 else "03"
            y_parity = "even" if y_int % 2 == 0 else "odd"
            
            result["public_key"] = {
                "uncompressed": "0x04" + pub_bytes.hex(),
                "uncompressed_no_prefix": "0x" + pub_bytes.hex(),
                "compressed": "0x" + prefix + x_coord.hex(),
                "x_coordinate": "0x" + x_coord.hex(),
                "y_coordinate": "0x" + y_coord.hex(),
                "y_parity": y_parity
            }
        
        return result
        
    except Exception as e:
        return {
            "error": True,
            "code": "DERIVATION_FAILED",
            "message": f"Failed to derive address: {e}"
        }


def derive_address_from_public_key_impl(
    public_key: str,
    key_format: str = "auto"
) -> dict:
    """
    Derive Ethereum address from a public key.
    
    Supports both compressed (33 bytes) and uncompressed (64/65 bytes) formats.
    
    Args:
        public_key: Hex-encoded public key
        key_format: "auto", "compressed", or "uncompressed"
    
    Returns:
        Dictionary containing:
        - address: Checksummed Ethereum address
        - input_format_detected: Detected key format
        - public_key_normalized: Normalized public key formats
        - keccak_hash: Full keccak hash
        - address_bytes: Last 20 bytes of hash
    """
    # Clean input
    key = public_key.strip() if public_key else ""
    if key.startswith('0x') or key.startswith('0X'):
        key = key[2:]
    
    try:
        key_bytes = bytes.fromhex(key)
    except ValueError as e:
        return {
            "error": True,
            "code": "INVALID_HEX",
            "message": f"Invalid hex: {e}"
        }
    
    # Detect format
    key_len = len(key_bytes)
    
    if key_format == "auto":
        if key_len == 33:
            detected_format = "compressed"
        elif key_len == 64:
            detected_format = "uncompressed"
        elif key_len == 65 and key_bytes[0] == 0x04:
            detected_format = "uncompressed"
            key_bytes = key_bytes[1:]  # Remove 04 prefix
        else:
            return {
                "error": True,
                "code": "INVALID_LENGTH",
                "message": f"Cannot determine format from length: {key_len}"
            }
    else:
        detected_format = key_format
    
    try:
        if detected_format == "compressed":
            # Decompress the public key
            pub_key_obj = keys.PublicKey.from_compressed_bytes(key_bytes)
            pub_bytes = pub_key_obj.to_bytes()
        else:
            # Already uncompressed
            if key_len == 65:
                pub_bytes = key_bytes[1:]
            else:
                pub_bytes = key_bytes
            pub_key_obj = keys.PublicKey(pub_bytes)
        
        # Compute keccak256 hash
        keccak_hash = keccak(pub_bytes)
        
        # Take last 20 bytes for address
        address_bytes = keccak_hash[-20:]
        address_hex = address_bytes.hex()
        address_checksum = to_checksum_address("0x" + address_hex)
        
        # Get normalized public key formats
        x_coord = pub_bytes[:32]
        y_coord = pub_bytes[32:]
        y_int = int.from_bytes(y_coord, 'big')
        prefix = "02" if y_int % 2 == 0 else "03"
        
        return {
            "address": address_checksum,
            "input_format_detected": detected_format,
            "public_key_normalized": {
                "uncompressed": "0x04" + pub_bytes.hex(),
                "compressed": "0x" + prefix + x_coord.hex()
            },
            "keccak_hash": "0x" + keccak_hash.hex(),
            "address_bytes": "0x" + address_bytes.hex()
        }
        
    except Exception as e:
        return {
            "error": True,
            "code": "DERIVATION_FAILED",
            "message": f"Failed to derive address: {e}"
        }


def register_derivation_tools(server: FastMCP) -> None:
    """Register derivation tools with the MCP server."""
    
    @server.tool()
    async def derive_address_from_private_key(
        private_key: str,
        include_public_key: bool = True
    ) -> dict:
        """
        Derive Ethereum address from a private key.
        
        Performs the full derivation chain: private key → public key → address,
        optionally returning the intermediate public key values.
        
        Args:
            private_key: Hex-encoded private key (with or without 0x prefix)
            include_public_key: Whether to include public key in response
        
        Returns:
            Dictionary containing:
            - address: Checksummed Ethereum address
            - address_lowercase: Lowercase address
            - public_key: Public key info (if include_public_key=True)
            - derivation_steps: Explanation of derivation process
        """
        return derive_address_from_private_key_impl(private_key, include_public_key)
    
    @server.tool()
    async def derive_address_from_public_key(
        public_key: str,
        key_format: str = "auto"
    ) -> dict:
        """
        Derive Ethereum address from a public key.
        
        Supports both compressed (33 bytes) and uncompressed (64/65 bytes) formats.
        
        Args:
            public_key: Hex-encoded public key
            key_format: "auto", "compressed", or "uncompressed"
        
        Returns:
            Dictionary containing:
            - address: Checksummed Ethereum address
            - input_format_detected: Detected key format
            - public_key_normalized: Normalized public key formats
            - keccak_hash: Full keccak hash
            - address_bytes: Last 20 bytes of hash
        """
        return derive_address_from_public_key_impl(public_key, key_format)
