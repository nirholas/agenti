"""
Transaction Decoding Tools

Tools for decoding and analyzing Ethereum transactions.
"""

from typing import Any, Dict

from eth_account import Account
from eth_utils import to_checksum_address
from rlp import decode as rlp_decode
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

GWEI = 10**9
ETHER = 10**18


# ============================================================================
# Core Functions
# ============================================================================

def decode_raw_transaction_impl(raw_tx: str) -> Dict[str, Any]:
    """
    Decode a raw signed transaction.
    """
    if not raw_tx.startswith('0x'):
        raw_tx = '0x' + raw_tx
    
    try:
        raw_bytes = bytes.fromhex(raw_tx[2:])
    except ValueError as e:
        return {
            'error': True,
            'message': f'Invalid hex data: {e}'
        }
    
    # Determine transaction type
    if raw_bytes[0] > 0x7f:
        # Legacy transaction (RLP encoded, first byte >= 0x80)
        return _decode_legacy_transaction(raw_bytes, raw_tx)
    else:
        # Typed transaction (EIP-2718)
        tx_type = raw_bytes[0]
        if tx_type == 1:
            return _decode_eip2930_transaction(raw_bytes[1:], raw_tx)
        elif tx_type == 2:
            return _decode_eip1559_transaction(raw_bytes[1:], raw_tx)
        else:
            return {
                'type': f'Unknown (Type {tx_type})',
                'raw': raw_tx
            }


def _decode_legacy_transaction(raw_bytes: bytes, raw_tx: str) -> Dict[str, Any]:
    """Decode a legacy (Type 0) transaction."""
    try:
        decoded = rlp_decode(raw_bytes)
        
        nonce = int.from_bytes(decoded[0], 'big') if decoded[0] else 0
        gas_price = int.from_bytes(decoded[1], 'big') if decoded[1] else 0
        gas = int.from_bytes(decoded[2], 'big') if decoded[2] else 0
        to = '0x' + decoded[3].hex() if decoded[3] else None
        value = int.from_bytes(decoded[4], 'big') if decoded[4] else 0
        data = '0x' + decoded[5].hex() if decoded[5] else '0x'
        
        # v, r, s for signature
        v = int.from_bytes(decoded[6], 'big') if decoded[6] else 0
        r = int.from_bytes(decoded[7], 'big') if decoded[7] else 0
        s = int.from_bytes(decoded[8], 'big') if decoded[8] else 0
        
        # Derive chain ID from v (EIP-155)
        if v >= 37:
            chain_id = (v - 35) // 2
        else:
            chain_id = None
        
        # Recover signer
        try:
            signer = Account.recover_transaction(raw_tx)
            signer = to_checksum_address(signer)
        except:
            signer = None
        
        return {
            'type': 'Legacy (Type 0)',
            'nonce': nonce,
            'gas_price_wei': gas_price,
            'gas_price_gwei': gas_price / GWEI,
            'gas_limit': gas,
            'to': to_checksum_address(to) if to else None,
            'value_wei': value,
            'value_eth': value / ETHER,
            'data': data,
            'data_length': len(bytes.fromhex(data[2:])) if data != '0x' else 0,
            'chain_id': chain_id,
            'v': v,
            'r': hex(r),
            's': hex(s),
            'signer': signer
        }
    except Exception as e:
        return {'error': True, 'message': f'Failed to decode legacy transaction: {e}'}


def _decode_eip2930_transaction(payload: bytes, raw_tx: str) -> Dict[str, Any]:
    """Decode an EIP-2930 (Type 1) transaction."""
    try:
        decoded = rlp_decode(payload)
        
        chain_id = int.from_bytes(decoded[0], 'big') if decoded[0] else 0
        nonce = int.from_bytes(decoded[1], 'big') if decoded[1] else 0
        gas_price = int.from_bytes(decoded[2], 'big') if decoded[2] else 0
        gas = int.from_bytes(decoded[3], 'big') if decoded[3] else 0
        to = '0x' + decoded[4].hex() if decoded[4] else None
        value = int.from_bytes(decoded[5], 'big') if decoded[5] else 0
        data = '0x' + decoded[6].hex() if decoded[6] else '0x'
        access_list = decoded[7] if len(decoded) > 7 else []
        
        # Recover signer
        try:
            signer = Account.recover_transaction(raw_tx)
            signer = to_checksum_address(signer)
        except:
            signer = None
        
        return {
            'type': 'EIP-2930 (Type 1)',
            'chain_id': chain_id,
            'nonce': nonce,
            'gas_price_wei': gas_price,
            'gas_price_gwei': gas_price / GWEI,
            'gas_limit': gas,
            'to': to_checksum_address(to) if to else None,
            'value_wei': value,
            'value_eth': value / ETHER,
            'data': data,
            'access_list_length': len(access_list),
            'signer': signer
        }
    except Exception as e:
        return {'error': True, 'message': f'Failed to decode EIP-2930 transaction: {e}'}


