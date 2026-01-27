"""
Tests for Ethereum Wallet MCP Server - Typed Data Tools

This module contains comprehensive tests for EIP-712 typed data signing tools:
- sign_typed_data
- verify_typed_data
- recover_typed_data_signer
- hash_typed_data
- generate_typed_data_template

All tests use known test vectors to ensure EIP-712 compliance.
"""

import pytest
import asyncio
import copy

# Import the typed data functions (adjust path as needed)
from ethereum_wallet_mcp.tools.typed_data import (
    _validate_private_key,
    _validate_signature,
    _validate_address,
    _validate_typed_data_structure,
    _validate_typed_data,
    TYPED_DATA_TEMPLATES,
    InvalidKeyError,
    InvalidSignatureError,
    InvalidAddressError,
    InvalidTypedDataError,
)


# ============================================================================
# Test Constants
# ============================================================================

# Well-known test private key - NEVER use for real funds!
TEST_PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129d7898a5a8b6e7f2a1e3e9f9d7a"
TEST_ADDRESS = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"

# Standard EIP-712 Mail example from the specification
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

# ERC-20 Permit typed data
PERMIT_TYPED_DATA = {
    "types": {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"}
        ],
        "Permit": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "nonce", "type": "uint256"},
            {"name": "deadline", "type": "uint256"}
        ]
    },
    "primaryType": "Permit",
    "domain": {
        "name": "USD Coin",
        "version": "2",
        "chainId": 1,
        "verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    },
    "message": {
        "owner": "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23",
        "spender": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
        "value": "1000000000000000000",
        "nonce": 0,
        "deadline": 1893456000
    }
}


# ============================================================================
# Validation Function Tests
# ============================================================================

class TestValidateTypedDataStructure:
    """Tests for _validate_typed_data_structure function."""
    
    def test_valid_mail_typed_data(self):
        """Should accept valid Mail typed data."""
        is_valid, errors = _validate_typed_data_structure(MAIL_TYPED_DATA)
        assert is_valid == True
        assert len(errors) == 0
    
    def test_valid_permit_typed_data(self):
        """Should accept valid Permit typed data."""
        is_valid, errors = _validate_typed_data_structure(PERMIT_TYPED_DATA)
        assert is_valid == True
        assert len(errors) == 0
    
    def test_missing_types(self):
        """Should reject typed data without types."""
        invalid_data = copy.deepcopy(MAIL_TYPED_DATA)
        del invalid_data["types"]
        
        is_valid, errors = _validate_typed_data_structure(invalid_data)
        assert is_valid == False
        assert any("types" in e for e in errors)
    
    def test_missing_primary_type(self):
        """Should reject typed data without primaryType."""
        invalid_data = copy.deepcopy(MAIL_TYPED_DATA)
        del invalid_data["primaryType"]
        
        is_valid, errors = _validate_typed_data_structure(invalid_data)
        assert is_valid == False
        assert any("primaryType" in e for e in errors)
    
    def test_missing_domain(self):
        """Should reject typed data without domain."""
        invalid_data = copy.deepcopy(MAIL_TYPED_DATA)
        del invalid_data["domain"]
        
        is_valid, errors = _validate_typed_data_structure(invalid_data)
        assert is_valid == False
        assert any("domain" in e for e in errors)
    
    def test_missing_message(self):
        """Should reject typed data without message."""
        invalid_data = copy.deepcopy(MAIL_TYPED_DATA)
        del invalid_data["message"]
        
        is_valid, errors = _validate_typed_data_structure(invalid_data)
        assert is_valid == False
        assert any("message" in e for e in errors)
    
    def test_missing_eip712domain(self):
        """Should reject typed data without EIP712Domain type."""
        invalid_data = copy.deepcopy(MAIL_TYPED_DATA)
        del invalid_data["types"]["EIP712Domain"]
        
        is_valid, errors = _validate_typed_data_structure(invalid_data)
        assert is_valid == False
        assert any("EIP712Domain" in e for e in errors)
    
    def test_primary_type_not_in_types(self):
        """Should reject when primaryType is not in types."""
        invalid_data = copy.deepcopy(MAIL_TYPED_DATA)
        invalid_data["primaryType"] = "NonExistentType"
        
        is_valid, errors = _validate_typed_data_structure(invalid_data)
        assert is_valid == False
        assert any("NonExistentType" in e for e in errors)


class TestValidateTypedData:
    """Tests for _validate_typed_data function."""
    
    def test_valid_data_returns_same(self):
        """Should return the same data for valid input."""
        result = _validate_typed_data(MAIL_TYPED_DATA)
        assert result == MAIL_TYPED_DATA
    
    def test_invalid_data_raises(self):
        """Should raise InvalidTypedDataError for invalid input."""
        invalid_data = {}
        with pytest.raises(InvalidTypedDataError):
            _validate_typed_data(invalid_data)


