"""
Tests for hex validation tools.
"""

import pytest
from validation_mcp.tools.hex_validation import validate_hex_impl


class TestValidateHexData:
    """Tests for hex data validation."""
    
    def test_valid_hex_with_prefix(self):
        """Test valid hex string with 0x prefix."""
        result = validate_hex_impl('0x1234abcd')
        assert result['is_valid'] is True
    
    def test_valid_hex_without_prefix(self):
        """Test valid hex string without prefix."""
        result = validate_hex_impl('1234abcd')
        assert result['is_valid'] is True
    
    def test_invalid_hex_chars(self):
        """Test hex string with invalid characters."""
        result = validate_hex_impl('0x1234ghij')
        assert result['is_valid'] is False
    
    def test_empty_string(self):
        """Test empty string."""
        result = validate_hex_impl('')
        assert result['is_valid'] is False
    
    def test_uppercase_hex(self):
        """Test uppercase hex characters."""
        result = validate_hex_impl('0xABCDEF')
        assert result['is_valid'] is True
    
    def test_address_detection(self):
        """Test that 20-byte data is detected as address."""
        # 20 bytes = 40 hex chars
        result = validate_hex_impl('0x' + 'a' * 40)
        
        assert result['is_valid'] is True
        assert result['byte_length'] == 20
        assert 'address' in result['detected_type'].lower()
    
    def test_hash_detection(self):
        """Test that 32-byte data is detected as hash."""
        # 32 bytes = 64 hex chars
        result = validate_hex_impl('0x' + 'a' * 64)
        
        assert result['is_valid'] is True
        assert result['byte_length'] == 32
        assert 'hash' in result['detected_type'].lower() or '256' in result['detected_type']
