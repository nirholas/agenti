#!/usr/bin/env python3
"""
Ethereum Offline Transaction Signer

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.
DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
Use at your own risk. Always audit the code yourself before any use.
================================================================================

Standalone module for creating and signing Ethereum transactions offline.
Supports both legacy (Type 0) and EIP-1559 (Type 2) transactions.

Requirements:
    pip install eth-account>=0.10.0

Usage:
    python transaction.py sign --to 0xABC... --ether 1.5 --nonce 0 --key 0xaaa...
    python transaction.py sign --to 0xABC... --value 1000000 --nonce 5 --max-fee 30000000000 --key 0xaaa...
    python transaction.py decode --raw 0xabc...
    python transaction.py recover --raw 0xabc...

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import json
import sys
from typing import Dict, Any, Optional

from eth_account import Account
from eth_account.typed_transactions import TypedTransaction


# Wei conversion constants
GWEI = 10**9
ETHER = 10**18


def sign_transaction(
    to: str,
    value: int,
    nonce: int,
    gas: int = 21000,
    chain_id: int = 1,
    data: str = '0x',
    gas_price: Optional[int] = None,
    max_fee_per_gas: Optional[int] = None,
    max_priority_fee_per_gas: Optional[int] = None,
    private_key: str = None
) -> Dict[str, Any]:
    """
    Sign a transaction offline.
    
    Args:
        to: Recipient address
        value: Value in Wei
        nonce: Transaction nonce (get from blockchain)
        gas: Gas limit (21000 for simple transfer)
        chain_id: Chain ID (1 = mainnet, 5 = goerli, etc.)
        data: Transaction data (hex)
        gas_price: Gas price in Wei (for legacy transactions)
        max_fee_per_gas: Max fee per gas (for EIP-1559)
        max_priority_fee_per_gas: Max priority fee (for EIP-1559)
        private_key: Hex-encoded private key
        
    Returns:
        Dictionary with signed transaction details
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    # Build transaction dictionary
    tx = {
        'to': to,
        'value': value,
        'nonce': nonce,
        'gas': gas,
        'chainId': chain_id,
        'data': data if data else '0x'
    }
    
    # Determine transaction type
    if max_fee_per_gas is not None:
        # EIP-1559 transaction (Type 2)
        tx['maxFeePerGas'] = max_fee_per_gas
        tx['maxPriorityFeePerGas'] = max_priority_fee_per_gas or 2 * GWEI
        tx_type = 'EIP-1559 (Type 2)'
    elif gas_price is not None:
        # Legacy transaction (Type 0)
        tx['gasPrice'] = gas_price
        tx_type = 'Legacy (Type 0)'
    else:
        # Default to EIP-1559 with reasonable defaults
        tx['maxFeePerGas'] = 30 * GWEI
        tx['maxPriorityFeePerGas'] = 2 * GWEI
        tx_type = 'EIP-1559 (Type 2)'
    
    # Sign the transaction
    signed = Account.sign_transaction(tx, private_key)
    
    # Get signer address
    account = Account.from_key(private_key)
    
    return {
        'from': account.address,
        'to': to,
        'value_wei': value,
        'value_ether': value / ETHER,
        'nonce': nonce,
        'gas': gas,
        'chain_id': chain_id,
        'type': tx_type,
        'raw_transaction': '0x' + signed.raw_transaction.hex() if not signed.raw_transaction.hex().startswith('0x') else signed.raw_transaction.hex(),
        'transaction_hash': '0x' + signed.hash.hex() if not signed.hash.hex().startswith('0x') else signed.hash.hex(),
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s)
    }


