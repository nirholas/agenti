"""
Transaction Building Tools

Tools for constructing unsigned Ethereum transactions.
"""

import re
from typing import Any, Dict, Optional

from eth_utils import to_checksum_address
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

GWEI = 10**9
ETHER = 10**18
HEX_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]*$')


# ============================================================================
# Validation Helpers
# ============================================================================

def _normalize_hex(value: str) -> str:
    """Normalize hex string to have 0x prefix."""
    if value.startswith('0x') or value.startswith('0X'):
        return '0x' + value[2:].lower()
    return '0x' + value.lower()


def _validate_address(address: str) -> str:
    """Validate and normalize an Ethereum address."""
    if not address:
        raise ValueError("Address is required")
    
    addr = _normalize_hex(address)
    addr_hex = addr[2:]
    
    if not HEX_PATTERN.match(addr_hex):
        raise ValueError("Address must be hexadecimal")
    
    if len(addr_hex) != 40:
        raise ValueError(f"Address must be 20 bytes (40 hex chars), got {len(addr_hex)}")
    
    try:
        return to_checksum_address(addr)
    except Exception as e:
        raise ValueError(f"Invalid address format: {e}")


def _parse_value(value: str | int, unit: str = "wei") -> int:
    """Parse a value with optional unit."""
    if isinstance(value, int):
        return value
    
    # Remove whitespace
    value = str(value).strip()
    
    # Handle numeric string
    try:
        numeric = float(value)
    except ValueError:
        raise ValueError(f"Invalid numeric value: {value}")
    
    # Apply unit conversion
    if unit.lower() == "wei":
        return int(numeric)
    elif unit.lower() == "gwei":
        return int(numeric * GWEI)
    elif unit.lower() in ("ether", "eth"):
        return int(numeric * ETHER)
    else:
        raise ValueError(f"Unknown unit: {unit}")


# ============================================================================
# Core Functions
# ============================================================================

def build_legacy_transaction_impl(
    to: str,
    value_wei: int = 0,
    chain_id: int = 1,
    nonce: int = 0,
    gas_limit: int = 21000,
    gas_price_gwei: float = 20,
    data: str = "0x"
) -> Dict[str, Any]:
    """
    Build a legacy (Type 0) transaction.
    """
    try:
        result = build_transaction_impl(
            to=to,
            value=value_wei,
            nonce=nonce,
            gas=gas_limit,
            chain_id=chain_id,
            data=data,
            tx_type="legacy",
            gas_price=int(gas_price_gwei * GWEI)
        )
        result['error'] = False
        return result
    except Exception as e:
        return {
            'error': True,
            'message': str(e)
        }


def build_eip1559_transaction_impl(
    to: str,
    value_wei: int = 0,
    chain_id: int = 1,
    nonce: int = 0,
    gas_limit: int = 21000,
    max_fee_per_gas_gwei: float = 30,
    max_priority_fee_gwei: float = 2,
    data: str = "0x"
) -> Dict[str, Any]:
    """
    Build an EIP-1559 (Type 2) transaction.
    """
    try:
        result = build_transaction_impl(
            to=to,
            value=value_wei,
            nonce=nonce,
            gas=gas_limit,
            chain_id=chain_id,
            data=data,
            tx_type="eip1559",
            max_fee_per_gas=int(max_fee_per_gas_gwei * GWEI),
            max_priority_fee_per_gas=int(max_priority_fee_gwei * GWEI)
        )
        result['error'] = False
        return result
    except Exception as e:
        return {
            'error': True,
            'message': str(e)
        }


def build_transaction_impl(
    to: str,
    value: int = 0,
    nonce: int = 0,
    gas: int = 21000,
    chain_id: int = 1,
    data: str = "0x",
    tx_type: str = "eip1559",
    gas_price: Optional[int] = None,
    max_fee_per_gas: Optional[int] = None,
    max_priority_fee_per_gas: Optional[int] = None
) -> Dict[str, Any]:
    """
    Build an unsigned transaction.
    """
    to_addr = _validate_address(to)
    
    # Normalize data
    if data and data != "0x":
        data = _normalize_hex(data)
    else:
        data = "0x"
    
    # Build base transaction
    tx = {
        'to': to_addr,
        'value': value,
        'nonce': nonce,
        'gas': gas,
        'chainId': chain_id,
        'data': data
    }
    
    # Add gas parameters based on type
    if tx_type.lower() == "legacy":
        if gas_price is None:
            gas_price = 20 * GWEI  # Default
        tx['gasPrice'] = gas_price
        tx_type_name = "Legacy (Type 0)"
    else:
        # EIP-1559
        if max_fee_per_gas is None:
            max_fee_per_gas = 30 * GWEI
        if max_priority_fee_per_gas is None:
            max_priority_fee_per_gas = 2 * GWEI
        tx['maxFeePerGas'] = max_fee_per_gas
        tx['maxPriorityFeePerGas'] = max_priority_fee_per_gas
        tx_type_name = "EIP-1559 (Type 2)"
    
    # Calculate max cost
    if 'gasPrice' in tx:
        max_gas_cost = tx['gasPrice'] * gas
    else:
        max_gas_cost = tx['maxFeePerGas'] * gas
    
    max_total_cost = max_gas_cost + value
    
    return {
        'transaction': tx,
        'type': tx_type_name,
        'to': to_addr,
        'value_wei': value,
        'value_eth': value / ETHER,
        'nonce': nonce,
        'gas_limit': gas,
        'chain_id': chain_id,
        'data_length': len(bytes.fromhex(data[2:])) if data != "0x" else 0,
        'max_gas_cost_wei': max_gas_cost,
        'max_gas_cost_eth': max_gas_cost / ETHER,
        'max_total_cost_wei': max_total_cost,
        'max_total_cost_eth': max_total_cost / ETHER
    }


