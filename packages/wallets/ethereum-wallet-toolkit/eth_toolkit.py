#!/usr/bin/env python3
"""
Ethereum Wallet Toolkit

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.

DO NOT USE WITH REAL FUNDS. DO NOT USE IN PRODUCTION.

The author(s) accept NO LIABILITY for any damages, losses, or consequences
arising from the use of this software. By using this software, you acknowledge
that you are solely responsible for your actions and any outcomes.

This software is provided "AS IS" without warranty of any kind. The author(s)
make no guarantees about the security, correctness, or fitness for any purpose.

ALWAYS:
- Audit the code yourself before any use
- Use hardware wallets for real funds
- Never use generated keys for real assets
- Understand that vanity address generation has inherent risks
================================================================================

A comprehensive toolkit for Ethereum wallet operations:
- Generate random wallets
- Generate vanity addresses (prefix/suffix/pattern matching)
- Create/restore from BIP39 mnemonics
- Sign and verify messages
- Validate addresses and keys

Uses official Ethereum Foundation libraries (eth-account).

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from multiprocessing import cpu_count
from typing import Optional

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_account.hdaccount import ETHEREUM_DEFAULT_PATH
from eth_keys import keys
import rlp


# Enable HD wallet features
Account.enable_unaudited_hdwallet_features()


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class WalletResult:
    """Result of wallet generation."""
    address: str
    private_key: str
    mnemonic: Optional[str] = None
    derivation_path: Optional[str] = None


@dataclass
class VanityResult(WalletResult):
    """Result of vanity address generation."""
    attempts: int = 0
    time_seconds: float = 0.0


# ============================================================================
# Validation Functions
# ============================================================================

def is_valid_hex_pattern(pattern: str) -> bool:
    """Check if pattern contains only valid hex characters."""
    return bool(re.match(r'^[0-9a-fA-F]*$', pattern))


def is_valid_address(address: str) -> bool:
    """Validate Ethereum address format."""
    if not address.startswith('0x'):
        return False
    if len(address) != 42:
        return False
    return is_valid_hex_pattern(address[2:])


def is_valid_private_key(key: str) -> bool:
    """Validate private key format."""
    key = key[2:] if key.startswith('0x') else key
    if len(key) != 64:
        return False
    return is_valid_hex_pattern(key)


def validate_public_key(address: str, private_key: str) -> bool:
    """Verify that a private key corresponds to an address."""
    try:
        account = Account.from_key(private_key)
        return account.address.lower() == address.lower()
    except Exception:
        return False


# ============================================================================
# Wallet Generation
# ============================================================================

def create_wallet() -> WalletResult:
    """Create a new random wallet."""
    account = Account.create()
    return WalletResult(
        address=account.address,
        private_key='0x' + account.key.hex()
    )


def create_wallet_with_mnemonic(
    num_words: int = 12,
    language: str = "english",
    passphrase: str = "",
    derivation_path: str = ETHEREUM_DEFAULT_PATH
) -> WalletResult:
    """Create a new wallet with BIP39 mnemonic."""
    account, mnemonic = Account.create_with_mnemonic(
        passphrase=passphrase,
        num_words=num_words,
        language=language,
        account_path=derivation_path
    )
    return WalletResult(
        address=account.address,
        private_key=account.key.hex(),
        mnemonic=mnemonic,
        derivation_path=derivation_path
    )


def restore_from_mnemonic(
    mnemonic: str,
    passphrase: str = "",
    derivation_path: str = ETHEREUM_DEFAULT_PATH
) -> WalletResult:
    """Restore wallet from BIP39 mnemonic."""
    account = Account.from_mnemonic(
        mnemonic=mnemonic,
        passphrase=passphrase,
        account_path=derivation_path
    )
    return WalletResult(
        address=account.address,
        private_key=account.key.hex(),
        mnemonic=mnemonic,
        derivation_path=derivation_path
    )


def restore_from_private_key(private_key: str) -> WalletResult:
    """Restore wallet from private key."""
    account = Account.from_key(private_key)
    return WalletResult(
        address=account.address,
        private_key=account.key.hex()
    )


def derive_multiple_accounts(
    mnemonic: str,
    count: int = 10,
    passphrase: str = "",
    base_path: str = "m/44'/60'/0'/0"
) -> list[WalletResult]:
    """Derive multiple accounts from a single mnemonic."""
    accounts = []
    for i in range(count):
        path = f"{base_path}/{i}"
        account = Account.from_mnemonic(
            mnemonic=mnemonic,
            passphrase=passphrase,
            account_path=path
        )
        accounts.append(WalletResult(
            address=account.address,
            private_key=account.key.hex(),
            mnemonic=mnemonic,
            derivation_path=path
        ))
    return accounts


# ============================================================================
# Message Signing & Verification
# ============================================================================

def sign_message(message: str, private_key: str) -> dict:
    """Sign a message with a private key."""
    signable = encode_defunct(text=message)
    signed = Account.sign_message(signable, private_key)
    return {
        "message": message,
        "signature": '0x' + signed.signature.hex(),
        "r": hex(signed.r),
        "s": hex(signed.s),
        "v": signed.v,
        "message_hash": '0x' + signed.message_hash.hex()
    }


def verify_message(message: str, signature: str, expected_address: str) -> dict:
    """Verify a signed message and recover the signer's address."""
    signable = encode_defunct(text=message)
    recovered_address = Account.recover_message(signable, signature=signature)
    is_valid = recovered_address.lower() == expected_address.lower()
    return {
        "message": message,
        "signature": signature,
        "expected_address": expected_address,
        "recovered_address": recovered_address,
        "is_valid": is_valid
    }


