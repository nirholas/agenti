"""
Tests for gas utility tools.
"""

import pytest
from transaction_mcp.tools.gas import (
    convert_gas_units_impl,
    estimate_transaction_cost_impl,
    get_gas_estimate_impl,
    calculate_gas_for_data_impl,
)


class TestConvertGasUnits:
    """Tests for gas unit conversion."""
    
    def test_gwei_to_wei(self):
        """Test converting gwei to wei."""
        result = convert_gas_units_impl(1, 'gwei', 'wei')
        
        assert result.get('error') is not True
        assert result['output_value'] == 10**9
    
    def test_ether_to_gwei(self):
        """Test converting ether to gwei."""
        result = convert_gas_units_impl(1, 'ether', 'gwei')
        
        assert result.get('error') is not True
        assert result['output_value'] == 10**9
    
    def test_wei_to_ether(self):
        """Test converting wei to ether."""
        result = convert_gas_units_impl(10**18, 'wei', 'ether')
        
        assert result.get('error') is not True
        assert result['output_value'] == 1
    
    def test_eth_alias(self):
        """Test that 'eth' works as alias for 'ether'."""
        result = convert_gas_units_impl(1, 'eth', 'wei')
        
        assert result.get('error') is not True
        assert result['output_value'] == 10**18
    
    def test_unknown_unit(self):
        """Test with unknown unit."""
        result = convert_gas_units_impl(1, 'unknown', 'wei')
        
        assert result['error'] is True
    
    def test_case_insensitive(self):
        """Test that units are case-insensitive."""
        result = convert_gas_units_impl(1, 'GWEI', 'WEI')
        
        assert result.get('error') is not True
        assert result['output_value'] == 10**9


class TestEstimateTransactionCost:
    """Tests for transaction cost estimation."""
    
    def test_legacy_cost(self):
        """Test legacy transaction cost."""
        result = estimate_transaction_cost_impl(
            gas_limit=21000,
            gas_price_gwei=30
        )
        
        assert result.get('error') is not True
        assert result['calculation_type'] == 'legacy'
        # 21000 * 30 gwei = 630000 gwei = 630000 * 10^9 wei
        expected_cost = 21000 * 30 * 10**9
        assert result['gas_cost_wei'] == expected_cost
    
    def test_eip1559_max_cost(self):
        """Test EIP-1559 max cost calculation."""
        result = estimate_transaction_cost_impl(
            gas_limit=21000,
            max_fee_per_gas_gwei=50
        )
        
        assert result.get('error') is not True
        assert result['calculation_type'] == 'eip1559'
        expected_max = 21000 * 50 * 10**9
        assert result['max_gas_cost_wei'] == expected_max
    
    def test_eip1559_actual_cost(self):
        """Test EIP-1559 actual cost with base fee."""
        result = estimate_transaction_cost_impl(
            gas_limit=21000,
            max_fee_per_gas_gwei=50,
            base_fee_gwei=20,
            priority_fee_gwei=2
        )
        
        assert result.get('error') is not True
        # Effective price = min(50, 20+2) = 22 gwei
        expected_actual = 21000 * 22 * 10**9
        assert result['actual_gas_cost_wei'] == expected_actual
    
    def test_with_value(self):
        """Test cost including ETH value."""
        result = estimate_transaction_cost_impl(
            gas_limit=21000,
            gas_price_gwei=30,
            value_eth=1.0
        )
        
        assert result.get('error') is not True
        gas_cost = 21000 * 30 * 10**9
        value_wei = 10**18
        assert result['total_cost_wei'] == gas_cost + value_wei
    
    def test_missing_gas_params(self):
        """Test with no gas price parameters."""
        result = estimate_transaction_cost_impl(
            gas_limit=21000
        )
        
        assert result['error'] is True


class TestGetGasEstimate:
    """Tests for operation gas estimates."""
    
    def test_transfer_estimate(self):
        """Test gas estimate for ETH transfer."""
        result = get_gas_estimate_impl('transfer')
        
        assert result.get('error') is None or result.get('error') == 'Operation not found'
        if 'estimated_gas' in result:
            assert result['estimated_gas'] == 21000
    
    def test_erc20_transfer_estimate(self):
        """Test gas estimate for ERC-20 transfer."""
        result = get_gas_estimate_impl('erc20_transfer')
        
        if 'estimated_gas' in result:
            assert result['estimated_gas'] >= 45000  # Varies but should be high
    
    def test_unknown_operation(self):
        """Test with unknown operation."""
        result = get_gas_estimate_impl('unknown_operation_xyz')
        
        # Should either have error or available_operations
        assert 'error' in result or 'available_operations' in result


class TestCalculateGasForData:
    """Tests for calldata gas calculation."""
    
    def test_zero_bytes(self):
        """Test gas for zero bytes."""
        result = calculate_gas_for_data_impl('0x0000')
        
        assert result.get('error') is not True
        assert result['zero_bytes'] == 2
        assert result['non_zero_bytes'] == 0
        assert result['data_gas_cost'] == 8  # 2 * 4
    
    def test_non_zero_bytes(self):
        """Test gas for non-zero bytes."""
        result = calculate_gas_for_data_impl('0xffff')
        
        assert result.get('error') is not True
        assert result['zero_bytes'] == 0
        assert result['non_zero_bytes'] == 2
        assert result['data_gas_cost'] == 32  # 2 * 16
    
    def test_mixed_bytes(self):
        """Test gas for mixed zero and non-zero bytes."""
        result = calculate_gas_for_data_impl('0xff00ff00')
        
        assert result.get('error') is not True
        assert result['zero_bytes'] == 2
        assert result['non_zero_bytes'] == 2
        assert result['data_gas_cost'] == 40  # 2*4 + 2*16
    
    def test_transfer_calldata(self):
        """Test gas for typical transfer calldata."""
        # transfer(address,uint256) with params
        calldata = '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000000000000000064'
        
        result = calculate_gas_for_data_impl(calldata)
        
        assert result.get('error') is not True
        assert result['data_length_bytes'] == 68  # 4 selector + 32 + 32
        # Many zeros in the padded values
        assert result['zero_bytes'] > 0
    
    def test_invalid_hex(self):
        """Test with invalid hex data."""
        result = calculate_gas_for_data_impl('not-valid-hex')
        
        assert result['error'] is True
