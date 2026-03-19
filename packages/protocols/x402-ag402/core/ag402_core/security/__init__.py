"""Security utilities for ag402-core."""

from ag402_core.security.key_guard import PrivateKeyFilter, install_key_guard
from ag402_core.security.wallet_encryption import (
    decrypt_private_key,
    decrypt_private_key_bytes,
    encrypt_private_key,
    get_unlock_password,
    load_encrypted_wallet,
    save_encrypted_wallet,
    secure_zero,
)

__all__ = [
    "PrivateKeyFilter",
    "install_key_guard",
    "encrypt_private_key",
    "decrypt_private_key",
    "decrypt_private_key_bytes",
    "save_encrypted_wallet",
    "load_encrypted_wallet",
    "get_unlock_password",
    "secure_zero",
]