# ============================================================================
# Keystore Encryption/Decryption
# ============================================================================

def encrypt_keystore(private_key: str, password: str) -> dict:
    """
    Encrypt a private key to a JSON keystore file format.
    
    Creates an industry-standard encrypted keystore compatible with:
    - MetaMask
    - MyEtherWallet
    - Geth
    - Most Ethereum wallets
    
    Args:
        private_key: Private key (with or without 0x prefix)
        password: Password to encrypt the keystore
    
    Returns:
        Keystore dictionary (JSON-serializable)
    """
    # Normalize private key
    if private_key.startswith('0x'):
        private_key = private_key[2:]
    
    key_bytes = bytes.fromhex(private_key)
    keystore = Account.encrypt(key_bytes, password)
    return keystore


def decrypt_keystore(keystore: dict, password: str) -> dict:
    """
    Decrypt a JSON keystore file to recover the private key.
    
    Args:
        keystore: Keystore dictionary (from JSON file)
        password: Password used to encrypt the keystore
    
    Returns:
        Dictionary with address and private_key
    """
    key_bytes = Account.decrypt(keystore, password)
    account = Account.from_key(key_bytes)
    return {
        "address": account.address,
        "private_key": key_bytes.hex()
    }


def save_keystore(private_key: str, password: str, filepath: str) -> str:
    """
    Encrypt and save a private key to a keystore file.
    
    Args:
        private_key: Private key to encrypt
        password: Encryption password
        filepath: Path to save the keystore file
    
    Returns:
        Path to the saved file
    """
    keystore = encrypt_keystore(private_key, password)
    with open(filepath, 'w') as f:
        json.dump(keystore, f, indent=2)
    return filepath


def load_keystore(filepath: str, password: str) -> dict:
    """
    Load and decrypt a keystore file.
    
    Args:
        filepath: Path to the keystore file
        password: Decryption password
    
    Returns:
        Dictionary with address and private_key
    """
    with open(filepath, 'r') as f:
        keystore = json.load(f)
    return decrypt_keystore(keystore, password)


# ============================================================================
# Transaction Signing
# ============================================================================

def sign_transaction(
    private_key: str,
    to: str,
    value: int,
    nonce: int,
    gas: int = 21000,
    gas_price: Optional[int] = None,
    max_fee_per_gas: Optional[int] = None,
    max_priority_fee_per_gas: Optional[int] = None,
    data: str = "0x",
    chain_id: int = 1
) -> dict:
    """
    Sign an Ethereum transaction offline.
    
    Supports both legacy (gas_price) and EIP-1559 (max_fee_per_gas) transactions.
    
    Args:
        private_key: Signer's private key
        to: Recipient address
        value: Amount in wei
        nonce: Transaction nonce
        gas: Gas limit (default: 21000 for simple transfer)
        gas_price: Legacy gas price in wei (for pre-EIP-1559)
        max_fee_per_gas: EIP-1559 max fee per gas in wei
        max_priority_fee_per_gas: EIP-1559 priority fee in wei
        data: Transaction data (default: 0x for simple transfer)
        chain_id: Network chain ID (1=mainnet, 5=goerli, 11155111=sepolia)
    
    Returns:
        Dictionary with signed transaction details
    """
    from eth_utils import to_checksum_address
    
    tx = {
        "to": to_checksum_address(to),
        "value": value,
        "gas": gas,
        "nonce": nonce,
        "chainId": chain_id,
        "data": data
    }
    
    # EIP-1559 transaction
    if max_fee_per_gas is not None:
        tx["maxFeePerGas"] = max_fee_per_gas
        tx["maxPriorityFeePerGas"] = max_priority_fee_per_gas or 0
        tx["type"] = 2
    # Legacy transaction
    elif gas_price is not None:
        tx["gasPrice"] = gas_price
    else:
        raise ValueError("Must specify either gas_price (legacy) or max_fee_per_gas (EIP-1559)")
    
    signed = Account.sign_transaction(tx, private_key)
    
    return {
        "raw_transaction": signed.raw_transaction.hex(),
        "hash": signed.hash.hex(),
        "r": hex(signed.r),
        "s": hex(signed.s),
        "v": signed.v,
        "transaction": tx
    }


def recover_transaction_signer(raw_transaction: str) -> str:
    """
    Recover the signer's address from a signed transaction.
    
    Args:
        raw_transaction: Raw signed transaction in hex
    
    Returns:
        Signer's address
    """
    if raw_transaction.startswith('0x'):
        raw_transaction = raw_transaction[2:]
    
    tx_bytes = bytes.fromhex(raw_transaction)
    return Account.recover_transaction(tx_bytes)


# ============================================================================
# EIP-712 Typed Data Signing
# ============================================================================

