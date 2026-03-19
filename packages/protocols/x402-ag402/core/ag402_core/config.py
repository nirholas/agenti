"""
Centralized configuration for ag402-core.

All settings are read from environment variables with sensible defaults.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum


class RunMode(Enum):
    """Operating mode of the gateway."""

    PRODUCTION = "production"
    TEST = "test"


class NetworkMode(Enum):
    """Network mode for Solana connectivity."""

    MOCK = "mock"
    LOCALNET = "localnet"
    DEVNET = "devnet"
    MAINNET = "mainnet"


# --- Safety constants ---
# Hardcoded upper bounds that cannot be exceeded even via environment variables.
MAX_DAILY_SPEND_HARD_CEILING: float = 1000.0  # USD — absolute maximum for daily limit
MAX_SINGLE_TX: float = 5.0  # USD — absolute single-transaction ceiling
MAX_PER_MINUTE_LIMIT_CEILING: float = 10.0  # USD — max per-minute $ cap
MAX_PER_MINUTE_COUNT_CEILING: int = 50  # max per-minute TX count
MAX_CIRCUIT_BREAKER_THRESHOLD_CEILING: int = 20
MAX_CIRCUIT_BREAKER_COOLDOWN_CEILING: int = 3600  # seconds

PRIVATE_KEY_LOG_PATTERNS: list[str] = [
    "private_key",
    "secret_key",
    "mnemonic",
    "seed_phrase",
]

# ---------------------------------------------------------------------------
# Module-level private key store (S1-1: never written to os.environ)
# Uses bytearray so it can be securely zeroed via secure_zero().
# ---------------------------------------------------------------------------
_decrypted_private_key: bytearray = bytearray()


def get_decrypted_private_key() -> str:
    """Return the decrypted private key as a string (if available).

    This getter avoids exposing the key through os.environ, which would
    leak it to child processes and crash dumps.

    .. note::

       Prefer :func:`get_decrypted_private_key_buf` when the caller can
       work with ``bytearray`` — it avoids creating an immutable ``str``
       copy that cannot be wiped.
    """
    if not _decrypted_private_key:
        return ""
    return _decrypted_private_key.decode("utf-8")


def get_decrypted_private_key_buf() -> bytearray:
    """Return a **copy** of the decrypted private key as ``bytearray``.

    The caller is responsible for calling
    :func:`ag402_core.security.wallet_encryption.secure_zero` on the
    returned buffer when it is no longer needed.
    """
    return bytearray(_decrypted_private_key)


def clear_decrypted_private_key() -> None:
    """Securely zero and discard the module-level decrypted private key."""
    global _decrypted_private_key
    from ag402_core.security.wallet_encryption import secure_zero

    secure_zero(_decrypted_private_key)
    _decrypted_private_key = bytearray()


def _env_float(name: str, default: float, ceiling: float) -> float:
    """Read a float from env, clamped to ceiling. Rejects negative and NaN values."""
    import logging as _log
    import math

    raw = os.getenv(name, str(default))
    try:
        val = float(raw)
    except (ValueError, TypeError):
        _log.getLogger(__name__).warning(
            "Invalid value for %s='%s', falling back to default %.2f", name, raw, default
        )
        val = default
    if math.isnan(val) or math.isinf(val):
        _log.getLogger(__name__).warning(
            "%s=%s is NaN/Infinity — using default %.2f instead", name, raw, default,
        )
        val = default
    if val < 0:
        _log.getLogger(__name__).warning(
            "%s=%s is negative — using 0 instead", name, raw,
        )
        val = 0.0
    if val > ceiling:
        _log.getLogger(__name__).warning(
            "%s=%.2f exceeds ceiling %.2f — clamped to %.2f", name, val, ceiling, ceiling,
        )
        val = ceiling
    return val


def _env_int(name: str, default: int, ceiling: int) -> int:
    """Read an int from env, clamped to ceiling. Rejects negative values."""
    import logging as _log

    raw = os.getenv(name, str(default))
    try:
        val = int(raw)
    except (ValueError, TypeError):
        _log.getLogger(__name__).warning(
            "Invalid value for %s='%s', falling back to default %d", name, raw, default
        )
        val = default
    if val < 0:
        _log.getLogger(__name__).warning(
            "%s=%s is negative — using 0 instead", name, raw,
        )
        val = 0
    if val > ceiling:
        _log.getLogger(__name__).warning(
            "%s=%d exceeds ceiling %d — clamped to %d", name, val, ceiling, ceiling,
        )
        val = ceiling
    return val


@dataclass(frozen=True)
class X402Config:
    """Immutable configuration loaded once at startup."""

    # --- Core ---
    mode: RunMode = field(default_factory=lambda: RunMode(os.getenv("X402_MODE", "test")))
    # WARNING: X402_MODE defaults to "test" if unset. The gateway layer (ag402_mcp)
    # enforces explicit mode selection before starting, but direct X402Config()
    # callers should always set X402_MODE explicitly in production.
    network: NetworkMode = field(
        default_factory=lambda: NetworkMode(os.getenv("X402_NETWORK", "mock"))
    )
    protocol_version: str = "v1.0"

    # --- Wallet ---
    solana_private_key: str = field(default_factory=lambda: os.getenv("SOLANA_PRIVATE_KEY", ""), repr=False)
    solana_rpc_url: str = field(
        default_factory=lambda: os.getenv(
            "SOLANA_RPC_URL", "https://api.devnet.solana.com"
        )
    )
    solana_rpc_backup_url: str = field(
        default_factory=lambda: os.getenv("SOLANA_RPC_BACKUP_URL", "")
    )
    usdc_mint_address: str = field(default_factory=lambda: os.getenv("USDC_MINT_ADDRESS", ""))

    def __post_init__(self) -> None:
        # Auto-select USDC mint based on network if not explicitly set.
        # Prevents accidentally using devnet mint on mainnet (money loss!).
        if not self.usdc_mint_address:
            _network_mints = {
                NetworkMode.DEVNET: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                NetworkMode.MAINNET: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            }
            mint = _network_mints.get(self.network, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
            # frozen dataclass — use object.__setattr__
            object.__setattr__(self, "usdc_mint_address", mint)

    # --- Budget ---
    single_tx_limit: float = field(
        default_factory=lambda: _env_float(
            "X402_SINGLE_TX_LIMIT", 5.0, MAX_SINGLE_TX
        )
    )
    daily_limit: float = field(
        default_factory=lambda: _env_float(
            "X402_DAILY_LIMIT", 10.0, MAX_DAILY_SPEND_HARD_CEILING
        )
    )
    per_minute_limit: float = field(
        default_factory=lambda: _env_float(
            "X402_PER_MINUTE_LIMIT", 2.0, MAX_PER_MINUTE_LIMIT_CEILING
        )
    )
    per_minute_count: int = field(
        default_factory=lambda: _env_int(
            "X402_PER_MINUTE_COUNT", 5, MAX_PER_MINUTE_COUNT_CEILING
        )
    )

    # --- Circuit Breaker ---
    circuit_breaker_threshold: int = field(
        default_factory=lambda: _env_int(
            "X402_CIRCUIT_BREAKER_THRESHOLD", 3, MAX_CIRCUIT_BREAKER_THRESHOLD_CEILING
        )
    )
    circuit_breaker_cooldown: int = field(
        default_factory=lambda: _env_int(
            "X402_CIRCUIT_BREAKER_COOLDOWN", 60, MAX_CIRCUIT_BREAKER_COOLDOWN_CEILING
        )
    )

    # --- Gateway ---
    gateway_host: str = field(default_factory=lambda: os.getenv("X402_HOST", "127.0.0.1"))
    gateway_port: int = field(default_factory=lambda: _env_int("X402_PORT", 4020, 65535))

    # --- Wallet DB ---
    wallet_db_path: str = field(
        default_factory=lambda: os.getenv("X402_WALLET_DB", os.path.expanduser("~/.ag402/wallet.db"))
    )

    # --- Priority Fees ---
    priority_fee_microlamports: int = field(
        default_factory=lambda: _env_int("X402_PRIORITY_FEE", 0, 1_000_000)
    )
    compute_unit_limit: int = field(
        default_factory=lambda: _env_int("X402_COMPUTE_UNIT_LIMIT", 0, 1_400_000)
    )

    # --- Security ---
    replay_window_seconds: int = 30
    rate_limit_per_minute: int = field(
        default_factory=lambda: _env_int("X402_RATE_LIMIT", 60, 10000)
    )
    trusted_addresses: list[str] = field(default_factory=list)

    # --- Dual-mode fallback ---
    # If target doesn't support x402, forward with this API key instead
    fallback_api_key: str = field(
        default_factory=lambda: os.getenv("X402_FALLBACK_API_KEY", "")
    )

    # --- V2 Extension Points (pre-defined, inactive in V1) ---

    # Registry (yellow pages)
    registry_url: str = field(default_factory=lambda: os.getenv("X402_REGISTRY_URL", ""))

    # --- Prepaid ---
    # Seller's signing key for HMAC credential verification (P0-2 gateway)
    # Buyers: leave empty — they don't sign, they just present credentials.
    prepaid_signing_key: str = field(
        default_factory=lambda: os.getenv("AG402_PREPAID_SIGNING_KEY", ""), repr=False
    )

    # --- PBE Wallet Encryption ---
    unlock_password: str = field(
        default_factory=lambda: os.getenv("AG402_UNLOCK_PASSWORD", ""), repr=False
    )
    encrypted_wallet_path: str = field(
        default_factory=lambda: os.getenv(
            "AG402_WALLET_KEY_PATH",
            os.path.expanduser("~/.ag402/wallet.key"),
        )
    )

    @property
    def is_test_mode(self) -> bool:
        return self.mode == RunMode.TEST

    @property
    def is_localnet(self) -> bool:
        return self.network == NetworkMode.LOCALNET

    @property
    def effective_rpc_url(self) -> str:
        """RPC URL based on network mode (localnet overrides solana_rpc_url)."""
        if self.network == NetworkMode.LOCALNET:
            return "http://127.0.0.1:8899"
        if self.network == NetworkMode.MAINNET:
            return self.solana_rpc_url or "https://api.mainnet-beta.solana.com"
        return self.solana_rpc_url

    @property
    def daily_spend_limit(self) -> float:
        """Daily spend limit — configurable via X402_DAILY_LIMIT, capped at $1000."""
        return self.daily_limit


def load_config() -> X402Config:
    """Load configuration from environment variables.

    Automatically reads ~/.ag402/.env if present (does not override
    existing env vars).

    If SOLANA_PRIVATE_KEY is not set but an encrypted wallet.key exists,
    attempts to decrypt it using AG402_UNLOCK_PASSWORD (env or interactive).
    The decrypted key is stored in a module-level variable (S1-1), NOT
    in os.environ.
    """
    from ag402_core.env_manager import load_dotenv

    load_dotenv()  # ~/.ag402/.env → os.environ (no override)

    if not os.getenv("X402_MODE"):
        import logging as _log
        _log.getLogger(__name__).warning(
            "X402_MODE is not set — defaulting to 'test'. "
            "Set X402_MODE=production for real deployments."
        )

    # Auto-decrypt wallet.key if plaintext key is not available
    if not os.getenv("SOLANA_PRIVATE_KEY") and not _decrypted_private_key:
        _try_decrypt_wallet_key()

    # Build config; if no env-var key, fall back to the module-level decrypted key
    config = X402Config()
    if not config.solana_private_key and _decrypted_private_key:
        object.__setattr__(
            config, "solana_private_key", _decrypted_private_key.decode("utf-8")
        )

    return config


def _try_decrypt_wallet_key() -> None:
    """Attempt to decrypt ~/.ag402/wallet.key into module-level storage.

    S1-1 FIX: The decrypted key is stored in a module-level private variable
    (_decrypted_private_key) instead of os.environ, preventing leakage to
    child processes, crash dumps, and /proc/*/environ.

    Silent no-op if:
    - wallet.key does not exist
    - cryptography package is not installed
    - AG402_UNLOCK_PASSWORD is not set and stdin is not a tty
    """
    global _decrypted_private_key
    import logging as _log

    wallet_path = os.getenv(
        "AG402_WALLET_KEY_PATH",
        os.path.expanduser("~/.ag402/wallet.key"),
    )
    if not os.path.exists(wallet_path):
        return

    try:
        from ag402_core.security.wallet_encryption import (
            decrypt_private_key_bytes,
            get_unlock_password,
            load_encrypted_wallet,
        )

        encrypted_data = load_encrypted_wallet(wallet_path)
        if encrypted_data is None:
            return

        password = get_unlock_password()
        # S1-1+: Decrypt directly into bytearray (can be securely zeroed later)
        _decrypted_private_key = decrypt_private_key_bytes(password, encrypted_data)
        _log.getLogger(__name__).info(
            "Private key loaded from encrypted wallet: %s", wallet_path
        )
    except ImportError:
        _log.getLogger(__name__).debug(
            "cryptography not installed — cannot decrypt wallet.key"
        )
    except SystemExit:
        _log.getLogger(__name__).debug(
            "No unlock password available — skipping wallet.key decryption"
        )
    except Exception as exc:
        _log.getLogger(__name__).warning(
            "Failed to decrypt wallet.key: %s", exc
        )
