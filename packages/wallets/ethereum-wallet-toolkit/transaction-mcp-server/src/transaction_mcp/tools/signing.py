"""
Transaction Signing Tools

Tools for signing Ethereum transactions offline.
"""

import re
from typing import Any, Dict, Optional

from eth_account import Account
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


def _validate_private_key(private_key: str) -> str:
    """Validate and normalize a private key."""
    if not private_key:
        raise ValueError("Private key is required")
    
    key = _normalize_hex(private_key)
    key_hex = key[2:]
    
    if not HEX_PATTERN.match(key_hex):
        raise ValueError("Private key must be hexadecimal")
    
    if len(key_hex) != 64:
        raise ValueError(f"Private key must be 32 bytes (64 hex chars), got {len(key_hex)}")
    
    # Validate range
    key_int = int(key_hex, 16)
    secp256k1_n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    
    if key_int == 0:
        raise ValueError("Private key cannot be zero")
    if key_int >= secp256k1_n:
        raise ValueError("Private key must be less than secp256k1 curve order")
    
    return key


def _validate_address(address: str) -> str:
    """Validate and normalize an Ethereum address."""
    if not address:
        raise ValueError("Address is required")
    
    addr = _normalize_hex(address)
    addr_hex = addr[2:]
    
    if len(addr_hex) != 40:
        raise ValueError(f"Address must be 20 bytes (40 hex chars), got {len(addr_hex)}")
    
    return to_checksum_address(addr)


# ============================================================================
# Core Functions
# ============================================================================

def sign_transaction_impl(
    to: str,
    value: int,
    nonce: int,
    gas: int,
    chain_id: int,
    private_key: str,
    data: str = "0x",
    gas_price: Optional[int] = None,
    max_fee_per_gas: Optional[int] = None,
    max_priority_fee_per_gas: Optional[int] = None
) -> Dict[str, Any]:
    """
    Sign a transaction offline.
    """
    key = _validate_private_key(private_key)
    to_addr = _validate_address(to)
    
    # Build transaction dict
    tx = {
        'to': to_addr,
        'value': value,
        'nonce': nonce,
        'gas': gas,
        'chainId': chain_id,
        'data': data if data else '0x'
    }
    
    # Add gas parameters
    if gas_price is not None:
        # Legacy transaction
        tx['gasPrice'] = gas_price
        tx_type = "Legacy (Type 0)"
    else:
        # EIP-1559 transaction
        if max_fee_per_gas is None:
            max_fee_per_gas = 30 * GWEI
        if max_priority_fee_per_gas is None:
            max_priority_fee_per_gas = 2 * GWEI
        tx['maxFeePerGas'] = max_fee_per_gas
        tx['maxPriorityFeePerGas'] = max_priority_fee_per_gas
        tx_type = "EIP-1559 (Type 2)"
    
    # Sign the transaction
    account = Account.from_key(key)
    signed = Account.sign_transaction(tx, key)
    
    # Get raw transaction
    raw_tx = '0x' + signed.raw_transaction.hex()
    tx_hash = '0x' + signed.hash.hex()
    
    return {
        'raw_transaction': raw_tx,
        'transaction_hash': tx_hash,
        'from': account.address,
        'to': to_addr,
        'value_wei': value,
        'value_eth': value / ETHER,
        'nonce': nonce,
        'gas_limit': gas,
        'chain_id': chain_id,
        'type': tx_type,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s),
        'note': "Transaction signed offline. Broadcast using eth_sendRawTransaction."
    }


def sign_transaction_object_impl(
    tx: Dict[str, Any],
    private_key: str
) -> Dict[str, Any]:
    """
    Sign a pre-built transaction object.
    """
    try:
        key = _validate_private_key(private_key)
    except ValueError as e:
        return {'error': True, 'message': str(e)}
    
    # Validate required fields
    required = ['to', 'nonce', 'gas', 'chainId']
    for field in required:
        if field not in tx:
            return {'error': True, 'message': f"Missing required field: {field}"}
    
    # Set default value if not present
    if 'value' not in tx:
        tx['value'] = 0
    
    # Validate address
    try:
        tx['to'] = _validate_address(tx['to'])
    except ValueError as e:
        return {'error': True, 'message': str(e)}
    
    # Sign
    account = Account.from_key(key)
    signed = Account.sign_transaction(tx, key)
    
    raw_tx = '0x' + signed.raw_transaction.hex()
    tx_hash = '0x' + signed.hash.hex()
    
    # Determine type
    if 'gasPrice' in tx:
        tx_type = "Legacy (Type 0)"
    elif 'maxFeePerGas' in tx:
        tx_type = "EIP-1559 (Type 2)"
    else:
        tx_type = "Unknown"
    
    return {
        'raw_transaction': raw_tx,
        'transaction_hash': tx_hash,
        'from': account.address,
        'to': tx['to'],
        'type': tx_type,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s)
    }


def recover_transaction_signer_impl(raw_tx: str) -> Dict[str, Any]:
    """
    Recover the signer address from a signed transaction.
    """
    if not raw_tx.startswith('0x'):
        raw_tx = '0x' + raw_tx
    
    try:
        address = Account.recover_transaction(raw_tx)
        return {
            'success': True,
            'signer': to_checksum_address(address),
            'raw_transaction': raw_tx
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# ============================================================================
# Tool Registration
# ============================================================================

def register_signing_tools(server: Server) -> None:
    """Register transaction signing tools with the MCP server."""
    
    @server.tool()
    async def sign_transaction(
        to: str,
        value: int,
        nonce: int,
        gas: int,
        chain_id: int,
        private_key: str,
        data: str = "0x",
        gas_price: Optional[int] = None,
        max_fee_per_gas: Optional[int] = None,
        max_priority_fee_per_gas: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Sign an Ethereum transaction offline.
        
        Creates either a legacy or EIP-1559 transaction based on gas parameters.
        
        Args:
            to: Recipient address
            value: Value in wei
            nonce: Transaction nonce
            gas: Gas limit
            chain_id: Chain ID
            private_key: Signer's private key (hex)
            data: Transaction data (hex, default "0x")
            gas_price: Gas price in wei (for legacy tx)
            max_fee_per_gas: Max fee in wei (for EIP-1559)
            max_priority_fee_per_gas: Priority fee in wei (for EIP-1559)
            
        Returns:
            Signed transaction with raw bytes and hash
        """
        try:
            return sign_transaction_impl(
                to, value, nonce, gas, chain_id, private_key,
                data, gas_price, max_fee_per_gas, max_priority_fee_per_gas
            )
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def sign_transaction_object(
        tx: Dict[str, Any],
        private_key: str
    ) -> Dict[str, Any]:
        """
        Sign a pre-built transaction object.
        
        Args:
            tx: Transaction dictionary with to, nonce, gas, chainId, etc.
            private_key: Signer's private key (hex)
            
        Returns:
            Signed transaction with raw bytes and hash
        """
        try:
            return sign_transaction_object_impl(tx, private_key)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def recover_transaction_signer(raw_tx: str) -> Dict[str, Any]:
        """
        Recover the signer address from a signed transaction.
        
        Args:
            raw_tx: Signed raw transaction in hex
            
        Returns:
            Recovered signer address
        """
        try:
            return recover_transaction_signer_impl(raw_tx)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['sign_transaction'] = sign_transaction
    server._tools['sign_transaction_object'] = sign_transaction_object
    server._tools['recover_transaction_signer'] = recover_transaction_signer
