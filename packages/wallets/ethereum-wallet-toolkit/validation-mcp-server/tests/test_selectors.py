"""
Tests for function selector tools.
"""

import pytest
from validation_mcp.tools.selectors import (
    encode_function_selector_impl,
    decode_function_selector_impl,
)


# Known function selectors
SELECTOR_VECTORS = [
    ("transfer(address,uint256)", "0xa9059cbb"),
    ("approve(address,uint256)", "0x095ea7b3"),
    ("transferFrom(address,address,uint256)", "0x23b872dd"),
    ("balanceOf(address)", "0x70a08231"),
    ("totalSupply()", "0x18160ddd"),
    ("name()", "0x06fdde03"),
    ("symbol()", "0x95d89b41"),
    ("decimals()", "0x313ce567"),
]


class TestEncodeFunctionSelector:
    """Tests for function selector encoding."""
    
    @pytest.mark.parametrize("signature,expected", SELECTOR_VECTORS)
    def test_encode_selector(self, signature, expected):
        """Test encoding function signatures to selectors."""
        result = encode_function_selector_impl(signature)
        
        assert result.get('error') is not True
        assert result['selector'] == expected
    
    def test_transfer_selector(self):
        """Test computing transfer function selector."""
        result = encode_function_selector_impl('transfer(address,uint256)')
        
        assert result.get('error') is not True
        assert result['selector'] == '0xa9059cbb'
    
    def test_no_params_function(self):
        """Test function with no parameters."""
        result = encode_function_selector_impl('totalSupply()')
        
        assert result.get('error') is not True
        assert result['selector'] == '0x18160ddd'


class TestDecodeFunctionSelector:
    """Tests for selector identification."""
    
    def test_identify_transfer(self):
        """Test identifying transfer selector."""
        result = decode_function_selector_impl('0xa9059cbb')
        
        assert result.get('error') is not True
        assert result['is_known'] is True
        assert 'transfer(address,uint256)' in result['known_signatures']
    
    def test_unknown_selector(self):
        """Test unknown selector."""
        result = decode_function_selector_impl('0x12345678')
        
        assert result.get('error') is not True
        assert result['is_known'] is False
        assert result['known_signatures'] == []
