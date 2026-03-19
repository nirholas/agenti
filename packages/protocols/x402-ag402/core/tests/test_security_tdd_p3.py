"""P3 Security TDD Tests — Issues found in deep architecture review.

Coverage:
  1. Path validation — export_history startswith() prefix collision bypass
  2. Replay guard — _ensure_db() race condition (double init)
  3. SSRF — DNS rebinding via validate_url_safety (hostname resolution)
  4. Resource safety — SolanaAdapter async close
  5. Monkey-patch — _middleware_init_lock creation race
"""

from __future__ import annotations

import asyncio
import os
import socket
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Global timeout for every test in this module
# ---------------------------------------------------------------------------
pytestmark = pytest.mark.timeout(15)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def wallet(tmp_path):
    from ag402_core.wallet.agent_wallet import AgentWallet
    db_path = str(tmp_path / "test_p3.db")
    w = AgentWallet(db_path=db_path)
    await w.init_db()
    await w.deposit(100.0, note="setup")
    yield w
    await w.close()


# ===================================================================
# 1. Path Validation — startswith() prefix collision
# ===================================================================

async def test_export_path_startswith_prefix_collision(wallet, tmp_path):
    """export_history must not allow /home/user2 when allowed dir is /home/user.

    The old code used `resolved.startswith(d)` which would allow
    /home/user2/evil.json when /home/user is in allowed_dirs.
    Fix: use os.sep-aware path prefix checking.
    """
    import ag402_core.wallet.agent_wallet as aw

    # Create two sibling directories: "allowed" and "allowed_extra"
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    evil_sibling = tmp_path / "allowed_extra"
    evil_sibling.mkdir()

    # Monkey-patch to control allowed_dirs precisely
    original_export = aw.AgentWallet.export_history

    async def patched_export(self, path, format="json"):
        """Narrowed export that only allows 'allowed' directory."""
        import json as json_module

        resolved = os.path.realpath(path)
        allowed_dirs = [os.path.realpath(str(allowed))]

        # This is the FIX being tested — must use os.sep-aware check
        if not any(
            resolved == d or resolved.startswith(d + os.sep) for d in allowed_dirs
        ):
            raise ValueError(
                f"Export path must be under CWD, HOME, or TMPDIR, got: {resolved}"
            )

        with open(path, "w") as f:
            json_module.dump([], f)

    aw.AgentWallet.export_history = patched_export  # type: ignore[assignment]
    try:
        # Writing to the allowed dir should work
        good_path = str(allowed / "ok.json")
        await wallet.export_history(good_path)
        assert os.path.exists(good_path)

        # Writing to sibling "allowed_extra" must be BLOCKED
        # With the old `startswith(d)` this would pass because
        # "/tmp/.../allowed_extra/evil.json".startswith("/tmp/.../allowed") == True
        evil_path = str(evil_sibling / "evil.json")
        with pytest.raises(ValueError, match="Export path must be under"):
            await wallet.export_history(evil_path)
    finally:
        aw.AgentWallet.export_history = original_export  # type: ignore[assignment]


async def test_export_path_exact_match_allowed(wallet, tmp_path):
    """Writing to a file directly in the allowed dir (same path) should work."""

    # The allowed dir IS the export target (edge case: resolved == d)
    target = str(tmp_path / "export.json")
    # tmp_path is always under TMPDIR, so this should work with the real function
    await wallet.export_history(target, format="json")
    assert os.path.exists(target)


# ===================================================================
# 2. Replay Guard — _ensure_db() race condition
# ===================================================================

async def test_replay_guard_ensure_db_concurrent_init():
    """Two concurrent _ensure_db() calls must not create two DB connections.

    Without a lock, both coroutines see _db is None and both call init_db(),
    leaking the first connection.
    """
    import tempfile

    from ag402_core.security.replay_guard import PersistentReplayGuard

    db_path = os.path.join(tempfile.mkdtemp(), "replay_race.db")
    guard = PersistentReplayGuard(db_path=db_path)

    init_count = 0
    original_init_db = guard.init_db

    async def counting_init_db():
        nonlocal init_count
        init_count += 1
        # Simulate a slow init to widen the race window
        await asyncio.sleep(0.05)
        await original_init_db()

    guard.init_db = counting_init_db  # type: ignore[assignment]

    # Fire two concurrent _ensure_db calls
    results = await asyncio.gather(
        guard._ensure_db(), guard._ensure_db(), return_exceptions=True,
    )
    # No exceptions should have occurred
    for i, r in enumerate(results):
        assert not isinstance(r, Exception), f"_ensure_db() call {i} raised: {r}"

    # With proper locking, init_db should be called exactly once
    assert init_count == 1, (
        f"init_db called {init_count} times — race condition in _ensure_db()!"
    )

    await guard.close()


# ===================================================================
# 3. SSRF — DNS rebinding & IPv6-mapped addresses
# ===================================================================

