"""
Tests for keystore validation functionality.
"""

import json
import os
import pytest
from unittest.mock import MagicMock, patch
import uuid

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from keystore_mcp.utils.validation import (
    validate_private_key,
    validate_password,
    validate_keystore_structure,
    normalize_private_key,
    get_keystore_address,
)


class TestPrivateKeyValidation:
    """Tests for private key validation."""
    
    def test_valid_private_key_hex_with_prefix(self):
        """Test valid private key with 0x prefix."""
        key = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
        is_valid, error, key_bytes = validate_private_key(key)
        assert is_valid is True
        assert key_bytes is not None
    
    def test_valid_private_key_hex_without_prefix(self):
        """Test valid private key without 0x prefix."""
        key = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
        is_valid, error, key_bytes = validate_private_key(key)
        assert is_valid is True
        assert key_bytes is not None
    
    def test_invalid_private_key_too_short(self):
        """Test private key that's too short."""
        key = "0x4c0883a69102937d6231471b5dbb6204"
        is_valid, error, key_bytes = validate_private_key(key)
        assert is_valid is False
        assert "64" in error  # expected length
    
    def test_invalid_private_key_too_long(self):
        """Test private key that's too long."""
        key = "0x" + "a" * 128
        is_valid, error, key_bytes = validate_private_key(key)
        assert is_valid is False
    
    def test_invalid_private_key_non_hex(self):
        """Test private key with non-hex characters."""
        key = "0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
        is_valid, error, key_bytes = validate_private_key(key)
        assert is_valid is False
    
    def test_private_key_empty(self):
        """Test empty private key."""
        is_valid, error, key_bytes = validate_private_key("")
        assert is_valid is False
    
    def test_private_key_none(self):
        """Test None private key."""
        is_valid, error, key_bytes = validate_private_key(None)
        assert is_valid is False


class TestNormalizePrivateKey:
    """Tests for private key normalization."""
    
    def test_normalize_with_prefix(self):
        """Test normalizing key with 0x prefix."""
        key = "0x4C0883A69102937D6231471B5DBB6204FE5129617082792AE468D01A3F362318"
        normalized = normalize_private_key(key)
        assert normalized.startswith("0x")
        assert normalized == normalized.lower()
    
    def test_normalize_without_prefix(self):
        """Test normalizing key without prefix."""
        key = "4C0883A69102937D6231471B5DBB6204FE5129617082792AE468D01A3F362318"
        normalized = normalize_private_key(key)
        assert normalized.startswith("0x")
        assert normalized == normalized.lower()


class TestPasswordValidation:
    """Tests for password validation."""
    
    def test_strong_password(self):
        """Test strong password passes validation."""
        password = "MyStr0ng!Password#2024"
        is_valid, warnings = validate_password(password)
        assert is_valid is True
    
    def test_weak_password_too_short(self):
        """Test weak password (too short)."""
        password = "Ab1!"
        is_valid, warnings = validate_password(password, min_length=8)
        assert is_valid is False
    
    def test_password_with_warnings(self):
        """Test password that is valid but has warnings."""
        password = "testpassword"  # Valid length but missing complexity
        is_valid, warnings = validate_password(password)
        assert is_valid is True
        assert len(warnings) > 0  # Should have warnings about complexity
    
    def test_empty_password(self):
        """Test empty password fails."""
        is_valid, warnings = validate_password("")
        assert is_valid is False


class TestKeystoreStructureValidation:
    """Tests for validating complete keystore structure."""
    
    def get_valid_keystore(self):
        """Return a valid keystore structure for testing."""
        return {
            "version": 3,
            "id": str(uuid.uuid4()),
            "address": "742d35cc6634c0532925a3b844bc9e7595f8fe00",
            "crypto": {
                "ciphertext": "a" * 64,
                "cipherparams": {
                    "iv": "b" * 32
                },
                "cipher": "aes-128-ctr",
                "kdf": "scrypt",
                "kdfparams": {
                    "n": 262144,
                    "r": 8,
                    "p": 1,
                    "dklen": 32,
                    "salt": "c" * 64
                },
                "mac": "d" * 64
            }
        }
    
    def test_valid_keystore_structure(self):
        """Test validation of valid keystore structure."""
        keystore = self.get_valid_keystore()
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is True
        assert len(result["errors"]) == 0
    
    def test_missing_version(self):
        """Test keystore missing version field."""
        keystore = self.get_valid_keystore()
        del keystore["version"]
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
        assert any("version" in e.lower() for e in result["errors"])
    
    def test_wrong_version(self):
        """Test keystore with wrong version."""
        keystore = self.get_valid_keystore()
        keystore["version"] = 2
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
    
    def test_missing_crypto(self):
        """Test keystore missing crypto section."""
        keystore = self.get_valid_keystore()
        del keystore["crypto"]
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
    
    def test_missing_mac(self):
        """Test keystore missing MAC."""
        keystore = self.get_valid_keystore()
        del keystore["crypto"]["mac"]
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
        assert any("mac" in e.lower() for e in result["errors"])
    
    def test_invalid_mac_length(self):
        """Test keystore with invalid MAC length."""
        keystore = self.get_valid_keystore()
        keystore["crypto"]["mac"] = "abc"  # Too short
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
    
    def test_invalid_iv_length(self):
        """Test keystore with invalid IV length."""
        keystore = self.get_valid_keystore()
        keystore["crypto"]["cipherparams"]["iv"] = "abc"  # Too short
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
    
    def test_missing_kdfparams(self):
        """Test keystore missing KDF parameters."""
        keystore = self.get_valid_keystore()
        del keystore["crypto"]["kdfparams"]
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
    
    def test_unsupported_cipher(self):
        """Test keystore with unsupported cipher."""
        keystore = self.get_valid_keystore()
        keystore["crypto"]["cipher"] = "aes-256-gcm"
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is False
    
    def test_pbkdf2_keystore(self):
        """Test valid PBKDF2 keystore structure."""
        keystore = self.get_valid_keystore()
        keystore["crypto"]["kdf"] = "pbkdf2"
        keystore["crypto"]["kdfparams"] = {
            "c": 262144,
            "prf": "hmac-sha256",
            "dklen": 32,
            "salt": "c" * 64
        }
        result = validate_keystore_structure(keystore)
        assert result["is_valid"] is True


class TestGetKeystoreAddress:
    """Tests for extracting address from keystore."""
    
    def test_get_address_lowercase(self):
        """Test getting address from lowercase format."""
        keystore = {"address": "742d35cc6634c0532925a3b844bc9e7595f8fe00"}
        address = get_keystore_address(keystore)
        assert address is not None
        assert address.startswith("0x")
    
    def test_get_address_with_prefix(self):
        """Test getting address that already has 0x prefix."""
        keystore = {"address": "0x742d35cc6634c0532925a3b844bc9e7595f8fe00"}
        address = get_keystore_address(keystore)
        assert address is not None
        assert address.startswith("0x")
    
    def test_get_address_missing(self):
        """Test getting address when not present."""
        keystore = {}
        address = get_keystore_address(keystore)
        assert address is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
