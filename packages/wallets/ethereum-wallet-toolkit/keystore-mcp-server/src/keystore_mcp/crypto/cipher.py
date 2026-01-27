"""
AES-128-CTR Cipher Operations for Keystore Encryption

Implements encryption and decryption following Web3 Secret Storage V3.
"""

import secrets
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend


# AES-128-CTR uses 16-byte IV
IV_LENGTH = 16
# AES-128 key is 16 bytes (first 16 bytes of derived key)
AES_KEY_LENGTH = 16


def encrypt_aes_ctr(
    plaintext: bytes,
    key: bytes,
    iv: bytes | None = None
) -> tuple[bytes, bytes]:
    """
    Encrypt data using AES-128-CTR.
    
    Args:
        plaintext: Data to encrypt (private key bytes)
        key: Derived key (uses first 16 bytes)
        iv: Initialization vector (generated if None)
        
    Returns:
        Tuple of (ciphertext, iv)
    """
    if iv is None:
        iv = secrets.token_bytes(IV_LENGTH)
    
    # Use first 16 bytes of key for AES-128
    aes_key = key[:AES_KEY_LENGTH]
    
    # Create AES-CTR cipher
    cipher = Cipher(
        algorithms.AES(aes_key),
        modes.CTR(iv),
        backend=default_backend()
    )
    
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    
    return ciphertext, iv


def decrypt_aes_ctr(
    ciphertext: bytes,
    key: bytes,
    iv: bytes
) -> bytes:
    """
    Decrypt data using AES-128-CTR.
    
    Args:
        ciphertext: Encrypted data
        key: Derived key (uses first 16 bytes)
        iv: Initialization vector used during encryption
        
    Returns:
        Decrypted plaintext (private key bytes)
    """
    # Use first 16 bytes of key for AES-128
    aes_key = key[:AES_KEY_LENGTH]
    
    # Create AES-CTR cipher
    cipher = Cipher(
        algorithms.AES(aes_key),
        modes.CTR(iv),
        backend=default_backend()
    )
    
    decryptor = cipher.decryptor()
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    
    return plaintext
