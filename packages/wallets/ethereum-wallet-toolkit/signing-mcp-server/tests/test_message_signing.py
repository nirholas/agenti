"""
Tests for EIP-191 message signing.
"""

import pytest


# Known test vector
# Private key: 0x0000000000000000000000000000000000000000000000000000000000000001
# Address: 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf
TEST_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001"
TEST_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"


class TestMessageSigning:
    """Test EIP-191 message signing."""
    
    @pytest.mark.asyncio
    async def test_sign_message(self):
        """Test signing a simple message."""
        from signing_mcp.tools.message_signing import sign_message_impl
        
        result = sign_message_impl("Hello, Ethereum!", TEST_KEY)
        
        assert result['signer'].lower() == TEST_ADDRESS.lower()
        assert result['signature'].startswith('0x')
        assert len(result['signature']) == 132  # 0x + 130 hex chars
        assert result['v'] in (27, 28)
        assert result['message'] == "Hello, Ethereum!"
    
    @pytest.mark.asyncio
    async def test_sign_empty_message(self):
        """Test signing an empty message."""
        from signing_mcp.tools.message_signing import sign_message_impl
        
        result = sign_message_impl("", TEST_KEY)
        
        assert result['signer'].lower() == TEST_ADDRESS.lower()
        assert result['message_length'] == 0
    
    @pytest.mark.asyncio
    async def test_sign_message_hex(self):
        """Test signing hex-encoded bytes."""
        from signing_mcp.tools.message_signing import sign_message_hex_impl
        
        # "Hello" in hex
        result = sign_message_hex_impl("0x48656c6c6f", TEST_KEY)
        
        assert result['signer'].lower() == TEST_ADDRESS.lower()
        assert result['message_length_bytes'] == 5


class TestMessageVerification:
    """Test message verification."""
    
    @pytest.mark.asyncio
    async def test_verify_valid_signature(self):
        """Test verifying a valid signature."""
        from signing_mcp.tools.message_signing import sign_message_impl, verify_message_impl
        
        # Sign a message
        sign_result = sign_message_impl("Test message", TEST_KEY)
        
        # Verify it
        verify_result = verify_message_impl(
            "Test message",
            sign_result['signature'],
            TEST_ADDRESS
        )
        
        assert verify_result['is_valid'] is True
        assert verify_result['match'] is True
    
    @pytest.mark.asyncio
    async def test_verify_wrong_message(self):
        """Test that wrong message fails verification."""
        from signing_mcp.tools.message_signing import sign_message_impl, verify_message_impl
        
        sign_result = sign_message_impl("Original message", TEST_KEY)
        
        verify_result = verify_message_impl(
            "Different message",
            sign_result['signature'],
            TEST_ADDRESS
        )
        
        assert verify_result['is_valid'] is False
    
    @pytest.mark.asyncio
    async def test_verify_wrong_address(self):
        """Test that wrong address fails verification."""
        from signing_mcp.tools.message_signing import sign_message_impl, verify_message_impl
        
        sign_result = sign_message_impl("Test message", TEST_KEY)
        wrong_address = "0x0000000000000000000000000000000000000001"
        
        verify_result = verify_message_impl(
            "Test message",
            sign_result['signature'],
            wrong_address
        )
        
        assert verify_result['is_valid'] is False


class TestSignerRecovery:
    """Test signer recovery."""
    
    @pytest.mark.asyncio
    async def test_recover_signer(self):
        """Test recovering signer from signature."""
        from signing_mcp.tools.message_signing import sign_message_impl, recover_signer_impl
        
        sign_result = sign_message_impl("Recover me", TEST_KEY)
        
        recover_result = recover_signer_impl("Recover me", sign_result['signature'])
        
        assert recover_result['success'] is True
        assert recover_result['signer'].lower() == TEST_ADDRESS.lower()


class TestKeyValidation:
    """Test private key validation."""
    
    def test_invalid_key_length(self):
        """Test that short keys are rejected."""
        from signing_mcp.tools.message_signing import sign_message_impl
        
        with pytest.raises(ValueError, match="32 bytes"):
            sign_message_impl("Test", "0x1234")
    
    def test_invalid_key_hex(self):
        """Test that non-hex keys are rejected."""
        from signing_mcp.tools.message_signing import sign_message_impl
        
        with pytest.raises(ValueError, match="hexadecimal"):
            sign_message_impl("Test", "0xGGGG" + "0" * 60)
    
    def test_zero_key_rejected(self):
        """Test that zero key is rejected."""
        from signing_mcp.tools.message_signing import sign_message_impl
        
        zero_key = "0x" + "0" * 64
        
        with pytest.raises(ValueError, match="zero"):
            sign_message_impl("Test", zero_key)
