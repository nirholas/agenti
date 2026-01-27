"""
Tests for keystore decryption functionality.
"""

import json
import os
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from keystore_mcp.crypto.kdf import derive_key_scrypt, derive_key_pbkdf2
from keystore_mcp.crypto.cipher import encrypt_aes_ctr, decrypt_aes_ctr
from keystore_mcp.crypto.mac import compute_mac, verify_mac


class TestDecryptionBasics:
    """Basic decryption tests."""
    
    def test_decrypt_scrypt_keystore(self):
        """Test decryption of a scrypt-encrypted keystore."""
        # Create a test keystore
        private_key = bytes.fromhex(
            "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
        )
        password = "testpassword123"
        salt = bytes.fromhex("ab0c7876052600dd703518d6fc3fe8984592145b591fc8fb5c6d43190334ba19")
        
        # Encrypt (with low params for speed)
        derived_key, kdf_params = derive_key_scrypt(password, salt, n=16384)
        encryption_key = derived_key[:16]
        ciphertext, iv = encrypt_aes_ctr(private_key, encryption_key)
        mac = compute_mac(derived_key, ciphertext)
        
        # Decrypt
        derived_key2, _ = derive_key_scrypt(password, salt, n=16384)
        
        # Verify MAC
        assert verify_mac(derived_key2, ciphertext, mac)
        
        # Decrypt
        decrypted = decrypt_aes_ctr(ciphertext, derived_key2[:16], iv)
        
        assert decrypted == private_key
    
    def test_decrypt_pbkdf2_keystore(self):
        """Test decryption of a PBKDF2-encrypted keystore."""
        private_key = os.urandom(32)
        password = "testpassword"
        salt = os.urandom(32)
        
        # Encrypt with PBKDF2 (low iterations for speed)
        derived_key, _ = derive_key_pbkdf2(password, salt, iterations=10000)
        encryption_key = derived_key[:16]
        ciphertext, iv = encrypt_aes_ctr(private_key, encryption_key)
        mac = compute_mac(derived_key, ciphertext)
        
        # Decrypt
        derived_key2, _ = derive_key_pbkdf2(password, salt, iterations=10000)
        assert verify_mac(derived_key2, ciphertext, mac)
        decrypted = decrypt_aes_ctr(ciphertext, derived_key2[:16], iv)
        
        assert decrypted == private_key


class TestPasswordVerification:
    """Tests for password verification via MAC."""
    
    def test_correct_password_verifies(self):
        """Test that correct password passes MAC verification."""
        private_key = os.urandom(32)
        password = "correctpassword"
        salt = os.urandom(32)
        
        derived_key, _ = derive_key_scrypt(password, salt, n=16384)
        ciphertext, _ = encrypt_aes_ctr(private_key, derived_key[:16])
        mac = compute_mac(derived_key, ciphertext)
        
        # Verify with same password
        derived_key2, _ = derive_key_scrypt(password, salt, n=16384)
        assert verify_mac(derived_key2, ciphertext, mac)
    
    def test_wrong_password_fails_verification(self):
        """Test that wrong password fails MAC verification."""
        private_key = os.urandom(32)
        correct_password = "correctpassword"
        wrong_password = "wrongpassword"
        salt = os.urandom(32)
        
        derived_key, _ = derive_key_scrypt(correct_password, salt, n=16384)
        ciphertext, _ = encrypt_aes_ctr(private_key, derived_key[:16])
        mac = compute_mac(derived_key, ciphertext)
        
        # Try to verify with wrong password
        wrong_key, _ = derive_key_scrypt(wrong_password, salt, n=16384)
        assert not verify_mac(wrong_key, ciphertext, mac)
    
    def test_similar_password_fails(self):
        """Test that similar but different password fails."""
        private_key = os.urandom(32)
        password = "MyPassword123"
        similar_password = "mypassword123"  # Different case
        salt = os.urandom(32)
        
        derived_key, _ = derive_key_scrypt(password, salt, n=16384)
        ciphertext, _ = encrypt_aes_ctr(private_key, derived_key[:16])
        mac = compute_mac(derived_key, ciphertext)
        
        # Verify with similar password should fail
        similar_key, _ = derive_key_scrypt(similar_password, salt, n=16384)
        assert not verify_mac(similar_key, ciphertext, mac)