def validate_transaction_impl(tx: Dict) -> Dict[str, Any]:
    """
    Validate a transaction's fields.
    """
    issues = []
    warnings = []
    
    # Check required fields
    required = ['to', 'nonce', 'gas', 'chainId']
    for field in required:
        if field not in tx:
            issues.append(f"Missing required field: {field}")
    
    # Validate address
    if 'to' in tx:
        try:
            _validate_address(tx['to'])
        except ValueError as e:
            issues.append(f"Invalid 'to' address: {e}")
    
    # Check nonce
    if 'nonce' in tx and tx['nonce'] < 0:
        issues.append("Nonce cannot be negative")
    
    # Check gas
    if 'gas' in tx:
        if tx['gas'] < 21000:
            warnings.append("Gas limit below 21000 (minimum for simple transfer)")
        if tx['gas'] > 30000000:
            warnings.append("Gas limit unusually high (>30M)")
    
    # Check value
    if 'value' in tx and tx['value'] < 0:
        issues.append("Value cannot be negative")
    
    # Check gas parameters
    has_legacy = 'gasPrice' in tx
    has_eip1559 = 'maxFeePerGas' in tx or 'maxPriorityFeePerGas' in tx
    
    if has_legacy and has_eip1559:
        issues.append("Cannot have both gasPrice and maxFeePerGas")
    
    if not has_legacy and not has_eip1559:
        issues.append("Must specify either gasPrice or maxFeePerGas")
    
    if has_eip1559:
        max_fee = tx.get('maxFeePerGas', 0)
        priority_fee = tx.get('maxPriorityFeePerGas', 0)
        if priority_fee > max_fee:
            issues.append("maxPriorityFeePerGas cannot exceed maxFeePerGas")
    
    # Check data
    if 'data' in tx and tx['data'] != "0x":
        try:
            data = _normalize_hex(tx['data'])
            bytes.fromhex(data[2:])
        except:
            issues.append("Invalid data field (must be valid hex)")
    
    return {
        'is_valid': len(issues) == 0,
        'issues': issues,
        'warnings': warnings,
        'issue_count': len(issues),
        'warning_count': len(warnings)
    }


def compare_transactions_impl(tx1: Dict, tx2: Dict) -> Dict[str, Any]:
    """
    Compare two transactions field by field.
    """
    all_keys = set(tx1.keys()) | set(tx2.keys())
    
    differences = []
    matches = []
    
    for key in sorted(all_keys):
        val1 = tx1.get(key)
        val2 = tx2.get(key)
        
        if val1 == val2:
            matches.append({
                'field': key,
                'value': val1
            })
        else:
            differences.append({
                'field': key,
                'tx1': val1,
                'tx2': val2
            })
    
    return {
        'are_identical': len(differences) == 0,
        'differences': differences,
        'matches': matches,
        'difference_count': len(differences),
        'match_count': len(matches)
    }


# ============================================================================
# Tool Registration
# ============================================================================

def register_building_tools(server: Server) -> None:
    """Register transaction building tools with the MCP server."""
    
    @server.tool()
    async def build_transaction(
        to: str,
        value: int = 0,
        nonce: int = 0,
        gas: int = 21000,
        chain_id: int = 1,
        data: str = "0x",
        tx_type: str = "eip1559",
        gas_price: Optional[int] = None,
        max_fee_per_gas: Optional[int] = None,
        max_priority_fee_per_gas: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Build an unsigned Ethereum transaction.
        
        Args:
            to: Recipient address
            value: Value in wei (default 0)
            nonce: Transaction nonce (get from chain)
            gas: Gas limit (21000 for simple transfer)
            chain_id: Chain ID (1 for mainnet)
            data: Transaction data in hex (default "0x")
            tx_type: "legacy" or "eip1559" (default)
            gas_price: Gas price in wei (for legacy)
            max_fee_per_gas: Max fee in wei (for EIP-1559)
            max_priority_fee_per_gas: Priority fee in wei (for EIP-1559)
            
        Returns:
            Unsigned transaction object with cost estimates
        """
        try:
            return build_transaction_impl(
                to, value, nonce, gas, chain_id, data, tx_type,
                gas_price, max_fee_per_gas, max_priority_fee_per_gas
            )
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def validate_transaction(tx: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate a transaction's fields.
        
        Checks for missing fields, invalid values, and common issues.
        
        Args:
            tx: Transaction dictionary to validate
            
        Returns:
            Validation results with issues and warnings
        """
        try:
            return validate_transaction_impl(tx)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def compare_transactions(
        tx1: Dict[str, Any],
        tx2: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compare two transactions field by field.
        
        Args:
            tx1: First transaction
            tx2: Second transaction
            
        Returns:
            Comparison showing differences and matches
        """
        try:
            return compare_transactions_impl(tx1, tx2)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['build_transaction'] = build_transaction
    server._tools['validate_transaction'] = validate_transaction
    server._tools['compare_transactions'] = compare_transactions
