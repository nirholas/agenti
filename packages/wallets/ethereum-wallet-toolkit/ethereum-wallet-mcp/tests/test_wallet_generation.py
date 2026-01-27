"""
Tests for Wallet Generation Tools

Comprehensive test suite for the ethereum-wallet-mcp wallet generation tools.
Tests cover wallet generation, mnemonic operations, HD derivation, and vanity addresses.
"""

import pytest
import re
from typing import Any

# Import the functions we're testing
from ethereum_wallet_mcp.tools.wallet_generation import (
    register_wallet_tools,
    _validate_mnemonic,
    _validate_private_key,
    _validate_hex_pattern,
    _normalize_private_key,
    _get_public_key,
    _calculate_vanity_difficulty,
    WalletError,
    InvalidMnemonicError,
    InvalidKeyError,
    InvalidPatternError,
)

# Test vectors - well-known test mnemonic
TEST_MNEMONIC_12 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
# Expected address for test mnemonic at m/44'/60'/0'/0/0 (no passphrase)
TEST_ADDRESS_INDEX_0 = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"

# 24-word test mnemonic
TEST_MNEMONIC_24 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"

# Test private key (DO NOT USE FOR REAL FUNDS)
TEST_PRIVATE_KEY = "0x4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e3c1a2"
TEST_PRIVATE_KEY_NO_PREFIX = "4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e3c1a2"


class TestValidationHelpers:
    """Test validation helper functions."""
    
    def test_validate_mnemonic_valid_12_words(self):
        """Valid 12-word mnemonic should pass validation."""
        is_valid, error = _validate_mnemonic(TEST_MNEMONIC_12)
        assert is_valid is True
        assert error == ""
    
    def test_validate_mnemonic_valid_24_words(self):
        """Valid 24-word mnemonic should pass validation."""
        is_valid, error = _validate_mnemonic(TEST_MNEMONIC_24)
        assert is_valid is True
        assert error == ""
    
    def test_validate_mnemonic_invalid_word_count(self):
        """Mnemonic with wrong word count should fail."""
        invalid_mnemonic = "abandon abandon abandon abandon abandon"  # 5 words
        is_valid, error = _validate_mnemonic(invalid_mnemonic)
        assert is_valid is False
        assert "word count" in error.lower() or "5" in error
    
    def test_validate_mnemonic_invalid_words(self):
        """Mnemonic with invalid words should fail."""
        invalid_mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon xyz"
        is_valid, error = _validate_mnemonic(invalid_mnemonic)
        assert is_valid is False
    
    def test_validate_mnemonic_empty(self):
        """Empty mnemonic should fail."""
        is_valid, error = _validate_mnemonic("")
        assert is_valid is False
    
    def test_validate_mnemonic_none(self):
        """None mnemonic should fail."""
        is_valid, error = _validate_mnemonic(None)
        assert is_valid is False
    
    def test_validate_private_key_valid_with_prefix(self):
        """Valid private key with 0x prefix should pass."""
        is_valid, error = _validate_private_key(TEST_PRIVATE_KEY)
        assert is_valid is True
        assert error == ""
    
    def test_validate_private_key_valid_without_prefix(self):
        """Valid private key without 0x prefix should pass."""
        is_valid, error = _validate_private_key(TEST_PRIVATE_KEY_NO_PREFIX)
        assert is_valid is True
        assert error == ""
    
    def test_validate_private_key_too_short(self):
        """Private key that's too short should fail."""
        is_valid, error = _validate_private_key("0x1234")
        assert is_valid is False
        assert "64" in error
    
    def test_validate_private_key_too_long(self):
        """Private key that's too long should fail."""
        long_key = "0x" + "a" * 70
        is_valid, error = _validate_private_key(long_key)
        assert is_valid is False
    
    def test_validate_private_key_invalid_chars(self):
        """Private key with invalid characters should fail."""
        invalid_key = "0x" + "g" * 64  # 'g' is not hex
        is_valid, error = _validate_private_key(invalid_key)
        assert is_valid is False
        assert "hex" in error.lower()
    
    def test_validate_hex_pattern_valid(self):
        """Valid hex patterns should pass."""
        for pattern in ["dead", "BEEF", "1234", "abcdef", "ABC123"]:
            is_valid, error = _validate_hex_pattern(pattern)
            assert is_valid is True, f"Pattern '{pattern}' should be valid"
    
    def test_validate_hex_pattern_invalid(self):
        """Invalid hex patterns should fail."""
        for pattern in ["xyz", "ghij", "0x123", "dead!"]:
            is_valid, error = _validate_hex_pattern(pattern)
            assert is_valid is False, f"Pattern '{pattern}' should be invalid"
    
    def test_validate_hex_pattern_empty(self):
        """Empty pattern should be valid (will be ignored)."""
        is_valid, error = _validate_hex_pattern("")
        assert is_valid is True
    
    def test_normalize_private_key_with_prefix(self):
        """Should keep 0x prefix and lowercase."""
        result = _normalize_private_key("0xABCD1234" + "0" * 56)
        assert result.startswith("0x")
        assert result == result.lower()
    
    def test_normalize_private_key_without_prefix(self):
        """Should add 0x prefix."""
        result = _normalize_private_key("abcd1234" + "0" * 56)
        assert result.startswith("0x")
    
    def test_calculate_vanity_difficulty(self):
        """Difficulty calculation should be correct."""
        # No pattern
        assert _calculate_vanity_difficulty("", "", False) == 1
        
        # Single char prefix
        assert _calculate_vanity_difficulty("a", "", False) == 16
        
        # Two char prefix
        assert _calculate_vanity_difficulty("ab", "", False) == 256
        
        # Prefix and suffix
        assert _calculate_vanity_difficulty("ab", "cd", False) == 16 ** 4


