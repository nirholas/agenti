"""
Tests for keystore encryption functionality.
"""

import json
import pytest
from unittest.mock import MagicMock, patch

# Import crypto modules
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from keystore_mcp.crypto.kdf import derive_key_scrypt, derive_key_pbkdf2
from keystore_mcp.crypto.cipher import encrypt_aes_ctr, decrypt_aes_ctr
from keystore_mcp.crypto.mac import compute_mac, verify_mac


class TestKDF:
    """Tests for key derivation functions."""
    
    def test_derive_key_scrypt_default_params(self):
        """Test scrypt key derivation with default parameters."""
        password = "testpassword123"
        salt = os.urandom(32)
        
        derived_key, params = derive_key_scrypt(password, salt)
        
        assert len(derived_key) == 32
        assert params.n == 262144
        assert params.r == 8
        assert params.p == 1
        assert params.dklen == 32
        assert params.salt == salt
    
    def test_derive_key_scrypt_custom_params(self):
        """Test scrypt key derivation with custom parameters."""
        password = "testpassword123"
        salt = os.urandom(32)
        
        derived_key, params = derive_key_scrypt(
            password, salt, n=16384, r=8, p=1
        )
        
        assert len(derived_key) == 32
        assert params.n == 16384
    
    def test_derive_key_scrypt_deterministic(self):
        """Test that scrypt produces same key for same inputs."""
        password = "testpassword123"
        salt = bytes.fromhex("1234567890abcdef" * 4)
        
        key1, _ = derive_key_scrypt(password, salt, n=16384)
        key2, _ = derive_key_scrypt(password, salt, n=16384)
        
        assert key1 == key2
    
    def test_derive_key_pbkdf2_default_params(self):
        """Test PBKDF2 key derivation with default parameters."""
        password = "testpassword123"
        salt = os.urandom(32)
        
        derived_key, params = derive_key_pbkdf2(password, salt)
        
        assert len(derived_key) == 32
        assert params.c == 262144
        assert params.prf == "hmac-sha256"
        assert params.dklen == 32
    
    def test_derive_key_pbkdf2_deterministic(self):
        """Test that PBKDF2 produces same key for same inputs."""
        password = "testpassword123"
        salt = bytes.fromhex("1234567890abcdef" * 4)
        
        key1, _ = derive_key_pbkdf2(password, salt, iterations=10000)
        key2, _ = derive_key_pbkdf2(password, salt, iterations=10000)
        
        assert key1 == key2


class TestCipher:
    """Tests for AES-128-CTR cipher operations."""
    
    def test_encrypt_decrypt_roundtrip(self):
        """Test encryption followed by decryption returns original."""
        key = os.urandom(16)  # AES-128 key
        plaintext = bytes.fromhex("1234567890abcdef" * 2)  # 32-byte private key
        
        ciphertext, iv = encrypt_aes_ctr(plaintext, key)
        decrypted = decrypt_aes_ctr(ciphertext, key, iv)
        
        assert decrypted == plaintext
    
    def test_encrypt_produces_different_output(self):
        """Test that encryption with different IV produces different ciphertext."""
        key = os.urandom(16)
        plaintext = bytes.fromhex("1234567890abcdef" * 2)
        
        ciphertext1, iv1 = encrypt_aes_ctr(plaintext, key)
        ciphertext2, iv2 = encrypt_aes_ctr(plaintext, key)
        
        # Different IVs should produce different ciphertexts
        assert iv1 != iv2
        assert ciphertext1 != ciphertext2
    
    def test_decrypt_with_wrong_key_fails(self):
        """Test decryption with wrong key produces wrong result."""
        key1 = os.urandom(16)
        key2 = os.urandom(16)
        plaintext = bytes.fromhex("1234567890abcdef" * 2)
        
        ciphertext, iv = encrypt_aes_ctr(plaintext, key1)
        decrypted = decrypt_aes_ctr(ciphertext, key2, iv)
        
        assert decrypted != plaintext
    
    def test_ciphertext_length_equals_plaintext(self):
        """Test CTR mode produces ciphertext same length as plaintext."""
        key = os.urandom(16)
        plaintext = bytes.fromhex("1234567890abcdef" * 2)
        
        ciphertext, _ = encrypt_aes_ctr(plaintext, key)
        
        assert len(ciphertext) == len(plaintext)


