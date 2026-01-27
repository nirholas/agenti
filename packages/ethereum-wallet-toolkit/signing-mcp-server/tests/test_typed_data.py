"""
Tests for EIP-712 typed data signing.
"""

import pytest


TEST_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001"
TEST_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"

# EIP-712 Mail example from the specification
MAIL_TYPED_DATA = {
    "types": {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"}
        ],
        "Person": [
            {"name": "name", "type": "string"},
            {"name": "wallet", "type": "address"}
        ],
        "Mail": [
            {"name": "from", "type": "Person"},
            {"name": "to", "type": "Person"},
            {"name": "contents", "type": "string"}
        ]
    },
    "primaryType": "Mail",
    "domain": {
        "name": "Ether Mail",
        "version": "1",
        "chainId": 1,
        "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
    },
    "message": {
        "from": {
            "name": "Alice",
            "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
        },
        "to": {
            "name": "Bob",
            "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
        },
        "contents": "Hello, Bob!"
    }
}


class TestTypedDataSigning:
    """Test EIP-712 typed data signing."""
    
    @pytest.mark.asyncio
    async def test_sign_typed_data(self):
        """Test signing typed data."""
        from signing_mcp.tools.typed_data import sign_typed_data_impl
        
        result = sign_typed_data_impl(MAIL_TYPED_DATA, TEST_KEY)
        
        assert result['signer'].lower() == TEST_ADDRESS.lower()
        assert result['signature'].startswith('0x')
        assert len(result['signature']) == 132
        assert result['primary_type'] == "Mail"
    
    @pytest.mark.asyncio
    async def test_sign_and_verify_typed_data(self):
        """Test sign and verify round-trip."""
        from signing_mcp.tools.typed_data import (
            sign_typed_data_impl,
            verify_typed_data_impl
        )
        
        sign_result = sign_typed_data_impl(MAIL_TYPED_DATA, TEST_KEY)
        
        verify_result = verify_typed_data_impl(
            MAIL_TYPED_DATA,
            sign_result['signature'],
            TEST_ADDRESS
        )
        
        assert verify_result['is_valid'] is True
        assert verify_result['match'] is True
    
    @pytest.mark.asyncio
    async def test_recover_typed_data_signer(self):
        """Test recovering signer from typed data signature."""
        from signing_mcp.tools.typed_data import (
            sign_typed_data_impl,
            recover_typed_data_signer_impl
        )
        
        sign_result = sign_typed_data_impl(MAIL_TYPED_DATA, TEST_KEY)
        
        recover_result = recover_typed_data_signer_impl(
            MAIL_TYPED_DATA,
            sign_result['signature']
        )
        
        assert recover_result['success'] is True
        assert recover_result['signer'].lower() == TEST_ADDRESS.lower()
    
    @pytest.mark.asyncio
    async def test_hash_typed_data(self):
        """Test computing typed data hash."""
        from signing_mcp.tools.typed_data import hash_typed_data_impl
        
        result = hash_typed_data_impl(MAIL_TYPED_DATA)
        
        assert result['success'] is True
        assert result['signing_hash'].startswith('0x')
        assert len(result['signing_hash']) == 66  # 0x + 64 hex chars


class TestTypedDataValidation:
    """Test typed data validation."""
    
    @pytest.mark.asyncio
    async def test_missing_types(self):
        """Test that missing types field is rejected."""
        from signing_mcp.tools.typed_data import sign_typed_data_impl
        
        invalid_data = {
            "primaryType": "Mail",
            "domain": {},
            "message": {}
        }
        
        with pytest.raises(ValueError, match="types"):
            sign_typed_data_impl(invalid_data, TEST_KEY)
    
    @pytest.mark.asyncio
    async def test_missing_primary_type(self):
        """Test that missing primaryType is rejected."""
        from signing_mcp.tools.typed_data import sign_typed_data_impl
        
        invalid_data = {
            "types": {"EIP712Domain": []},
            "domain": {},
            "message": {}
        }
        
        with pytest.raises(ValueError, match="primaryType"):
            sign_typed_data_impl(invalid_data, TEST_KEY)


class TestTypedDataTemplates:
    """Test typed data templates."""
    
    @pytest.mark.asyncio
    async def test_get_permit_template(self):
        """Test getting permit template."""
        from signing_mcp.tools.typed_data import get_typed_data_template_impl
        
        result = get_typed_data_template_impl("permit")
        
        assert result['success'] is True
        assert result['template_name'] == "permit"
        assert 'typed_data' in result
        assert result['typed_data']['primaryType'] == "Permit"
    
    @pytest.mark.asyncio
    async def test_get_unknown_template(self):
        """Test getting unknown template."""
        from signing_mcp.tools.typed_data import get_typed_data_template_impl
        
        result = get_typed_data_template_impl("unknown_template")
        
        assert result['success'] is False
        assert 'available_templates' in result
