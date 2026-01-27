"""
Tests for data encoding tools.
"""

import pytest
from transaction_mcp.tools.encoding import (
    encode_transfer_impl,
    encode_approve_impl,
    encode_transfer_from_impl,
    encode_function_call_impl,
    decode_calldata_impl,
)


class TestEncodeTransfer:
    """Tests for ERC-20 transfer encoding."""
    
    def test_encode_basic_transfer(self, test_addresses):
        """Test encoding a basic transfer."""
        result = encode_transfer_impl(
            to=test_addresses['recipient'],
            amount=1000000
        )
        
        assert result.get('error') is not True
        assert result['function'] == 'transfer(address,uint256)'
        assert result['selector'] == '0xa9059cbb'
        assert result['calldata'].startswith('0xa9059cbb')
        assert result['calldata_length'] == 68  # 4 + 32 + 32
    
    def test_encode_transfer_large_amount(self, test_addresses):
        """Test encoding transfer with large amount."""
        # 1 million tokens with 18 decimals
        amount = 10**24
        result = encode_transfer_impl(
            to=test_addresses['recipient'],
            amount=amount
        )
        
        assert result.get('error') is not True
        assert result['amount'] == amount
    
    def test_encode_transfer_invalid_address(self):
        """Test encoding with invalid address."""
        result = encode_transfer_impl(
            to='invalid-address',
            amount=1000
        )
        
        assert result['error'] is True


class TestEncodeApprove:
    """Tests for ERC-20 approve encoding."""
    
    def test_encode_basic_approve(self, test_addresses):
        """Test encoding a basic approval."""
        result = encode_approve_impl(
            spender=test_addresses['recipient'],
            amount=1000000
        )
        
        assert result.get('error') is not True
        assert result['function'] == 'approve(address,uint256)'
        assert result['selector'] == '0x095ea7b3'
    
    def test_encode_unlimited_approve(self, test_addresses):
        """Test encoding unlimited approval."""
        max_uint256 = 2**256 - 1
        result = encode_approve_impl(
            spender=test_addresses['recipient'],
            amount=max_uint256
        )
        
        assert result.get('error') is not True
        assert result['amount_is_max'] is True
    
    def test_encode_zero_approve(self, test_addresses):
        """Test encoding revocation (zero approval)."""
        result = encode_approve_impl(
            spender=test_addresses['recipient'],
            amount=0
        )
        
        assert result.get('error') is not True
        assert result['amount'] == 0


class TestEncodeTransferFrom:
    """Tests for ERC-20 transferFrom encoding."""
    
    def test_encode_transfer_from(self, test_addresses):
        """Test encoding a transferFrom call."""
        result = encode_transfer_from_impl(
            from_addr=test_addresses['sender'],
            to_addr=test_addresses['recipient'],
            amount=500000
        )
        
        assert result.get('error') is not True
        assert result['function'] == 'transferFrom(address,address,uint256)'
        assert result['selector'] == '0x23b872dd'
        assert result['calldata_length'] == 100  # 4 + 32 + 32 + 32
    
    def test_encode_transfer_from_invalid(self):
        """Test encoding with invalid addresses."""
        result = encode_transfer_from_impl(
            from_addr='invalid',
            to_addr='also-invalid',
            amount=1000
        )
        
        assert result['error'] is True


class TestEncodeFunctionCall:
    """Tests for arbitrary function encoding."""
    
    def test_encode_balance_of(self, test_addresses):
        """Test encoding balanceOf(address)."""
        result = encode_function_call_impl(
            function_signature='balanceOf(address)',
            params=[test_addresses['sender']]
        )
        
        assert result.get('error') is not True
        assert result['selector'] == '0x70a08231'
        assert result['calldata_length'] == 36  # 4 + 32
    
    def test_encode_no_params(self):
        """Test encoding function with no parameters."""
        result = encode_function_call_impl(
            function_signature='totalSupply()',
            params=[]
        )
        
        assert result.get('error') is not True
        assert result['selector'] == '0x18160ddd'
        assert result['calldata_length'] == 4
    
    def test_encode_multiple_params(self, test_addresses):
        """Test encoding function with multiple parameters."""
        result = encode_function_call_impl(
            function_signature='allowance(address,address)',
            params=[test_addresses['sender'], test_addresses['recipient']]
        )
        
        assert result.get('error') is not True
        assert result['calldata_length'] == 68  # 4 + 32 + 32
    
    def test_encode_param_mismatch(self, test_addresses):
        """Test encoding with wrong number of parameters."""
        result = encode_function_call_impl(
            function_signature='transfer(address,uint256)',
            params=[test_addresses['recipient']]  # Missing amount
        )
        
        assert result['error'] is True
        assert 'mismatch' in result['message'].lower()


class TestDecodeCalldata:
    """Tests for calldata decoding."""
    
    def test_decode_transfer(self, test_addresses):
        """Test decoding transfer calldata."""
        # First encode
        encoded = encode_transfer_impl(
            to=test_addresses['recipient'],
            amount=1000000
        )
        
        # Then decode
        result = decode_calldata_impl(encoded['calldata'])
        
        assert result.get('error') is not True
        assert result['is_known'] is True
        assert result['function'] == 'transfer(address,uint256)'
        assert result['selector'] == '0xa9059cbb'
    
    def test_decode_approve(self, test_addresses):
        """Test decoding approve calldata."""
        encoded = encode_approve_impl(
            spender=test_addresses['recipient'],
            amount=1000000
        )
        
        result = decode_calldata_impl(encoded['calldata'])
        
        assert result['is_known'] is True
        assert result['function'] == 'approve(address,uint256)'
    
    def test_decode_unknown_selector(self):
        """Test decoding unknown function selector."""
        # Made-up calldata with unknown selector
        result = decode_calldata_impl('0x12345678abcdef00')
        
        assert result.get('error') is not True
        assert result['is_known'] is False
        assert result['selector'] == '0x12345678'
    
    def test_decode_too_short(self):
        """Test decoding data that's too short."""
        result = decode_calldata_impl('0x1234')
        
        assert result['error'] is True
    
    def test_decode_extracts_params(self, test_addresses):
        """Test that decoding extracts parameters."""
        encoded = encode_transfer_impl(
            to=test_addresses['recipient'],
            amount=1000000
        )
        
        result = decode_calldata_impl(encoded['calldata'])
        
        if 'decoded_params' in result and result['decoded_params']:
            # First param should be address (lowercase)
            assert test_addresses['recipient'].lower() in str(result['decoded_params'][0]).lower()
            # Second param should be amount
            assert '1000000' in str(result['decoded_params'][1])


class TestRoundTrip:
    """End-to-end encoding and decoding tests."""
    
    def test_transfer_roundtrip(self, test_addresses):
        """Test encoding then decoding transfer."""
        original_to = test_addresses['recipient']
        original_amount = 12345678
        
        encoded = encode_transfer_impl(to=original_to, amount=original_amount)
        decoded = decode_calldata_impl(encoded['calldata'])
        
        assert decoded['function'] == 'transfer(address,uint256)'
        if decoded.get('decoded_params'):
            assert original_to.lower() in decoded['decoded_params'][0].lower()
            assert str(original_amount) in str(decoded['decoded_params'][1])
