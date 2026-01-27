"""
Wallet Generation Tools for Ethereum Wallet MCP Server

This module implements MCP tools for:
- Generating new Ethereum wallets
- Creating wallets with BIP39 mnemonics
- Restoring wallets from mnemonics or private keys
- Deriving multiple HD wallet accounts
- Generating vanity addresses

Security Note: Private keys are never logged or persisted.
All operations use cryptographically secure randomness.
"""

import re
import time
import secrets
from typing import Optional, Any
from dataclasses import dataclass, asdict, field

from eth_account import Account
from eth_account.hdaccount import ETHEREUM_DEFAULT_PATH
from eth_keys import keys
from eth_utils import is_hex, to_checksum_address
from mcp.server import Server

# Enable HD wallet features in eth-account
Account.enable_unaudited_hdwallet_features()

# Constants
VALID_WORD_COUNTS = {12, 15, 18, 21, 24}
SUPPORTED_LANGUAGES = {
    "english", "spanish", "french", "italian", 
    "japanese", "korean", "chinese_simplified", "chinese_traditional",
    "czech", "portuguese"
}
DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0/0"
DEFAULT_BASE_PATH = "m/44'/60'/0'/0"
MAX_DERIVE_COUNT = 100
MAX_VANITY_TIMEOUT = 300  # 5 minutes max
HEX_PATTERN = re.compile(r'^[0-9a-fA-F]+$')


# ============================================================================
# Error Classes
# ============================================================================

class WalletError(Exception):
    """Base exception for wallet operations."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
    
    def to_dict(self) -> dict:
        return {"error": True, "code": self.code, "message": self.message}


class InvalidMnemonicError(WalletError):
    def __init__(self, message: str):
        super().__init__("INVALID_MNEMONIC", message)


class InvalidKeyError(WalletError):
    def __init__(self, message: str):
        super().__init__("INVALID_KEY", message)


class InvalidPatternError(WalletError):
    def __init__(self, message: str):
        super().__init__("INVALID_PATTERN", message)


class TimeoutError(WalletError):
    def __init__(self, message: str):
        super().__init__("TIMEOUT", message)


class InvalidWordCountError(WalletError):
    def __init__(self, message: str):
        super().__init__("INVALID_WORD_COUNT", message)


# ============================================================================
# Data Classes
# ============================================================================

@dataclass
class WalletResult:
    """Standard wallet result containing address and keys."""
    address: str
    private_key: str
    public_key: str
    mnemonic: Optional[str] = None
    derivation_path: Optional[str] = None
    passphrase_used: bool = False
    
    def to_dict(self) -> dict:
        result = {
            "address": self.address,
            "private_key": self.private_key,
            "public_key": self.public_key,
        }
        if self.mnemonic:
            result["mnemonic"] = self.mnemonic
        if self.derivation_path:
            result["derivation_path"] = self.derivation_path
        result["passphrase_used"] = self.passphrase_used
        return result


@dataclass
class AccountInfo:
    """Information about a derived account."""
    index: int
    derivation_path: str
    address: str
    private_key: str
    public_key: str
    
    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class MultiAccountResult:
    """Result of deriving multiple accounts."""
    accounts: list[AccountInfo]
    total_derived: int
    base_path: str
    passphrase_used: bool = False
    
    def to_dict(self) -> dict:
        return {
            "accounts": [acc.to_dict() for acc in self.accounts],
            "total_derived": self.total_derived,
            "base_path": self.base_path,
            "passphrase_used": self.passphrase_used,
        }


@dataclass
class VanityResult:
    """Result of vanity address generation."""
    address: str
    private_key: str
    public_key: str
    pattern_matched: str
    attempts: int
    time_seconds: float
    difficulty: int
    warning: str = field(default="⚠️ VANITY ADDRESS WARNING: Vanity address generation carries inherent risks. Never use for high-value storage. Consider hardware wallets for real funds.")
    
    def to_dict(self) -> dict:
        return asdict(self)


# ============================================================================
# Helper Functions
# ============================================================================

def _get_public_key(account: Account) -> str:
    """
    Extract the public key from an eth-account Account object.
    
    Args:
        account: An eth-account Account instance
        
    Returns:
        Hex-encoded public key with 0x prefix
    """
    # Get the private key bytes and derive public key
    private_key_bytes = account.key
    private_key_obj = keys.PrivateKey(private_key_bytes)
    public_key = private_key_obj.public_key
    return public_key.to_hex()


def _validate_mnemonic(mnemonic: str) -> tuple[bool, str]:
    """
    Validate a BIP39 mnemonic phrase.
    
    Args:
        mnemonic: Space-separated mnemonic phrase
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not mnemonic or not isinstance(mnemonic, str):
        return False, "Mnemonic must be a non-empty string"
    
    words = mnemonic.strip().split()
    word_count = len(words)
    
    if word_count not in VALID_WORD_COUNTS:
        return False, f"Invalid word count: {word_count}. Must be one of: {sorted(VALID_WORD_COUNTS)}"
    
    # Use eth-account's built-in validation
    try:
        Account.from_mnemonic(mnemonic)
        return True, ""
    except Exception as e:
        error_msg = str(e)
        if "not in the dictionary" in error_msg.lower():
            return False, f"Mnemonic contains invalid words: {error_msg}"
        if "checksum" in error_msg.lower():
            return False, "Invalid mnemonic: checksum verification failed"
        return False, f"Invalid mnemonic: {error_msg}"