def decode_transaction(raw_tx: str) -> Dict[str, Any]:
    """
    Decode a raw signed transaction.
    
    Args:
        raw_tx: Hex-encoded raw transaction
        
    Returns:
        Dictionary with decoded transaction fields
    """
    if not raw_tx.startswith('0x'):
        raw_tx = '0x' + raw_tx
    
    raw_bytes = bytes.fromhex(raw_tx[2:])
    
    # Decode based on transaction type
    if raw_bytes[0] > 0x7f:
        # Legacy transaction (RLP encoded starting with value >= 0x80)
        from rlp import decode as rlp_decode
        from rlp.sedes import (
            Binary, big_endian_int, binary
        )
        
        decoded = rlp_decode(raw_bytes)
        nonce = int.from_bytes(decoded[0], 'big') if decoded[0] else 0
        gas_price = int.from_bytes(decoded[1], 'big') if decoded[1] else 0
        gas = int.from_bytes(decoded[2], 'big') if decoded[2] else 0
        to = '0x' + decoded[3].hex() if decoded[3] else None
        value = int.from_bytes(decoded[4], 'big') if decoded[4] else 0
        data = '0x' + decoded[5].hex() if decoded[5] else '0x'
        
        return {
            'type': 'Legacy (Type 0)',
            'nonce': nonce,
            'gas_price': gas_price,
            'gas_price_gwei': gas_price / GWEI,
            'gas': gas,
            'to': to,
            'value_wei': value,
            'value_ether': value / ETHER,
            'data': data
        }
    else:
        # Typed transaction (EIP-2718)
        tx_type = raw_bytes[0]
        
        if tx_type == 2:
            # EIP-1559 transaction
            from rlp import decode as rlp_decode
            decoded = rlp_decode(raw_bytes[1:])
            
            chain_id = int.from_bytes(decoded[0], 'big') if decoded[0] else 0
            nonce = int.from_bytes(decoded[1], 'big') if decoded[1] else 0
            max_priority_fee = int.from_bytes(decoded[2], 'big') if decoded[2] else 0
            max_fee = int.from_bytes(decoded[3], 'big') if decoded[3] else 0
            gas = int.from_bytes(decoded[4], 'big') if decoded[4] else 0
            to = '0x' + decoded[5].hex() if decoded[5] else None
            value = int.from_bytes(decoded[6], 'big') if decoded[6] else 0
            data = '0x' + decoded[7].hex() if decoded[7] else '0x'
            
            return {
                'type': 'EIP-1559 (Type 2)',
                'chain_id': chain_id,
                'nonce': nonce,
                'max_priority_fee_per_gas': max_priority_fee,
                'max_priority_fee_gwei': max_priority_fee / GWEI,
                'max_fee_per_gas': max_fee,
                'max_fee_gwei': max_fee / GWEI,
                'gas': gas,
                'to': to,
                'value_wei': value,
                'value_ether': value / ETHER,
                'data': data
            }
        else:
            return {'type': f'Unknown (Type {tx_type})', 'raw': raw_tx}


def recover_transaction_signer(raw_tx: str) -> str:
    """
    Recover the signer address from a signed transaction.
    
    Args:
        raw_tx: Hex-encoded raw signed transaction
        
    Returns:
        Signer address
    """
    if not raw_tx.startswith('0x'):
        raw_tx = '0x' + raw_tx
    
    return Account.recover_transaction(raw_tx)


def cmd_sign(args):
    """Handle sign command."""
    # Calculate value in Wei
    if args.ether:
        value = int(args.ether * ETHER)
    else:
        value = int(args.value)
    
    result = sign_transaction(
        to=args.to,
        value=value,
        nonce=args.nonce,
        gas=args.gas,
        chain_id=args.chain_id,
        data=args.data,
        gas_price=args.gas_price,
        max_fee_per_gas=args.max_fee,
        max_priority_fee_per_gas=args.priority_fee,
        private_key=args.key
    )
    
    print("\n" + "=" * 80)
    print("TRANSACTION SIGNED (OFFLINE)")
    print("=" * 80)
    print(f"From:              {result['from']}")
    print(f"To:                {result['to']}")
    print(f"Value:             {result['value_ether']} ETH ({result['value_wei']} Wei)")
    print(f"Nonce:             {result['nonce']}")
    print(f"Gas Limit:         {result['gas']}")
    print(f"Chain ID:          {result['chain_id']}")
    print(f"Transaction Type:  {result['type']}")
    print(f"\nTransaction Hash:  {result['transaction_hash']}")
    print(f"\nRaw Transaction:")
    print(f"  {result['raw_transaction']}")
    print("=" * 80)
    print("IMPORTANT: This transaction is NOT broadcast!")
    print("Use the raw transaction with eth_sendRawTransaction to broadcast.")
    print("=" * 80 + "\n")
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Saved to: {args.output}")