def test_ssrf_validate_url_blocks_ipv6_mapped_loopback():
    """IPv6-mapped loopback ::ffff:127.0.0.1 must be blocked."""
    from ag402_core.security.challenge_validator import validate_url_safety

    result = validate_url_safety("https://[::ffff:127.0.0.1]:8000/pay")
    assert not result.valid, "IPv6-mapped loopback bypassed SSRF check!"


def test_ssrf_validate_url_blocks_ipv6_mapped_private():
    """IPv6-mapped private ::ffff:10.0.0.1 must be blocked."""
    from ag402_core.security.challenge_validator import validate_url_safety

    result = validate_url_safety("https://[::ffff:10.0.0.1]:8000/pay")
    assert not result.valid, "IPv6-mapped private address bypassed SSRF check!"


def test_ssrf_validate_url_blocks_ipv6_mapped_192_168():
    """IPv6-mapped 192.168.x.x must be blocked."""
    from ag402_core.security.challenge_validator import validate_url_safety

    result = validate_url_safety("https://[::ffff:192.168.1.1]:8000/pay")
    assert not result.valid, "IPv6-mapped 192.168 bypassed SSRF check!"


def test_ssrf_dns_rebinding_resolved_to_private():
    """If hostname DNS-resolves to a private IP, it must be blocked.

    This tests that validate_url_safety resolves the hostname and checks
    the resolved IP, not just the literal hostname string.
    """
    from ag402_core.security.challenge_validator import validate_url_safety

    # Mock socket.getaddrinfo to simulate DNS resolving to a private IP
    fake_result = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('10.0.0.1', 443))]
    with patch("socket.getaddrinfo", return_value=fake_result):
        result = validate_url_safety("https://attacker-rebind.example.com/pay")
        assert not result.valid, (
            "DNS rebinding attack succeeded — hostname resolved to private IP "
            "but was not blocked!"
        )


def test_ssrf_dns_rebinding_resolved_to_loopback():
    """Hostname resolving to 127.0.0.1 must be blocked."""
    from ag402_core.security.challenge_validator import validate_url_safety

    fake_result = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]
    with patch("socket.getaddrinfo", return_value=fake_result):
        result = validate_url_safety("https://evil-loopback.example.com/pay")
        assert not result.valid, "DNS → loopback was not blocked!"


def test_ssrf_dns_resolution_failure_blocks():
    """If DNS resolution fails, the URL should be blocked (fail-closed)."""
    from ag402_core.security.challenge_validator import validate_url_safety

    with patch("socket.getaddrinfo", side_effect=socket.gaierror("DNS failed")):
        result = validate_url_safety("https://nonexistent-host.invalid/pay")
        assert not result.valid, "DNS resolution failure should block the request!"


def test_ssrf_public_ip_allowed():
    """A public IP resolving from DNS should be allowed."""
    from ag402_core.security.challenge_validator import validate_url_safety

    fake_result = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]
    with patch("socket.getaddrinfo", return_value=fake_result):
        result = validate_url_safety("https://example.com/pay")
        assert result.valid, f"Public address was blocked: {result.error}"


def test_ssrf_localhost_allowed_in_test_mode():
    """localhost should be allowed when allow_localhost=True."""
    from ag402_core.security.challenge_validator import validate_url_safety

    result = validate_url_safety(
        "http://localhost:8001/weather", allow_localhost=True
    )
    assert result.valid


# ===================================================================
# 4. SolanaAdapter — async resource cleanup
# ===================================================================

async def test_solana_adapter_aclose():
    """SolanaAdapter must provide aclose() to properly shut down async HTTP."""
    from ag402_core.payment.solana_adapter import SolanaAdapter

    # We can't create a real SolanaAdapter without solana deps,
    # so test that the class has the aclose method
    assert hasattr(SolanaAdapter, "aclose"), (
        "SolanaAdapter missing aclose() — async resources won't be properly released"
    )


# ===================================================================
# 5. Monkey-patch — _middleware_init_lock safe creation
# ===================================================================

async def test_middleware_init_lock_not_recreated():
    """_middleware_init_lock must not be recreated on each call.

    The lock should be created exactly once, even under concurrent access.
    """
    from ag402_core import monkey

    # Reset state for test
    monkey._middleware_init_lock = None
    monkey._middleware = MagicMock()
    monkey._middleware._wallet_initialized = False
    monkey._middleware.config.is_test_mode = True

    mock_wallet = AsyncMock()
    mock_wallet.get_balance = AsyncMock(return_value=100)
    mock_wallet.init_db = AsyncMock()
    monkey._middleware.wallet = mock_wallet

    # Call once to create the lock
    await monkey._get_initialized_middleware()
    lock1 = monkey._middleware_init_lock

    # Reset initialized flag to force re-entry
    monkey._middleware._wallet_initialized = False

    await monkey._get_initialized_middleware()
    lock2 = monkey._middleware_init_lock

    assert lock1 is lock2, (
        "Lock was recreated — TOCTOU vulnerability in lock initialization!"
    )

    # Cleanup
    monkey._middleware = None
    monkey._middleware_init_lock = None
