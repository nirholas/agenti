"""
Tests for key validation tools.
"""

import pytest
from validation_mcp.tools.key_validation import validate_private_key_impl


# Known test vectors
TEST_VECTORS = [
    {
        "private_key": "0x0000000000000000000000000000000000000000000000000000000000000001",
        "address": "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"
    },
    {
        "private_key": "0x0000000000000000000000000000000000000000000000000000000000000002",
        "address": "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF"
    },
]


class TestKeyValidation:
    """Test private key validation."""
    
    def test_valid_key(self):
        """Test validation of a valid private key."""
        result = validate_private_key_impl(
            TEST_VECTORS[0]["private_key"],
            derive_address=True
        )
        
        assert result["is_valid"] is True
        assert result["byte_length"] == 32
        assert result["derived_address"].lower() == TEST_VECTORS[0]["address"].lower()
    
    def test_invalid_length(self):
        """Test validation of key with wrong length."""
        result = validate_private_key_impl("0x1234")
        assert result["is_valid"] is False
    
    def test_weak_key_detected(self):
        """Test that known weak keys are flagged."""
        # Key 0x01 is a known weak key
        result = validate_private_key_impl(
            "0x0000000000000000000000000000000000000000000000000000000000000001"
        )
        
        assert result["is_valid"] is True
        assert result["security_assessment"]["known_weak_key"] is True
    
    def test_zero_key_rejected(self):
        """Test that zero key is rejected."""
        result = validate_private_key_impl(
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        )
        assert result["is_valid"] is False
    
    def test_key_without_prefix(self):
        """Test validation of key without 0x prefix."""
        key = TEST_VECTORS[0]["private_key"][2:]  # Remove 0x
        result = validate_private_key_impl(key, derive_address=True)
        
        assert result["is_valid"] is True
        assert result["derived_address"].lower() == TEST_VECTORS[0]["address"].lower()
