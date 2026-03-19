"""
Password-Based Encryption (PBE) for Solana private key protection.

Uses PBKDF2-HMAC-SHA256 + Fernet (AES-128-CBC) to encrypt private keys.
The encrypted key is stored on disk; the plaintext key only exists in memory
during active use.

Supports:
- Interactive password input (getpass)
- Environment variable (AG402_UNLOCK_PASSWORD) for Docker/CI automation
"""

from __future__ import annotations

import base64
import gc
import json
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

# PBKDF2 iteration count — OWASP 2023 recommendation for SHA256
_PBKDF2_ITERATIONS = 480_000

# Minimum password length for wallet encryption (NIST 800-63B recommends >= 12)
_MIN_PASSWORD_LENGTH = 12


def secure_zero(buf: bytearray) -> None:
    """Securely zero out a bytearray using ctypes.memset.

    Unlike a Python ``for`` loop, ctypes.memset cannot be optimised away by
    the interpreter — the underlying C library call always writes zeroes.
    """
    if not isinstance(buf, bytearray) or len(buf) == 0:
        return
    import ctypes

    ctypes.memset((ctypes.c_char * len(buf)).from_buffer(buf), 0, len(buf))


def _import_crypto():
    """Lazy import cryptography — allows graceful degradation when not installed."""
    try:
        from cryptography.fernet import Fernet
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

        return Fernet, hashes, PBKDF2HMAC
    except ImportError as err:
        raise ImportError(
            "cryptography package is required for wallet encryption. "
            "Install it with: pip install cryptography"
        ) from err


def _derive_key(password: str, salt: bytes) -> bytes:
    """Derive a Fernet-compatible AES key from password + salt."""
    Fernet, hashes, PBKDF2HMAC = _import_crypto()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))


def encrypt_private_key(password: str, private_key: str) -> dict[str, str]:
    """Encrypt a private key with a user-provided password.

    Returns a dict with 'salt' (hex) and 'encrypted_key' (base64) suitable
    for JSON serialisation and storage on disk.

    Raises ValueError if password is too short (< 12 characters).
    """
    if not password or len(password) < _MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must be at least {_MIN_PASSWORD_LENGTH} characters long. "
            "Use a strong, unique password (a password manager is recommended)."
        )
    Fernet, _, _ = _import_crypto()
    salt = os.urandom(16)
    key = _derive_key(password, salt)
    fernet = Fernet(key)
    encrypted = fernet.encrypt(private_key.encode("utf-8"))

    return {
        "salt": salt.hex(),
        "encrypted_key": encrypted.decode("utf-8"),
    }


def decrypt_private_key(password: str, encrypted_data: dict[str, str]) -> str:
    """Decrypt a private key using the user-provided password.

    Raises ``InvalidToken`` (from cryptography) if the password is wrong.

    .. note::

       Prefer :func:`decrypt_private_key_bytes` when the caller can work
       with ``bytearray`` — it allows real memory wiping via
       :func:`secure_zero`.
    """
    Fernet, _, _ = _import_crypto()
    salt = bytes.fromhex(encrypted_data["salt"])
    key = _derive_key(password, salt)
    fernet = Fernet(key)
    decrypted = fernet.decrypt(encrypted_data["encrypted_key"].encode("utf-8"))
    return decrypted.decode("utf-8")


def decrypt_private_key_bytes(password: str, encrypted_data: dict[str, str]) -> bytearray:
    """Decrypt a private key into a **mutable** ``bytearray``.

    Unlike :func:`decrypt_private_key` (which returns an immutable ``str``),
    the returned ``bytearray`` can be securely zeroed after use via
    :func:`secure_zero`.

    Usage::

        key_buf = decrypt_private_key_bytes(password, data)
        try:
            adapter = SolanaAdapter(private_key=key_buf)
        finally:
            secure_zero(key_buf)
    """
    Fernet, _, _ = _import_crypto()
    salt = bytes.fromhex(encrypted_data["salt"])
    key = _derive_key(password, salt)
    fernet = Fernet(key)
    decrypted = fernet.decrypt(encrypted_data["encrypted_key"].encode("utf-8"))
    # Return as bytearray so caller can zero it after use
    return bytearray(decrypted)


def save_encrypted_wallet(path: str, encrypted_data: dict[str, str]) -> None:
    """Persist encrypted wallet data to disk with restrictive permissions.

    Uses atomic write (write to temp file then os.replace) so a crash
    mid-write cannot corrupt the wallet file.
    """
    wallet_dir = os.path.dirname(path) or "."
    if not os.path.exists(wallet_dir):
        os.makedirs(wallet_dir, exist_ok=True)

    # Write to a temp file in the same directory, then atomically rename
    fd, tmp_path = tempfile.mkstemp(dir=wallet_dir, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(encrypted_data, f, indent=2)
        # Restrict file permissions (owner-only read/write)
        import contextlib
        with contextlib.suppress(OSError):
            os.chmod(tmp_path, 0o600)
        os.replace(tmp_path, path)
    except BaseException:
        # Clean up temp file on any failure
        with contextlib.suppress(OSError):
            os.unlink(tmp_path)
        raise


def load_encrypted_wallet(path: str) -> dict[str, str] | None:
    """Load encrypted wallet data from disk. Returns None if file missing."""
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def wipe_from_memory(value: str | bytearray) -> None:
    """Best-effort wipe of sensitive data from memory.

    For ``bytearray`` objects, uses :func:`secure_zero` (ctypes.memset) to
    overwrite the buffer with zeroes — this cannot be optimised away.

    For ``str`` objects, Python strings are immutable and cannot be truly
    erased — we can only delete the reference and request GC.

    **Recommendation**: prefer ``bytearray`` for storing sensitive data
    so this function can actually zero out the memory.
    """
    if isinstance(value, bytearray):
        secure_zero(value)
    del value
    gc.collect()


def get_unlock_password(env_var: str = "AG402_UNLOCK_PASSWORD") -> str:
    """Get the unlock password from env var or interactive prompt.

    Raises SystemExit if running non-interactively without the env var.
    """
    password = os.getenv(env_var, "")
    if password:
        return password

    import sys
    if not sys.stdin.isatty():
        logger.error("No unlock password provided and stdin is not interactive.")
        raise SystemExit(
            "Set AG402_UNLOCK_PASSWORD environment variable for non-interactive mode."
        )

    import getpass
    return getpass.getpass("Enter wallet unlock password: ")
