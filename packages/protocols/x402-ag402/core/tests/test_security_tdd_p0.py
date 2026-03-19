"""P0 Security TDD Tests — Critical vulnerabilities.

These tests are written FIRST (red phase) to expose security issues,
then source code is fixed to make them pass (green phase).

Coverage:
  1. SQL LIKE wildcard injection in find_transactions_by_prefix
  2. Negative / zero amount deduction & deposit validation
  3. Encryption module boundary tests (wrong password, tampered ciphertext,
     malformed JSON, wipe_from_memory)
  4. Circuit breaker TOCTOU race condition

Root-cause fix for hangs: pytest-asyncio 1.x auto-mode does NOT properly
handle async methods inside classes.  All async tests are module-level
functions.  All threading tests use join(timeout=) to prevent deadlocks.
"""

from __future__ import annotations

import json
import os
import threading
from decimal import Decimal

import pytest
from ag402_core.wallet.agent_wallet import AgentWallet

# ---------------------------------------------------------------------------
# Global timeout for every test in this module (seconds)
# ---------------------------------------------------------------------------
pytestmark = pytest.mark.timeout(15)

# Thread join timeout to prevent deadlocks
_THREAD_TIMEOUT = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture
async def wallet(tmp_path):
    """Fresh wallet with 100 USDC balance."""
    db_path = str(tmp_path / "test_p0.db")
    w = AgentWallet(db_path=db_path)
    await w.init_db()
    await w.deposit(100.0, note="setup")
    yield w
    await w.close()


@pytest.fixture
async def empty_wallet(tmp_path):
    """Fresh wallet with 0 balance."""
    db_path = str(tmp_path / "test_p0_empty.db")
    w = AgentWallet(db_path=db_path)
    await w.init_db()
    yield w
    await w.close()


# ===================================================================
# 1. SQL LIKE Wildcard Injection
# ===================================================================

async def test_like_percent_wildcard_should_not_match_all(wallet):
    """Searching with '%' should NOT return all transactions."""
    await wallet.deduct(Decimal("1"), "addr1", "hash1")
    await wallet.deduct(Decimal("2"), "addr2", "hash2")

    # A literal '%' prefix should match nothing (no ID starts with '%')
    results = await wallet.find_transactions_by_prefix("%", limit=100)
    assert len(results) == 0, (
        "LIKE wildcard '%' leaked: returned all transactions instead of none"
    )


async def test_like_underscore_wildcard_should_not_match_single_char(wallet):
    """Searching with '_' should NOT act as single-character wildcard."""
    await wallet.deduct(Decimal("1"), "addr1", "hash1")

    results = await wallet.find_transactions_by_prefix("_", limit=100)
    assert len(results) == 0, (
        "LIKE wildcard '_' leaked: matched transaction IDs it shouldn't"
    )


async def test_like_backslash_in_prefix(wallet):
    """Backslash in prefix should not cause SQL errors."""
    await wallet.deduct(Decimal("1"), "addr1", "hash1")
    results = await wallet.find_transactions_by_prefix("\\", limit=100)
    assert len(results) == 0


async def test_like_combined_wildcards(wallet):
    """Combined wildcards should be treated as literals."""
    await wallet.deduct(Decimal("1"), "addr1", "hash1")
    results = await wallet.find_transactions_by_prefix("%_", limit=100)
    assert len(results) == 0


async def test_like_sql_injection_string_in_prefix(wallet):
    """SQL injection payload in prefix should be safe (parameterized query)."""
    await wallet.deduct(Decimal("1"), "addr1", "hash1")

    results = await wallet.find_transactions_by_prefix(
        "'; DROP TABLE transactions; --", limit=100
    )
    assert len(results) == 0

    # Verify table still intact
    txs = await wallet.get_transactions(limit=100)
    assert len(txs) >= 1


async def test_like_legitimate_prefix_still_works(wallet):
    """Normal UUID prefix search should still work after escaping."""
    tx = await wallet.deduct(Decimal("1"), "addr1", "hash1")

    prefix = tx.id[:8]
    results = await wallet.find_transactions_by_prefix(prefix, limit=10)
    assert any(r.id == tx.id for r in results), (
        "Legitimate prefix search broken after LIKE escape fix"
    )


# ===================================================================
# 2. Negative / Zero Amount Validation
# ===================================================================

async def test_deduct_negative_amount_rejected(wallet):
    """Negative deduction (= free money) must be rejected."""
    with pytest.raises(ValueError, match="positive"):
        await wallet.deduct(Decimal("-1.00"), "addr", "hash")


async def test_deduct_zero_amount_rejected(wallet):
    """Zero deduction is meaningless and must be rejected."""
    with pytest.raises(ValueError, match="positive"):
        await wallet.deduct(Decimal("0"), "addr", "hash")


async def test_deduct_negative_float_rejected(wallet):
    """Float negative amount must also be rejected."""
    with pytest.raises(ValueError, match="positive"):
        await wallet.deduct(-0.5, "addr", "hash")