def _validate_hex_pattern(pattern: str) -> tuple[bool, str]:
    """
    Validate a hex pattern for vanity address generation.
    
    Args:
        pattern: Hex pattern string (without 0x prefix)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not pattern:
        return True, ""  # Empty pattern is valid (will be ignored)
    
    if not isinstance(pattern, str):
        return False, "Pattern must be a string"
    
    if not HEX_PATTERN.match(pattern):
        return False, f"Pattern must contain only hex characters (0-9, a-f, A-F). Got: '{pattern}'"
    
    return True, ""


def _normalize_private_key(private_key: str) -> str:
    """
    Normalize a private key to 0x-prefixed format.
    
    Args:
        private_key: Hex private key with or without 0x prefix
        
    Returns:
        Normalized private key with 0x prefix
    """
    key = private_key.strip()
    if key.startswith("0x") or key.startswith("0X"):
        key = key[2:]
    return "0x" + key.lower()


def _validate_private_key(private_key: str) -> tuple[bool, str]:
    """
    Validate a private key format.
    
    Args:
        private_key: Hex private key string
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not private_key or not isinstance(private_key, str):
        return False, "Private key must be a non-empty string"
    
    key = private_key.strip()
    if key.startswith("0x") or key.startswith("0X"):
        key = key[2:]
    
    if len(key) != 64:
        return False, f"Private key must be 64 hex characters (32 bytes). Got {len(key)} characters"
    
    if not HEX_PATTERN.match(key):
        return False, "Private key must contain only hex characters (0-9, a-f, A-F)"
    
    return True, ""


def _calculate_vanity_difficulty(prefix: str = "", suffix: str = "", case_sensitive: bool = False) -> int:
    """
    Calculate the expected number of attempts to find a vanity address.
    
    Args:
        prefix: Address prefix pattern
        suffix: Address suffix pattern
        case_sensitive: Whether matching is case-sensitive
        
    Returns:
        Expected number of attempts (1 in N)
    """
    total_chars = len(prefix) + len(suffix)
    if total_chars == 0:
        return 1
    
    if case_sensitive:
        # Each hex char has 16 possibilities, but case-sensitive reduces matches
        # Addresses are checksummed, so roughly half the chars are upper/lower
        return 16 ** total_chars
    else:
        # Case-insensitive: 16 possibilities per character
        return 16 ** total_chars


def _word_count_to_entropy_bits(word_count: int) -> int:
    """Convert mnemonic word count to entropy bits."""
    # BIP39: words = (entropy_bits + checksum_bits) / 11
    # checksum_bits = entropy_bits / 32
    # So: words = entropy_bits * 33 / 352
    # entropy_bits = words * 352 / 33 ≈ words * 10.67
    entropy_map = {
        12: 128,  # 128 bits
        15: 160,  # 160 bits
        18: 192,  # 192 bits
        21: 224,  # 224 bits
        24: 256,  # 256 bits
    }
    return entropy_map.get(word_count, 128)


# ============================================================================
# Tool Registration
# ============================================================================

