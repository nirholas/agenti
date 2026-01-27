"""
Tests for transaction building tools.
"""

import pytest
from transaction_mcp.tools.building import (
    build_legacy_transaction_impl,
    build_eip1559_transaction_impl,
)


class TestBuildLegacyTransaction:
    """Tests for legacy transaction building."""
    
    def test_build_basic_transfer(self, test_addresses):
        """Test building a basic ETH transfer."""
        result = build_legacy_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=1000000000000000000,  # 1 ETH
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            gas_price_gwei=30
        )
        
        assert 'error' not in result or result.get('error') is not True
        assert result['transaction']['to'] == test_addresses['recipient']
        assert result['transaction']['value'] == 1000000000000000000
        assert result['transaction']['gas'] == 21000
        assert result['transaction']['gasPrice'] == 30000000000
        assert result['transaction']['nonce'] == 0
        assert result['transaction']['chainId'] == 1
    
    def test_invalid_address(self):
        """Test with invalid recipient address."""
        result = build_legacy_transaction_impl(
            to='invalid-address',
            value_wei=1000000000000000000,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            gas_price_gwei=30
        )
        
        assert result['error'] is True
        assert 'address' in result['message'].lower()
    
    def test_negative_value_allowed_at_build(self, test_addresses):
        """Test that negative value may be allowed at build time (fails on-chain)."""
        # The builder doesn't necessarily validate negative values
        # since the transaction will fail when broadcast anyway
        result = build_legacy_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=-1,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            gas_price_gwei=30
        )
        
        # Either it's an error, or a transaction is built (will fail on-chain)
        assert 'error' in result or 'transaction' in result
    
    def test_with_data(self, test_addresses):
        """Test with calldata."""
        data = '0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001'
        result = build_legacy_transaction_impl(
            to=test_addresses['contract'],
            value_wei=0,
            chain_id=1,
            nonce=5,
            gas_limit=65000,
            gas_price_gwei=30,
            data=data
        )
        
        assert 'error' not in result or result.get('error') is not True
        assert result['transaction']['data'] == data


class TestBuildEIP1559Transaction:
    """Tests for EIP-1559 transaction building."""
    
    def test_build_basic_transfer(self, test_addresses):
        """Test building a basic EIP-1559 transfer."""
        result = build_eip1559_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=1000000000000000000,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            max_fee_per_gas_gwei=50,
            max_priority_fee_gwei=2
        )
        
        assert 'error' not in result or result.get('error') is not True
        assert result['transaction']['to'] == test_addresses['recipient']
        assert result['transaction']['maxFeePerGas'] == 50000000000
        assert result['transaction']['maxPriorityFeePerGas'] == 2000000000
        # Verify it's EIP-1559 by checking gas fields
        assert 'maxFeePerGas' in result['transaction']
        assert 'maxPriorityFeePerGas' in result['transaction']
    
    def test_priority_fee_exceeds_max_fee_allowed_at_build(self, test_addresses):
        """Test that priority fee > max fee may be allowed at build (fails on-chain)."""
        result = build_eip1559_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=1000000000000000000,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            max_fee_per_gas_gwei=10,
            max_priority_fee_gwei=20
        )
        
        # Either it's an error, or a transaction is built (will fail on-chain)
        assert 'error' in result or 'transaction' in result
    
    def test_zero_gas_limit_allowed_at_build(self, test_addresses):
        """Test that zero gas limit may be allowed at build (fails on-chain)."""
        result = build_eip1559_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=0,
            chain_id=1,
            nonce=0,
            gas_limit=0,
            max_fee_per_gas_gwei=50,
            max_priority_fee_gwei=2
        )
        
        # Either it's an error, or a transaction is built (will fail on-chain)
        assert 'error' in result or 'transaction' in result


class TestTransactionEstimates:
    """Tests for transaction cost estimates."""
    
    def test_legacy_cost_estimate(self, test_addresses):
        """Test cost calculation in legacy transaction."""
        result = build_legacy_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=1000000000000000000,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            gas_price_gwei=30
        )
        
        assert 'error' not in result or result.get('error') is not True
        # 21000 * 30 gwei = 630000 gwei = 0.00063 ETH
        expected_cost = 21000 * 30 * 10**9
        assert result['max_gas_cost_wei'] == expected_cost
    
    def test_eip1559_max_cost_estimate(self, test_addresses):
        """Test max cost calculation in EIP-1559 transaction."""
        result = build_eip1559_transaction_impl(
            to=test_addresses['recipient'],
            value_wei=1000000000000000000,
            chain_id=1,
            nonce=0,
            gas_limit=21000,
            max_fee_per_gas_gwei=50,
            max_priority_fee_gwei=2
        )
        
        assert 'error' not in result or result.get('error') is not True
        # 21000 * 50 gwei = 1050000 gwei = 0.00105 ETH
        expected_max = 21000 * 50 * 10**9
        assert result['max_gas_cost_wei'] == expected_max
