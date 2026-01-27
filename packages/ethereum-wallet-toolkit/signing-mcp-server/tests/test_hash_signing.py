"""
Tests for hash signing tools.
"""

import pytest
import asyncio
from mcp.server import Server
from signing_mcp.tools.hash_signing import (
    sign_hash_impl,
    verify_hash_signature_impl,
    RISK_ACKNOWLEDGEMENT,
)


# Test private key - NEVER use in production
TEST_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
# Corresponding address: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23
TEST_ADDRESS = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'


class TestSignHash:
    """Tests for raw hash signing."""
    
    def test_sign_without_acknowledgement(self):
        """Test that signing requires risk acknowledgement."""
        hash_to_sign = '0x' + 'a' * 64
        
        result = sign_hash_impl(
            message_hash=hash_to_sign,
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement=""
        )
        
        assert result['error'] is True
        assert 'RISK_ACKNOWLEDGEMENT' in result.get('code', '')
    
    def test_sign_with_wrong_acknowledgement(self):
        """Test signing with wrong acknowledgement."""
        hash_to_sign = '0x' + 'a' * 64
        
        result = sign_hash_impl(
            message_hash=hash_to_sign,
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement="wrong text"
        )
        
        assert result['error'] is True
    
    def test_sign_valid_hash_with_acknowledgement(self):
        """Test signing a valid hash with proper acknowledgement."""
        hash_to_sign = '0x' + 'a' * 64
        
        result = sign_hash_impl(
            message_hash=hash_to_sign,
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement=RISK_ACKNOWLEDGEMENT
        )
        
        assert result.get('error') is not True
        assert 'signature' in result
        assert result['signature'].startswith('0x')
    
    def test_sign_invalid_hash_length(self):
        """Test signing with wrong hash length."""
        result = sign_hash_impl(
            message_hash='0x1234',  # Too short
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement=RISK_ACKNOWLEDGEMENT
        )
        
        assert result['error'] is True
    
    def test_sign_invalid_private_key(self):
        """Test signing with invalid private key."""
        hash_to_sign = '0x' + 'a' * 64
        
        result = sign_hash_impl(
            message_hash=hash_to_sign,
            private_key='invalid',
            risk_acknowledgement=RISK_ACKNOWLEDGEMENT
        )
        
        assert result['error'] is True


class TestVerifyHashSignature:
    """Tests for hash signature verification."""
    
    def test_verify_valid_signature(self):
        """Test verifying a valid signature."""
        hash_to_sign = '0x' + 'b' * 64
        
        # Sign first
        signed = sign_hash_impl(
            message_hash=hash_to_sign,
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement=RISK_ACKNOWLEDGEMENT
        )
        
        if signed.get('error'):
            pytest.skip("Signing failed")
        
        # Then verify
        result = verify_hash_signature_impl(
            message_hash=hash_to_sign,
            signature=signed['signature'],
            expected_signer=TEST_ADDRESS
        )
        
        assert result.get('error') is not True
        assert result['is_valid'] is True
    
    def test_verify_wrong_signer(self):
        """Test verification with wrong expected signer."""
        hash_to_sign = '0x' + 'c' * 64
        wrong_address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
        
        signed = sign_hash_impl(
            message_hash=hash_to_sign,
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement=RISK_ACKNOWLEDGEMENT
        )
        
        if signed.get('error'):
            pytest.skip("Signing failed")
        
        result = verify_hash_signature_impl(
            message_hash=hash_to_sign,
            signature=signed['signature'],
            expected_signer=wrong_address
        )
        
        assert result['is_valid'] is False
    
    def test_verify_wrong_hash(self):
        """Test verification with different hash."""
        original_hash = '0x' + 'd' * 64
        different_hash = '0x' + 'e' * 64
        
        signed = sign_hash_impl(
            message_hash=original_hash,
            private_key=TEST_PRIVATE_KEY,
            risk_acknowledgement=RISK_ACKNOWLEDGEMENT
        )
        
        if signed.get('error'):
            pytest.skip("Signing failed")
        
        result = verify_hash_signature_impl(
            message_hash=different_hash,
            signature=signed['signature'],
            expected_signer=TEST_ADDRESS
        )
        
        assert result['is_valid'] is False
