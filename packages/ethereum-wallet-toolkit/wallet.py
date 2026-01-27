#!/usr/bin/env python3
"""
Ethereum Wallet Generator and Restorer

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.
DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
Use at your own risk. Always audit the code yourself before any use.
================================================================================

Standalone module for wallet generation and restoration.
Supports both random key generation and BIP39 mnemonic-based HD wallets.

Requirements:
    pip install eth-account>=0.10.0

Usage:
    python wallet.py generate
    python wallet.py generate --mnemonic --words 24
    python wallet.py restore --mnemonic word1 word2 word3 ...
    python wallet.py restore --key 0xaaa...
    python wallet.py derive --mnemonic word1 word2 ... --count 10

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import json
import secrets
import sys
from dataclasses import dataclass, asdict
from typing import Optional, List

from eth_account import Account
from eth_account.hdaccount import generate_mnemonic, ETHEREUM_DEFAULT_PATH

# Enable HD wallet features
Account.enable_unaudited_hdwallet_features()


# Constants
DEFAULT_DERIVATION_PATH = ETHEREUM_DEFAULT_PATH  # m/44'/60'/0'/0/0


@dataclass
class WalletResult:
    """Result of wallet generation or restoration."""
    address: str
    private_key: str
    public_key: str
    mnemonic: Optional[str] = None
    derivation_path: Optional[str] = None
    passphrase_used: bool = False


def generate_wallet(
    use_mnemonic: bool = False,
    word_count: int = 12,
    language: str = 'english',
    passphrase: str = '',
    derivation_path: Optional[str] = None
) -> WalletResult:
    """
    Generate a new Ethereum wallet.
    
    Args:
        use_mnemonic: If True, generate with BIP39 mnemonic
        word_count: Number of mnemonic words (12, 15, 18, 21, 24)
        language: Mnemonic language
        passphrase: Optional BIP39 passphrase
        derivation_path: HD derivation path
        
    Returns:
        WalletResult with wallet details
    """
    if use_mnemonic:
        # generate_mnemonic takes num_words directly
        mnemonic = generate_mnemonic(word_count, language)
        path = derivation_path or DEFAULT_DERIVATION_PATH
        
        account = Account.from_mnemonic(mnemonic, passphrase=passphrase, account_path=path)
        
        # Get public key using the correct method
        private_key_obj = account._key_obj
        public_key_hex = private_key_obj.public_key.to_hex()
        
        return WalletResult(
            address=account.address,
            private_key=account.key.hex(),
            public_key=public_key_hex,
            mnemonic=mnemonic,
            derivation_path=path,
            passphrase_used=bool(passphrase)
        )
    else:
        # Simple random key generation
        private_key = '0x' + secrets.token_hex(32)
        account = Account.from_key(private_key)
        
        # Get public key
        private_key_obj = account._key_obj
        public_key_hex = private_key_obj.public_key.to_hex()
        
        return WalletResult(
            address=account.address,
            private_key=private_key,
            public_key=public_key_hex
        )


def restore_from_mnemonic(
    mnemonic: str,
    passphrase: str = '',
    derivation_path: Optional[str] = None
) -> WalletResult:
    """
    Restore wallet from BIP39 mnemonic.
    
    Args:
        mnemonic: BIP39 mnemonic phrase
        passphrase: Optional BIP39 passphrase
        derivation_path: HD derivation path
        
    Returns:
        WalletResult with restored wallet details
    """
    path = derivation_path or DEFAULT_DERIVATION_PATH
    account = Account.from_mnemonic(mnemonic, passphrase=passphrase, account_path=path)
    
    # Get public key
    private_key_obj = account._key_obj
    public_key_hex = private_key_obj.public_key.to_hex()
    
    return WalletResult(
        address=account.address,
        private_key=account.key.hex(),
        public_key=public_key_hex,
        mnemonic=mnemonic,
        derivation_path=path,
        passphrase_used=bool(passphrase)
    )


def restore_from_private_key(private_key: str) -> WalletResult:
    """
    Restore wallet from private key.
    
    Args:
        private_key: Hex-encoded private key
        
    Returns:
        WalletResult with restored wallet details
    """
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
        
    account = Account.from_key(private_key)
    
    # Get public key
    private_key_obj = account._key_obj
    public_key_hex = private_key_obj.public_key.to_hex()
    
    return WalletResult(
        address=account.address,
        private_key=private_key,
        public_key=public_key_hex
    )


def derive_accounts(
    mnemonic: str,
    count: int = 10,
    passphrase: str = '',
    base_path: str = "m/44'/60'/0'/0"
) -> List[dict]:
    """
    Derive multiple accounts from a mnemonic.
    
    Args:
        mnemonic: BIP39 mnemonic phrase
        count: Number of accounts to derive
        passphrase: Optional BIP39 passphrase
        base_path: Base derivation path
        
    Returns:
        List of account dictionaries with index, path, address, private_key
    """
    accounts = []
    
    for i in range(count):
        path = f"{base_path}/{i}"
        account = Account.from_mnemonic(mnemonic, passphrase=passphrase, account_path=path)
        
        accounts.append({
            'index': i,
            'path': path,
            'address': account.address,
            'private_key': account.key.hex()
        })
    
    return accounts


def cmd_generate(args):
    """Handle generate command."""
    result = generate_wallet(
        use_mnemonic=args.mnemonic,
        word_count=args.words,
        passphrase=args.passphrase or '',
        derivation_path=args.path
    )
    
    print("\n" + "=" * 60)
    print("NEW WALLET GENERATED")
    print("=" * 60)
    print(f"Address:     {result.address}")
    print(f"Private Key: {result.private_key}")
    print(f"Public Key:  {result.public_key}")
    
    if result.mnemonic:
        print(f"\nMnemonic ({len(result.mnemonic.split())} words):")
        print(f"  {result.mnemonic}")
        print(f"\nDerivation Path: {result.derivation_path}")
        if result.passphrase_used:
            print("Passphrase: [used]")
    
    print("=" * 60)
    print("IMPORTANT: Store your private key and mnemonic securely!")
    print("=" * 60 + "\n")
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(asdict(result), f, indent=2)
        print(f"Saved to: {args.output}")


def cmd_restore(args):
    """Handle restore command."""
    if args.mnemonic:
        mnemonic = ' '.join(args.mnemonic)
        result = restore_from_mnemonic(
            mnemonic,
            passphrase=args.passphrase or '',
            derivation_path=args.path
        )
    elif args.key:
        result = restore_from_private_key(args.key)
    else:
        print("Error: Provide --mnemonic or --key")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("WALLET RESTORED")
    print("=" * 60)
    print(f"Address:     {result.address}")
    print(f"Private Key: {result.private_key}")
    print(f"Public Key:  {result.public_key}")
    
    if result.mnemonic:
        print(f"\nDerivation Path: {result.derivation_path}")
    
    print("=" * 60 + "\n")


def cmd_derive(args):
    """Handle derive command."""
    mnemonic = ' '.join(args.mnemonic)
    base_path = args.base_path or "m/44'/60'/0'/0"
    
    accounts = derive_accounts(
        mnemonic,
        count=args.count,
        passphrase=args.passphrase or '',
        base_path=base_path
    )
    
    print(f"\nDerived {len(accounts)} accounts from mnemonic")
    print(f"Base Path: {base_path}")
    print("-" * 80)
    
    for acc in accounts:
        if args.verbose:
            print(f"[{acc['index']:3d}] {acc['path']}")
            print(f"      Address: {acc['address']}")
            print(f"      Key:     {acc['private_key']}")
        else:
            print(f"[{acc['index']:3d}] {acc['address']}")
    
    print("-" * 80)


def main():
    parser = argparse.ArgumentParser(
        description='Ethereum Wallet Generator and Restorer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Generate random wallet:
    %(prog)s generate
    
  Generate with 24-word mnemonic:
    %(prog)s generate --mnemonic --words 24
    
  Restore from mnemonic:
    %(prog)s restore --mnemonic word1 word2 word3 ...
    
  Restore from private key:
    %(prog)s restore --key 0x...
    
  Derive 10 accounts:
    %(prog)s derive --mnemonic word1 word2 ... --count 10 --verbose
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Generate command
    gen_parser = subparsers.add_parser('generate', help='Generate new wallet')
    gen_parser.add_argument('--mnemonic', '-m', action='store_true', help='Generate with BIP39 mnemonic')
    gen_parser.add_argument('--words', '-w', type=int, default=12, choices=[12, 15, 18, 21, 24], help='Mnemonic word count')
    gen_parser.add_argument('--passphrase', help='Optional mnemonic passphrase')
    gen_parser.add_argument('--path', help='HD derivation path')
    gen_parser.add_argument('--output', '-o', help='Save to JSON file')
    
    # Restore command
    restore_parser = subparsers.add_parser('restore', help='Restore wallet')
    restore_parser.add_argument('--mnemonic', '-m', nargs='+', help='BIP39 mnemonic words')
    restore_parser.add_argument('--key', '-k', help='Private key')
    restore_parser.add_argument('--passphrase', help='Mnemonic passphrase')
    restore_parser.add_argument('--path', help='HD derivation path')
    
    # Derive command
    derive_parser = subparsers.add_parser('derive', help='Derive multiple accounts')
    derive_parser.add_argument('--mnemonic', '-m', nargs='+', required=True, help='BIP39 mnemonic')
    derive_parser.add_argument('--count', '-c', type=int, default=10, help='Number of accounts')
    derive_parser.add_argument('--passphrase', help='Mnemonic passphrase')
    derive_parser.add_argument('--base-path', help="Base HD path (default: m/44'/60'/0'/0)")
    derive_parser.add_argument('--verbose', '-v', action='store_true', help='Show private keys')
    
    args = parser.parse_args()
    
    if args.command == 'generate':
        cmd_generate(args)
    elif args.command == 'restore':
        cmd_restore(args)
    elif args.command == 'derive':
        cmd_derive(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