def register_wallet_tools(server: Server) -> None:
    """
    Register all wallet generation tools with the MCP server.
    
    Args:
        server: MCP Server instance to register tools with
    """
    
    @server.tool()
    async def generate_wallet() -> dict:
        """
        Generate a new random Ethereum wallet.
        
        Creates a cryptographically secure random private key and derives
        the corresponding Ethereum address and public key.
        
        Returns:
            dict containing:
                - address: Ethereum address (0x prefixed, checksummed)
                - private_key: Private key (0x prefixed, hex)
                - public_key: Public key (0x prefixed, hex)
        
        Example:
            {
                "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00",
                "private_key": "0x4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e3c1a2",
                "public_key": "0x04bfcab..."
            }
        """
        try:
            # Generate new account with secure randomness
            account = Account.create()
            
            result = WalletResult(
                address=account.address,
                private_key=account.key.hex(),
                public_key=_get_public_key(account),
            )
            
            return result.to_dict()
            
        except Exception as e:
            return WalletError("GENERATION_FAILED", f"Failed to generate wallet: {str(e)}").to_dict()
    
    
    @server.tool()
    async def generate_wallet_with_mnemonic(
        word_count: int = 12,
        language: str = "english",
        passphrase: str = "",
        derivation_path: str = DEFAULT_DERIVATION_PATH
    ) -> dict:
        """
        Generate a new wallet with BIP39 mnemonic seed phrase.
        
        Creates a new BIP39 mnemonic and derives an Ethereum wallet from it
        using the specified derivation path. The mnemonic can be used to
        recover the wallet later.
        
        Args:
            word_count: Number of mnemonic words (12, 15, 18, 21, or 24). Default: 12
            language: Mnemonic language (english, spanish, french, italian, 
                     japanese, korean, chinese_simplified, chinese_traditional). Default: english
            passphrase: Optional BIP39 passphrase (25th word) for additional security. Default: ""
            derivation_path: HD derivation path. Default: m/44'/60'/0'/0/0
        
        Returns:
            dict containing:
                - address: Derived Ethereum address
                - private_key: Private key
                - public_key: Public key
                - mnemonic: BIP39 mnemonic phrase (space-separated words)
                - derivation_path: Path used for derivation
                - passphrase_used: Whether a passphrase was applied
        
        Security Warning:
            Store the mnemonic phrase securely! Anyone with access to it
            can derive all wallets and access all funds.
        """
        try:
            # Validate word count
            if word_count not in VALID_WORD_COUNTS:
                return InvalidWordCountError(
                    f"Invalid word count: {word_count}. Must be one of: {sorted(VALID_WORD_COUNTS)}"
                ).to_dict()
            
            # Validate language
            if language.lower() not in SUPPORTED_LANGUAGES:
                return WalletError(
                    "INVALID_LANGUAGE",
                    f"Unsupported language: {language}. Supported: {sorted(SUPPORTED_LANGUAGES)}"
                ).to_dict()
            
            # Generate entropy and mnemonic
            entropy_bits = _word_count_to_entropy_bits(word_count)
            entropy_bytes = entropy_bits // 8
            
            # Use secrets for cryptographic randomness
            entropy = secrets.token_bytes(entropy_bytes)
            
            # Generate mnemonic from entropy
            from mnemonic import Mnemonic
            mnemo = Mnemonic(language.lower())
            mnemonic_phrase = mnemo.to_mnemonic(entropy)
            
            # Derive account from mnemonic
            account = Account.from_mnemonic(
                mnemonic_phrase,
                passphrase=passphrase,
                account_path=derivation_path
            )
            
            result = WalletResult(
                address=account.address,
                private_key=account.key.hex(),
                public_key=_get_public_key(account),
                mnemonic=mnemonic_phrase,
                derivation_path=derivation_path,
                passphrase_used=bool(passphrase),
            )
            
            return result.to_dict()
            
        except Exception as e:
            return WalletError("GENERATION_FAILED", f"Failed to generate wallet: {str(e)}").to_dict()
    
    
    @server.tool()
    async def restore_wallet_from_mnemonic(
        mnemonic: str,
        passphrase: str = "",
        derivation_path: str = DEFAULT_DERIVATION_PATH
    ) -> dict:
        """
        Restore a wallet from an existing BIP39 mnemonic.
        
        Derives an Ethereum wallet from a previously generated mnemonic phrase.
        The same mnemonic and passphrase will always derive the same wallet.
        
        Args:
            mnemonic: BIP39 mnemonic phrase (space-separated words)
            passphrase: Optional BIP39 passphrase that was used during creation. Default: ""
            derivation_path: HD derivation path. Default: m/44'/60'/0'/0/0
        
        Returns:
            dict containing:
                - address: Derived Ethereum address
                - private_key: Private key
                - public_key: Public key
                - derivation_path: Path used for derivation
                - passphrase_used: Whether a passphrase was applied
        
        Raises:
            INVALID_MNEMONIC: If the mnemonic is invalid (wrong word count,
                            invalid words, or failed checksum)
        """
        try:
            # Validate mnemonic
            is_valid, error_msg = _validate_mnemonic(mnemonic)
            if not is_valid:
                return InvalidMnemonicError(error_msg).to_dict()
            
            # Derive account from mnemonic
            account = Account.from_mnemonic(
                mnemonic.strip(),
                passphrase=passphrase,
                account_path=derivation_path
            )
            
            result = WalletResult(
                address=account.address,
                private_key=account.key.hex(),
                public_key=_get_public_key(account),
                derivation_path=derivation_path,
                passphrase_used=bool(passphrase),
            )
            
            return result.to_dict()
            
        except InvalidMnemonicError:
            raise
        except Exception as e:
            error_str = str(e)
            if "mnemonic" in error_str.lower():
                return InvalidMnemonicError(error_str).to_dict()
            return WalletError("RESTORE_FAILED", f"Failed to restore wallet: {error_str}").to_dict()
    
    
    @server.tool()
    async def restore_wallet_from_private_key(private_key: str) -> dict:
        """
        Restore a wallet from a private key.
        
        Derives the Ethereum address and public key from a private key.
        Accepts the key with or without '0x' prefix.
        
        Args:
            private_key: Hex-encoded private key (with or without 0x prefix)
        
        Returns:
            dict containing:
                - address: Derived Ethereum address
                - private_key: Normalized private key (0x prefixed)
                - public_key: Public key
        
        Raises:
            INVALID_KEY: If the private key format is invalid
        """
        try:
            # Validate private key
            is_valid, error_msg = _validate_private_key(private_key)
            if not is_valid:
                return InvalidKeyError(error_msg).to_dict()
            
            # Normalize and create account
            normalized_key = _normalize_private_key(private_key)
            account = Account.from_key(normalized_key)
            
            result = WalletResult(
                address=account.address,
                private_key=account.key.hex(),
                public_key=_get_public_key(account),
            )
            
            return result.to_dict()
            
        except InvalidKeyError:
            raise
        except Exception as e:
            return InvalidKeyError(f"Failed to restore wallet: {str(e)}").to_dict()
    
    
    @server.tool()
    async def derive_multiple_accounts(
        mnemonic: str,
        count: int = 5,
        start_index: int = 0,
        passphrase: str = "",
        base_path: str = DEFAULT_BASE_PATH
    ) -> dict:
        """
        Derive multiple accounts from a single mnemonic (HD wallet batch derivation).
        
        Generates multiple Ethereum accounts from a single seed phrase by
        incrementing the account index in the derivation path.
        
        Args:
            mnemonic: BIP39 mnemonic phrase
            count: Number of accounts to derive (1-100). Default: 5
            start_index: Starting account index. Default: 0
            passphrase: Optional BIP39 passphrase. Default: ""
            base_path: Base HD path (index will be appended). Default: m/44'/60'/0'/0
        
        Returns:
            dict containing:
                - accounts: List of account objects, each with:
                    - index: Account index
                    - derivation_path: Full derivation path
                    - address: Ethereum address
                    - private_key: Private key
                    - public_key: Public key
                - total_derived: Number of accounts derived
                - base_path: Base path used
                - passphrase_used: Whether passphrase was applied
        
        Example:
            derive_multiple_accounts(mnemonic="abandon ...", count=3)
            Returns 3 accounts at paths:
                m/44'/60'/0'/0/0
                m/44'/60'/0'/0/1
                m/44'/60'/0'/0/2
        """
        try:
            # Validate mnemonic
            is_valid, error_msg = _validate_mnemonic(mnemonic)
            if not is_valid:
                return InvalidMnemonicError(error_msg).to_dict()
            
            # Validate count
            if count < 1:
                return WalletError("INVALID_COUNT", "Count must be at least 1").to_dict()
            if count > MAX_DERIVE_COUNT:
                return WalletError(
                    "INVALID_COUNT", 
                    f"Count exceeds maximum of {MAX_DERIVE_COUNT}"
                ).to_dict()
            
            # Validate start_index
            if start_index < 0:
                return WalletError("INVALID_INDEX", "Start index must be non-negative").to_dict()
            
            accounts = []
            
            for i in range(count):
                index = start_index + i
                path = f"{base_path}/{index}"
                
                account = Account.from_mnemonic(
                    mnemonic.strip(),
                    passphrase=passphrase,
                    account_path=path
                )
                
                account_info = AccountInfo(
                    index=index,
                    derivation_path=path,
                    address=account.address,
                    private_key=account.key.hex(),
                    public_key=_get_public_key(account),
                )
                accounts.append(account_info)
            
            result = MultiAccountResult(
                accounts=accounts,
                total_derived=len(accounts),
                base_path=base_path,
                passphrase_used=bool(passphrase),
            )
            
            return result.to_dict()
            
        except InvalidMnemonicError:
            raise
        except Exception as e:
            return WalletError("DERIVATION_FAILED", f"Failed to derive accounts: {str(e)}").to_dict()
    
    
    @server.tool()
    async def generate_vanity_address(
        prefix: str = "",
        suffix: str = "",
        case_sensitive: bool = False,
        timeout_seconds: int = 60
    ) -> dict:
        """
        Generate an Ethereum address matching a vanity pattern.
        
        Repeatedly generates random wallets until one matches the specified
        prefix and/or suffix pattern. This is a computationally intensive
        operation that may take significant time for longer patterns.
        
        Args:
            prefix: Desired address prefix (after 0x), hex chars only
            suffix: Desired address suffix, hex chars only
            case_sensitive: Match case exactly using EIP-55 checksum. Default: false
            timeout_seconds: Maximum time to search (1-300 seconds). Default: 60
        
        Returns:
            dict containing:
                - address: Matching vanity address
                - private_key: Private key
                - public_key: Public key
                - pattern_matched: The pattern that was matched
                - attempts: Number of addresses tried
                - time_seconds: Time taken
                - difficulty: Estimated 1-in-N difficulty
                - warning: Security warning about vanity addresses
        
        Raises:
            INVALID_PATTERN: If prefix/suffix contains non-hex characters
            TIMEOUT: If no match found within timeout period
        
        Performance Notes:
            - Each additional character increases difficulty 16x
            - 4 chars: ~65,000 attempts average
            - 6 chars: ~16 million attempts average
            - 8+ chars: May take hours or never complete
        
        Security Warning:
            ⚠️ Vanity address generation carries inherent risks.
            Never use vanity addresses for high-value storage.
            Consider hardware wallets for real funds.
        """
        try:
            # Validate that at least one pattern is provided
            if not prefix and not suffix:
                return InvalidPatternError(
                    "At least one of prefix or suffix must be provided"
                ).to_dict()
            
            # Validate prefix
            is_valid, error_msg = _validate_hex_pattern(prefix)
            if not is_valid:
                return InvalidPatternError(f"Invalid prefix: {error_msg}").to_dict()
            
            # Validate suffix
            is_valid, error_msg = _validate_hex_pattern(suffix)
            if not is_valid:
                return InvalidPatternError(f"Invalid suffix: {error_msg}").to_dict()
            
            # Validate timeout
            if timeout_seconds < 1:
                timeout_seconds = 1
            if timeout_seconds > MAX_VANITY_TIMEOUT:
                timeout_seconds = MAX_VANITY_TIMEOUT
            
            # Warn about difficulty
            total_pattern_length = len(prefix) + len(suffix)
            if total_pattern_length > 6:
                # This is informational, not an error
                pass  # Could log a warning here
            
            # Calculate difficulty
            difficulty = _calculate_vanity_difficulty(prefix, suffix, case_sensitive)
            
            # Normalize patterns for matching
            if not case_sensitive:
                prefix_match = prefix.lower()
                suffix_match = suffix.lower()
            else:
                prefix_match = prefix
                suffix_match = suffix
            
            # Build pattern description
            pattern_parts = []
            if prefix:
                pattern_parts.append(f"prefix='{prefix}'")
            if suffix:
                pattern_parts.append(f"suffix='{suffix}'")
            pattern_desc = ", ".join(pattern_parts)
            
            # Search for matching address
            start_time = time.time()
            attempts = 0
            
            while True:
                attempts += 1
                
                # Check timeout
                elapsed = time.time() - start_time
                if elapsed >= timeout_seconds:
                    return TimeoutError(
                        f"Timeout after {attempts:,} attempts in {elapsed:.2f} seconds. "
                        f"Pattern ({pattern_desc}) has difficulty 1 in {difficulty:,}. "
                        f"Try a shorter pattern or longer timeout."
                    ).to_dict()
                
                # Generate random wallet
                account = Account.create()
                address = account.address
                
                # Get address without 0x for matching
                if case_sensitive:
                    addr_check = address[2:]  # Checksummed address
                else:
                    addr_check = address[2:].lower()
                
                # Check prefix match
                if prefix_match and not addr_check.startswith(prefix_match):
                    continue
                
                # Check suffix match
                if suffix_match and not addr_check.endswith(suffix_match):
                    continue
                
                # Found a match!
                end_time = time.time()
                
                result = VanityResult(
                    address=account.address,
                    private_key=account.key.hex(),
                    public_key=_get_public_key(account),
                    pattern_matched=pattern_desc,
                    attempts=attempts,
                    time_seconds=round(end_time - start_time, 3),
                    difficulty=difficulty,
                )
                
                return result.to_dict()
                
        except (InvalidPatternError, TimeoutError):
            raise
        except Exception as e:
            return WalletError("GENERATION_FAILED", f"Vanity generation failed: {str(e)}").to_dict()
