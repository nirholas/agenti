#!/usr/bin/env python3
"""
Ethereum Vanity Address Generator

================================================================================
DISCLAIMER - EDUCATIONAL PURPOSES ONLY - NO LIABILITY
================================================================================
THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.

DO NOT USE WITH REAL FUNDS. DO NOT USE IN PRODUCTION.

The author(s) accept NO LIABILITY for any damages, losses, or consequences
arising from the use of this software. By using this software, you acknowledge
that you are solely responsible for your actions and any outcomes.

This software is provided "AS IS" without warranty of any kind. The author(s)
make no guarantees about the security, correctness, or fitness for any purpose.

Vanity address generation carries INHERENT RISKS that cannot be fully mitigated.
The Profanity vulnerability (September 2022) caused $160M+ in losses.

ALWAYS:
- Audit the code yourself before any use
- Use hardware wallets for real funds  
- Never use generated keys for real assets
- Understand that vanity address generation has inherent risks
================================================================================

A secure, auditable tool for generating Ethereum vanity addresses.
Uses ONLY official Ethereum Foundation libraries (eth-account).

Author: nich
License: MIT
X (Formerly Twitter): x.com/nichxbt
Github: github.com/nirholas

References:
- James. "Fixing Other People's Code." Oregon State Blogs, Feb 2023
- foobar. "Vanity Addresses." 0xfoobar Substack, Jan 2023
- CertiK. "Vanity Address and Address Poisoning." July 2024

For high-value use cases, consider CREATE2 deployment for smart contracts
instead of EOA vanity addresses.
"""

import argparse
import re
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import cpu_count
from typing import Optional

from eth_account import Account


def is_valid_hex_pattern(pattern: str) -> bool:
    """Check if pattern contains only valid hex characters (0-9, a-f, A-F)."""
    return bool(re.match(r'^[0-9a-fA-F]*$', pattern))


def generate_wallet() -> tuple[str, str]:
    """
    Generate a random Ethereum wallet.
    
    Returns:
        Tuple of (address, private_key)
    """
    account = Account.create()
    return account.address, account.key.hex()


def check_vanity_match(
    address: str,
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    case_sensitive: bool = False
) -> bool:
    """
    Check if an address matches the vanity pattern.
    
    Args:
        address: Ethereum address (with 0x prefix)
        prefix: Desired prefix (after 0x)
        suffix: Desired suffix
        case_sensitive: Whether to match case exactly
    
    Returns:
        True if address matches the pattern
    """
    # Remove 0x prefix for comparison
    addr = address[2:]
    
    if not case_sensitive:
        addr = addr.lower()
        prefix = prefix.lower() if prefix else None
        suffix = suffix.lower() if suffix else None
    
    if prefix and not addr.startswith(prefix):
        return False
    if suffix and not addr.endswith(suffix):
        return False
    
    return True


def mine_vanity_address(
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    case_sensitive: bool = False,
    max_attempts: int = 0
) -> Optional[tuple[str, str, int]]:
    """
    Mine for a vanity address matching the pattern.
    
    Args:
        prefix: Desired prefix (after 0x)
        suffix: Desired suffix
        case_sensitive: Whether to match case exactly
        max_attempts: Maximum attempts (0 = unlimited)
    
    Returns:
        Tuple of (address, private_key, attempts) or None if max_attempts reached
    """
    attempts = 0
    
    while max_attempts == 0 or attempts < max_attempts:
        address, private_key = generate_wallet()
        attempts += 1
        
        if check_vanity_match(address, prefix, suffix, case_sensitive):
            return address, private_key, attempts
    
    return None


def worker_mine(
    worker_id: int,
    prefix: Optional[str],
    suffix: Optional[str],
    case_sensitive: bool,
    batch_size: int = 10000
) -> tuple[str, str, int]:
    """
    Worker function for parallel mining.
    
    Each worker mines in batches and returns when a match is found.
    """
    total_attempts = 0
    
    while True:
        result = mine_vanity_address(prefix, suffix, case_sensitive, batch_size)
        if result:
            address, private_key, attempts = result
            return address, private_key, total_attempts + attempts
        total_attempts += batch_size


def estimate_difficulty(prefix: Optional[str], suffix: Optional[str], case_sensitive: bool) -> int:
    """
    Estimate the number of attempts needed to find a match.
    
    Returns:
        Expected number of attempts (average)
    """
    total_chars = len(prefix or '') + len(suffix or '')
    
    if case_sensitive:
        # 22 possible characters per position (0-9, a-f, A-F with checksum)
        # This is approximate; actual checksum rules are more complex
        return 16 ** total_chars
    else:
        # 16 possible characters per position (0-9, a-f)
        return 16 ** total_chars


