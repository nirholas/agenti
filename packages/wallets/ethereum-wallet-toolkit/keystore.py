#!/usr/bin/env python3
"""
Ethereum Keystore Manager

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.
DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
Use at your own risk. Always audit the code yourself before any use.
================================================================================

Standalone module for encrypting and decrypting Ethereum keystores.
Supports Web3 Secret Storage Definition (V3) format compatible with
all major Ethereum wallets (MetaMask, Geth, etc.).

Requirements:
    pip install eth-account>=0.10.0

Usage:
    python keystore.py encrypt --key 0xaaa... --output wallet.json
    python keystore.py decrypt --file wallet.json
    python keystore.py info --file wallet.json

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import json
import sys
import getpass
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from eth_account import Account


def encrypt_keystore(
    private_key: str,
    password: str,
    kdf: str = 'scrypt',
    iterations: Optional[int] = None
) -> Dict[str, Any]:
    """
    Encrypt a private key to keystore format.
    
    Args:
        private_key: Hex-encoded private key
        password: Encryption password
        kdf: Key derivation function ('scrypt' or 'pbkdf2')
        iterations: Custom iteration count for KDF
        
    Returns:
        Keystore dictionary in Web3 Secret Storage format
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    # Build extra KDF parameters if custom iterations specified
    extra_args = {}
    if iterations:
        if kdf == 'scrypt':
            extra_args['kdf'] = 'scrypt'
            # scrypt uses 'n' parameter for work factor
        else:
            extra_args['kdf'] = 'pbkdf2'
            extra_args['iterations'] = iterations
    else:
        extra_args['kdf'] = kdf
    
    keystore = Account.encrypt(private_key, password, **extra_args)
    return keystore


def decrypt_keystore(keystore: Dict[str, Any], password: str) -> str:
    """
    Decrypt a keystore to recover the private key.
    
    Args:
        keystore: Keystore dictionary
        password: Decryption password
        
    Returns:
        Hex-encoded private key
    """
    private_key = Account.decrypt(keystore, password)
    return '0x' + private_key.hex()


def save_keystore(
    keystore: Dict[str, Any],
    filepath: Optional[str] = None
) -> str:
    """
    Save keystore to file with standard naming convention.
    
    Args:
        keystore: Keystore dictionary
        filepath: Optional custom file path
        
    Returns:
        Path to saved file
    """
    if filepath:
        path = Path(filepath)
    else:
        # Standard keystore filename: UTC--<timestamp>--<address>
        timestamp = datetime.utcnow().strftime('%Y-%m-%dT%H-%M-%S.%f')[:-3] + 'Z'
        address = keystore['address']
        filename = f"UTC--{timestamp}--{address}"
        path = Path(filename)
    
    with open(path, 'w') as f:
        json.dump(keystore, f, indent=2)
    
    return str(path)


def load_keystore(filepath: str) -> Dict[str, Any]:
    """
    Load keystore from file.
    
    Args:
        filepath: Path to keystore file
        
    Returns:
        Keystore dictionary
    """
    with open(filepath, 'r') as f:
        return json.load(f)


