"""
Data Encoding Tools

Tools for encoding transaction calldata.
"""

from typing import Any, Dict, List, Optional

from eth_utils import keccak, to_checksum_address
from eth_abi import encode
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

# Common function signatures
COMMON_FUNCTIONS = {
    'transfer': 'transfer(address,uint256)',
    'approve': 'approve(address,uint256)',
    'transferFrom': 'transferFrom(address,address,uint256)',
    'balanceOf': 'balanceOf(address)',
    'allowance': 'allowance(address,address)',
    'totalSupply': 'totalSupply()',
    'name': 'name()',
    'symbol': 'symbol()',
    'decimals': 'decimals()',
    # ERC-721
    'ownerOf': 'ownerOf(uint256)',
    'safeTransferFrom': 'safeTransferFrom(address,address,uint256)',
    # Uniswap
    'swapExactTokensForTokens': 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
}


# ============================================================================
# Helpers
# ============================================================================

def _get_function_selector(signature: str) -> str:
    """Get the 4-byte function selector from a signature."""
    return '0x' + keccak(text=signature)[:4].hex()


def _normalize_hex(value: str) -> str:
    """Normalize hex string."""
    if value.startswith('0x') or value.startswith('0X'):
        return value[2:].lower()
    return value.lower()


# ============================================================================
# Core Functions
# ============================================================================

def encode_transfer_impl(to: str, amount: int) -> Dict[str, Any]:
    """
    Encode an ERC-20 transfer call.
    """
    try:
        to_addr = to_checksum_address(to)
    except:
        return {'error': True, 'message': 'Invalid recipient address'}
    
    selector = _get_function_selector('transfer(address,uint256)')
    
    # Encode parameters
    encoded_params = encode(['address', 'uint256'], [to_addr, amount])
    
    calldata = selector + encoded_params.hex()
    
    return {
        'function': 'transfer(address,uint256)',
        'selector': selector,
        'to': to_addr,
        'amount': amount,
        'calldata': calldata,
        'calldata_length': len(bytes.fromhex(calldata[2:])),
        'note': 'Use this as the "data" field in your transaction'
    }


def encode_approve_impl(spender: str, amount: int) -> Dict[str, Any]:
    """
    Encode an ERC-20 approve call.
    """
    try:
        spender_addr = to_checksum_address(spender)
    except:
        return {'error': True, 'message': 'Invalid spender address'}
    
    selector = _get_function_selector('approve(address,uint256)')
    encoded_params = encode(['address', 'uint256'], [spender_addr, amount])
    
    calldata = selector + encoded_params.hex()
    
    # Max uint256 for unlimited approval
    max_uint256 = 2**256 - 1
    
    return {
        'function': 'approve(address,uint256)',
        'selector': selector,
        'spender': spender_addr,
        'amount': amount,
        'amount_is_max': amount == max_uint256,
        'calldata': calldata,
        'calldata_length': len(bytes.fromhex(calldata[2:]))
    }


def encode_transfer_from_impl(
    from_addr: str,
    to_addr: str,
    amount: int
) -> Dict[str, Any]:
    """
    Encode an ERC-20 transferFrom call.
    """
    try:
        from_address = to_checksum_address(from_addr)
        to_address = to_checksum_address(to_addr)
    except:
        return {'error': True, 'message': 'Invalid address'}
    
    selector = _get_function_selector('transferFrom(address,address,uint256)')
    encoded_params = encode(
        ['address', 'address', 'uint256'],
        [from_address, to_address, amount]
    )
    
    calldata = selector + encoded_params.hex()
    
    return {
        'function': 'transferFrom(address,address,uint256)',
        'selector': selector,
        'from': from_address,
        'to': to_address,
        'amount': amount,
        'calldata': calldata,
        'calldata_length': len(bytes.fromhex(calldata[2:]))
    }


def encode_function_call_impl(
    function_signature: str,
    params: List[Any]
) -> Dict[str, Any]:
    """
    Encode an arbitrary function call.
    """
    # Parse signature to get types
    try:
        # Extract function name and params
        name_end = function_signature.index('(')
        params_str = function_signature[name_end + 1:-1]
        
        if params_str:
            param_types = [t.strip() for t in params_str.split(',')]
        else:
            param_types = []
    except:
        return {'error': True, 'message': 'Invalid function signature format'}
    
    if len(param_types) != len(params):
        return {
            'error': True,
            'message': f'Parameter count mismatch: signature has {len(param_types)}, provided {len(params)}'
        }
    
    selector = _get_function_selector(function_signature)
    
    # Convert address params to checksum
    processed_params = []
    for i, (ptype, pval) in enumerate(zip(param_types, params)):
        if 'address' in ptype and isinstance(pval, str):
            try:
                pval = to_checksum_address(pval)
            except:
                return {'error': True, 'message': f'Invalid address at parameter {i}'}
        processed_params.append(pval)
    
    try:
        encoded_params = encode(param_types, processed_params)
    except Exception as e:
        return {'error': True, 'message': f'Encoding failed: {e}'}
    
    calldata = selector + encoded_params.hex()
    
    return {
        'function': function_signature,
        'selector': selector,
        'param_types': param_types,
        'params': params,
        'calldata': calldata,
        'calldata_length': len(bytes.fromhex(calldata[2:]))
    }


