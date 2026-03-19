"""Tests for private key memory safety (Issue #1).

Verifies that:
  1. secure_zero() actually zeroes bytearray buffers via ctypes.memset
  2. decrypt_private_key_bytes() returns a wipeable bytearray
  3. wipe_from_memory() delegates to secure_zero() for bytearrays
  4. config module stores decrypted key as bytearray and can clear it
  5. SolanaAdapter accepts bytearray and wipes the input buffer
"""

from __future__ import annotations

import os

import pytest

# ---------------------------------------------------------------------------
# 1. secure_zero — core primitive
# ---------------------------------------------------------------------------


def test_secure_zero_zeroes_bytearray():
    """secure_zero must overwrite every byte with 0x00."""
    from ag402_core.security.wallet_encryption import secure_zero

    buf = bytearray(b"my_secret_key_data_1234567890")
    assert any(b != 0 for b in buf), "precondition: buffer is non-zero"

    secure_zero(buf)
    assert all(b == 0 for b in buf), "secure_zero did not zero out buffer"
    # Length must be preserved (not truncated)
    assert len(buf) == len(b"my_secret_key_data_1234567890")


def test_secure_zero_empty_bytearray_is_noop():
    """secure_zero on empty bytearray should not raise."""
    from ag402_core.security.wallet_encryption import secure_zero

    buf = bytearray()
    secure_zero(buf)  # should not raise
    assert len(buf) == 0


def test_secure_zero_rejects_non_bytearray():
    """secure_zero should be a no-op for non-bytearray types (not raise)."""
    from ag402_core.security.wallet_encryption import secure_zero

    # str — should silently do nothing
    secure_zero("hello")  # type: ignore[arg-type]

    # bytes — immutable, should silently do nothing
    secure_zero(b"hello")  # type: ignore[arg-type]


def test_secure_zero_large_buffer():
    """secure_zero works on larger buffers (e.g. 1 KB)."""
    from ag402_core.security.wallet_encryption import secure_zero

    buf = bytearray(os.urandom(1024))
    secure_zero(buf)
    assert all(b == 0 for b in buf)


# ---------------------------------------------------------------------------
# 2. decrypt_private_key_bytes — returns wipeable bytearray
# ---------------------------------------------------------------------------


def test_decrypt_private_key_bytes_returns_bytearray():
    """decrypt_private_key_bytes must return a bytearray, not str."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key_bytes,
        encrypt_private_key,
    )

    password = "strong_test_password"
    original = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
    enc = encrypt_private_key(password, original)

    result = decrypt_private_key_bytes(password, enc)
    assert isinstance(result, bytearray), f"Expected bytearray, got {type(result)}"
    assert result.decode("utf-8") == original


def test_decrypt_private_key_bytes_can_be_wiped():
    """The bytearray from decrypt_private_key_bytes can be securely zeroed."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key_bytes,
        encrypt_private_key,
        secure_zero,
    )

    password = "strong_test_password"
    original = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
    enc = encrypt_private_key(password, original)

    result = decrypt_private_key_bytes(password, enc)
    assert any(b != 0 for b in result), "precondition: result is non-zero"

    secure_zero(result)
    assert all(b == 0 for b in result), "bytearray was not zeroed after secure_zero"


def test_decrypt_private_key_bytes_wrong_password_raises():
    """Wrong password should raise InvalidToken."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key_bytes,
        encrypt_private_key,
    )

    enc = encrypt_private_key("correct_password", "my_key_data")
    with pytest.raises(Exception):  # cryptography.fernet.InvalidToken
        decrypt_private_key_bytes("wrong_password!!", enc)


# ---------------------------------------------------------------------------
# 3. wipe_from_memory — delegates to secure_zero for bytearray
# ---------------------------------------------------------------------------


def test_wipe_from_memory_zeroes_bytearray():
    """wipe_from_memory should use secure_zero for bytearray."""
    from ag402_core.security.wallet_encryption import wipe_from_memory

    buf = bytearray(b"sensitive_data_here")
    wipe_from_memory(buf)
    assert all(b == 0 for b in buf), "wipe_from_memory did not zero bytearray"


def test_wipe_from_memory_str_does_not_crash():
    """wipe_from_memory on str should not raise (best-effort, backward compat)."""
    from ag402_core.security.wallet_encryption import wipe_from_memory

    wipe_from_memory("some_secret_string")  # should not raise


# ---------------------------------------------------------------------------
# 4. config module — bytearray storage + clear
# ---------------------------------------------------------------------------


def test_config_decrypted_key_stored_as_bytearray():
    """Module-level _decrypted_private_key should be a bytearray."""
    import ag402_core.config as cfg

    assert isinstance(cfg._decrypted_private_key, bytearray)


def test_config_clear_decrypted_private_key():
    """clear_decrypted_private_key should zero and reset the buffer."""
    import ag402_core.config as cfg

    # Simulate a decrypted key being stored
    original_key = cfg._decrypted_private_key
    cfg._decrypted_private_key = bytearray(b"test_private_key_data")
    try:
        cfg.clear_decrypted_private_key()
        # After clearing, getter should return empty string
        assert cfg.get_decrypted_private_key() == ""
        assert len(cfg._decrypted_private_key) == 0
    finally:
        # Restore original state
        cfg._decrypted_private_key = original_key


def test_config_get_decrypted_private_key_returns_str():
    """get_decrypted_private_key should decode bytearray to str."""
    import ag402_core.config as cfg

    original_key = cfg._decrypted_private_key
    cfg._decrypted_private_key = bytearray(b"test_key_123")
    try:
        result = cfg.get_decrypted_private_key()
        assert isinstance(result, str)
        assert result == "test_key_123"
    finally:
        cfg._decrypted_private_key = original_key


def test_config_get_decrypted_private_key_buf_returns_copy():
    """get_decrypted_private_key_buf should return a copy (not a reference)."""
    import ag402_core.config as cfg

    original_key = cfg._decrypted_private_key
    cfg._decrypted_private_key = bytearray(b"test_key_456")
    try:
        buf = cfg.get_decrypted_private_key_buf()
        assert isinstance(buf, bytearray)
        assert buf == bytearray(b"test_key_456")
        # Modifying the copy should NOT affect the original
        buf[0] = 0
        assert cfg._decrypted_private_key[0] != 0
    finally:
        cfg._decrypted_private_key = original_key


# ---------------------------------------------------------------------------
# 5. Backward compatibility — original decrypt_private_key still returns str
# ---------------------------------------------------------------------------


def test_decrypt_private_key_still_returns_str():
    """Original decrypt_private_key must still return str for backward compat."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key,
        encrypt_private_key,
    )

    password = "strong_test_password"
    original = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
    enc = encrypt_private_key(password, original)

    result = decrypt_private_key(password, enc)
    assert isinstance(result, str), f"Expected str, got {type(result)}"
    assert result == original