def format_duration(seconds: float) -> str:
    """Format duration in human-readable form."""
    if seconds < 60:
        return f"{seconds:.1f} seconds"
    elif seconds < 3600:
        return f"{seconds / 60:.1f} minutes"
    elif seconds < 86400:
        return f"{seconds / 3600:.1f} hours"
    else:
        return f"{seconds / 86400:.1f} days"


def main():
    parser = argparse.ArgumentParser(
        description='Generate Ethereum vanity addresses using official Ethereum libraries.',
        epilog='''
Examples:
  %(prog)s --prefix abc
  %(prog)s --suffix 1234
  %(prog)s --prefix dead --suffix beef
  %(prog)s --prefix ABC --case-sensitive
        ''',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--prefix', '-p',
        type=str,
        default='',
        help='Desired address prefix (after 0x)'
    )
    
    parser.add_argument(
        '--suffix', '-s',
        type=str,
        default='',
        help='Desired address suffix'
    )
    
    parser.add_argument(
        '--case-sensitive', '-c',
        action='store_true',
        help='Match case exactly (uses EIP-55 checksum)'
    )
    
    parser.add_argument(
        '--threads', '-t',
        type=int,
        default=cpu_count(),
        help=f'Number of threads to use (default: {cpu_count()})'
    )
    
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Only output the result (no progress info)'
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    prefix = args.prefix or None
    suffix = args.suffix or None
    
    if not prefix and not suffix:
        parser.error('Please specify at least --prefix or --suffix')
    
    if prefix and not is_valid_hex_pattern(prefix):
        parser.error(f'Invalid prefix: "{prefix}". Use only hex characters (0-9, a-f)')
    
    if suffix and not is_valid_hex_pattern(suffix):
        parser.error(f'Invalid suffix: "{suffix}". Use only hex characters (0-9, a-f)')
    
    total_chars = len(prefix or '') + len(suffix or '')
    if total_chars > 10:
        if not args.quiet:
            print(f'⚠️  Warning: {total_chars} characters will take a VERY long time!')
            print('   Consider using fewer characters.')
            print()
    
    # Estimate difficulty
    difficulty = estimate_difficulty(prefix, suffix, args.case_sensitive)
    
    if not args.quiet:
        print('=' * 50)
        print('Ethereum Vanity Address Generator')
        print('=' * 50)
        print(f'Prefix:         {prefix or "(none)"}')
        print(f'Suffix:         {suffix or "(none)"}')
        print(f'Case-sensitive: {args.case_sensitive}')
        print(f'Threads:        {args.threads}')
        print(f'Difficulty:     ~1 in {difficulty:,} addresses')
        print('=' * 50)
        print('Mining... (Press Ctrl+C to cancel)')
        print()
    
    start_time = time.time()
    
    try:
        if args.threads == 1:
            # Single-threaded mode
            address, private_key, attempts = mine_vanity_address(
                prefix, suffix, args.case_sensitive, max_attempts=0
            )
        else:
            # Multi-threaded mode
            with ProcessPoolExecutor(max_workers=args.threads) as executor:
                futures = [
                    executor.submit(
                        worker_mine,
                        i, prefix, suffix, args.case_sensitive
                    )
                    for i in range(args.threads)
                ]
                
                # Wait for first result
                for future in as_completed(futures):
                    address, private_key, attempts = future.result()
                    # Cancel remaining workers
                    for f in futures:
                        f.cancel()
                    break
        
        elapsed = time.time() - start_time
        
        if not args.quiet:
            print('✅ Found!')
            print()
        
        print(f'Address:     {address}')
        print(f'Private Key: {private_key}')
        
        if not args.quiet:
            print()
            print(f'Time:        {format_duration(elapsed)}')
            print(f'Attempts:    ~{attempts:,}')
            print(f'Speed:       ~{attempts / elapsed:,.0f} addr/sec')
            print()
            print('⚠️  SECURITY REMINDER:')
            print('   - Never share your private key')
            print('   - Store it securely offline')
            print('   - This tool ran entirely on your machine')
        
    except KeyboardInterrupt:
        elapsed = time.time() - start_time
        print(f'\n\nCancelled after {format_duration(elapsed)}')
        sys.exit(1)


if __name__ == '__main__':
    main()




