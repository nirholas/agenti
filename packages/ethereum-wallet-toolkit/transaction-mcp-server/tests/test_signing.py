"""
Tests for transaction signing tools.
"""

import pytest
from transaction_mcp.tools.signing import (
    sign_transaction_object_impl,
    recover_transaction_signer_impl,
)


# Test private key - NEVER use in production
TEST_PRIVATE_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'
# Corresponding address: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23


class TestSignTransaction:
    """Tests for transaction signing."""
    
    def test_sign_legacy_transaction(self, legacy_tx):
        """Test signing a legacy transaction."""
        result = sign_transaction_object_impl(
            tx=legacy_tx,
            private_key=TEST_PRIVATE_KEY
        )
        
        assert 'error' not in result or result.get('error') is not True
        assert 'raw_transaction' in result
        assert result['raw_transaction'].startswith('0x')
        assert 'transaction_hash' in result
        assert result['transaction_hash'].startswith('0x')
        assert len(result['transaction_hash']) == 66  # 0x + 64 hex chars
    
    def test_sign_eip1559_transaction(self, eip1559_tx):
        """Test signing an EIP-1559 transaction."""
        result = sign_transaction_object_impl(
            tx=eip1559_tx,
            private_key=TEST_PRIVATE_KEY
        )
        
        assert 'error' not in result or result.get('error') is not True
        assert 'raw_transaction' in result
        # EIP-1559 transactions start with 0x02
        assert result['raw_transaction'].startswith('0x02')
    
    def test_sign_with_invalid_key(self, legacy_tx):
        """Test signing with invalid private key returns error."""
        result = sign_transaction_object_impl(
            tx=legacy_tx,
            private_key='invalid-key'
        )
        
        assert result['error'] is True
        assert 'message' in result
    
    def test_sign_with_short_key(self, legacy_tx):
        """Test signing with too-short private key returns error."""
        result = sign_transaction_object_impl(
            tx=legacy_tx,
            private_key='0x1234'
        )
        
        assert result['error'] is True
        assert 'message' in result
    
    def test_sign_returns_signer_address(self, legacy_tx):
        """Test that signing returns the signer address."""
        result = sign_transaction_object_impl(
            tx=legacy_tx,
            private_key=TEST_PRIVATE_KEY
        )
        
        assert 'error' not in result or result.get('error') is not True
        assert 'from' in result
        # Address should be checksummed
        assert result['from'] == '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'


class TestRecoverTransactionSigner:
    """Tests for recovering signer from signed transaction."""
    
    def test_recover_legacy_signer(self, legacy_tx):
        """Test recovering signer from legacy transaction."""
        # First sign the transaction
        signed = sign_transaction_object_impl(
            tx=legacy_tx,
            private_key=TEST_PRIVATE_KEY
        )
        
        assert 'error' not in signed or signed.get('error') is not True
        
        # Then recover the signer
        result = recover_transaction_signer_impl(signed['raw_transaction'])
        
        assert result.get('success') is True or 'signer' in result
        assert result['signer'] == '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'
    
    def test_recover_eip1559_signer(self, eip1559_tx):
        """Test recovering signer from EIP-1559 transaction."""
        signed = sign_transaction_object_impl(
            tx=eip1559_tx,
            private_key=TEST_PRIVATE_KEY
        )
        
        assert 'error' not in signed or signed.get('error') is not True
        
        result = recover_transaction_signer_impl(signed['raw_transaction'])
        
        assert result.get('success') is True or 'signer' in result
        assert result['signer'] == '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23'
    
    def test_recover_invalid_transaction(self):
        """Test recovery with invalid transaction data returns error."""
        result = recover_transaction_signer_impl('0x1234')
        
        # Should indicate failure - either error=True or error message in result
        is_error = result.get('error') is True or isinstance(result.get('error'), str)
        assert is_error
    
    def test_recover_returns_signer(self, legacy_tx, eip1559_tx):
        """Test that recovery returns valid signer address."""
        # Legacy
        signed_legacy = sign_transaction_object_impl(
            tx=legacy_tx,
            private_key=TEST_PRIVATE_KEY
        )
        result_legacy = recover_transaction_signer_impl(signed_legacy['raw_transaction'])
        
        assert 'signer' in result_legacy
        assert result_legacy['signer'].startswith('0x')
        
        # EIP-1559
        signed_1559 = sign_transaction_object_impl(
            tx=eip1559_tx,
            private_key=TEST_PRIVATE_KEY
        )
        result_1559 = recover_transaction_signer_impl(signed_1559['raw_transaction'])
        
        assert 'signer' in result_1559
        assert result_1559['signer'].startswith('0x')


class TestRoundTrip:
    """End-to-end signing and verification tests."""
    
    def test_build_sign_verify(self, test_addresses):
        """Test complete transaction workflow."""
        from transaction_mcp.tools.building import build_legacy_transaction_impl
        
        # Build
        built = build_legacy_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=1000000000000000000,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            gas_price_gwei=30
        )
        
        assert 'error' not in built or built.get('error') is not True
        
        # Sign
        signed = sign_transaction_object_impl(
            tx=built['transaction'],
            private_key=TEST_PRIVATE_KEY
        )
        
        assert 'error' not in signed or signed.get('error') is not True
        
        # Verify signer
        recovered = recover_transaction_signer_impl(signed['raw_transaction'])
        
        assert 'signer' in recovered
        assert recovered['signer'] == signed['from']
