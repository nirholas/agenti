#!/usr/bin/env python3
"""
Ethereum EIP-712 Typed Data Signer

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.
DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
Use at your own risk. Always audit the code yourself before any use.
================================================================================

Standalone module for signing and verifying EIP-712 typed structured data.
Used for signing permits, orders, and other structured messages in DeFi.

Requirements:
    pip install eth-account>=0.10.0

Usage:
    python typed_data.py sign --file permit.json --key 0xaaa...
    python typed_data.py verify --file permit.json --signature 0xabc... --address 0xABC...
    python typed_data.py hash --file permit.json
    python typed_data.py example --type permit

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import json
import sys
from typing import Dict, Any

from eth_account import Account
from eth_account.messages import encode_typed_data


# Example typed data structures
EXAMPLES = {
    'permit': {
        'types': {
            'EIP712Domain': [
                {'name': 'name', 'type': 'string'},
                {'name': 'version', 'type': 'string'},
                {'name': 'chainId', 'type': 'uint256'},
                {'name': 'verifyingContract', 'type': 'address'}
            ],
            'Permit': [
                {'name': 'owner', 'type': 'address'},
                {'name': 'spender', 'type': 'address'},
                {'name': 'value', 'type': 'uint256'},
                {'name': 'nonce', 'type': 'uint256'},
                {'name': 'deadline', 'type': 'uint256'}
            ]
        },
        'primaryType': 'Permit',
        'domain': {
            'name': 'MyToken',
            'version': '1',
            'chainId': 1,
            'verifyingContract': '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
        },
        'message': {
            'owner': '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            'spender': '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
            'value': 1000000000000000000,
            'nonce': 0,
            'deadline': 1893456000
        }
    },
    'order': {
        'types': {
            'EIP712Domain': [
                {'name': 'name', 'type': 'string'},
                {'name': 'version', 'type': 'string'},
                {'name': 'chainId', 'type': 'uint256'},
                {'name': 'verifyingContract', 'type': 'address'}
            ],
            'Order': [
                {'name': 'maker', 'type': 'address'},
                {'name': 'taker', 'type': 'address'},
                {'name': 'makerToken', 'type': 'address'},
                {'name': 'takerToken', 'type': 'address'},
                {'name': 'makerAmount', 'type': 'uint256'},
                {'name': 'takerAmount', 'type': 'uint256'},
                {'name': 'expiry', 'type': 'uint256'},
                {'name': 'salt', 'type': 'uint256'}
            ]
        },
        'primaryType': 'Order',
        'domain': {
            'name': 'Exchange',
            'version': '1.0',
            'chainId': 1,
            'verifyingContract': '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD'
        },
        'message': {
            'maker': '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            'taker': '0x0000000000000000000000000000000000000000',
            'makerToken': '0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
            'takerToken': '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
            'makerAmount': 1000000000000000000,
            'takerAmount': 3000000000,
            'expiry': 1893456000,
            'salt': 12345678901234567890
        }
    },
    'mail': {
        'types': {
            'EIP712Domain': [
                {'name': 'name', 'type': 'string'},
                {'name': 'version', 'type': 'string'},
                {'name': 'chainId', 'type': 'uint256'},
                {'name': 'verifyingContract', 'type': 'address'}
            ],
            'Person': [
                {'name': 'name', 'type': 'string'},
                {'name': 'wallet', 'type': 'address'}
            ],
            'Mail': [
                {'name': 'from', 'type': 'Person'},
                {'name': 'to', 'type': 'Person'},
                {'name': 'contents', 'type': 'string'}
            ]
        },
        'primaryType': 'Mail',
        'domain': {
            'name': 'Ether Mail',
            'version': '1',
            'chainId': 1,
            'verifyingContract': '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
        },
        'message': {
            'from': {
                'name': 'Alice',
                'wallet': '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
            },
            'to': {
                'name': 'Bob',
                'wallet': '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
            },
            'contents': 'Hello, Bob!'
        }
    }
}


def sign_typed_data(typed_data: Dict[str, Any], private_key: str) -> Dict[str, Any]:
    """
    Sign EIP-712 typed structured data.
    
    Args:
        typed_data: EIP-712 typed data dictionary with types, primaryType, domain, message
        private_key: Hex-encoded private key
        
    Returns:
        Dictionary with signature and components
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    account = Account.from_key(private_key)
    
    # Sign the typed data
    signed = account.sign_message(encode_typed_data(full_message=typed_data))
    
    # Handle different attribute names in different versions
    signature_hex = signed.signature.hex()
    if not signature_hex.startswith('0x'):
        signature_hex = '0x' + signature_hex
    
    # Get message hash (attribute name varies by version)
    message_hash_attr = getattr(signed, 'message_hash', None) or getattr(signed, 'messageHash', None)
    message_hash_hex = message_hash_attr.hex() if message_hash_attr else ''
    if message_hash_hex and not message_hash_hex.startswith('0x'):
        message_hash_hex = '0x' + message_hash_hex
    
    return {
        'signer': account.address,
        'signature': signature_hex,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s),
        'message_hash': message_hash_hex
    }