def sign_typed_data(private_key: str, domain: dict, types: dict, message: dict, primary_type: str) -> dict:
    """
    Sign EIP-712 typed structured data.
    
    Used by DeFi protocols, NFT marketplaces, and dApps for:
    - Uniswap Permit2 approvals
    - OpenSea listings
    - Gnosis Safe transactions
    - And many more
    
    Args:
        private_key: Signer's private key
        domain: EIP-712 domain separator (name, version, chainId, verifyingContract)
        types: Type definitions for the structured data
        message: The actual message data to sign
        primary_type: The primary type name in the types dict
    
    Returns:
        Dictionary with signature details
    
    Example:
        domain = {
            "name": "MyDApp",
            "version": "1",
            "chainId": 1,
            "verifyingContract": "0x..."
        }
        types = {
            "Person": [
                {"name": "name", "type": "string"},
                {"name": "wallet", "type": "address"}
            ]
        }
        message = {"name": "Alice", "wallet": "0x..."}
        sign_typed_data(key, domain, types, message, "Person")
    """
    from eth_account.messages import encode_typed_data
    
    full_message = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            **types
        },
        "primaryType": primary_type,
        "domain": domain,
        "message": message
    }
    
    signable = encode_typed_data(full_message=full_message)
    signed = Account.sign_message(signable, private_key)
    
    return {
        "signature": signed.signature.hex(),
        "r": hex(signed.r),
        "s": hex(signed.s),
        "v": signed.v,
        "message_hash": signed.message_hash.hex(),
        "domain": domain,
        "primary_type": primary_type
    }


def verify_typed_data(
    domain: dict,
    types: dict, 
    message: dict,
    primary_type: str,
    signature: str,
    expected_address: str
) -> dict:
    """
    Verify an EIP-712 typed data signature.
    
    Args:
        domain: EIP-712 domain separator
        types: Type definitions
        message: The message that was signed
        primary_type: Primary type name
        signature: The signature to verify
        expected_address: Expected signer address
    
    Returns:
        Dictionary with verification result
    """
    from eth_account.messages import encode_typed_data
    
    full_message = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            **types
        },
        "primaryType": primary_type,
        "domain": domain,
        "message": message
    }
    
    signable = encode_typed_data(full_message=full_message)
    recovered = Account.recover_message(signable, signature=signature)
    is_valid = recovered.lower() == expected_address.lower()
    
    return {
        "expected_address": expected_address,
        "recovered_address": recovered,
        "is_valid": is_valid
    }


# ============================================================================
# Contract Address Calculation
# ============================================================================

def calculate_contract_address(address: str, nonce: int = 0) -> str:
    """
    Calculate the contract address that would be created by an account.
    
    Uses RLP encoding: keccak256(rlp([sender, nonce]))
    The first contract created by an account has nonce 0.
    
    Args:
        address: The account address (with 0x prefix)
        nonce: Transaction nonce (0 for first contract)
    
    Returns:
        Contract address (with 0x prefix)
    """
    # Remove 0x prefix and convert to bytes
    addr_bytes = bytes.fromhex(address[2:])
    
    # RLP encode [address, nonce]
    encoded = rlp.encode([addr_bytes, nonce])
    
    # Keccak-256 hash and take last 20 bytes
    from eth_hash.auto import keccak
    contract_hash = keccak(encoded)
    contract_address = '0x' + contract_hash[-20:].hex()
    
    # Apply EIP-55 checksum
    return Account.from_key(bytes(32)).address[:2] + contract_address[2:]  # Placeholder for checksum


def get_checksum_address(address: str) -> str:
    """Convert address to EIP-55 checksum format."""
    from eth_hash.auto import keccak
    addr = address.lower()[2:] if address.startswith('0x') else address.lower()
    hash_hex = keccak(addr.encode()).hex()
    
    result = '0x'
    for i, char in enumerate(addr):
        if char in '0123456789':
            result += char
        elif int(hash_hex[i], 16) >= 8:
            result += char.upper()
        else:
            result += char.lower()
    return result


# ============================================================================
# Vanity Address Generation
# ============================================================================

def check_vanity_match(
    address: str,
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False,
    letters_only: bool = False,
    numbers_only: bool = False,
    mirror: bool = False,
    leading: Optional[str] = None,
    leading_count: int = 0,
    doubles: bool = False,
    zeros: bool = False,
    regex_pattern: Optional[str] = None
) -> bool:
    """Check if an address matches the vanity criteria."""
    addr = address[2:]  # Remove 0x
    
    if not case_sensitive:
        addr_check = addr.lower()
        prefix = prefix.lower() if prefix else None
        suffix = suffix.lower() if suffix else None
        contains = contains.lower() if contains else None
        leading = leading.lower() if leading else None
    else:
        addr_check = addr
    
    # Basic prefix/suffix matching
    if prefix and not addr_check.startswith(prefix):
        return False
    if suffix and not addr_check.endswith(suffix):
        return False
    if contains and contains not in addr_check:
        return False
    
    # Letters only (a-f)
    if letters_only:
        if not all(c in 'abcdef' for c in addr_check):
            return False
    
    # Numbers only (0-9)
    if numbers_only:
        if not all(c in '0123456789' for c in addr_check):
            return False
    
    # Mirror check (first half mirrors second half)
    if mirror:
        half = len(addr_check) // 2
        if addr_check[:half] != addr_check[-half:][::-1]:
            return False
    
    # Leading character check (address starts with N repetitions of a character)
    if leading and leading_count > 0:
        expected = leading * leading_count
        if not addr_check.startswith(expected):
            return False
    
    # Doubles check (leading pairs like aa, bb, cc)
    if doubles:
        # Check for at least 2 leading double pairs
        count = 0
        for i in range(0, len(addr_check) - 1, 2):
            if addr_check[i] == addr_check[i + 1]:
                count += 1
            else:
                break
        if count < 2:
            return False
    
    # Zeros check (address contains many zeros)
    if zeros:
        zero_count = addr_check.count('0')
        if zero_count < 8:  # Require at least 8 zeros
            return False
    
    # Regex pattern matching
    if regex_pattern:
        if not re.match(regex_pattern, addr_check, re.IGNORECASE if not case_sensitive else 0):
            return False
    
    return True


