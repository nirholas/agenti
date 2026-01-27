"""
Gas Utility Tools

Tools for gas estimation, conversion, and cost calculation.
"""

from typing import Any, Dict, Optional

from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

WEI = 1
GWEI = 10**9
ETHER = 10**18

UNIT_VALUES = {
    'wei': WEI,
    'kwei': 10**3,
    'mwei': 10**6,
    'gwei': GWEI,
    'szabo': 10**12,
    'finney': 10**15,
    'ether': ETHER,
    'eth': ETHER
}

# Common gas costs
GAS_COSTS = {
    'transfer': 21000,
    'erc20_transfer': 65000,
    'erc20_approve': 46000,
    'erc721_transfer': 85000,
    'uniswap_swap': 150000,
    'contract_deployment': 1000000,  # Varies widely
}


# ============================================================================
# Core Functions
# ============================================================================

def convert_gas_units_impl(
    value: float,
    from_unit: str,
    to_unit: str
) -> Dict[str, Any]:
    """
    Convert between gas/value units.
    """
    from_unit = from_unit.lower()
    to_unit = to_unit.lower()
    
    if from_unit not in UNIT_VALUES:
        return {
            'error': True,
            'message': f"Unknown unit: {from_unit}",
            'available_units': list(UNIT_VALUES.keys())
        }
    
    if to_unit not in UNIT_VALUES:
        return {
            'error': True,
            'message': f"Unknown unit: {to_unit}",
            'available_units': list(UNIT_VALUES.keys())
        }
    
    # Convert to wei first, then to target unit
    wei_value = value * UNIT_VALUES[from_unit]
    result = wei_value / UNIT_VALUES[to_unit]
    
    return {
        'input_value': value,
        'input_unit': from_unit,
        'output_value': result,
        'output_unit': to_unit,
        'wei_value': int(wei_value)
    }


def estimate_transaction_cost_impl(
    gas_limit: int,
    gas_price_gwei: Optional[float] = None,
    max_fee_per_gas_gwei: Optional[float] = None,
    base_fee_gwei: Optional[float] = None,
    priority_fee_gwei: Optional[float] = None,
    value_eth: float = 0
) -> Dict[str, Any]:
    """
    Estimate the cost of a transaction.
    """
    result = {
        'gas_limit': gas_limit,
        'value_eth': value_eth,
        'value_wei': int(value_eth * ETHER)
    }
    
    if gas_price_gwei is not None:
        # Legacy calculation
        gas_cost_wei = int(gas_limit * gas_price_gwei * GWEI)
        total_wei = gas_cost_wei + int(value_eth * ETHER)
        
        result['calculation_type'] = 'legacy'
        result['gas_price_gwei'] = gas_price_gwei
        result['gas_cost_wei'] = gas_cost_wei
        result['gas_cost_eth'] = gas_cost_wei / ETHER
        result['total_cost_wei'] = total_wei
        result['total_cost_eth'] = total_wei / ETHER
        
    elif max_fee_per_gas_gwei is not None:
        # EIP-1559 calculation
        max_gas_cost_wei = int(gas_limit * max_fee_per_gas_gwei * GWEI)
        max_total_wei = max_gas_cost_wei + int(value_eth * ETHER)
        
        result['calculation_type'] = 'eip1559'
        result['max_fee_per_gas_gwei'] = max_fee_per_gas_gwei
        result['max_gas_cost_wei'] = max_gas_cost_wei
        result['max_gas_cost_eth'] = max_gas_cost_wei / ETHER
        result['max_total_cost_wei'] = max_total_wei
        result['max_total_cost_eth'] = max_total_wei / ETHER
        
        # If we have base fee, calculate actual cost
        if base_fee_gwei is not None and priority_fee_gwei is not None:
            actual_gas_price = min(
                base_fee_gwei + priority_fee_gwei,
                max_fee_per_gas_gwei
            )
            actual_gas_cost_wei = int(gas_limit * actual_gas_price * GWEI)
            actual_total_wei = actual_gas_cost_wei + int(value_eth * ETHER)
            
            result['base_fee_gwei'] = base_fee_gwei
            result['priority_fee_gwei'] = priority_fee_gwei
            result['effective_gas_price_gwei'] = actual_gas_price
            result['actual_gas_cost_wei'] = actual_gas_cost_wei
            result['actual_gas_cost_eth'] = actual_gas_cost_wei / ETHER
            result['actual_total_cost_wei'] = actual_total_wei
            result['actual_total_cost_eth'] = actual_total_wei / ETHER
            result['savings_from_max_wei'] = max_gas_cost_wei - actual_gas_cost_wei
            result['savings_from_max_eth'] = (max_gas_cost_wei - actual_gas_cost_wei) / ETHER
    
    else:
        return {
            'error': True,
            'message': 'Must provide either gas_price_gwei or max_fee_per_gas_gwei'
        }
    
    return result