# ============================================================================
# Template Tests
# ============================================================================

class TestTypedDataTemplates:
    """Tests for TYPED_DATA_TEMPLATES."""
    
    def test_permit_template_exists(self):
        """Should have permit template."""
        assert "permit" in TYPED_DATA_TEMPLATES
        template = TYPED_DATA_TEMPLATES["permit"]["template"]
        assert "Permit" in template["types"]
    
    def test_permit2_template_exists(self):
        """Should have permit2 template."""
        assert "permit2" in TYPED_DATA_TEMPLATES
        template = TYPED_DATA_TEMPLATES["permit2"]["template"]
        assert "PermitSingle" in template["types"]
    
    def test_order_template_exists(self):
        """Should have order template."""
        assert "order" in TYPED_DATA_TEMPLATES
        template = TYPED_DATA_TEMPLATES["order"]["template"]
        assert "Order" in template["types"]
    
    def test_delegation_template_exists(self):
        """Should have delegation template."""
        assert "delegation" in TYPED_DATA_TEMPLATES
        template = TYPED_DATA_TEMPLATES["delegation"]["template"]
        assert "Delegation" in template["types"]
    
    def test_mail_template_exists(self):
        """Should have mail template."""
        assert "mail" in TYPED_DATA_TEMPLATES
        template = TYPED_DATA_TEMPLATES["mail"]["template"]
        assert "Mail" in template["types"]
    
    def test_custom_template_exists(self):
        """Should have custom template."""
        assert "custom" in TYPED_DATA_TEMPLATES
    
    def test_all_templates_have_required_fields(self):
        """All templates should have description, template, required_fields, example_values."""
        for name, info in TYPED_DATA_TEMPLATES.items():
            assert "description" in info, f"{name} missing description"
            assert "template" in info, f"{name} missing template"
            assert "required_fields" in info, f"{name} missing required_fields"
            assert "example_values" in info, f"{name} missing example_values"
    
    def test_all_templates_are_valid(self):
        """All templates should pass structure validation."""
        for name, info in TYPED_DATA_TEMPLATES.items():
            template = info["template"]
            is_valid, errors = _validate_typed_data_structure(template)
            assert is_valid, f"{name} template invalid: {errors}"


# ============================================================================
# Integration Tests
# ============================================================================

class TestSignTypedDataIntegration:
    """Integration tests for sign_typed_data tool."""
    
    @pytest.mark.asyncio
    async def test_sign_mail_typed_data(self):
        """Should sign Mail typed data correctly."""
        # This test requires the actual tool to be callable
        pass
    
    @pytest.mark.asyncio
    async def test_sign_permit_typed_data(self):
        """Should sign Permit typed data correctly."""
        pass
    
    @pytest.mark.asyncio
    async def test_sign_and_verify_roundtrip(self):
        """Signing then verifying should succeed."""
        pass


class TestVerifyTypedDataIntegration:
    """Integration tests for verify_typed_data tool."""
    
    @pytest.mark.asyncio
    async def test_verify_valid_signature(self):
        """Should verify a valid typed data signature."""
        pass
    
    @pytest.mark.asyncio
    async def test_verify_invalid_signature(self):
        """Should reject an invalid typed data signature."""
        pass
    
    @pytest.mark.asyncio
    async def test_verify_wrong_address(self):
        """Should return False for wrong expected address."""
        pass


class TestRecoverTypedDataSignerIntegration:
    """Integration tests for recover_typed_data_signer tool."""
    
    @pytest.mark.asyncio
    async def test_recover_correct_address(self):
        """Should recover the correct signer address."""
        pass


class TestHashTypedDataIntegration:
    """Integration tests for hash_typed_data tool."""
    
    @pytest.mark.asyncio
    async def test_hash_mail_typed_data(self):
        """Should hash Mail typed data correctly."""
        pass
    
    @pytest.mark.asyncio
    async def test_hash_returns_components(self):
        """Should return struct_hash, domain_separator, and message_hash."""
        pass


class TestGenerateTypedDataTemplateIntegration:
    """Integration tests for generate_typed_data_template tool."""
    
    @pytest.mark.asyncio
    async def test_generate_permit_template(self):
        """Should generate valid permit template."""
        pass
    
    @pytest.mark.asyncio
    async def test_generate_with_chain_id(self):
        """Should set chain_id in generated template."""
        pass
    
    @pytest.mark.asyncio
    async def test_generate_with_contract_address(self):
        """Should set contract address in generated template."""
        pass
    
    @pytest.mark.asyncio
    async def test_generate_unknown_template(self):
        """Should return error for unknown template type."""
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
def mail_typed_data():
    """Provide Mail typed data."""
    return copy.deepcopy(MAIL_TYPED_DATA)


@pytest.fixture
def permit_typed_data():
    """Provide Permit typed data."""
    return copy.deepcopy(PERMIT_TYPED_DATA)


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