def verify_typed_data(
    typed_data: Dict[str, Any],
    signature: str,
    address: str
) -> Dict[str, Any]:
    """
    Verify a signed EIP-712 typed data signature.
    
    Args:
        typed_data: EIP-712 typed data dictionary
        signature: Hex-encoded signature
        address: Expected signer address
        
    Returns:
        Dictionary with verification result
    """
    if not signature.startswith('0x'):
        signature = '0x' + signature
    
    # Recover the signer
    recovered = Account.recover_message(
        encode_typed_data(full_message=typed_data),
        signature=signature
    )
    
    # Normalize for comparison
    expected = address.lower()
    recovered_lower = recovered.lower()
    
    return {
        'expected_address': address,
        'recovered_address': recovered,
        'is_valid': expected == recovered_lower
    }


def hash_typed_data(typed_data: Dict[str, Any]) -> str:
    """
    Calculate the hash of EIP-712 typed data (for debugging/verification).
    
    Args:
        typed_data: EIP-712 typed data dictionary
        
    Returns:
        Hex-encoded hash
    """
    encoded = encode_typed_data(full_message=typed_data)
    # The signable_message has a body which when hashed gives us the signing hash
    from eth_account._utils.signing import hash_of_signed_message
    return hash_of_signed_message(encoded).hex()


def load_typed_data(filepath: str) -> Dict[str, Any]:
    """
    Load typed data from a JSON file.
    
    Args:
        filepath: Path to JSON file
        
    Returns:
        Typed data dictionary
    """
    with open(filepath, 'r') as f:
        return json.load(f)


def cmd_sign(args):
    """Handle sign command."""
    typed_data = load_typed_data(args.file)
    result = sign_typed_data(typed_data, args.key)
    
    print("\n" + "=" * 80)
    print("EIP-712 TYPED DATA SIGNED")
    print("=" * 80)
    print(f"Primary Type:  {typed_data.get('primaryType', 'Unknown')}")
    print(f"Domain Name:   {typed_data.get('domain', {}).get('name', 'Unknown')}")
    print(f"Chain ID:      {typed_data.get('domain', {}).get('chainId', 'Unknown')}")
    print(f"\nSigner:        {result['signer']}")
    print(f"Signature:     {result['signature']}")
    
    if args.verbose:
        print(f"\nSignature Components:")
        print(f"  v: {result['v']}")
        print(f"  r: {result['r']}")
        print(f"  s: {result['s']}")
        print(f"  Message Hash: {result['message_hash']}")
    
    print("=" * 80 + "\n")
    
    if args.output:
        output_data = {
            'typed_data': typed_data,
            'signature': result
        }
        with open(args.output, 'w') as f:
            json.dump(output_data, f, indent=2)
        print(f"Saved to: {args.output}")


def cmd_verify(args):
    """Handle verify command."""
    typed_data = load_typed_data(args.file)
    result = verify_typed_data(typed_data, args.signature, args.address)
    
    print("\n" + "=" * 80)
    print("EIP-712 SIGNATURE VERIFICATION")
    print("=" * 80)
    print(f"Primary Type:      {typed_data.get('primaryType', 'Unknown')}")
    print(f"Expected Address:  {result['expected_address']}")
    print(f"Recovered Address: {result['recovered_address']}")
    print(f"Valid:             {'Yes' if result['is_valid'] else 'No'}")
    print("=" * 80 + "\n")
    
    if not result['is_valid']:
        sys.exit(1)