def get_gas_estimate_impl(operation: str) -> Dict[str, Any]:
    """
    Get gas estimates for common operations.
    """
    operation = operation.lower().replace('-', '_').replace(' ', '_')
    
    if operation in GAS_COSTS:
        gas = GAS_COSTS[operation]
        return {
            'operation': operation,
            'estimated_gas': gas,
            'note': 'Actual gas may vary based on contract implementation'
        }
    
    # Try partial match
    matches = [k for k in GAS_COSTS.keys() if operation in k or k in operation]
    if matches:
        return {
            'operation': operation,
            'similar_operations': {k: GAS_COSTS[k] for k in matches},
            'note': 'Exact operation not found, showing similar operations'
        }
    
    return {
        'operation': operation,
        'error': 'Operation not found',
        'available_operations': list(GAS_COSTS.keys())
    }


def calculate_gas_for_data_impl(data: str) -> Dict[str, Any]:
    """
    Calculate gas cost for transaction data.
    """
    if data.startswith('0x'):
        data = data[2:]
    
    try:
        data_bytes = bytes.fromhex(data)
    except ValueError:
        return {'error': True, 'message': 'Invalid hex data'}
    
    # Gas costs per byte
    zero_byte_cost = 4
    non_zero_byte_cost = 16
    
    zero_bytes = sum(1 for b in data_bytes if b == 0)
    non_zero_bytes = len(data_bytes) - zero_bytes
    
    data_gas = (zero_bytes * zero_byte_cost) + (non_zero_bytes * non_zero_byte_cost)
    
    return {
        'data_length_bytes': len(data_bytes),
        'zero_bytes': zero_bytes,
        'non_zero_bytes': non_zero_bytes,
        'zero_byte_cost': zero_byte_cost,
        'non_zero_byte_cost': non_zero_byte_cost,
        'data_gas_cost': data_gas,
        'note': 'This is only the intrinsic gas for data, not execution gas'
    }


# ============================================================================
# Tool Registration
# ============================================================================

def register_gas_tools(server: Server) -> None:
    """Register gas utility tools with the MCP server."""
    
    @server.tool()
    async def convert_gas_units(
        value: float,
        from_unit: str,
        to_unit: str
    ) -> Dict[str, Any]:
        """
        Convert between Ethereum value units.
        
        Supported units: wei, kwei, mwei, gwei, szabo, finney, ether/eth
        
        Args:
            value: The value to convert
            from_unit: Source unit
            to_unit: Target unit
            
        Returns:
            Converted value
        """
        try:
            return convert_gas_units_impl(value, from_unit, to_unit)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def estimate_transaction_cost(
        gas_limit: int,
        gas_price_gwei: Optional[float] = None,
        max_fee_per_gas_gwei: Optional[float] = None,
        base_fee_gwei: Optional[float] = None,
        priority_fee_gwei: Optional[float] = None,
        value_eth: float = 0
    ) -> Dict[str, Any]:
        """
        Estimate the total cost of a transaction.
        
        For legacy: provide gas_price_gwei
        For EIP-1559: provide max_fee_per_gas_gwei (and optionally base_fee + priority_fee)
        
        Args:
            gas_limit: Gas limit for the transaction
            gas_price_gwei: Gas price in gwei (for legacy)
            max_fee_per_gas_gwei: Max fee per gas in gwei (for EIP-1559)
            base_fee_gwei: Current base fee (for actual cost calculation)
            priority_fee_gwei: Priority fee (for actual cost calculation)
            value_eth: Value being transferred in ETH
            
        Returns:
            Cost breakdown in wei and ETH
        """
        try:
            return estimate_transaction_cost_impl(
                gas_limit, gas_price_gwei, max_fee_per_gas_gwei,
                base_fee_gwei, priority_fee_gwei, value_eth
            )
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def get_gas_estimate(operation: str) -> Dict[str, Any]:
        """
        Get gas estimates for common operations.
        
        Available operations: transfer, erc20_transfer, erc20_approve,
        erc721_transfer, uniswap_swap, contract_deployment
        
        Args:
            operation: The operation type
            
        Returns:
            Estimated gas for the operation
        """
        try:
            return get_gas_estimate_impl(operation)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def calculate_gas_for_data(data: str) -> Dict[str, Any]:
        """
        Calculate the intrinsic gas cost for transaction data.
        
        Gas costs: 4 per zero byte, 16 per non-zero byte
        
        Args:
            data: Hex-encoded transaction data
            
        Returns:
            Gas cost breakdown for data
        """
        try:
            return calculate_gas_for_data_impl(data)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['convert_gas_units'] = convert_gas_units
    server._tools['estimate_transaction_cost'] = estimate_transaction_cost
    server._tools['get_gas_estimate'] = get_gas_estimate
    server._tools['calculate_gas_for_data'] = calculate_gas_for_data