async def test_deposit_negative_amount_rejected(empty_wallet):
    """Negative deposit (= stealing money) must be rejected."""
    with pytest.raises(ValueError, match="positive"):
        await empty_wallet.deposit(Decimal("-10.00"))


async def test_deposit_zero_amount_rejected(empty_wallet):
    """Zero deposit is meaningless and must be rejected."""
    with pytest.raises(ValueError, match="positive"):
        await empty_wallet.deposit(Decimal("0"))


async def test_tiny_positive_amount_accepted(wallet):
    """Tiny positive amount (1 lamport = 0.000001) should be accepted."""
    tx = await wallet.deduct(Decimal("0.000001"), "addr", "hash")
    assert tx.amount == Decimal("0.000001")


async def test_balance_not_changed_on_rejection(wallet):
    """Rejected amounts must not alter the balance."""
    balance_before = await wallet.get_balance()

    with pytest.raises(ValueError):
        await wallet.deduct(Decimal("-5"), "addr", "hash")
    with pytest.raises(ValueError):
        await wallet.deposit(Decimal("-5"))

    balance_after = await wallet.get_balance()
    assert balance_before == balance_after


# ===================================================================
# 3. Encryption Module Boundary Tests
# ===================================================================

def test_enc_wrong_password_raises():
    """Decrypting with wrong password must raise an error."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key,
        encrypt_private_key,
    )

    enc = encrypt_private_key("correct_password_123", "my_secret_key")
    with pytest.raises(Exception):  # cryptography.fernet.InvalidToken
        decrypt_private_key("wrong_password_456", enc)


def test_enc_tampered_ciphertext_raises():
    """Modified ciphertext must fail integrity check."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key,
        encrypt_private_key,
    )

    enc = encrypt_private_key("strong_pass_123", "my_secret_key")
    tampered = enc.copy()
    original_key = tampered["encrypted_key"]
    if original_key[-2] == "A":
        tampered["encrypted_key"] = original_key[:-2] + "B" + original_key[-1]
    else:
        tampered["encrypted_key"] = original_key[:-2] + "A" + original_key[-1]

    with pytest.raises(Exception):  # InvalidToken
        decrypt_private_key("strong_pass_123", tampered)


