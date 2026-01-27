"""
Tests for address derivation tools.
"""

import pytest
from validation_mcp.tools.derivation import (
    derive_address_from_private_key_impl,
    derive_address_from_public_key_impl,
)


# Test private key - NEVER use in production
TEST_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
# Corresponding address: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23
TEST_ADDRESS = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'


class TestDeriveAddressFromPrivateKey:
    """Tests for deriving address from private key."""
    
    def test_derive_valid_key(self):
        """Test deriving address from valid private key."""
        result = derive_address_from_private_key_impl(TEST_PRIVATE_KEY)
        
        assert result.get('error') is not True
        assert result['address'] == TEST_ADDRESS
    
    def test_derive_without_prefix(self):
        """Test deriving address without 0x prefix."""
        key = TEST_PRIVATE_KEY[2:]  # Remove 0x prefix
        result = derive_address_from_private_key_impl(key)
        
        assert result.get('error') is not True
        assert result['address'] == TEST_ADDRESS
    
    def test_derive_invalid_key_length(self):
        """Test with invalid key length."""
        result = derive_address_from_private_key_impl('0x1234')
        assert result['error'] is True
    
    def test_derive_includes_public_key(self):
        """Test that derivation includes public key by default."""
        result = derive_address_from_private_key_impl(TEST_PRIVATE_KEY)
        
        assert result.get('error') is not True
        assert 'public_key' in result
        assert 'uncompressed' in result['public_key']
        assert 'compressed' in result['public_key']
    
    def test_derive_without_public_key(self):
        """Test derivation without public key included."""
        result = derive_address_from_private_key_impl(TEST_PRIVATE_KEY, include_public_key=False)
        
        assert result.get('error') is not True
        assert result['address'] == TEST_ADDRESS
        assert 'public_key' not in result


class TestDeriveAddressFromPublicKey:
    """Tests for deriving address from public key."""
    
    def test_derive_from_uncompressed(self):
        """Test deriving address from uncompressed public key."""
        # First get the public key
        key_result = derive_address_from_private_key_impl(TEST_PRIVATE_KEY)
        
        # Get the uncompressed public key (without 04 prefix)
        pub_key = key_result['public_key']['uncompressed_no_prefix']
        
        result = derive_address_from_public_key_impl(pub_key)
        
        assert result.get('error') is not True
        assert result['address'] == TEST_ADDRESS
    
    def test_derive_invalid_public_key(self):
        """Test with invalid public key."""
        result = derive_address_from_public_key_impl('0x1234')  # Too short
        
        # Should error
        assert result.get('error') is True
