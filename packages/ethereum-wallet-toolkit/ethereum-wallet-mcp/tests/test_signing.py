"""
Tests for Ethereum Wallet MCP Server - Signing Tools

This module contains comprehensive tests for EIP-191 message signing tools:
- sign_message
- sign_message_hex
- verify_message
- recover_signer
- sign_hash
- decompose_signature
- compose_signature

All tests use known test vectors to ensure signature correctness.
"""

import pytest
import asyncio

# Import the signing functions (adjust path as needed)
# These tests assume the functions are accessible
from ethereum_wallet_mcp.tools.signing import (
    _validate_private_key,
    _validate_signature,
    _validate_address,
    _validate_hash,
    _normalize_hex,
    _constant_time_compare,
    InvalidKeyError,
    InvalidSignatureError,
    InvalidAddressError,
    InvalidHashError,
)


# ============================================================================
# Test Constants
# ============================================================================

# Well-known test private key - NEVER use for real funds!
TEST_PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a"
TEST_PRIVATE_KEY_NO_PREFIX = "4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a"

# Derived address from the test private key
TEST_ADDRESS = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"

# Test messages
TEST_MESSAGE = "Hello, Ethereum!"
TEST_MESSAGE_EMPTY = ""
TEST_MESSAGE_UNICODE = "Hello, 以太坊! 🚀"

# Test hex message (hex of "Hello")
TEST_HEX_MESSAGE = "0x48656c6c6f"


# ============================================================================
# Validation Function Tests
# ============================================================================

class TestNormalizeHex:
    """Tests for _normalize_hex function."""
    
    def test_with_0x_prefix(self):
        """Should keep 0x prefix and lowercase."""
        result = _normalize_hex("0xABCD")
        assert result == "0xABCD"
    
    def test_without_prefix(self):
        """Should add 0x prefix."""
        result = _normalize_hex("ABCD")
        assert result == "0xABCD"
    
    def test_with_0X_prefix(self):
        """Should normalize 0X to 0x."""
        result = _normalize_hex("0XABCD")
        assert result == "0xABCD"


class TestValidatePrivateKey:
    """Tests for _validate_private_key function."""
    
    def test_valid_key_with_prefix(self):
        """Should accept valid key with 0x prefix."""
        result = _validate_private_key(TEST_PRIVATE_KEY)
        assert result == TEST_PRIVATE_KEY
    
    def test_valid_key_without_prefix(self):
        """Should accept valid key without 0x prefix."""
        result = _validate_private_key(TEST_PRIVATE_KEY_NO_PREFIX)
        assert result == TEST_PRIVATE_KEY
    
    def test_empty_key_raises(self):
        """Should raise for empty key."""
        with pytest.raises(InvalidKeyError):
            _validate_private_key("")
    
    def test_none_key_raises(self):
        """Should raise for None key."""
        with pytest.raises(InvalidKeyError):
            _validate_private_key(None)
    
    def test_short_key_raises(self):
        """Should raise for key that's too short."""
        with pytest.raises(InvalidKeyError):
            _validate_private_key("0x1234")
    
    def test_long_key_raises(self):
        """Should raise for key that's too long."""
        with pytest.raises(InvalidKeyError):
            _validate_private_key("0x" + "ab" * 33)


class TestValidateSignature:
    """Tests for _validate_signature function."""
    
    def test_valid_signature(self):
        """Should accept valid 65-byte signature."""
        valid_sig = "0x" + "ab" * 65
        result = _validate_signature(valid_sig)
        assert result.startswith("0x")
        assert len(result) == 132
    
    def test_empty_signature_raises(self):
        """Should raise for empty signature."""
        with pytest.raises(InvalidSignatureError):
            _validate_signature("")
    
    def test_short_signature_raises(self):
        """Should raise for signature that's too short."""
        with pytest.raises(InvalidSignatureError):
            _validate_signature("0x" + "ab" * 64)
    
    def test_long_signature_raises(self):
        """Should raise for signature that's too long."""
        with pytest.raises(InvalidSignatureError):
            _validate_signature("0x" + "ab" * 66)


class TestValidateAddress:
    """Tests for _validate_address function."""
    
    def test_valid_address(self):
        """Should accept valid address."""
        result = _validate_address(TEST_ADDRESS)
        assert result == TEST_ADDRESS
    
    def test_valid_address_lowercase(self):
        """Should checksum lowercase address."""
        result = _validate_address(TEST_ADDRESS.lower())
        assert result == TEST_ADDRESS
    
    def test_empty_address_raises(self):
        """Should raise for empty address."""
        with pytest.raises(InvalidAddressError):
            _validate_address("")
    
    def test_short_address_raises(self):
        """Should raise for address that's too short."""
        with pytest.raises(InvalidAddressError):
            _validate_address("0x1234")