def get_keystore_info(keystore: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract metadata from keystore without decryption.
    
    Args:
        keystore: Keystore dictionary
        
    Returns:
        Dictionary with keystore metadata
    """
    crypto = keystore.get('crypto', keystore.get('Crypto', {}))
    kdf_params = crypto.get('kdfparams', {})
    
    info = {
        'address': '0x' + keystore.get('address', ''),
        'version': keystore.get('version', 'unknown'),
        'id': keystore.get('id', 'unknown'),
        'kdf': crypto.get('kdf', 'unknown'),
        'cipher': crypto.get('cipher', 'unknown'),
    }
    
    # Add KDF-specific parameters
    if crypto.get('kdf') == 'scrypt':
        info['scrypt_n'] = kdf_params.get('n')
        info['scrypt_r'] = kdf_params.get('r')
        info['scrypt_p'] = kdf_params.get('p')
        info['dklen'] = kdf_params.get('dklen')
    elif crypto.get('kdf') == 'pbkdf2':
        info['pbkdf2_c'] = kdf_params.get('c')
        info['pbkdf2_prf'] = kdf_params.get('prf')
        info['dklen'] = kdf_params.get('dklen')
    
    return info


def cmd_encrypt(args):
    """Handle encrypt command."""
    # Get password securely if not provided
    if args.password:
        password = args.password
    else:
        password = getpass.getpass("Enter password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: Passwords do not match")
            sys.exit(1)
    
    keystore = encrypt_keystore(
        args.key,
        password,
        kdf=args.kdf,
        iterations=args.iterations
    )
    
    # Get address for display
    address = '0x' + keystore['address']
    
    if args.output:
        filepath = save_keystore(keystore, args.output)
    else:
        filepath = save_keystore(keystore)
    
    print("\n" + "=" * 60)
    print("KEYSTORE CREATED")
    print("=" * 60)
    print(f"Address:  {address}")
    print(f"File:     {filepath}")
    print(f"KDF:      {args.kdf}")
    print("=" * 60)
    print("IMPORTANT: Remember your password! Without it, funds are")
    print("           permanently inaccessible.")
    print("=" * 60 + "\n")


def cmd_decrypt(args):
    """Handle decrypt command."""
    if not args.file:
        print("Error: --file is required")
        sys.exit(1)
    
    # Get password securely if not provided
    if args.password:
        password = args.password
    else:
        password = getpass.getpass("Enter password: ")
    
    try:
        keystore = load_keystore(args.file)
        private_key = decrypt_keystore(keystore, password)
        account = Account.from_key(private_key)
        
        print("\n" + "=" * 60)
        print("KEYSTORE DECRYPTED")
        print("=" * 60)
        print(f"Address:     {account.address}")
        print(f"Private Key: {private_key}")
        print("=" * 60)
        print("WARNING: Your private key is now visible!")
        print("=" * 60 + "\n")
        
    except ValueError as e:
        print(f"Error: Failed to decrypt keystore - {e}")
        print("Check that the password is correct.")
        sys.exit(1)


def cmd_info(args):
    """Handle info command."""
    if not args.file:
        print("Error: --file is required")
        sys.exit(1)
    
    keystore = load_keystore(args.file)
    info = get_keystore_info(keystore)
    
    print("\n" + "=" * 60)
    print("KEYSTORE INFO")
    print("=" * 60)
    print(f"Address:   {info['address']}")
    print(f"Version:   {info['version']}")
    print(f"UUID:      {info['id']}")
    print(f"KDF:       {info['kdf']}")
    print(f"Cipher:    {info['cipher']}")
    
    if info['kdf'] == 'scrypt':
        print(f"Scrypt N:  {info.get('scrypt_n')}")
        print(f"Scrypt r:  {info.get('scrypt_r')}")
        print(f"Scrypt p:  {info.get('scrypt_p')}")
    elif info['kdf'] == 'pbkdf2':
        print(f"PBKDF2 c:  {info.get('pbkdf2_c')}")
        print(f"PBKDF2 prf: {info.get('pbkdf2_prf')}")
    
    print(f"DKLen:     {info.get('dklen')}")
    print("=" * 60 + "\n")


def cmd_change_password(args):
    """Handle change-password command."""
    if not args.file:
        print("Error: --file is required")
        sys.exit(1)
    
    # Get old password
    if args.old_password:
        old_password = args.old_password
    else:
        old_password = getpass.getpass("Enter current password: ")
    
    # Decrypt with old password
    try:
        keystore = load_keystore(args.file)
        private_key = decrypt_keystore(keystore, old_password)
    except ValueError:
        print("Error: Incorrect password")
        sys.exit(1)
    
    # Get new password
    if args.new_password:
        new_password = args.new_password
    else:
        new_password = getpass.getpass("Enter new password: ")
        confirm = getpass.getpass("Confirm new password: ")
        if new_password != confirm:
            print("Error: Passwords do not match")
            sys.exit(1)
    
    # Re-encrypt with new password
    new_keystore = encrypt_keystore(private_key, new_password, kdf=args.kdf)
    
    # Save to output or original file
    output_path = args.output or args.file
    save_keystore(new_keystore, output_path)
    
    print("\n" + "=" * 60)
    print("PASSWORD CHANGED")
    print("=" * 60)
    print(f"Address: 0x{new_keystore['address']}")
    print(f"File:    {output_path}")
    print("=" * 60 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Ethereum Keystore Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Encrypt private key to keystore:
    %(prog)s encrypt --key 0x... --password secret --output wallet.json
    %(prog)s encrypt --key 0x... --kdf pbkdf2  # Use PBKDF2 instead of scrypt
    
  Decrypt keystore:
    %(prog)s decrypt --file wallet.json --password secret
    %(prog)s decrypt --file wallet.json  # Will prompt for password
    
  View keystore info (no password needed):
    %(prog)s info --file wallet.json
    
  Change keystore password:
    %(prog)s change-password --file wallet.json
    
Security Notes:
  - Use a strong, unique password for each keystore
  - Never share your keystore file AND password together
  - Keep backups of your keystore in secure locations
  - Prefer scrypt over pbkdf2 for better security
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Encrypt command
    enc_parser = subparsers.add_parser('encrypt', help='Encrypt private key to keystore')
    enc_parser.add_argument('--key', '-k', required=True, help='Private key to encrypt')
    enc_parser.add_argument('--password', '-p', help='Keystore password (or will prompt)')
    enc_parser.add_argument('--output', '-o', help='Output file path')
    enc_parser.add_argument('--kdf', default='scrypt', choices=['scrypt', 'pbkdf2'], help='KDF algorithm')
    enc_parser.add_argument('--iterations', type=int, help='Custom KDF iterations')
    
    # Decrypt command
    dec_parser = subparsers.add_parser('decrypt', help='Decrypt keystore file')
    dec_parser.add_argument('--file', '-f', required=True, help='Keystore file path')
    dec_parser.add_argument('--password', '-p', help='Keystore password (or will prompt)')
    
    # Info command
    info_parser = subparsers.add_parser('info', help='View keystore info without decryption')
    info_parser.add_argument('--file', '-f', required=True, help='Keystore file path')
    
    # Change password command
    change_parser = subparsers.add_parser('change-password', help='Change keystore password')
    change_parser.add_argument('--file', '-f', required=True, help='Keystore file path')
    change_parser.add_argument('--old-password', help='Current password (or will prompt)')
    change_parser.add_argument('--new-password', help='New password (or will prompt)')
    change_parser.add_argument('--output', '-o', help='Output file (default: overwrite original)')
    change_parser.add_argument('--kdf', default='scrypt', choices=['scrypt', 'pbkdf2'], help='KDF for new keystore')
    
    args = parser.parse_args()
    
    if args.command == 'encrypt':
        cmd_encrypt(args)
    elif args.command == 'decrypt':
        cmd_decrypt(args)
    elif args.command == 'info':
        cmd_info(args)
    elif args.command == 'change-password':
        cmd_change_password(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