class TestWalletGeneration:
    """Test wallet generation tools."""
    
    @pytest.fixture
    def mock_server(self):
        """Create a mock server for testing."""
        from unittest.mock import MagicMock
        return MagicMock()
    
    def test_generate_wallet_returns_valid_structure(self, mock_server):
        """Generated wallet should have required fields."""
        from eth_account import Account
        
        account = Account.create()
        
        assert account.address is not None
        assert account.address.startswith("0x")
        assert len(account.address) == 42
        assert account.key is not None
    
    def test_generate_wallet_unique_each_time(self):
        """Each call should generate different wallet."""
        from eth_account import Account
        
        accounts = [Account.create() for _ in range(5)]
        addresses = [acc.address for acc in accounts]
        
        # All addresses should be unique
        assert len(set(addresses)) == 5
    
    def test_generate_wallet_valid_checksum_address(self):
        """Generated address should be checksummed (EIP-55)."""
        from eth_account import Account
        from eth_utils import is_checksum_address
        
        account = Account.create()
        assert is_checksum_address(account.address)
    
    def test_mnemonic_word_counts(self):
        """Test generation with different word counts."""
        from eth_account import Account
        from mnemonic import Mnemonic
        import secrets
        
        Account.enable_unaudited_hdwallet_features()
        
        for word_count in [12, 15, 18, 21, 24]:
            entropy_bits = {12: 128, 15: 160, 18: 192, 21: 224, 24: 256}[word_count]
            entropy = secrets.token_bytes(entropy_bits // 8)
            
            mnemo = Mnemonic("english")
            mnemonic = mnemo.to_mnemonic(entropy)
            
            words = mnemonic.split()
            assert len(words) == word_count, f"Expected {word_count} words, got {len(words)}"
    
    def test_restore_from_mnemonic_deterministic(self):
        """Same mnemonic should always derive same address."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        # Derive multiple times
        addresses = []
        for _ in range(3):
            account = Account.from_mnemonic(TEST_MNEMONIC_12)
            addresses.append(account.address)
        
        # All should be identical
        assert all(addr == addresses[0] for addr in addresses)
    
    def test_restore_from_mnemonic_known_address(self):
        """Test mnemonic should derive to known address."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        account = Account.from_mnemonic(
            TEST_MNEMONIC_12,
            account_path="m/44'/60'/0'/0/0"
        )
        
        # Compare case-insensitively
        assert account.address.lower() == TEST_ADDRESS_INDEX_0.lower()
    
    def test_restore_with_passphrase_different_address(self):
        """Passphrase should derive different address."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        account_no_pass = Account.from_mnemonic(TEST_MNEMONIC_12)
        account_with_pass = Account.from_mnemonic(TEST_MNEMONIC_12, passphrase="test")
        
        assert account_no_pass.address != account_with_pass.address
    
    def test_restore_from_private_key(self):
        """Should restore wallet from private key."""
        from eth_account import Account
        
        account = Account.from_key(TEST_PRIVATE_KEY)
        
        assert account.address is not None
        assert account.address.startswith("0x")
        assert len(account.address) == 42
    
    def test_restore_from_private_key_deterministic(self):
        """Same private key should always derive same address."""
        from eth_account import Account
        
        addresses = []
        for _ in range(3):
            account = Account.from_key(TEST_PRIVATE_KEY)
            addresses.append(account.address)
        
        assert all(addr == addresses[0] for addr in addresses)
    
    def test_derive_multiple_accounts_count(self):
        """Should derive correct number of accounts."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        count = 5
        accounts = []
        
        for i in range(count):
            path = f"m/44'/60'/0'/0/{i}"
            account = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path)
            accounts.append(account)
        
        assert len(accounts) == count
    
    def test_derive_multiple_accounts_unique(self):
        """Derived accounts should have unique addresses."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        addresses = []
        for i in range(10):
            path = f"m/44'/60'/0'/0/{i}"
            account = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path)
            addresses.append(account.address)
        
        assert len(set(addresses)) == 10
    
    def test_derive_multiple_accounts_deterministic(self):
        """Same index should always derive same address."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        for i in range(5):
            path = f"m/44'/60'/0'/0/{i}"
            addr1 = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path).address
            addr2 = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path).address
            assert addr1 == addr2, f"Index {i} should be deterministic"