def _decode_eip1559_transaction(payload: bytes, raw_tx: str) -> Dict[str, Any]:
    """Decode an EIP-1559 (Type 2) transaction."""
    try:
        decoded = rlp_decode(payload)
        
        chain_id = int.from_bytes(decoded[0], 'big') if decoded[0] else 0
        nonce = int.from_bytes(decoded[1], 'big') if decoded[1] else 0
        max_priority_fee = int.from_bytes(decoded[2], 'big') if decoded[2] else 0
        max_fee = int.from_bytes(decoded[3], 'big') if decoded[3] else 0
        gas = int.from_bytes(decoded[4], 'big') if decoded[4] else 0
        to = '0x' + decoded[5].hex() if decoded[5] else None
        value = int.from_bytes(decoded[6], 'big') if decoded[6] else 0
        data = '0x' + decoded[7].hex() if decoded[7] else '0x'
        access_list = decoded[8] if len(decoded) > 8 else []
        
        # Recover signer
        try:
            signer = Account.recover_transaction(raw_tx)
            signer = to_checksum_address(signer)
        except:
            signer = None
        
        return {
            'type': 'EIP-1559 (Type 2)',
            'chain_id': chain_id,
            'nonce': nonce,
            'max_priority_fee_per_gas_wei': max_priority_fee,
            'max_priority_fee_per_gas_gwei': max_priority_fee / GWEI,
            'max_fee_per_gas_wei': max_fee,
            'max_fee_per_gas_gwei': max_fee / GWEI,
            'gas_limit': gas,
            'to': to_checksum_address(to) if to else None,
            'value_wei': value,
            'value_eth': value / ETHER,
            'data': data,
            'data_length': len(bytes.fromhex(data[2:])) if data != '0x' else 0,
            'access_list_length': len(access_list),
            'signer': signer,
            'max_gas_cost_eth': (max_fee * gas) / ETHER
        }
    except Exception as e:
        return {'error': True, 'message': f'Failed to decode EIP-1559 transaction: {e}'}


def analyze_transaction_impl(raw_tx: str) -> Dict[str, Any]:
    """
    Provide detailed analysis of a transaction.
    """
    decoded = decode_raw_transaction_impl(raw_tx)
    
    if 'error' in decoded:
        return decoded
    
    analysis = {
        'decoded': decoded,
        'analysis': {}
    }
    
    # Analyze transaction type
    tx_type = decoded.get('type', '')
    if 'Legacy' in tx_type:
        analysis['analysis']['type_note'] = "Legacy transaction - consider using EIP-1559 for better fee management"
    elif 'EIP-1559' in tx_type:
        analysis['analysis']['type_note'] = "EIP-1559 transaction - modern fee structure with priority fee"
    
    # Analyze gas
    gas_limit = decoded.get('gas_limit', 0)
    if gas_limit == 21000:
        analysis['analysis']['gas_note'] = "Standard ETH transfer gas limit"
    elif gas_limit > 21000:
        analysis['analysis']['gas_note'] = "Contract interaction or complex transaction"
    
    # Analyze value
    value_eth = decoded.get('value_eth', 0)
    if value_eth == 0:
        analysis['analysis']['value_note'] = "Zero value - likely a contract call"
    
    # Analyze data
    data_length = decoded.get('data_length', 0)
    if data_length > 0:
        data = decoded.get('data', '0x')
        if len(data) >= 10:
            selector = data[:10]
            analysis['analysis']['function_selector'] = selector
            # Common selectors
            known_selectors = {
                '0xa9059cbb': 'transfer(address,uint256) - ERC-20 Transfer',
                '0x23b872dd': 'transferFrom(address,address,uint256) - ERC-20 TransferFrom',
                '0x095ea7b3': 'approve(address,uint256) - ERC-20 Approve',
                '0x70a08231': 'balanceOf(address) - ERC-20 Balance Query',
                '0x18160ddd': 'totalSupply() - ERC-20 Total Supply',
            }
            if selector in known_selectors:
                analysis['analysis']['function_name'] = known_selectors[selector]
    
    return analysis


# ============================================================================
# Tool Registration
# ============================================================================

def register_decoding_tools(server: Server) -> None:
    """Register transaction decoding tools with the MCP server."""
    
    @server.tool()
    async def decode_raw_transaction(raw_tx: str) -> Dict[str, Any]:
        """
        Decode a raw signed transaction.
        
        Supports Legacy (Type 0), EIP-2930 (Type 1), and EIP-1559 (Type 2).
        
        Args:
            raw_tx: Signed raw transaction in hex format
            
        Returns:
            Decoded transaction fields including signer
        """
        try:
            return decode_raw_transaction_impl(raw_tx)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def analyze_transaction(raw_tx: str) -> Dict[str, Any]:
        """
        Decode and analyze a transaction in detail.
        
        Provides decoded fields plus analysis of gas, value, and function calls.
        
        Args:
            raw_tx: Signed raw transaction in hex format
            
        Returns:
            Decoded transaction with analysis notes
        """
        try:
            return analyze_transaction_impl(raw_tx)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['decode_raw_transaction'] = decode_raw_transaction
    server._tools['analyze_transaction'] = analyze_transaction
