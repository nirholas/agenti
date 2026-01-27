#!/usr/bin/env python3
"""
Ethereum Message Signer

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.
DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
Use at your own risk. Always audit the code yourself before any use.
================================================================================

Standalone module for signing and verifying Ethereum messages.
Implements EIP-191 (personal_sign) standard message signing.

Requirements:
    pip install eth-account>=0.10.0

Usage:
    python sign.py sign --message "Hello" --key 0xaaa...
    python sign.py verify --message "Hello" --signature 0xabc... --address 0xABC...
    python sign.py recover --message "Hello" --signature 0xabc...

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import sys
from typing import Dict, Any

from eth_account import Account
from eth_account.messages import encode_defunct


def sign_message(message: str, private_key: str) -> Dict[str, Any]:
    """
    Sign a message using EIP-191 (personal_sign) format.
    
    This prefixes the message with "\\x19Ethereum Signed Message:\\n<length>"
    before signing, preventing signed messages from being used as transactions.
    
    Args:
        message: Message to sign
        private_key: Hex-encoded private key
        
    Returns:
        Dictionary with message, address, signature, and signature components
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    account = Account.from_key(private_key)
    message_encoded = encode_defunct(text=message)
    signed = account.sign_message(message_encoded)
    
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
        'message': message,
        'address': account.address,
        'signature': signature_hex,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s),
        'message_hash': message_hash_hex
    }


def verify_message(message: str, signature: str, address: str) -> Dict[str, Any]:
    """
    Verify a signed message.
    
    Args:
        message: Original message
        signature: Hex-encoded signature
        address: Expected signer address
        
    Returns:
        Dictionary with verification result
    """
    if not signature.startswith('0x'):
        signature = '0x' + signature
    
    message_encoded = encode_defunct(text=message)
    recovered_address = Account.recover_message(message_encoded, signature=signature)
    
    # Normalize addresses for comparison
    expected = address.lower()
    recovered = recovered_address.lower()
    
    return {
        'message': message,
        'expected_address': address,
        'recovered_address': recovered_address,
        'is_valid': expected == recovered
    }


def recover_signer(message: str, signature: str) -> str:
    """
    Recover the signer address from a signed message.
    
    Args:
        message: Original message
        signature: Hex-encoded signature
        
    Returns:
        Recovered signer address
    """
    if not signature.startswith('0x'):
        signature = '0x' + signature
    
    message_encoded = encode_defunct(text=message)
    return Account.recover_message(message_encoded, signature=signature)


def sign_raw_hash(message_hash: bytes, private_key: str) -> Dict[str, Any]:
    """
    Sign a raw message hash (32 bytes).
    
    WARNING: This is dangerous! Only use if you know what you're doing.
    Signing arbitrary hashes can be used to sign transactions.
    
    Args:
        message_hash: 32-byte hash to sign
        private_key: Hex-encoded private key
        
    Returns:
        Dictionary with signature components
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    account = Account.from_key(private_key)
    signed = account.signHash(message_hash)
    
    return {
        'hash': message_hash.hex() if isinstance(message_hash, bytes) else message_hash,
        'address': account.address,
        'signature': signed.signature.hex(),
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s)
    }


def cmd_sign(args):
    """Handle sign command."""
    result = sign_message(args.message, args.key)
    
    print("\n" + "=" * 70)
    print("MESSAGE SIGNED")
    print("=" * 70)
    print(f"Message:      {result['message']}")
    print(f"Signer:       {result['address']}")
    print(f"Signature:    {result['signature']}")
    
    if args.verbose:
        print(f"\nSignature Components:")
        print(f"  v: {result['v']}")
        print(f"  r: {result['r']}")
        print(f"  s: {result['s']}")
        print(f"  Message Hash: {result['message_hash']}")
    
    print("=" * 70 + "\n")


def cmd_verify(args):
    """Handle verify command."""
    result = verify_message(args.message, args.signature, args.address)
    
    print("\n" + "=" * 70)
    print("SIGNATURE VERIFICATION")
    print("=" * 70)
    print(f"Message:           {result['message']}")
    print(f"Expected Address:  {result['expected_address']}")
    print(f"Recovered Address: {result['recovered_address']}")
    print(f"Valid:             {'Yes' if result['is_valid'] else 'No'}")
    print("=" * 70 + "\n")
    
    if not result['is_valid']:
        sys.exit(1)


def cmd_recover(args):
    """Handle recover command."""
    address = recover_signer(args.message, args.signature)
    
    print("\n" + "=" * 70)
    print("SIGNER RECOVERED")
    print("=" * 70)
    print(f"Message:   {args.message}")
    print(f"Signature: {args.signature}")
    print(f"Signer:    {address}")
    print("=" * 70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Ethereum Message Signer and Verifier',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Sign a message:
    %(prog)s sign --message "Hello, Ethereum!" --key 0x...
    %(prog)s sign --message "Hello" --key 0x... --verbose  # Show v, r, s
    
  Verify a signature:
    %(prog)s verify --message "Hello" --signature 0x... --address 0x...
    
  Recover signer from signature:
    %(prog)s recover --message "Hello" --signature 0x...
    
About EIP-191:
  This tool uses the "personal_sign" standard (EIP-191), which prefixes
  messages with "\\x19Ethereum Signed Message:\\n<length>" before signing.
  This prevents signed messages from being used as transaction signatures.
  
  The same message and key will always produce the same signature.
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Sign command
    sign_parser = subparsers.add_parser('sign', help='Sign a message')
    sign_parser.add_argument('--message', '-m', required=True, help='Message to sign')
    sign_parser.add_argument('--key', '-k', required=True, help='Private key')
    sign_parser.add_argument('--verbose', '-v', action='store_true', help='Show v, r, s values')
    
    # Verify command
    verify_parser = subparsers.add_parser('verify', help='Verify a signature')
    verify_parser.add_argument('--message', '-m', required=True, help='Original message')
    verify_parser.add_argument('--signature', '-s', required=True, help='Signature to verify')
    verify_parser.add_argument('--address', '-a', required=True, help='Expected signer address')
    
    # Recover command
    recover_parser = subparsers.add_parser('recover', help='Recover signer from signature')
    recover_parser.add_argument('--message', '-m', required=True, help='Original message')
    recover_parser.add_argument('--signature', '-s', required=True, help='Signature')
    
    args = parser.parse_args()
    
    if args.command == 'sign':
        cmd_sign(args)
    elif args.command == 'verify':
        cmd_verify(args)
    elif args.command == 'recover':
        cmd_recover(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




