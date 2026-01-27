"""
Tests for signature utilities.
"""

import pytest


class TestSignatureDecomposition:
    """Test signature decomposition."""
    
    @pytest.mark.asyncio
    async def test_decompose_signature(self):
        """Test decomposing a signature into components."""
        from signing_mcp.tools.signature_utils import decompose_signature_impl
        
        # Create a valid 65-byte signature
        r = "a" * 64
        s = "b" * 64
        v = "1c"  # 28 in hex
        signature = "0x" + r + s + v
        
        result = decompose_signature_impl(signature)
        
        assert result['v'] == 28
        assert result['v_standard'] == 28
        assert result['r_bytes'] == 32
        assert result['s_bytes'] == 32
        assert result['total_bytes'] == 65
    
    @pytest.mark.asyncio
    async def test_decompose_recovery_id_signature(self):
        """Test decomposing a signature with recovery ID v value."""
        from signing_mcp.tools.signature_utils import decompose_signature_impl
        
        r = "a" * 64
        s = "b" * 64
        v = "01"  # 1 in hex (recovery ID)
        signature = "0x" + r + s + v
        
        result = decompose_signature_impl(signature)
        
        assert result['v'] == 1
        assert result['v_standard'] == 28  # 1 + 27
        assert result['v_format'] == "recovery_id (0/1)"


class TestSignatureComposition:
    """Test signature composition."""
    
    @pytest.mark.asyncio
    async def test_compose_signature(self):
        """Test composing a signature from components."""
        from signing_mcp.tools.signature_utils import compose_signature_impl
        
        v = 28
        r = "0x" + "a" * 64
        s = "0x" + "b" * 64
        
        result = compose_signature_impl(v, r, s)
        
        assert result['signature'].startswith('0x')
        assert len(result['signature']) == 132
        assert result['v'] == 28
        assert result['bytes'] == 65
    
    @pytest.mark.asyncio
    async def test_compose_with_recovery_id_output(self):
        """Test composing with recovery_id output format."""
        from signing_mcp.tools.signature_utils import compose_signature_impl
        
        v = 28
        r = "0x" + "a" * 64
        s = "0x" + "b" * 64
        
        result = compose_signature_impl(v, r, s, output_format="recovery_id")
        
        assert result['v'] == 1  # 28 - 27 = 1
        assert result['output_format'] == "recovery_id"


class TestSignatureNormalization:
    """Test signature normalization."""
    
    @pytest.mark.asyncio
    async def test_normalize_to_standard(self):
        """Test normalizing recovery ID to standard format."""
        from signing_mcp.tools.signature_utils import normalize_signature_impl
        
        r = "a" * 64
        s = "b" * 64
        v = "01"  # recovery ID 1
        signature = "0x" + r + s + v
        
        result = normalize_signature_impl(signature, target_format="standard")
        
        # Check the new v byte is 28
        new_sig_bytes = bytes.fromhex(result['normalized_signature'][2:])
        assert new_sig_bytes[64] == 28
        assert result['normalized_v'] == 28
        assert result['changed'] is True
    
    @pytest.mark.asyncio
    async def test_normalize_to_recovery_id(self):
        """Test normalizing standard to recovery ID format."""
        from signing_mcp.tools.signature_utils import normalize_signature_impl
        
        r = "a" * 64
        s = "b" * 64
        v = "1c"  # 28 standard
        signature = "0x" + r + s + v
        
        result = normalize_signature_impl(signature, target_format="recovery_id")
        
        new_sig_bytes = bytes.fromhex(result['normalized_signature'][2:])
        assert new_sig_bytes[64] == 1
        assert result['normalized_v'] == 1


class TestSignatureValidation:
    """Test signature format validation."""
    
    @pytest.mark.asyncio
    async def test_validate_valid_signature(self):
        """Test validating a valid signature."""
        from signing_mcp.tools.signature_utils import validate_signature_format_impl
        
        r = "a" * 64
        s = "1" * 64  # Low s value
        v = "1b"  # 27
        signature = "0x" + r + s + v
        
        result = validate_signature_format_impl(signature)
        
        assert result['is_valid'] is True
        assert result['v'] == 27
        assert result['v_format'] == "standard"
        assert result['length_bytes'] == 65
    
    @pytest.mark.asyncio
    async def test_validate_invalid_length(self):
        """Test that short signatures are rejected."""
        from signing_mcp.tools.signature_utils import validate_signature_format_impl
        
        result = validate_signature_format_impl("0x1234")
        
        assert result['is_valid'] is False
        assert 'error' in result
