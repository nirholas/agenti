#!/usr/bin/env python3
"""
Ethereum Address and Key Validator

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.
DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
Use at your own risk. Always audit the code yourself before any use.
================================================================================

Standalone module for validating Ethereum addresses and private keys.
Includes checksum validation (EIP-55), key validation, and address derivation.

Requirements:
    pip install eth-account>=0.10.0

Usage:
    python validate.py address --address 0xABC...
    python validate.py key --key 0xaaa...
    python validate.py checksum --address 0xabc...
    python validate.py derive --key 0xaaa...

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import sys
import re
from typing import Dict, Any, Optional

from eth_account import Account
from eth_utils import is_checksum_address, to_checksum_address


def validate_address(address: str) -> Dict[str, Any]:
    """
    Validate an Ethereum address.
    
    Args:
        address: Address to validate
        
    Returns:
        Dictionary with validation results
    """
    result = {
        'input': address,
        'is_valid_format': False,
        'is_checksum_valid': False,
        'checksum_address': None,
        'errors': []
    }
    
    # Check basic format
    if not address:
        result['errors'].append('Address is empty')
        return result
    
    # Remove 0x prefix for length check
    addr_no_prefix = address[2:] if address.startswith('0x') else address
    
    # Check length
    if len(addr_no_prefix) != 40:
        result['errors'].append(f'Invalid length: {len(addr_no_prefix)} chars (expected 40)')
        return result
    
    # Check hex characters
    if not re.match(r'^[0-9a-fA-F]{40}$', addr_no_prefix):
        result['errors'].append('Invalid characters: must be hexadecimal (0-9, a-f, A-F)')
        return result
    
    result['is_valid_format'] = True
    
    # Normalize to 0x prefix
    normalized = '0x' + addr_no_prefix.lower()
    
    # Calculate checksum address
    try:
        checksum = to_checksum_address(normalized)
        result['checksum_address'] = checksum
        
        # Check if original had valid checksum
        if address.startswith('0x'):
            # Has 0x prefix, check if it matches checksum
            if address == checksum:
                result['is_checksum_valid'] = True
            elif address.lower() == checksum.lower():
                # Valid format but not checksummed
                result['errors'].append('Valid address but not checksummed (EIP-55)')
        else:
            # No 0x prefix
            if address == checksum[2:]:
                result['is_checksum_valid'] = True
            elif address.lower() == checksum[2:].lower():
                result['errors'].append('Valid address but missing 0x prefix and not checksummed')
                
    except Exception as e:
        result['errors'].append(f'Checksum calculation failed: {e}')
    
    return result


def validate_private_key(private_key: str) -> Dict[str, Any]:
    """
    Validate an Ethereum private key.
    
    Args:
        private_key: Private key to validate
        
    Returns:
        Dictionary with validation results and derived address
    """
    result = {
        'input': private_key[:10] + '...' if len(private_key) > 10 else private_key,
        'is_valid': False,
        'derived_address': None,
        'public_key': None,
        'errors': []
    }
    
    if not private_key:
        result['errors'].append('Private key is empty')
        return result
    
    # Remove 0x prefix for validation
    key_no_prefix = private_key[2:] if private_key.startswith('0x') else private_key
    
    # Check length
    if len(key_no_prefix) != 64:
        result['errors'].append(f'Invalid length: {len(key_no_prefix)} chars (expected 64)')
        return result
    
    # Check hex characters
    if not re.match(r'^[0-9a-fA-F]{64}$', key_no_prefix):
        result['errors'].append('Invalid characters: must be hexadecimal')
        return result
    
    # Try to create account from key
    try:
        key_with_prefix = '0x' + key_no_prefix
        account = Account.from_key(key_with_prefix)
        
        result['is_valid'] = True
        result['derived_address'] = account.address
        # Get public key using the correct method
        private_key_obj = account._key_obj
        result['public_key'] = private_key_obj.public_key.to_hex()
        
    except Exception as e:
        result['errors'].append(f'Key validation failed: {e}')
    
    return result


def to_checksum(address: str) -> str:
    """
    Convert an address to EIP-55 checksum format.
    
    Args:
        address: Address to convert
        
    Returns:
        Checksummed address
    """
    addr_no_prefix = address[2:] if address.startswith('0x') else address
    return to_checksum_address('0x' + addr_no_prefix.lower())


def derive_address_from_key(private_key: str) -> Dict[str, Any]:
    """
    Derive address and public key from private key.
    
    Args:
        private_key: Hex-encoded private key
        
    Returns:
        Dictionary with address and public key
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    account = Account.from_key(private_key)
    
    # Get public key using the correct method
    private_key_obj = account._key_obj
    public_key_hex = private_key_obj.public_key.to_hex()
    
    return {
        'address': account.address,
        'public_key': public_key_hex
    }


def cmd_address(args):
    """Handle address validation command."""
    result = validate_address(args.address)
    
    print("\n" + "=" * 60)
    print("ADDRESS VALIDATION")
    print("=" * 60)
    print(f"Input:          {result['input']}")
    print(f"Valid Format:   {'Yes' if result['is_valid_format'] else 'No'}")
    print(f"Valid Checksum: {'Yes' if result['is_checksum_valid'] else 'No'}")
    
    if result['checksum_address']:
        print(f"Checksum Addr:  {result['checksum_address']}")
    
    if result['errors']:
        print(f"\nIssues:")
        for error in result['errors']:
            print(f"  - {error}")
    
    print("=" * 60 + "\n")
    
    if not result['is_valid_format']:
        sys.exit(1)