def decode_calldata_impl(calldata: str) -> Dict[str, Any]:
    """
    Decode transaction calldata (selector identification).
    """
    if calldata.startswith('0x'):
        calldata = calldata[2:]
    
    if len(calldata) < 8:
        return {
            'error': True,
            'message': 'Calldata too short for function call'
        }
    
    selector = '0x' + calldata[:8]
    params_hex = calldata[8:]
    
    # Known selectors
    known_selectors = {
        '0xa9059cbb': ('transfer(address,uint256)', ['address', 'uint256']),
        '0x095ea7b3': ('approve(address,uint256)', ['address', 'uint256']),
        '0x23b872dd': ('transferFrom(address,address,uint256)', ['address', 'address', 'uint256']),
        '0x70a08231': ('balanceOf(address)', ['address']),
        '0xdd62ed3e': ('allowance(address,address)', ['address', 'address']),
        '0x18160ddd': ('totalSupply()', []),
        '0x06fdde03': ('name()', []),
        '0x95d89b41': ('symbol()', []),
        '0x313ce567': ('decimals()', []),
    }
    
    result = {
        'selector': selector,
        'params_hex': '0x' + params_hex if params_hex else '0x',
        'params_length_bytes': len(bytes.fromhex(params_hex)) if params_hex else 0
    }
    
    if selector in known_selectors:
        func_name, param_types = known_selectors[selector]
        result['is_known'] = True
        result['function'] = func_name
        result['param_types'] = param_types
        
        # Try to decode params
        if params_hex and param_types:
            try:
                from eth_abi import decode as abi_decode
                decoded = abi_decode(param_types, bytes.fromhex(params_hex))
                result['decoded_params'] = [
                    str(p) if isinstance(p, int) else p
                    for p in decoded
                ]
            except:
                result['decoded_params'] = None
    else:
        result['is_known'] = False
        result['note'] = 'Unknown function selector'
    
    return result


# ============================================================================
# Tool Registration
# ============================================================================

def register_encoding_tools(server: Server) -> None:
    """Register data encoding tools with the MCP server."""
    
    @server.tool()
    async def encode_transfer(to: str, amount: int) -> Dict[str, Any]:
        """
        Encode an ERC-20 transfer function call.
        
        Args:
            to: Recipient address
            amount: Token amount in smallest units
            
        Returns:
            Encoded calldata for transfer
        """
        try:
            return encode_transfer_impl(to, amount)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def encode_approve(spender: str, amount: int) -> Dict[str, Any]:
        """
        Encode an ERC-20 approve function call.
        
        Args:
            spender: Address to approve
            amount: Token amount to approve (use 2**256-1 for unlimited)
            
        Returns:
            Encoded calldata for approve
        """
        try:
            return encode_approve_impl(spender, amount)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def encode_transfer_from(
        from_addr: str,
        to_addr: str,
        amount: int
    ) -> Dict[str, Any]:
        """
        Encode an ERC-20 transferFrom function call.
        
        Args:
            from_addr: Address to transfer from
            to_addr: Recipient address
            amount: Token amount
            
        Returns:
            Encoded calldata for transferFrom
        """
        try:
            return encode_transfer_from_impl(from_addr, to_addr, amount)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def encode_function_call(
        function_signature: str,
        params: List[Any]
    ) -> Dict[str, Any]:
        """
        Encode an arbitrary function call.
        
        Args:
            function_signature: Function signature (e.g., "transfer(address,uint256)")
            params: List of parameter values
            
        Returns:
            Encoded calldata
        """
        try:
            return encode_function_call_impl(function_signature, params)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def decode_calldata(calldata: str) -> Dict[str, Any]:
        """
        Decode transaction calldata.
        
        Identifies the function selector and attempts to decode parameters.
        
        Args:
            calldata: Transaction input data in hex
            
        Returns:
            Decoded function and parameters
        """
        try:
            return decode_calldata_impl(calldata)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['encode_transfer'] = encode_transfer
    server._tools['encode_approve'] = encode_approve
    server._tools['encode_transfer_from'] = encode_transfer_from
    server._tools['encode_function_call'] = encode_function_call
    server._tools['decode_calldata'] = decode_calldata