def cmd_decode(args):
    """Handle decode command."""
    result = decode_transaction(args.raw)
    
    print("\n" + "=" * 80)
    print("TRANSACTION DECODED")
    print("=" * 80)
    
    for key, value in result.items():
        # Format key nicely
        display_key = key.replace('_', ' ').title()
        print(f"{display_key:25} {value}")
    
    print("=" * 80 + "\n")


def cmd_recover(args):
    """Handle recover command."""
    address = recover_transaction_signer(args.raw)
    
    print("\n" + "=" * 80)
    print("TRANSACTION SIGNER RECOVERED")
    print("=" * 80)
    print(f"Signer Address: {address}")
    print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Ethereum Offline Transaction Signer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Sign a simple ETH transfer (EIP-1559):
    %(prog)s sign --to 0x... --ether 1.5 --nonce 0 --key 0x...
    
  Sign with specific gas parameters:
    %(prog)s sign --to 0x... --ether 0.5 --nonce 5 \\
      --max-fee 30000000000 --priority-fee 2000000000 --key 0x...
    
  Sign legacy transaction:
    %(prog)s sign --to 0x... --value 1000000000000000000 --nonce 0 \\
      --gas-price 20000000000 --key 0x...
    
  Sign with contract data:
    %(prog)s sign --to 0x... --value 0 --nonce 0 --gas 100000 \\
      --data 0x... --key 0x...
    
  Decode a signed transaction:
    %(prog)s decode --raw 0x...
    
  Recover signer from transaction:
    %(prog)s recover --raw 0x...
    
Chain IDs:
  1   - Ethereum Mainnet
  5   - Goerli Testnet
  11155111 - Sepolia Testnet
  137 - Polygon Mainnet
  42161 - Arbitrum One
  10  - Optimism

Note: This tool creates signed transactions offline. You must broadcast
them separately using eth_sendRawTransaction on an Ethereum node.
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Sign command
    sign_parser = subparsers.add_parser('sign', help='Sign a transaction offline')
    sign_parser.add_argument('--to', required=True, help='Recipient address')
    sign_parser.add_argument('--value', default='0', help='Value in Wei')
    sign_parser.add_argument('--ether', type=float, help='Value in Ether (overrides --value)')
    sign_parser.add_argument('--nonce', type=int, required=True, help='Transaction nonce')
    sign_parser.add_argument('--gas', type=int, default=21000, help='Gas limit')
    sign_parser.add_argument('--gas-price', type=int, help='Gas price in Wei (legacy tx)')
    sign_parser.add_argument('--max-fee', type=int, help='Max fee per gas in Wei (EIP-1559)')
    sign_parser.add_argument('--priority-fee', type=int, help='Max priority fee in Wei (EIP-1559)')
    sign_parser.add_argument('--data', default='0x', help='Transaction data (hex)')
    sign_parser.add_argument('--chain-id', type=int, default=1, help='Chain ID')
    sign_parser.add_argument('--key', '-k', required=True, help='Private key')
    sign_parser.add_argument('--output', '-o', help='Save to JSON file')
    
    # Decode command
    decode_parser = subparsers.add_parser('decode', help='Decode a raw transaction')
    decode_parser.add_argument('--raw', '-r', required=True, help='Raw signed transaction (hex)')
    
    # Recover command
    recover_parser = subparsers.add_parser('recover', help='Recover transaction signer')
    recover_parser.add_argument('--raw', '-r', required=True, help='Raw signed transaction (hex)')
    
    args = parser.parse_args()
    
    if args.command == 'sign':
        cmd_sign(args)
    elif args.command == 'decode':
        cmd_decode(args)
    elif args.command == 'recover':
        cmd_recover(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