def cmd_key(args):
    """Handle key validation command."""
    result = validate_private_key(args.key)
    
    print("\n" + "=" * 60)
    print("PRIVATE KEY VALIDATION")
    print("=" * 60)
    print(f"Valid:           {'Yes' if result['is_valid'] else 'No'}")
    
    if result['derived_address']:
        print(f"Derived Address: {result['derived_address']}")
    
    if args.verbose and result['public_key']:
        print(f"Public Key:      {result['public_key']}")
    
    if result['errors']:
        print(f"\nErrors:")
        for error in result['errors']:
            print(f"  - {error}")
    
    print("=" * 60 + "\n")
    
    if not result['is_valid']:
        sys.exit(1)


def cmd_checksum(args):
    """Handle checksum conversion command."""
    try:
        checksum = to_checksum(args.address)
        print("\n" + "=" * 60)
        print("CHECKSUM CONVERSION (EIP-55)")
        print("=" * 60)
        print(f"Input:    {args.address}")
        print(f"Checksum: {checksum}")
        print("=" * 60 + "\n")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_derive(args):
    """Handle address derivation command."""
    try:
        result = derive_address_from_key(args.key)
        print("\n" + "=" * 60)
        print("ADDRESS DERIVATION")
        print("=" * 60)
        print(f"Address:    {result['address']}")
        print(f"Public Key: {result['public_key']}")
        print("=" * 60 + "\n")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_batch(args):
    """Handle batch validation command."""
    addresses = []
    
    if args.file:
        with open(args.file, 'r') as f:
            addresses = [line.strip() for line in f if line.strip()]
    else:
        print("Enter addresses (one per line, empty line to finish):")
        while True:
            line = input().strip()
            if not line:
                break
            addresses.append(line)
    
    print("\n" + "=" * 80)
    print("BATCH ADDRESS VALIDATION")
    print("=" * 80)
    
    valid_count = 0
    invalid_count = 0
    
    for addr in addresses:
        result = validate_address(addr)
        status = "VALID" if result['is_valid_format'] else "INVALID"
        checksum_status = "checksum OK" if result['is_checksum_valid'] else "no checksum"
        
        if result['is_valid_format']:
            valid_count += 1
            print(f"  {status:7} | {checksum_status:12} | {addr}")
        else:
            invalid_count += 1
            error = result['errors'][0] if result['errors'] else 'Unknown error'
            print(f"  {status:7} | {error:12} | {addr}")
    
    print("-" * 80)
    print(f"Total: {len(addresses)} | Valid: {valid_count} | Invalid: {invalid_count}")
    print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Ethereum Address and Key Validator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Validate an address:
    %(prog)s address --address 0xABCDabcdABCDabcdABCDabcdABCDabcdABCDabcd
    %(prog)s address --address abcdabcdabcdabcdabcdabcdabcdabcdabcdabcd
    
  Validate a private key:
    %(prog)s key --key 0xaaa...  # Use your own key
    %(prog)s key --key 0xaaa... --verbose  # Show public key
    
  Convert to checksum format:
    %(prog)s checksum --address 0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd
    
  Derive address from private key:
    %(prog)s derive --key 0xaaa...  # Use your own key
    
  Batch validate addresses:
    %(prog)s batch --file addresses.txt
    %(prog)s batch  # Interactive input
    
About Checksums (EIP-55):
  EIP-55 defines a checksum encoding using mixed-case letters in addresses.
  This helps catch typos without adding extra characters to the address.
  
  Example:
    Without checksum: 0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd
    With checksum:    0xABCDabcdABCDabcdABCDabcdABCDabcdABCDabcd
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Address validation
    addr_parser = subparsers.add_parser('address', help='Validate an Ethereum address')
    addr_parser.add_argument('--address', '-a', required=True, help='Address to validate')
    
    # Key validation
    key_parser = subparsers.add_parser('key', help='Validate a private key')
    key_parser.add_argument('--key', '-k', required=True, help='Private key to validate')
    key_parser.add_argument('--verbose', '-v', action='store_true', help='Show public key')
    
    # Checksum conversion
    check_parser = subparsers.add_parser('checksum', help='Convert to checksum format')
    check_parser.add_argument('--address', '-a', required=True, help='Address to convert')
    
    # Address derivation
    derive_parser = subparsers.add_parser('derive', help='Derive address from private key')
    derive_parser.add_argument('--key', '-k', required=True, help='Private key')
    
    # Batch validation
    batch_parser = subparsers.add_parser('batch', help='Validate multiple addresses')
    batch_parser.add_argument('--file', '-f', help='File with addresses (one per line)')
    
    args = parser.parse_args()
    
    if args.command == 'address':
        cmd_address(args)
    elif args.command == 'key':
        cmd_key(args)
    elif args.command == 'checksum':
        cmd_checksum(args)
    elif args.command == 'derive':
        cmd_derive(args)
    elif args.command == 'batch':
        cmd_batch(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