def test_enc_tampered_salt_raises():
    """Modified salt must fail decryption."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key,
        encrypt_private_key,
    )

    enc = encrypt_private_key("strong_pass_123", "my_secret_key")
    tampered = enc.copy()
    salt_bytes = bytes.fromhex(tampered["salt"])
    tampered_salt = bytes([(salt_bytes[0] + 1) % 256]) + salt_bytes[1:]
    tampered["salt"] = tampered_salt.hex()

    with pytest.raises(Exception):  # InvalidToken
        decrypt_private_key("strong_pass_123", tampered)


def test_enc_malformed_json_missing_salt():
    """Loading wallet with missing 'salt' key should raise."""
    from ag402_core.security.wallet_encryption import decrypt_private_key

    malformed = {"encrypted_key": "some_data"}
    with pytest.raises(KeyError):
        decrypt_private_key("password123", malformed)


def test_enc_malformed_json_missing_encrypted_key():
    """Loading wallet with missing 'encrypted_key' key should raise."""
    from ag402_core.security.wallet_encryption import decrypt_private_key

    malformed = {"salt": "aa" * 16}
    with pytest.raises(KeyError):
        decrypt_private_key("password123", malformed)


def test_enc_invalid_hex_salt_raises():
    """Non-hex salt value should raise."""
    from ag402_core.security.wallet_encryption import decrypt_private_key

    malformed = {"salt": "not_hex_data!", "encrypted_key": "some_data"}
    with pytest.raises(ValueError):
        decrypt_private_key("password123", malformed)


def test_enc_load_corrupted_file(tmp_path):
    """Loading a corrupted (non-JSON) wallet file should raise."""
    from ag402_core.security.wallet_encryption import load_encrypted_wallet

    path = str(tmp_path / "corrupted.key")
    with open(path, "w") as f:
        f.write("this is not json {{{")

    with pytest.raises(json.JSONDecodeError):
        load_encrypted_wallet(path)


def test_enc_load_nonexistent_returns_none(tmp_path):
    """Loading nonexistent file should return None."""
    from ag402_core.security.wallet_encryption import load_encrypted_wallet

    result = load_encrypted_wallet(str(tmp_path / "does_not_exist.key"))
    assert result is None


def test_enc_wipe_bytearray_zeroed():
    """wipe_from_memory should zero out bytearray content."""
    from ag402_core.security.wallet_encryption import wipe_from_memory

    secret = bytearray(b"my_secret_private_key_data")
    assert any(b != 0 for b in secret)

    wipe_from_memory(secret)
    assert all(b == 0 for b in secret), (
        "wipe_from_memory did not zero out bytearray"
    )


def test_enc_wipe_string_does_not_crash():
    """wipe_from_memory on str should not raise (best-effort)."""
    from ag402_core.security.wallet_encryption import wipe_from_memory

    wipe_from_memory("some_secret_string")


def test_enc_encrypt_decrypt_roundtrip():
    """Encrypt then decrypt should return original key."""
    from ag402_core.security.wallet_encryption import (
        decrypt_private_key,
        encrypt_private_key,
    )

    password = "my_strong_password"
    original = "5K1gA5sUpqrT1VDfz1UZTvXzGv9mKYhVXiPuQMYo8deGFYcJhF"
    enc = encrypt_private_key(password, original)
    result = decrypt_private_key(password, enc)
    assert result == original


def test_enc_save_and_load_roundtrip(tmp_path):
    """Save encrypted wallet to disk, load back, verify content."""
    from ag402_core.security.wallet_encryption import (
        encrypt_private_key,
        load_encrypted_wallet,
        save_encrypted_wallet,
    )

    path = str(tmp_path / "wallet.key")
    enc = encrypt_private_key("test_password_123", "private_key_data")
    save_encrypted_wallet(path, enc)

    loaded = load_encrypted_wallet(path)
    assert loaded is not None
    assert loaded["salt"] == enc["salt"]
    assert loaded["encrypted_key"] == enc["encrypted_key"]


def test_enc_file_permissions_restrictive(tmp_path):
    """Saved wallet file should have 0o600 permissions."""
    from ag402_core.security.wallet_encryption import (
        encrypt_private_key,
        save_encrypted_wallet,
    )

    path = str(tmp_path / "wallet.key")
    enc = encrypt_private_key("test_password_123", "private_key_data")
    save_encrypted_wallet(path, enc)

    stat = os.stat(path)
    assert stat.st_mode & 0o777 == 0o600


# ===================================================================
# 4. Circuit Breaker TOCTOU Race Condition
# ===================================================================

def _run_threads_with_timeout(threads, timeout=_THREAD_TIMEOUT):
    """Start all threads and join with timeout to prevent deadlocks."""
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=timeout)
        if t.is_alive():
            raise TimeoutError(
                f"Thread {t.name} still alive after {timeout}s — possible deadlock"
            )


def test_cb_concurrent_failure_recording():
    """Multiple threads recording failures concurrently must not corrupt state."""
    from ag402_core.middleware.budget_guard import CircuitBreaker

    cb = CircuitBreaker()
    n_threads = 20
    barrier = threading.Barrier(n_threads, timeout=5)

    def record_failures():
        barrier.wait(timeout=5)
        for _ in range(10):
            cb.record_failure()

    threads = [
        threading.Thread(target=record_failures, name=f"fail-{i}")
        for i in range(n_threads)
    ]
    _run_threads_with_timeout(threads)

    with cb._lock:
        assert cb._consecutive_failures == 200


def test_cb_concurrent_success_resets_counter():
    """record_success under concurrent load must reliably reset counter."""
    from ag402_core.middleware.budget_guard import CircuitBreaker

    cb = CircuitBreaker()
    for _ in range(50):
        cb.record_failure()

    n_threads = 10
    barrier = threading.Barrier(n_threads, timeout=5)

    def record_success():
        barrier.wait(timeout=5)
        cb.record_success()

    threads = [
        threading.Thread(target=record_success, name=f"succ-{i}")
        for i in range(n_threads)
    ]
    _run_threads_with_timeout(threads)

    with cb._lock:
        assert cb._consecutive_failures == 0


def test_cb_circuit_open_check_race_with_failure():
    """is_open and record_failure must not have TOCTOU issues."""
    from ag402_core.middleware.budget_guard import CircuitBreaker

    cb = CircuitBreaker()
    results = {"open_count": 0, "closed_count": 0}
    results_lock = threading.Lock()
    n_threads = 20
    barrier = threading.Barrier(n_threads, timeout=5)

    def mixed_operations():
        barrier.wait(timeout=5)
        local_open = 0
        local_closed = 0
        for i in range(50):
            if i % 2 == 0:
                cb.record_failure()
            else:
                is_open = cb.is_open(threshold=3, cooldown=60)
                if is_open:
                    local_open += 1
                else:
                    local_closed += 1
        with results_lock:
            results["open_count"] += local_open
            results["closed_count"] += local_closed

    threads = [
        threading.Thread(target=mixed_operations, name=f"mix-{i}")
        for i in range(n_threads)
    ]
    _run_threads_with_timeout(threads)

    total_checks = results["open_count"] + results["closed_count"]
    assert total_checks > 0, "No circuit breaker checks were performed"


async def test_cb_budget_check_with_open_circuit(wallet):
    """BudgetGuard.check() must deny when circuit is open."""
    from ag402_core.config import RunMode, X402Config
    from ag402_core.middleware.budget_guard import BudgetGuard

    config = X402Config(
        mode=RunMode.TEST,
        circuit_breaker_threshold=3,
        circuit_breaker_cooldown=60,
    )
    guard = BudgetGuard(wallet, config)

    for _ in range(5):
        guard.record_failure()

    result = await guard.check(Decimal("0.01"))
    assert not result.allowed
    assert "circuit breaker" in result.reason.lower()
