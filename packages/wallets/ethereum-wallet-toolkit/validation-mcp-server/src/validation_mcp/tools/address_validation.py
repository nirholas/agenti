"""
Address Validation Tools

Implements validate_address, compare_addresses, and batch_validate_addresses.
All core logic is in *_impl functions for testability.
"""

import re
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP
from eth_utils import to_checksum_address, keccak


# Constants
HEX_PATTERN = re.compile(r'^[0-9a-fA-F]+$')
ADDRESS_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]{40}$', re.IGNORECASE)


def _is_checksum_address(address: str) -> bool:
    """Check if address has valid EIP-55 checksum."""
    if not address.startswith('0x'):
        return False
    
    addr = address[2:]
    addr_lower = addr.lower()
    
    # Compute checksum
    hash_bytes = keccak(text=addr_lower)
    hash_hex = hash_bytes.hex()
    
    for i, char in enumerate(addr):
        if char.isalpha():
            if int(hash_hex[i], 16) >= 8:
                if char != char.upper():
                    return False
            else:
                if char != char.lower():
                    return False
    
    return True


def _detect_address_format(address: str) -> str:
    """Detect the format of an address."""
    if not address.startswith('0x'):
        return "no_prefix"
    
    addr = address[2:]
    if addr == addr.lower():
        return "lowercase"
    elif addr == addr.upper():
        return "uppercase"
    elif _is_checksum_address(address):
        return "checksum"
    else:
        return "mixed_invalid"


# =============================================================================
# Implementation Functions (testable without async)
# =============================================================================

def validate_address_impl(
    address: str,
    check_checksum: bool = True,
    return_normalized: bool = True
) -> Dict[str, Any]:
    """
    Comprehensive Ethereum address validation.
    
    Args:
        address: Address to validate
        check_checksum: Whether to verify EIP-55 checksum if present
        return_normalized: Return checksummed version
    
    Returns:
        Validation result dictionary
    """
    warnings = []
    validation_details = {
        "has_0x_prefix": False,
        "correct_length": False,
        "valid_hex_characters": False,
        "checksum_matches": None
    }
    
    # Initial cleaning
    addr = address.strip() if address else ""
    
    # Check for 0x prefix
    if addr.startswith('0x') or addr.startswith('0X'):
        validation_details["has_0x_prefix"] = True
        addr_hex = addr[2:]
    else:
        validation_details["has_0x_prefix"] = False
        addr_hex = addr
        warnings.append("Address missing 0x prefix")
    
    # Check length
    if len(addr_hex) == 40:
        validation_details["correct_length"] = True
    else:
        return {
            "is_valid": False,
            "address_input": address,
            "address_checksum": None,
            "address_lowercase": None,
            "format_detected": "invalid",
            "checksum_valid": None,
            "checksum_status": "invalid_length",
            "byte_length": len(addr_hex) // 2 if HEX_PATTERN.match(addr_hex) else 0,
            "validation_details": validation_details,
            "warnings": [f"Invalid length: {len(addr_hex)} chars (expected 40)"]
        }
    
    # Check hex characters
    if HEX_PATTERN.match(addr_hex):
        validation_details["valid_hex_characters"] = True
    else:
        return {
            "is_valid": False,
            "address_input": address,
            "address_checksum": None,
            "address_lowercase": None,
            "format_detected": "invalid",
            "checksum_valid": None,
            "checksum_status": "invalid_characters",
            "byte_length": 0,
            "validation_details": validation_details,
            "warnings": ["Address contains non-hex characters"]
        }
    
    # Build normalized addresses
    addr_normalized = "0x" + addr_hex
    addr_lowercase = "0x" + addr_hex.lower()
    
    try:
        addr_checksum = to_checksum_address(addr_lowercase)
    except Exception as e:
        return {
            "is_valid": False,
            "address_input": address,
            "address_checksum": None,
            "address_lowercase": addr_lowercase,
            "format_detected": "invalid",
            "checksum_valid": None,
            "checksum_status": "error",
            "byte_length": 20,
            "validation_details": validation_details,
            "warnings": [f"Checksum computation failed: {e}"]
        }
    
    # Detect format
    format_detected = _detect_address_format(addr_normalized)
    
    # Determine checksum status
    if format_detected == "lowercase" or format_detected == "uppercase":
        checksum_valid = None
        checksum_status = "not_checksummed"
    elif format_detected == "checksum":
        checksum_valid = True
        checksum_status = "valid"
        validation_details["checksum_matches"] = True
    elif format_detected == "mixed_invalid":
        checksum_valid = False
        checksum_status = "invalid"
        validation_details["checksum_matches"] = False
        if check_checksum:
            warnings.append("Address has mixed case but invalid checksum")
    else:
        checksum_valid = None
        checksum_status = "not_checksummed"
    
    return {
        "is_valid": True,
        "address_input": address,
        "address_checksum": addr_checksum,
        "address_lowercase": addr_lowercase,
        "format_detected": format_detected,
        "checksum_valid": checksum_valid,
        "checksum_status": checksum_status,
        "byte_length": 20,
        "validation_details": validation_details,
        "warnings": warnings
    }