def mine_vanity_single(
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False,
    letters_only: bool = False,
    numbers_only: bool = False,
    mirror: bool = False,
    leading: Optional[str] = None,
    leading_count: int = 0,
    doubles: bool = False,
    zeros: bool = False,
    regex_pattern: Optional[str] = None,
    contract: bool = False,
    max_attempts: int = 0
) -> Optional[tuple[str, str, int]]:
    """Mine for a single vanity address."""
    attempts = 0
    
    while max_attempts == 0 or attempts < max_attempts:
        account = Account.create()
        attempts += 1
        
        # Determine which address to check
        if contract:
            # Check the contract address that would be created
            from eth_hash.auto import keccak
            addr_bytes = bytes.fromhex(account.address[2:])
            encoded = rlp.encode([addr_bytes, 0])  # nonce 0 for first contract
            contract_hash = keccak(encoded)
            check_address = '0x' + contract_hash[-20:].hex()
            check_address = get_checksum_address(check_address)
        else:
            check_address = account.address
        
        if check_vanity_match(
            check_address, prefix, suffix, contains,
            case_sensitive, letters_only, numbers_only, mirror,
            leading, leading_count, doubles, zeros, regex_pattern
        ):
            if contract:
                return check_address, account.key.hex(), attempts, account.address
            return check_address, account.key.hex(), attempts
    
    return None


def worker_mine_vanity(
    worker_id: int,
    prefix: Optional[str],
    suffix: Optional[str],
    contains: Optional[str],
    case_sensitive: bool,
    letters_only: bool,
    numbers_only: bool,
    mirror: bool,
    leading: Optional[str] = None,
    leading_count: int = 0,
    doubles: bool = False,
    zeros: bool = False,
    regex_pattern: Optional[str] = None,
    contract: bool = False,
    batch_size: int = 10000
) -> tuple:
    """Worker function for parallel vanity mining."""
    total_attempts = 0
    
    while True:
        result = mine_vanity_single(
            prefix, suffix, contains, case_sensitive,
            letters_only, numbers_only, mirror,
            leading, leading_count, doubles, zeros, regex_pattern,
            contract, batch_size
        )
        if result:
            if contract:
                address, key, attempts, deployer = result
                return address, key, total_attempts + attempts, deployer
            address, key, attempts = result
            return address, key, total_attempts + attempts
        total_attempts += batch_size


def generate_vanity_address(
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False,
    letters_only: bool = False,
    numbers_only: bool = False,
    mirror: bool = False,
    leading: Optional[str] = None,
    leading_count: int = 0,
    doubles: bool = False,
    zeros: bool = False,
    regex_pattern: Optional[str] = None,
    contract: bool = False,
    threads: int = 1,
    count: int = 1,
    callback: Optional[callable] = None
) -> list[VanityResult]:
    """Generate vanity addresses matching the criteria."""
    results = []
    
    for i in range(count):
        start_time = time.time()
        deployer_address = None
        
        if threads == 1:
            result_tuple = mine_vanity_single(
                prefix, suffix, contains, case_sensitive,
                letters_only, numbers_only, mirror,
                leading, leading_count, doubles, zeros, regex_pattern,
                contract, 0
            )
            if contract:
                address, private_key, attempts, deployer_address = result_tuple
            else:
                address, private_key, attempts = result_tuple
        else:
            with ProcessPoolExecutor(max_workers=threads) as executor:
                futures = [
                    executor.submit(
                        worker_mine_vanity,
                        j, prefix, suffix, contains, case_sensitive,
                        letters_only, numbers_only, mirror,
                        leading, leading_count, doubles, zeros, regex_pattern,
                        contract
                    )
                    for j in range(threads)
                ]
                
                for future in as_completed(futures):
                    result_tuple = future.result()
                    if contract:
                        address, private_key, attempts, deployer_address = result_tuple
                    else:
                        address, private_key, attempts = result_tuple
                    for f in futures:
                        f.cancel()
                    break
        
        elapsed = time.time() - start_time
        
        result = VanityResult(
            address=address,
            private_key=private_key,
            attempts=attempts,
            time_seconds=elapsed
        )
        # Store deployer address in derivation_path field for contract mode
        if contract and deployer_address:
            result.derivation_path = f"deployer:{deployer_address}"
        results.append(result)
        
        if callback:
            callback(result, i + 1, count)
    
    return results


# ============================================================================
# Utility Functions
# ============================================================================

def estimate_difficulty(
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False
) -> int:
    """Estimate attempts needed to find a vanity address."""
    total_chars = len(prefix or '') + len(suffix or '') + len(contains or '')
    
    if case_sensitive:
        # Checksum makes it harder (roughly 22 possible chars per position)
        return int(22 ** total_chars)
    else:
        # 16 possible hex characters
        return 16 ** total_chars