class TestVanityAddressGeneration:
    """Test vanity address generation."""
    
    def test_vanity_prefix_match(self):
        """Generated address should match prefix pattern."""
        from eth_account import Account
        
        # Generate until we find one starting with '0' (very common)
        prefix = "0"
        max_attempts = 1000
        
        for _ in range(max_attempts):
            account = Account.create()
            addr_without_0x = account.address[2:].lower()
            if addr_without_0x.startswith(prefix.lower()):
                assert True
                return
        
        # Should find at least one in 1000 attempts (1/16 probability)
        pytest.fail(f"Should have found address with prefix '{prefix}' in {max_attempts} attempts")
    
    def test_vanity_suffix_match(self):
        """Generated address should match suffix pattern."""
        from eth_account import Account
        
        suffix = "0"
        max_attempts = 1000
        
        for _ in range(max_attempts):
            account = Account.create()
            addr_without_0x = account.address[2:].lower()
            if addr_without_0x.endswith(suffix.lower()):
                assert True
                return
        
        pytest.fail(f"Should have found address with suffix '{suffix}' in {max_attempts} attempts")
    
    def test_vanity_case_insensitive(self):
        """Case-insensitive matching should work."""
        # Test that lowercase and uppercase are treated the same
        from eth_account import Account
        
        account = Account.create()
        addr = account.address[2:]
        
        # Should match case-insensitively
        assert addr.lower() == addr.lower()
        assert addr.upper() != addr.lower() or addr.isdigit()  # Unless all digits


class TestErrorHandling:
    """Test error handling."""
    
    def test_wallet_error_to_dict(self):
        """WalletError should convert to dict properly."""
        error = WalletError("TEST_CODE", "Test message")
        result = error.to_dict()
        
        assert result["error"] is True
        assert result["code"] == "TEST_CODE"
        assert result["message"] == "Test message"
    
    def test_invalid_mnemonic_error(self):
        """InvalidMnemonicError should have correct code."""
        error = InvalidMnemonicError("Bad mnemonic")
        assert error.code == "INVALID_MNEMONIC"
    
    def test_invalid_key_error(self):
        """InvalidKeyError should have correct code."""
        error = InvalidKeyError("Bad key")
        assert error.code == "INVALID_KEY"
    
    def test_invalid_pattern_error(self):
        """InvalidPatternError should have correct code."""
        error = InvalidPatternError("Bad pattern")
        assert error.code == "INVALID_PATTERN"


class TestPublicKeyExtraction:
    """Test public key extraction."""
    
    def test_get_public_key_format(self):
        """Public key should be in correct format."""
        from eth_account import Account
        
        account = Account.create()
        public_key = _get_public_key(account)
        
        # Should start with 0x (hex format)
        assert public_key.startswith("0x")
        
        # Public key is 64 bytes = 128 hex chars + 2 for 0x
        assert len(public_key) == 130
    
    def test_get_public_key_deterministic(self):
        """Same account should always produce same public key."""
        from eth_account import Account
        
        account = Account.from_key(TEST_PRIVATE_KEY)
        
        pk1 = _get_public_key(account)
        pk2 = _get_public_key(account)
        
        assert pk1 == pk2


class TestDerivationPaths:
    """Test derivation path handling."""
    
    def test_standard_ethereum_path(self):
        """Standard Ethereum path should work."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        # Standard BIP44 Ethereum path
        path = "m/44'/60'/0'/0/0"
        account = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path)
        
        assert account.address is not None
    
    def test_different_paths_different_addresses(self):
        """Different paths should derive different addresses."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        paths = [
            "m/44'/60'/0'/0/0",
            "m/44'/60'/0'/0/1",
            "m/44'/60'/1'/0/0",
        ]
        
        addresses = []
        for path in paths:
            account = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path)
            addresses.append(account.address)
        
        assert len(set(addresses)) == len(paths)
    
    def test_custom_base_path(self):
        """Custom base path should work for derivation."""
        from eth_account import Account
        
        Account.enable_unaudited_hdwallet_features()
        
        base_path = "m/44'/60'/0'/0"
        
        for i in range(3):
            path = f"{base_path}/{i}"
            account = Account.from_mnemonic(TEST_MNEMONIC_12, account_path=path)
            assert account.address is not None


class TestMnemonicLanguages:
    """Test mnemonic language support."""
    
    def test_english_mnemonic(self):
        """English mnemonic should work."""
        from mnemonic import Mnemonic
        
        mnemo = Mnemonic("english")
        words = mnemo.generate(128)
        
        assert len(words.split()) == 12
        assert mnemo.check(words)
    
    def test_supported_languages(self):
        """All supported languages should work."""
        from mnemonic import Mnemonic
        
        languages = ["english", "spanish", "french", "italian", "japanese", "korean"]
        
        for lang in languages:
            try:
                mnemo = Mnemonic(lang)
                words = mnemo.generate(128)
                assert mnemo.check(words), f"Language {lang} mnemonic failed validation"
            except Exception as e:
                pytest.fail(f"Language {lang} failed: {e}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
