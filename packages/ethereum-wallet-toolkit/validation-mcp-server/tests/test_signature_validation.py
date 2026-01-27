"""
Tests for signature validation tools.
"""

import pytest
from validation_mcp.tools.signature_validation import validate_signature_impl


class TestValidateSignature:
    """Tests for signature validation."""
    
    def test_valid_signature_components(self):
        """Test valid v, r, s components."""
        # Use a low s value (below half curve order) to be EIP-2 compliant
        result = validate_signature_impl(
            v=27,
            r='0x' + 'a' * 64,
            s='0x' + '0' * 63 + '1'  # Low s value
        )
        assert result['is_valid'] is True
    
    def test_v_value_28(self):
        """Test v = 28 is valid."""
        result = validate_signature_impl(
            v=28,
            r='0x' + 'a' * 64,
            s='0x' + '0' * 63 + '1'  # Low s value
        )
        assert result['is_valid'] is True
    
    def test_eip155_v_value(self):
        """Test EIP-155 v value (v = chain_id * 2 + 35)."""
        # v = 37 means chain_id = 1 (Ethereum mainnet), recovery_id = 0
        result = validate_signature_impl(
            v=37,
            r='0x' + 'a' * 64,
            s='0x' + '0' * 63 + '1'
        )
        
        assert result['is_valid'] is True
        if 'v' in result and result['v']:
            assert result['v'].get('is_eip155') is True
    
    def test_r_zero_invalid(self):
        """Test r = 0 is invalid."""
        result = validate_signature_impl(
            v=27,
            r='0x' + '0' * 64,
            s='0x' + 'b' * 64
        )
        assert result['is_valid'] is False
    
    def test_s_zero_invalid(self):
        """Test s = 0 is invalid."""
        result = validate_signature_impl(
            v=27,
            r='0x' + 'a' * 64,
            s='0x' + '0' * 64
        )
        assert result['is_valid'] is False