class TestMAC:
    """Tests for Keccak-256 MAC operations."""
    
    def test_compute_mac_deterministic(self):
        """Test MAC computation is deterministic."""
        derived_key = os.urandom(32)
        ciphertext = os.urandom(32)
        
        mac1 = compute_mac(derived_key, ciphertext)
        mac2 = compute_mac(derived_key, ciphertext)
        
        assert mac1 == mac2
    
    def test_compute_mac_uses_last_16_bytes(self):
        """Test MAC uses last 16 bytes of derived key."""
        derived_key = bytes(range(32))  # 0-31
        ciphertext = bytes(16)  # 16 zero bytes
        
        mac = compute_mac(derived_key, ciphertext)
        
        # Should be keccak256(derived_key[16:32] + ciphertext)
        assert len(mac) == 32
    
    def test_verify_mac_correct(self):
        """Test MAC verification with correct MAC."""
        derived_key = os.urandom(32)
        ciphertext = os.urandom(32)
        
        mac = compute_mac(derived_key, ciphertext)
        
        assert verify_mac(derived_key, ciphertext, mac) is True
    
    def test_verify_mac_incorrect(self):
        """Test MAC verification with incorrect MAC."""
        derived_key = os.urandom(32)
        ciphertext = os.urandom(32)
        wrong_mac = os.urandom(32)
        
        assert verify_mac(derived_key, ciphertext, wrong_mac) is False
    
    def test_mac_changes_with_ciphertext(self):
        """Test MAC changes when ciphertext changes."""
        derived_key = os.urandom(32)
        ciphertext1 = bytes(32)
        ciphertext2 = bytes([1] + [0] * 31)
        
        mac1 = compute_mac(derived_key, ciphertext1)
        mac2 = compute_mac(derived_key, ciphertext2)
        
        assert mac1 != mac2


class TestKeystoreEncryption:
    """Integration tests for full keystore encryption."""
    
    def test_full_encryption_roundtrip(self):
        """Test complete encryption and decryption cycle."""
        # Generate a test private key
        private_key = os.urandom(32)
        password = "testpassword123"
        
        # Generate salt and IV
        salt = os.urandom(32)
        
        # Derive key using scrypt (with lower params for testing)
        derived_key, kdf_params = derive_key_scrypt(
            password, salt, n=16384, r=8, p=1
        )
        
        # Encrypt
        encryption_key = derived_key[:16]
        ciphertext, iv = encrypt_aes_ctr(private_key, encryption_key)
        
        # Compute MAC
        mac = compute_mac(derived_key, ciphertext)
        
        # Now decrypt
        derived_key2, _ = derive_key_scrypt(
            password, salt, n=16384, r=8, p=1
        )
        
        # Verify MAC
        assert verify_mac(derived_key2, ciphertext, mac)
        
        # Decrypt
        encryption_key2 = derived_key2[:16]
        decrypted = decrypt_aes_ctr(ciphertext, encryption_key2, iv)
        
        assert decrypted == private_key
    
    def test_wrong_password_fails_mac(self):
        """Test that wrong password fails MAC verification."""
        private_key = os.urandom(32)
        password = "correctpassword"
        wrong_password = "wrongpassword"
        salt = os.urandom(32)
        
        # Encrypt with correct password
        derived_key, _ = derive_key_scrypt(password, salt, n=16384)
        encryption_key = derived_key[:16]
        ciphertext, iv = encrypt_aes_ctr(private_key, encryption_key)
        mac = compute_mac(derived_key, ciphertext)
        
        # Try to decrypt with wrong password
        wrong_derived_key, _ = derive_key_scrypt(wrong_password, salt, n=16384)
        
        # MAC should fail
        assert verify_mac(wrong_derived_key, ciphertext, mac) is False


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_empty_password(self):
        """Test handling of empty password."""
        salt = os.urandom(32)
        
        # Empty password should still work (not recommended but valid)
        derived_key, params = derive_key_scrypt("", salt, n=16384)
        
        assert len(derived_key) == 32
    
    def test_unicode_password(self):
        """Test handling of Unicode password."""
        salt = os.urandom(32)
        password = "пароль密码🔐"
        
        derived_key, params = derive_key_scrypt(password, salt, n=16384)
        
        assert len(derived_key) == 32
    
    def test_long_password(self):
        """Test handling of very long password."""
        salt = os.urandom(32)
        password = "a" * 10000
        
        derived_key, params = derive_key_scrypt(password, salt, n=16384)
        
        assert len(derived_key) == 32


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