class TestPasswordChange:
    """Tests for changing keystore password."""
    
    def test_change_password_preserves_key(self):
        """Test that changing password preserves the private key."""
        private_key = os.urandom(32)
        old_password = "oldpassword"
        new_password = "newpassword"
        
        # Encrypt with old password
        old_salt = os.urandom(32)
        old_derived_key, _ = derive_key_scrypt(old_password, old_salt, n=16384)
        ciphertext, iv = encrypt_aes_ctr(private_key, old_derived_key[:16])
        old_mac = compute_mac(old_derived_key, ciphertext)
        
        # Decrypt with old password
        derived_key_check, _ = derive_key_scrypt(old_password, old_salt, n=16384)
        assert verify_mac(derived_key_check, ciphertext, old_mac)
        decrypted_key = decrypt_aes_ctr(ciphertext, derived_key_check[:16], iv)
        
        # Re-encrypt with new password
        new_salt = os.urandom(32)
        new_derived_key, _ = derive_key_scrypt(new_password, new_salt, n=16384)
        new_ciphertext, new_iv = encrypt_aes_ctr(decrypted_key, new_derived_key[:16])
        new_mac = compute_mac(new_derived_key, new_ciphertext)
        
        # Verify new keystore works
        verify_key, _ = derive_key_scrypt(new_password, new_salt, n=16384)
        assert verify_mac(verify_key, new_ciphertext, new_mac)
        
        final_key = decrypt_aes_ctr(new_ciphertext, verify_key[:16], new_iv)
        assert final_key == private_key
    
    def test_change_kdf_preserves_key(self):
        """Test changing KDF from PBKDF2 to scrypt preserves key."""
        private_key = os.urandom(32)
        password = "testpassword"
        
        # Encrypt with PBKDF2
        pbkdf2_salt = os.urandom(32)
        pbkdf2_key, _ = derive_key_pbkdf2(password, pbkdf2_salt, iterations=10000)
        ciphertext, iv = encrypt_aes_ctr(private_key, pbkdf2_key[:16])
        pbkdf2_mac = compute_mac(pbkdf2_key, ciphertext)
        
        # Decrypt
        decrypted = decrypt_aes_ctr(ciphertext, pbkdf2_key[:16], iv)
        
        # Re-encrypt with scrypt
        scrypt_salt = os.urandom(32)
        scrypt_key, _ = derive_key_scrypt(password, scrypt_salt, n=16384)
        new_ciphertext, new_iv = encrypt_aes_ctr(decrypted, scrypt_key[:16])
        scrypt_mac = compute_mac(scrypt_key, new_ciphertext)
        
        # Verify new keystore
        verify_key, _ = derive_key_scrypt(password, scrypt_salt, n=16384)
        assert verify_mac(verify_key, new_ciphertext, scrypt_mac)
        
        final_key = decrypt_aes_ctr(new_ciphertext, verify_key[:16], new_iv)
        assert final_key == private_key


class TestDecryptionErrors:
    """Tests for error handling during decryption."""
    
    def test_corrupted_ciphertext_detected(self):
        """Test that corrupted ciphertext is detected via MAC."""
        private_key = os.urandom(32)
        password = "testpassword"
        salt = os.urandom(32)
        
        derived_key, _ = derive_key_scrypt(password, salt, n=16384)
        ciphertext, iv = encrypt_aes_ctr(private_key, derived_key[:16])
        mac = compute_mac(derived_key, ciphertext)
        
        # Corrupt ciphertext
        corrupted = bytearray(ciphertext)
        corrupted[0] ^= 0xFF
        corrupted = bytes(corrupted)
        
        # MAC verification should fail
        assert not verify_mac(derived_key, corrupted, mac)
    
    def test_corrupted_mac_detected(self):
        """Test that corrupted MAC is detected."""
        private_key = os.urandom(32)
        password = "testpassword"
        salt = os.urandom(32)
        
        derived_key, _ = derive_key_scrypt(password, salt, n=16384)
        ciphertext, _ = encrypt_aes_ctr(private_key, derived_key[:16])
        mac = compute_mac(derived_key, ciphertext)
        
        # Corrupt MAC
        corrupted_mac = bytearray(mac)
        corrupted_mac[0] ^= 0xFF
        corrupted_mac = bytes(corrupted_mac)
        
        # Verification should fail
        assert not verify_mac(derived_key, ciphertext, corrupted_mac)


class TestRealWorldKeystores:
    """Tests with realistic keystore structures."""
    
    def test_create_and_decrypt_keystore_structure(self):
        """Test creating and decrypting a full keystore structure."""
        import uuid
        from eth_keys import keys
        
        # Generate test account
        private_key_bytes = os.urandom(32)
        private_key = keys.PrivateKey(private_key_bytes)
        address = private_key.public_key.to_checksum_address()
        
        password = "SecurePassword123!"
        salt = os.urandom(32)
        
        # Create keystore
        derived_key, kdf_params = derive_key_scrypt(password, salt, n=16384)
        encryption_key = derived_key[:16]
        ciphertext, iv = encrypt_aes_ctr(private_key_bytes, encryption_key)
        mac = compute_mac(derived_key, ciphertext)
        
        keystore = {
            "version": 3,
            "id": str(uuid.uuid4()),
            "address": address[2:].lower(),
            "crypto": {
                "ciphertext": ciphertext.hex(),
                "cipherparams": {
                    "iv": iv.hex()
                },
                "cipher": "aes-128-ctr",
                "kdf": "scrypt",
                "kdfparams": {
                    "n": kdf_params.n,
                    "r": kdf_params.r,
                    "p": kdf_params.p,
                    "dklen": kdf_params.dklen,
                    "salt": kdf_params.salt.hex()
                },
                "mac": mac.hex()
            }
        }
        
        # Decrypt the keystore
        crypto = keystore["crypto"]
        stored_salt = bytes.fromhex(crypto["kdfparams"]["salt"])
        derived_key2, _ = derive_key_scrypt(
            password, stored_salt, 
            n=crypto["kdfparams"]["n"]
        )
        
        stored_ciphertext = bytes.fromhex(crypto["ciphertext"])
        stored_mac = bytes.fromhex(crypto["mac"])
        
        assert verify_mac(derived_key2, stored_ciphertext, stored_mac)
        
        stored_iv = bytes.fromhex(crypto["cipherparams"]["iv"])
        decrypted = decrypt_aes_ctr(
            stored_ciphertext, derived_key2[:16], stored_iv
        )
        
        assert decrypted == private_key_bytes
        
        # Verify address matches
        recovered_key = keys.PrivateKey(decrypted)
        recovered_address = recovered_key.public_key.to_checksum_address()
        assert recovered_address.lower() == ("0x" + keystore["address"]).lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