def compare_addresses_impl(
    address1: str,
    address2: str
) -> Dict[str, Any]:
    """
    Compare two Ethereum addresses for equality.
    
    Args:
        address1: First address
        address2: Second address
    
    Returns:
        Comparison result dictionary
    """
    result1 = validate_address_impl(address1)
    result2 = validate_address_impl(address2)
    
    if not result1["is_valid"]:
        return {
            "are_equal": False,
            "address1": {"input": address1, "is_valid": False, "error": "Invalid address"},
            "address2": {"input": address2, "is_valid": result2["is_valid"]},
            "comparison_method": "failed",
            "case_matches": False,
            "both_valid_checksum": False
        }
    
    if not result2["is_valid"]:
        return {
            "are_equal": False,
            "address1": {"input": address1, "is_valid": True},
            "address2": {"input": address2, "is_valid": False, "error": "Invalid address"},
            "comparison_method": "failed",
            "case_matches": False,
            "both_valid_checksum": False
        }
    
    are_equal = result1["address_lowercase"] == result2["address_lowercase"]
    case_matches = address1 == address2
    both_checksummed = (
        result1["checksum_status"] == "valid" and 
        result2["checksum_status"] == "valid"
    )
    
    return {
        "are_equal": are_equal,
        "address1": {
            "input": address1,
            "is_valid": True,
            "checksum": result1["address_checksum"],
            "format": result1["format_detected"]
        },
        "address2": {
            "input": address2,
            "is_valid": True,
            "checksum": result2["address_checksum"],
            "format": result2["format_detected"]
        },
        "comparison_method": "normalized_lowercase",
        "case_matches": case_matches,
        "both_valid_checksum": both_checksummed
    }


def batch_validate_addresses_impl(
    addresses: List[str],
    check_checksum: bool = True,
    stop_on_invalid: bool = False
) -> Dict[str, Any]:
    """
    Validate multiple addresses at once.
    
    Args:
        addresses: List of addresses to validate
        check_checksum: Whether to verify checksums
        stop_on_invalid: Stop at first invalid address
    
    Returns:
        Batch validation results
    """
    results = []
    valid_addresses = []
    invalid_addresses = []
    
    for i, addr in enumerate(addresses):
        result = validate_address_impl(addr, check_checksum)
        
        entry = {
            "index": i,
            "input": addr,
            "is_valid": result["is_valid"],
            "checksum_address": result.get("address_checksum"),
            "error": result.get("warnings", [None])[0] if not result["is_valid"] else None
        }
        results.append(entry)
        
        if result["is_valid"]:
            valid_addresses.append(result["address_checksum"])
        else:
            invalid_addresses.append({
                "index": i,
                "input": addr,
                "error": entry["error"] or "Invalid address"
            })
            if stop_on_invalid:
                break
    
    return {
        "total_count": len(addresses),
        "valid_count": len(valid_addresses),
        "invalid_count": len(invalid_addresses),
        "all_valid": len(invalid_addresses) == 0,
        "results": results,
        "invalid_addresses": invalid_addresses,
        "valid_addresses": valid_addresses
    }


def generate_vanity_check_impl(
    address: str,
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None
) -> Dict[str, Any]:
    """
    Check if an address matches vanity criteria.
    
    Args:
        address: Address to check
        prefix: Required prefix (after 0x)
        suffix: Required suffix
        contains: Required substring
    
    Returns:
        Vanity check results
    """
    result = validate_address_impl(address)
    if not result["is_valid"]:
        return {
            "matches_all": False,
            "address": None,
            "error": "Invalid address",
            "checks": {},
            "details": {},
            "pattern_difficulty": None
        }
    
    addr_lower = result["address_lowercase"][2:]  # Remove 0x
    addr_checksum = result["address_checksum"]
    
    checks = {
        "prefix_match": True,
        "suffix_match": True,
        "contains_match": True
    }
    details = {}
    
    # Check prefix
    if prefix:
        prefix_lower = prefix.lower()
        checks["prefix_match"] = addr_lower.startswith(prefix_lower)
        details["prefix_wanted"] = prefix
        details["prefix_found"] = addr_lower[:len(prefix)]
    
    # Check suffix
    if suffix:
        suffix_lower = suffix.lower()
        checks["suffix_match"] = addr_lower.endswith(suffix_lower)
        details["suffix_wanted"] = suffix
        details["suffix_found"] = addr_lower[-len(suffix):] if suffix else ""
    
    # Check contains
    if contains:
        contains_lower = contains.lower()
        found = contains_lower in addr_lower
        checks["contains_match"] = found
        details["contains_wanted"] = contains
        if found:
            pos = addr_lower.find(contains_lower)
            details["contains_position"] = pos
    
    matches_all = all(checks.values())
    
    # Calculate difficulty
    total_chars = len(prefix or "") + len(suffix or "")
    estimated_attempts = 16 ** total_chars if total_chars > 0 else 1
    
    if total_chars <= 2:
        difficulty_score = "trivial"
    elif total_chars <= 4:
        difficulty_score = "easy"
    elif total_chars <= 6:
        difficulty_score = "medium"
    elif total_chars <= 8:
        difficulty_score = "hard"
    else:
        difficulty_score = "very_hard"
    
    return {
        "matches_all": matches_all,
        "address": addr_checksum,
        "checks": checks,
        "details": details,
        "pattern_difficulty": {
            "estimated_attempts": estimated_attempts,
            "hex_chars_matched": total_chars,
            "difficulty_score": difficulty_score
        }
    }