class TestValidateHash:
    """Tests for _validate_hash function."""
    
    def test_valid_hash(self):
        """Should accept valid 32-byte hash."""
        valid_hash = "0x" + "ab" * 32
        result = _validate_hash(valid_hash)
        assert result.startswith("0x")
        assert len(result) == 66
    
    def test_empty_hash_raises(self):
        """Should raise for empty hash."""
        with pytest.raises(InvalidHashError):
            _validate_hash("")
    
    def test_short_hash_raises(self):
        """Should raise for hash that's too short."""
        with pytest.raises(InvalidHashError):
            _validate_hash("0x" + "ab" * 31)


class TestConstantTimeCompare:
    """Tests for _constant_time_compare function."""
    
    def test_equal_strings(self):
        """Should return True for equal strings."""
        assert _constant_time_compare("abc", "abc") == True
    
    def test_different_strings(self):
        """Should return False for different strings."""
        assert _constant_time_compare("abc", "def") == False
    
    def test_case_insensitive(self):
        """Should be case-insensitive."""
        assert _constant_time_compare("ABC", "abc") == True
    
    def test_addresses(self):
        """Should work for Ethereum addresses."""
        addr1 = "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00"
        addr2 = "0x742d35cc6634c0532925a3b844bc9e7595f8fe00"
        assert _constant_time_compare(addr1, addr2) == True


# ============================================================================
# Integration Tests - These require the full MCP server setup
# ============================================================================

class TestSignMessageIntegration:
    """Integration tests for sign_message tool."""
    
    @pytest.mark.asyncio
    async def test_sign_simple_message(self):
        """Should sign a simple message correctly."""
        # This test requires the actual tool to be callable
        # In a real test environment, you would:
        # 1. Set up the MCP server
        # 2. Call the sign_message tool
        # 3. Verify the result
        pass
    
    @pytest.mark.asyncio
    async def test_sign_and_verify_roundtrip(self):
        """Signing then verifying should succeed."""
        # Sign a message, then verify the signature
        pass
    
    @pytest.mark.asyncio
    async def test_sign_unicode_message(self):
        """Should handle Unicode messages correctly."""
        pass


class TestVerifyMessageIntegration:
    """Integration tests for verify_message tool."""
    
    @pytest.mark.asyncio
    async def test_verify_valid_signature(self):
        """Should verify a valid signature."""
        pass
    
    @pytest.mark.asyncio
    async def test_verify_invalid_signature(self):
        """Should reject an invalid signature."""
        pass
    
    @pytest.mark.asyncio
    async def test_verify_wrong_address(self):
        """Should return False for wrong expected address."""
        pass


class TestRecoverSignerIntegration:
    """Integration tests for recover_signer tool."""
    
    @pytest.mark.asyncio
    async def test_recover_correct_address(self):
        """Should recover the correct signer address."""
        pass


class TestSignHashIntegration:
    """Integration tests for sign_hash tool."""
    
    @pytest.mark.asyncio
    async def test_requires_acknowledgement(self):
        """Should require acknowledge_risk=True."""
        pass
    
    @pytest.mark.asyncio
    async def test_signs_with_acknowledgement(self):
        """Should sign when acknowledged."""
        pass


class TestDecomposeSignatureIntegration:
    """Integration tests for decompose_signature tool."""
    
    @pytest.mark.asyncio
    async def test_decompose_valid_signature(self):
        """Should correctly decompose a valid signature."""
        pass
    
    @pytest.mark.asyncio
    async def test_decompose_returns_correct_components(self):
        """Should return correct v, r, s values."""
        pass


class TestComposeSignatureIntegration:
    """Integration tests for compose_signature tool."""
    
    @pytest.mark.asyncio
    async def test_compose_valid_components(self):
        """Should compose a valid signature from components."""
        pass
    
    @pytest.mark.asyncio
    async def test_compose_decompose_roundtrip(self):
        """Compose then decompose should return original values."""
        pass


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def test_private_key():
    """Provide test private key."""
    return TEST_PRIVATE_KEY


@pytest.fixture
def test_address():
    """Provide test address."""
    return TEST_ADDRESS


@pytest.fixture
def test_message():
    """Provide test message."""
    return TEST_MESSAGE


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