def format_duration(seconds: float) -> str:
    """Format duration in human-readable form."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        return f"{seconds / 60:.1f}m"
    elif seconds < 86400:
        return f"{seconds / 3600:.1f}h"
    else:
        return f"{seconds / 86400:.1f}d"


def format_number(n: int) -> str:
    """Format number with commas."""
    return f"{n:,}"


# ============================================================================
# CLI Commands
# ============================================================================

def cmd_generate(args):
    """Generate a new wallet."""
    if args.mnemonic:
        result = create_wallet_with_mnemonic(
            num_words=args.words,
            language=args.language,
            passphrase=args.passphrase or "",
            derivation_path=args.path or ETHEREUM_DEFAULT_PATH
        )
    else:
        result = create_wallet()
    
    print(f"Address:     {result.address}")
    print(f"Private Key: {result.private_key}")
    if result.mnemonic:
        print(f"Mnemonic:    {result.mnemonic}")
        print(f"Path:        {result.derivation_path}")
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump({
                "address": result.address,
                "private_key": result.private_key,
                "mnemonic": result.mnemonic,
                "derivation_path": result.derivation_path
            }, f, indent=2)
        print(f"\nSaved to: {args.output}")


def cmd_restore(args):
    """Restore wallet from mnemonic or private key."""
    if args.mnemonic:
        mnemonic = ' '.join(args.mnemonic)
        result = restore_from_mnemonic(
            mnemonic=mnemonic,
            passphrase=args.passphrase or "",
            derivation_path=args.path or ETHEREUM_DEFAULT_PATH
        )
        print(f"Address:     {result.address}")
        print(f"Private Key: {result.private_key}")
        print(f"Path:        {result.derivation_path}")
    elif args.key:
        result = restore_from_private_key(args.key)
        print(f"Address:     {result.address}")
        print(f"Private Key: {result.private_key}")
    else:
        print("Error: Provide --mnemonic or --key")
        sys.exit(1)


def cmd_derive(args):
    """Derive multiple accounts from mnemonic."""
    mnemonic = ' '.join(args.mnemonic)
    accounts = derive_multiple_accounts(
        mnemonic=mnemonic,
        count=args.count,
        passphrase=args.passphrase or "",
        base_path=args.base_path or "m/44'/60'/0'/0"
    )
    
    print(f"Derived {len(accounts)} accounts:\n")
    for i, acc in enumerate(accounts):
        print(f"[{i}] {acc.address}")
        if args.verbose:
            print(f"    Key:  {acc.private_key}")
            print(f"    Path: {acc.derivation_path}")
        print()


def cmd_vanity(args):
    """Generate vanity address."""
    prefix = args.prefix
    suffix = args.suffix
    contains = args.contains
    leading = args.leading
    leading_count = args.leading_count if hasattr(args, 'leading_count') else 0
    doubles = getattr(args, 'doubles', False)
    zeros = getattr(args, 'zeros', False)
    regex_pattern = getattr(args, 'regex', None)
    contract = getattr(args, 'contract', False)
    
    # Validate inputs
    if not any([prefix, suffix, contains, args.letters, args.numbers, args.mirror,
                leading, doubles, zeros, regex_pattern]):
        print("Error: Specify at least one criteria")
        print("  Options: --prefix, --suffix, --contains, --letters, --numbers,")
        print("           --mirror, --leading, --doubles, --zeros, --regex")
        sys.exit(1)
    
    if prefix and not is_valid_hex_pattern(prefix):
        print(f"Error: Invalid prefix '{prefix}'. Use only hex characters (0-9, a-f)")
        sys.exit(1)
    
    if suffix and not is_valid_hex_pattern(suffix):
        print(f"Error: Invalid suffix '{suffix}'. Use only hex characters (0-9, a-f)")
        sys.exit(1)
    
    if contains and not is_valid_hex_pattern(contains):
        print(f"Error: Invalid contains pattern '{contains}'. Use only hex characters (0-9, a-f)")
        sys.exit(1)
    
    if leading and not is_valid_hex_pattern(leading):
        print(f"Error: Invalid leading character '{leading}'. Use only hex characters (0-9, a-f)")
        sys.exit(1)
    
    if leading and len(leading) != 1:
        print("Error: --leading requires a single hex character")
        sys.exit(1)
    
    if regex_pattern:
        try:
            re.compile(regex_pattern)
        except re.error as e:
            print(f"Error: Invalid regex pattern: {e}")
            sys.exit(1)
    
    # Estimate difficulty
    difficulty = estimate_difficulty(prefix, suffix, contains, args.case_sensitive)
    if leading and leading_count:
        difficulty = max(difficulty, 16 ** leading_count)
    if doubles:
        difficulty = max(difficulty, 16 ** 4)  # At least 2 double pairs
    if zeros:
        difficulty = max(difficulty, 100000)  # Rough estimate for 8+ zeros
    
    if not args.quiet:
        print("=" * 60)
        print("Ethereum Vanity Address Generator")
        print("=" * 60)
        print(f"Target:         {'Contract' if contract else 'Account'} address")
        print(f"Prefix:         {prefix or '(none)'}")
        print(f"Suffix:         {suffix or '(none)'}")
        print(f"Contains:       {contains or '(none)'}")
        if leading:
            print(f"Leading:        '{leading}' x {leading_count}")
        if doubles:
            print(f"Doubles:        Yes (aa, bb, cc...)")
        if zeros:
            print(f"Zeros:          Yes (8+ zeros)")
        if regex_pattern:
            print(f"Regex:          {regex_pattern}")
        print(f"Case-sensitive: {args.case_sensitive}")
        print(f"Letters only:   {args.letters}")
        print(f"Numbers only:   {args.numbers}")
        print(f"Mirror:         {args.mirror}")
        print(f"Threads:        {args.threads}")
        print(f"Count:          {args.count}")
        print(f"Difficulty:     ~1 in {format_number(difficulty)}")
        print("=" * 60)
        print("Mining... (Ctrl+C to cancel)\n")
    
    def on_found(result, current, total):
        if not args.quiet:
            print(f"[{current}/{total}] Found in {format_duration(result.time_seconds)} ({format_number(result.attempts)} attempts)")
        if contract and result.derivation_path:
            deployer = result.derivation_path.replace('deployer:', '')
            print(f"Contract Address: {result.address}")
            print(f"Deployer Address: {deployer}")
        else:
            print(f"Address:     {result.address}")
        print(f"Private Key: {result.private_key}")
        if not args.quiet:
            print()
    
    try:
        results = generate_vanity_address(
            prefix=prefix,
            suffix=suffix,
            contains=contains,
            case_sensitive=args.case_sensitive,
            letters_only=args.letters,
            numbers_only=args.numbers,
            mirror=args.mirror,
            leading=leading,
            leading_count=leading_count,
            doubles=doubles,
            zeros=zeros,
            regex_pattern=regex_pattern,
            contract=contract,
            threads=args.threads,
            count=args.count,
            callback=on_found
        )
        
        if args.output and results:
            output_data = []
            for r in results:
                entry = {
                    "address": r.address,
                    "private_key": r.private_key,
                    "attempts": r.attempts,
                    "time_seconds": r.time_seconds
                }
                if contract and r.derivation_path:
                    entry["deployer_address"] = r.derivation_path.replace('deployer:', '')
                    entry["contract_address"] = r.address
                output_data.append(entry)
            with open(args.output, 'w') as f:
                json.dump(output_data, f, indent=2)
            print(f"Saved to: {args.output}")
            
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)


def cmd_sign(args):
    """Sign a message."""
    result = sign_message(args.message, args.key)
    
    print(f"Message:      {result['message']}")
    print(f"Signature:    {result['signature']}")
    print(f"Message Hash: {result['message_hash']}")
    
    if args.verbose:
        print(f"r: {result['r']}")
        print(f"s: {result['s']}")
        print(f"v: {result['v']}")


def cmd_verify(args):
    """Verify a signed message."""
    result = verify_message(args.message, args.signature, args.address)
    
    print(f"Message:           {result['message']}")
    print(f"Expected Address:  {result['expected_address']}")
    print(f"Recovered Address: {result['recovered_address']}")
    print(f"Valid:             {'Yes' if result['is_valid'] else 'No'}")


def cmd_validate(args):
    """Validate address or keypair."""
    if args.address:
        valid = is_valid_address(args.address)
        print(f"Address: {args.address}")
        print(f"Valid:   {'Yes' if valid else 'No'}")
    
    if args.key:
        valid = is_valid_private_key(args.key)
        print(f"Private Key Valid: {'Yes' if valid else 'No'}")
        
        if valid and args.address:
            matches = validate_public_key(args.address, args.key)
            print(f"Key matches address: {'Yes' if matches else 'No'}")


def cmd_keystore(args):
    """Encrypt or decrypt keystore files."""
    if args.encrypt:
        # Encrypt a private key to keystore
        import getpass
        
        private_key = args.key
        if not private_key:
            print("Error: --key is required for encryption")
            sys.exit(1)
        
        password = args.password
        if not password:
            password = getpass.getpass("Enter password: ")
            password_confirm = getpass.getpass("Confirm password: ")
            if password != password_confirm:
                print("Error: Passwords do not match")
                sys.exit(1)
        
        keystore = encrypt_keystore(private_key, password)
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(keystore, f, indent=2)
            print(f"Keystore saved to: {args.output}")
        else:
            print(json.dumps(keystore, indent=2))
    
    elif args.decrypt:
        # Decrypt a keystore file
        import getpass
        
        if not args.file:
            print("Error: --file is required for decryption")
            sys.exit(1)
        
        password = args.password
        if not password:
            password = getpass.getpass("Enter password: ")
        
        try:
            result = load_keystore(args.file, password)
            print(f"Address:     {result['address']}")
            print(f"Private Key: {result['private_key']}")
        except ValueError as e:
            print(f"Error: Failed to decrypt keystore - {e}")
            sys.exit(1)
    
    else:
        print("Error: Specify --encrypt or --decrypt")
        sys.exit(1)


def cmd_transaction(args):
    """Sign a transaction offline."""
    # Validate required args
    if not args.to:
        print("Error: --to address is required")
        sys.exit(1)
    if not args.key:
        print("Error: --key is required")
        sys.exit(1)
    
    # Parse value (support wei, gwei, ether)
    if args.ether is not None:
        value = int(args.ether * 10**18)
    else:
        value = args.value or 0
        if isinstance(value, str):
            if value.endswith('ether'):
                value = int(float(value.replace('ether', '').strip()) * 10**18)
            elif value.endswith('gwei'):
                value = int(float(value.replace('gwei', '').strip()) * 10**9)
            else:
                value = int(value)
    
    try:
        result = sign_transaction(
            private_key=args.key,
            to=args.to,
            value=value,
            nonce=args.nonce,
            gas=args.gas,
            gas_price=args.gas_price,
            max_fee_per_gas=args.max_fee,
            max_priority_fee_per_gas=args.priority_fee,
            data=args.data or "0x",
            chain_id=args.chain_id
        )
        
        print("Signed Transaction")
        print("=" * 60)
        print(f"To:              {args.to}")
        print(f"Value:           {value} wei")
        print(f"Nonce:           {args.nonce}")
        print(f"Gas:             {args.gas}")
        print(f"Chain ID:        {args.chain_id}")
        print(f"Transaction Hash: {result['hash']}")
        print(f"Raw Transaction: {result['raw_transaction']}")
        
        if args.verbose:
            print(f"\nr: {result['r']}")
            print(f"s: {result['s']}")
            print(f"v: {result['v']}")
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\nSaved to: {args.output}")
            
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


def cmd_typed_data(args):
    """Sign or verify EIP-712 typed data."""
    if args.sign:
        # Load typed data from file
        if not args.file:
            print("Error: --file is required (JSON file with typed data)")
            sys.exit(1)
        if not args.key:
            print("Error: --key is required")
            sys.exit(1)
        
        with open(args.file, 'r') as f:
            data = json.load(f)
        
        # Validate structure
        required = ['domain', 'types', 'message', 'primaryType']
        for field in required:
            if field not in data:
                print(f"Error: JSON must contain '{field}'")
                sys.exit(1)
        
        result = sign_typed_data(
            private_key=args.key,
            domain=data['domain'],
            types=data['types'],
            message=data['message'],
            primary_type=data['primaryType']
        )
        
        print("EIP-712 Typed Data Signature")
        print("=" * 60)
        print(f"Primary Type:  {result['primary_type']}")
        print(f"Domain:        {result['domain'].get('name', 'N/A')}")
        print(f"Signature:     {result['signature']}")
        print(f"Message Hash:  {result['message_hash']}")
        
        if args.verbose:
            print(f"\nr: {result['r']}")
            print(f"s: {result['s']}")
            print(f"v: {result['v']}")
        
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\nSaved to: {args.output}")
    
    elif args.verify:
        if not args.file:
            print("Error: --file is required")
            sys.exit(1)
        if not args.signature:
            print("Error: --signature is required")
            sys.exit(1)
        if not args.address:
            print("Error: --address is required")
            sys.exit(1)
        
        with open(args.file, 'r') as f:
            data = json.load(f)
        
        result = verify_typed_data(
            domain=data['domain'],
            types=data['types'],
            message=data['message'],
            primary_type=data['primaryType'],
            signature=args.signature,
            expected_address=args.address
        )
        
        print(f"Expected Address:  {result['expected_address']}")
        print(f"Recovered Address: {result['recovered_address']}")
        print(f"Valid:             {'Yes' if result['is_valid'] else 'No'}")
    
    else:
        print("Error: Specify --sign or --verify")
        sys.exit(1)


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Ethereum Wallet Toolkit - Generate, restore, sign, and verify',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  Generate random wallet:
    %(prog)s generate
    
  Generate with mnemonic:
    %(prog)s generate --mnemonic --words 24
    
  Generate vanity address:
    %(prog)s vanity --prefix dead --suffix beef
    %(prog)s vanity --prefix abc --threads 4 --count 5
    %(prog)s vanity --letters        # All letters (a-f)
    %(prog)s vanity --numbers        # All numbers (0-9)
    %(prog)s vanity --leading 0 --leading-count 6  # 6 leading zeros
    %(prog)s vanity --doubles        # Leading pairs (aa, bb, etc.)
    %(prog)s vanity --zeros          # Many zeros in address
    %(prog)s vanity --regex "^dead.*beef$"  # Regex pattern
    %(prog)s vanity --prefix cafe --contract  # Vanity contract address
    
  Restore from mnemonic:
    %(prog)s restore --mnemonic word1 word2 word3 ...
    
  Restore from private key:
    %(prog)s restore --key 0x...
    
  Derive multiple accounts:
    %(prog)s derive --mnemonic word1 word2 ... --count 10
    
  Sign message:
    %(prog)s sign --message "Hello" --key 0x...
    
  Verify signature:
    %(prog)s verify --message "Hello" --signature 0x... --address 0x...
    
  Validate address/key:
    %(prog)s validate --address 0x... --key 0x...
    
  Keystore operations:
    %(prog)s keystore --encrypt --key 0x... --password secret --output wallet.json
    %(prog)s keystore --decrypt --file wallet.json --password secret
    
  Sign transaction offline:
    %(prog)s transaction --to 0x... --ether 1.5 --nonce 0 --key 0x...
    %(prog)s transaction --to 0x... --value 1000000000 --nonce 5 --max-fee 30000000000 --priority-fee 2000000000 --key 0x...
    
  EIP-712 typed data:
    %(prog)s typed-data --sign --file permit.json --key 0x...
    %(prog)s typed-data --verify --file permit.json --signature 0x... --address 0x...
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Generate command
    gen_parser = subparsers.add_parser('generate', help='Generate new wallet')
    gen_parser.add_argument('--mnemonic', '-m', action='store_true', help='Generate with BIP39 mnemonic')
    gen_parser.add_argument('--words', '-w', type=int, default=12, choices=[12, 15, 18, 21, 24], help='Mnemonic word count')
    gen_parser.add_argument('--language', '-l', default='english', help='Mnemonic language')
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
    derive_parser.add_argument('--base-path', help='Base HD path (default: m/44\'/60\'/0\'/0)')
    derive_parser.add_argument('--verbose', '-v', action='store_true', help='Show private keys')
    
    # Vanity command
    vanity_parser = subparsers.add_parser('vanity', help='Generate vanity address')
    vanity_parser.add_argument('--prefix', '-p', help='Address prefix (after 0x)')
    vanity_parser.add_argument('--suffix', '-s', help='Address suffix')
    vanity_parser.add_argument('--contains', help='Address must contain pattern')
    vanity_parser.add_argument('--case-sensitive', '-c', action='store_true', help='Case-sensitive matching (EIP-55)')
    vanity_parser.add_argument('--letters', action='store_true', help='Letters only (a-f)')
    vanity_parser.add_argument('--numbers', action='store_true', help='Numbers only (0-9)')
    vanity_parser.add_argument('--mirror', action='store_true', help='Mirrored address (palindrome)')
    vanity_parser.add_argument('--leading', help='Leading character (single hex char)')
    vanity_parser.add_argument('--leading-count', type=int, default=4, help='Count for --leading (default: 4)')
    vanity_parser.add_argument('--doubles', action='store_true', help='Leading double pairs (aa, bb, etc.)')
    vanity_parser.add_argument('--zeros', action='store_true', help='Address with many zeros (8+)')
    vanity_parser.add_argument('--regex', help='Match address with regex pattern')
    vanity_parser.add_argument('--contract', action='store_true', help='Generate vanity contract address')
    vanity_parser.add_argument('--threads', '-t', type=int, default=cpu_count(), help='CPU threads')
    vanity_parser.add_argument('--count', '-n', type=int, default=1, help='Number of addresses')
    vanity_parser.add_argument('--quiet', '-q', action='store_true', help='Minimal output')
    vanity_parser.add_argument('--output', '-o', help='Save to JSON file')
    
    # Sign command
    sign_parser = subparsers.add_parser('sign', help='Sign a message')
    sign_parser.add_argument('--message', '-m', required=True, help='Message to sign')
    sign_parser.add_argument('--key', '-k', required=True, help='Private key')
    sign_parser.add_argument('--verbose', '-v', action='store_true', help='Show r, s, v values')
    
    # Verify command
    verify_parser = subparsers.add_parser('verify', help='Verify signature')
    verify_parser.add_argument('--message', '-m', required=True, help='Original message')
    verify_parser.add_argument('--signature', '-s', required=True, help='Signature')
    verify_parser.add_argument('--address', '-a', required=True, help='Expected signer address')
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate address/key')
    validate_parser.add_argument('--address', '-a', help='Ethereum address')
    validate_parser.add_argument('--key', '-k', help='Private key')
    
    # Keystore command
    keystore_parser = subparsers.add_parser('keystore', help='Keystore operations')
    keystore_parser.add_argument('--encrypt', action='store_true', help='Encrypt private key to keystore')
    keystore_parser.add_argument('--decrypt', action='store_true', help='Decrypt keystore file')
    keystore_parser.add_argument('--key', '-k', help='Private key to encrypt')
    keystore_parser.add_argument('--password', '-p', help='Keystore password')
    keystore_parser.add_argument('--file', '-f', help='Keystore file path')
    keystore_parser.add_argument('--output', '-o', help='Output file path')
    keystore_parser.add_argument('--kdf', default='scrypt', choices=['scrypt', 'pbkdf2'], help='KDF algorithm')
    keystore_parser.add_argument('--iterations', type=int, help='KDF iterations (for custom security)')
    
    # Transaction command
    tx_parser = subparsers.add_parser('transaction', help='Sign transactions offline')
    tx_parser.add_argument('--to', required=True, help='Recipient address')
    tx_parser.add_argument('--value', default='0', help='Value in Wei (or use --ether)')
    tx_parser.add_argument('--ether', type=float, help='Value in Ether')
    tx_parser.add_argument('--nonce', type=int, required=True, help='Transaction nonce')
    tx_parser.add_argument('--gas', type=int, default=21000, help='Gas limit')
    tx_parser.add_argument('--gas-price', type=int, help='Gas price in Wei (legacy)')
    tx_parser.add_argument('--max-fee', type=int, help='Max fee per gas (EIP-1559)')
    tx_parser.add_argument('--priority-fee', type=int, help='Max priority fee (EIP-1559)')
    tx_parser.add_argument('--data', default='0x', help='Transaction data (hex)')
    tx_parser.add_argument('--chain-id', type=int, default=1, help='Chain ID (1=mainnet)')
    tx_parser.add_argument('--key', '-k', required=True, help='Private key')
    tx_parser.add_argument('--output', '-o', help='Save signed tx to file')
    tx_parser.add_argument('--verbose', '-v', action='store_true', help='Show r, s, v values')
    
    # Typed Data command (EIP-712)
    typed_parser = subparsers.add_parser('typed-data', help='EIP-712 typed data signing')
    typed_parser.add_argument('--sign', action='store_true', help='Sign typed data')
    typed_parser.add_argument('--verify', action='store_true', help='Verify typed data signature')
    typed_parser.add_argument('--file', '-f', required=True, help='JSON file with typed data')
    typed_parser.add_argument('--key', '-k', help='Private key (for signing)')
    typed_parser.add_argument('--signature', '-s', help='Signature (for verification)')
    typed_parser.add_argument('--address', '-a', help='Expected signer (for verification)')
    typed_parser.add_argument('--verbose', '-v', action='store_true', help='Show r, s, v values')
    typed_parser.add_argument('--output', '-o', help='Save result to file')
    
    args = parser.parse_args()
    
    if args.command == 'generate':
        cmd_generate(args)
    elif args.command == 'restore':
        cmd_restore(args)
    elif args.command == 'derive':
        cmd_derive(args)
    elif args.command == 'vanity':
        cmd_vanity(args)
    elif args.command == 'sign':
        cmd_sign(args)
    elif args.command == 'verify':
        cmd_verify(args)
    elif args.command == 'validate':
        cmd_validate(args)
    elif args.command == 'keystore':
        cmd_keystore(args)
    elif args.command == 'transaction':
        cmd_transaction(args)
    elif args.command == 'typed-data':
        cmd_typed_data(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()