# =============================================================================
# Tool Registration
# =============================================================================

def register_address_tools(server: FastMCP) -> None:
    """Register address validation tools with the MCP server."""
    
    @server.tool()
    async def validate_address(
        address: str,
        check_checksum: bool = True,
        return_normalized: bool = True
    ) -> dict:
        """
        Comprehensive Ethereum address validation.
        
        Validates an Ethereum address format, optionally verifying EIP-55 checksum.
        Returns detailed information about the address validity and format.
        
        Args:
            address: Address to validate (any format - with/without 0x, any case)
            check_checksum: Whether to verify EIP-55 checksum if present
            return_normalized: Return checksummed version
        
        Returns:
            Dictionary containing:
            - is_valid: Whether the address is valid
            - address_input: Original input
            - address_checksum: EIP-55 checksummed version
            - address_lowercase: Lowercase version
            - format_detected: Format of input (lowercase/checksum/mixed_invalid)
            - checksum_valid: Whether checksum is valid (null if not checksummed)
            - checksum_status: valid/invalid/not_checksummed
            - byte_length: Address byte length (should be 20)
            - validation_details: Detailed validation info
            - warnings: Any warnings about the address
        """
        return validate_address_impl(address, check_checksum, return_normalized)
    
    @server.tool()
    async def compare_addresses(
        address1: str,
        address2: str
    ) -> dict:
        """
        Compare two Ethereum addresses for equality (case-insensitive).
        
        Compares two addresses after normalizing them, returning whether they
        represent the same Ethereum address regardless of case/format.
        
        Args:
            address1: First address
            address2: Second address
        
        Returns:
            Dictionary containing:
            - are_equal: Whether addresses are the same
            - address1: Info about first address
            - address2: Info about second address
            - comparison_method: How comparison was done
            - case_matches: Whether cases match exactly
            - both_valid_checksum: Whether both have valid checksums
        """
        return compare_addresses_impl(address1, address2)
    
    @server.tool()
    async def batch_validate_addresses(
        addresses: list,
        check_checksum: bool = True,
        stop_on_invalid: bool = False
    ) -> dict:
        """
        Validate multiple Ethereum addresses at once.
        
        Efficiently validates a list of addresses, returning summary statistics
        and detailed results for each address.
        
        Args:
            addresses: List of addresses to validate
            check_checksum: Verify checksums for all addresses
            stop_on_invalid: Stop at first invalid address
        
        Returns:
            Dictionary containing:
            - total_count: Total addresses checked
            - valid_count: Number of valid addresses
            - invalid_count: Number of invalid addresses
            - all_valid: Whether all addresses are valid
            - results: Detailed result for each address
            - invalid_addresses: List of invalid addresses with errors
            - valid_addresses: List of valid checksummed addresses
        """
        return batch_validate_addresses_impl(addresses, check_checksum, stop_on_invalid)
    
    @server.tool()
    async def generate_vanity_check(
        address: str,
        prefix: str = None,
        suffix: str = None,
        contains: str = None
    ) -> dict:
        """
        Check if an address matches vanity criteria.
        
        Checks whether an Ethereum address matches specified vanity patterns
        (prefix, suffix, or contains) and calculates pattern difficulty.
        
        Args:
            address: Address to check
            prefix: Required prefix (after 0x), case-insensitive
            suffix: Required suffix, case-insensitive
            contains: Required substring, case-insensitive
        
        Returns:
            Dictionary containing:
            - matches_all: Whether all criteria are met
            - address: Checksummed address
            - checks: Individual check results
            - details: What was matched
            - pattern_difficulty: Estimated difficulty
        """
        return generate_vanity_check_impl(address, prefix, suffix, contains)
