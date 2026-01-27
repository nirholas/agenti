"""
Tests for hashing tools.
"""

import pytest
from validation_mcp.tools.hashing import compute_keccak256_impl


class TestKeccakHash:
    """Test keccak256 hashing."""
    
    def test_text_hash(self):
        """Test hashing text input."""
        # Known hash of empty string
        result = compute_keccak256_impl("", "text")
        expected = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        assert result["hash"] == expected
    
    def test_hex_hash(self):
        """Test hashing hex input."""
        result = compute_keccak256_impl("0x", "hex")
        # Hash of empty bytes
        expected = "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        assert result["hash"] == expected
    
    def test_hello_hash(self):
        """Test hashing 'Hello, World!'."""
        result = compute_keccak256_impl("Hello, World!", "text")
        expected = "0xacaf3289d7b601cbd114fb36c4d29c85bbfd5e133f14cb355c3fd8d99367964f"
        assert result["hash"] == expected
    
    def test_function_signature_hash(self):
        """Test hashing function signature for selector."""
        result = compute_keccak256_impl("transfer(address,uint256)", "text")
        # transfer selector is first 4 bytes = 0xa9059cbb
        assert result["hash"].startswith("0xa9059cbb")
