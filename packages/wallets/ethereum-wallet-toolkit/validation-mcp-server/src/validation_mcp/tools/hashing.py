"""
Hashing Tools

Implements keccak256_hash tool.
"""

import base64
from mcp.server.fastmcp import FastMCP
from eth_utils import keccak


def compute_keccak256_impl(
    data: str,
    input_type: str = "hex"
) -> dict:
    """
    Compute Keccak-256 hash (Ethereum's hash function).
    
    Computes the Keccak-256 hash used throughout Ethereum for addresses,
    signatures, storage slots, and more.
    
    Args:
        data: Data to hash
        input_type: Input format - "hex" (0x-prefixed), "text" (UTF-8 string), 
                   or "bytes" (base64 encoded)
    
    Returns:
        Dictionary containing:
        - hash: 0x-prefixed hash (64 hex chars)
        - hash_no_prefix: Hash without 0x prefix
        - input_type: Input type used
        - input_byte_length: Length of input in bytes
        - algorithm: Hash algorithm used
        - note: Important note about Keccak vs SHA3
    
    Note:
        Ethereum uses Keccak-256, which differs from NIST SHA3-256.
        This is the pre-standardization version of SHA3.
    """
    try:
        # Convert input to bytes based on type
        if input_type == "hex":
            hex_str = data.strip() if data else ""
            if hex_str.startswith('0x') or hex_str.startswith('0X'):
                hex_str = hex_str[2:]
            input_bytes = bytes.fromhex(hex_str)
        elif input_type == "text":
            input_bytes = data.encode('utf-8')
        elif input_type == "bytes":
            input_bytes = base64.b64decode(data)
        else:
            return {
                "error": True,
                "code": "INVALID_INPUT_TYPE",
                "message": f"Unknown input_type: {input_type}. Use 'hex', 'text', or 'bytes'"
            }
        
        # Compute hash
        if input_type == "text":
            hash_bytes = keccak(text=data)
        else:
            hash_bytes = keccak(primitive=input_bytes)
        
        hash_hex = hash_bytes.hex()
        
        return {
            "hash": "0x" + hash_hex,
            "hash_no_prefix": hash_hex,
            "input_type": input_type,
            "input_byte_length": len(input_bytes),
            "algorithm": "keccak256",
            "note": "Ethereum uses Keccak-256, not NIST SHA3-256"
        }
        
    except Exception as e:
        return {
            "error": True,
            "code": "HASH_FAILED",
            "message": f"Failed to compute hash: {e}"
        }


def register_hashing_tools(server: FastMCP) -> None:
    """Register hashing tools with the MCP server."""
    
    @server.tool()
    async def keccak256_hash(
        data: str,
        input_type: str = "hex"
    ) -> dict:
        """
        Compute Keccak-256 hash (Ethereum's hash function).
        
        Computes the Keccak-256 hash used throughout Ethereum for addresses,
        signatures, storage slots, and more.
        
        Args:
            data: Data to hash
            input_type: Input format - "hex" (0x-prefixed), "text" (UTF-8 string), 
                       or "bytes" (base64 encoded)
        
        Returns:
            Dictionary containing:
            - hash: 0x-prefixed hash (64 hex chars)
            - hash_no_prefix: Hash without 0x prefix
            - input_type: Input type used
            - input_byte_length: Length of input in bytes
            - algorithm: Hash algorithm used
            - note: Important note about Keccak vs SHA3
        
        Note:
            Ethereum uses Keccak-256, which differs from NIST SHA3-256.
            This is the pre-standardization version of SHA3.
        """
        return compute_keccak256_impl(data, input_type)
    
    @server.tool()
    async def validate_ens_name(
        name: str,
        check_format_only: bool = True
    ) -> dict:
        """
        Validate ENS name format (offline validation only).
        
        Validates the format of an ENS name and computes its namehash.
        Does not perform actual resolution (requires network access).
        
        Args:
            name: ENS name (e.g., "vitalik.eth")
            check_format_only: Only check format, not resolution
        
        Returns:
            Dictionary containing:
            - is_valid_format: Whether the name format is valid
            - name: Original name
            - normalized: Normalized name
            - namehash: ENS namehash (recursive keccak256)
            - labels: List of labels (e.g., ["vitalik", "eth"])
            - tld: Top-level domain (e.g., "eth")
            - validation_details: Detailed validation checks
            - note: Reminder that resolution requires network
        """
        if not name or not isinstance(name, str):
            return {
                "is_valid_format": False,
                "name": name,
                "normalized": None,
                "namehash": None,
                "labels": [],
                "tld": None,
                "validation_details": {
                    "valid_characters": False,
                    "no_invalid_hyphens": False,
                    "label_lengths_valid": False
                },
                "note": "Resolution requires online ENS lookup"
            }
        
        # Normalize to lowercase
        normalized = name.lower().strip()
        
        # Split into labels
        labels = normalized.split('.')
        
        if len(labels) < 2:
            return {
                "is_valid_format": False,
                "name": name,
                "normalized": normalized,
                "namehash": None,
                "labels": labels,
                "tld": labels[-1] if labels else None,
                "validation_details": {
                    "valid_characters": True,
                    "no_invalid_hyphens": True,
                    "label_lengths_valid": False,
                    "error": "ENS name must have at least 2 labels (e.g., name.eth)"
                },
                "note": "Resolution requires online ENS lookup"
            }
        
        # Validate each label
        valid_characters = True
        no_invalid_hyphens = True
        label_lengths_valid = True
        
        for label in labels:
            # Check for empty labels
            if len(label) == 0:
                label_lengths_valid = False
                continue
            
            # Check label length (1-63 chars)
            if len(label) > 63:
                label_lengths_valid = False
            
            # Check for invalid hyphens (can't start or end with hyphen)
            if label.startswith('-') or label.endswith('-'):
                no_invalid_hyphens = False
            
            # Check valid characters (alphanumeric and hyphen)
            for char in label:
                if not (char.isalnum() or char == '-'):
                    valid_characters = False
        
        is_valid = valid_characters and no_invalid_hyphens and label_lengths_valid
        
        # Compute namehash
        # namehash('') = 0x0
        # namehash(name) = keccak256(namehash(parent) + keccak256(label))
        namehash = bytes(32)  # Start with 32 zero bytes
        
        try:
            for label in reversed(labels):
                label_hash = keccak(text=label)
                namehash = keccak(primitive=namehash + label_hash)
            
            namehash_hex = "0x" + namehash.hex()
        except Exception:
            namehash_hex = None
        
        return {
            "is_valid_format": is_valid,
            "name": name,
            "normalized": normalized,
            "namehash": namehash_hex,
            "labels": labels,
            "tld": labels[-1],
            "validation_details": {
                "valid_characters": valid_characters,
                "no_invalid_hyphens": no_invalid_hyphens,
                "label_lengths_valid": label_lengths_valid
            },
            "note": "Resolution requires online ENS lookup"
        }