def cmd_hash(args):
    """Handle hash command."""
    typed_data = load_typed_data(args.file)
    
    print("\n" + "=" * 80)
    print("EIP-712 TYPED DATA HASH")
    print("=" * 80)
    print(f"Primary Type: {typed_data.get('primaryType', 'Unknown')}")
    print(f"Domain Name:  {typed_data.get('domain', {}).get('name', 'Unknown')}")
    
    try:
        hash_value = hash_typed_data(typed_data)
        print(f"\nSigning Hash: {hash_value}")
    except Exception as e:
        print(f"\nError calculating hash: {e}")
    
    print("=" * 80 + "\n")


def cmd_example(args):
    """Handle example command."""
    example_type = args.type.lower()
    
    if example_type not in EXAMPLES:
        print(f"Error: Unknown example type '{example_type}'")
        print(f"Available types: {', '.join(EXAMPLES.keys())}")
        sys.exit(1)
    
    example = EXAMPLES[example_type]
    
    print("\n" + "=" * 80)
    print(f"EIP-712 EXAMPLE: {example_type.upper()}")
    print("=" * 80)
    print(json.dumps(example, indent=2))
    print("=" * 80 + "\n")
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(example, f, indent=2)
        print(f"Saved to: {args.output}")


def main():
    parser = argparse.ArgumentParser(
        description='Ethereum EIP-712 Typed Data Signer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Sign typed data:
    %(prog)s sign --file permit.json --key 0x...
    %(prog)s sign --file order.json --key 0x... --verbose
    
  Verify a signature:
    %(prog)s verify --file permit.json --signature 0x... --address 0x...
    
  Calculate hash (for debugging):
    %(prog)s hash --file permit.json
    
  Generate example typed data:
    %(prog)s example --type permit --output permit.json
    %(prog)s example --type order --output order.json
    %(prog)s example --type mail --output mail.json
    
Available Example Types:
  permit  - ERC-20 permit (gasless approvals)
  order   - DEX order (0x-style)
  mail    - Simple structured message (EIP-712 spec example)
    
About EIP-712:
  EIP-712 defines a standard for hashing and signing typed structured data.
  It is widely used in DeFi for gasless transactions (permits), DEX orders,
  meta-transactions, and other off-chain signatures.
  
  The typed data format includes:
  - types: Type definitions for the domain and message
  - primaryType: The main type being signed
  - domain: Context (contract name, version, chainId, address)
  - message: The actual data being signed
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Sign command
    sign_parser = subparsers.add_parser('sign', help='Sign EIP-712 typed data')
    sign_parser.add_argument('--file', '-f', required=True, help='JSON file with typed data')
    sign_parser.add_argument('--key', '-k', required=True, help='Private key')
    sign_parser.add_argument('--verbose', '-v', action='store_true', help='Show v, r, s values')
    sign_parser.add_argument('--output', '-o', help='Save result to JSON file')
    
    # Verify command
    verify_parser = subparsers.add_parser('verify', help='Verify EIP-712 signature')
    verify_parser.add_argument('--file', '-f', required=True, help='JSON file with typed data')
    verify_parser.add_argument('--signature', '-s', required=True, help='Signature to verify')
    verify_parser.add_argument('--address', '-a', required=True, help='Expected signer address')
    
    # Hash command
    hash_parser = subparsers.add_parser('hash', help='Calculate typed data hash')
    hash_parser.add_argument('--file', '-f', required=True, help='JSON file with typed data')
    
    # Example command
    example_parser = subparsers.add_parser('example', help='Generate example typed data')
    example_parser.add_argument('--type', '-t', required=True, help='Example type (permit, order, mail)')
    example_parser.add_argument('--output', '-o', help='Save to JSON file')
    
    args = parser.parse_args()
    
    if args.command == 'sign':
        cmd_sign(args)
    elif args.command == 'verify':
        cmd_verify(args)
    elif args.command == 'hash':
        cmd_hash(args)
    elif args.command == 'example':
        cmd_example(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




