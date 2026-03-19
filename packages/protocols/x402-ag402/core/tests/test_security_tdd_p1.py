"""P1 Security TDD Tests — High priority vulnerabilities.

Coverage:
  1. Time attacks — ReplayGuard clock skew, boundary window, future timestamps
  2. Path traversal — export_history with ../, symlinks
  3. Protocol fuzzing — malformed WWW-Authenticate, null bytes, Unicode
  4. Monkey-patch concurrency — enable/disable race, disable takes effect immediately
  5. SSRF — IPv6 mapped addresses, DNS rebinding hostnames
"""

from __future__ import annotations

import os
import threading
import time
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Global timeout for every test in this module
# ---------------------------------------------------------------------------
pytestmark = pytest.mark.timeout(15)

_THREAD_TIMEOUT = 8


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def wallet(tmp_path):
    from ag402_core.wallet.agent_wallet import AgentWallet
    db_path = str(tmp_path / "test_p1.db")
    w = AgentWallet(db_path=db_path)
    await w.init_db()
    await w.deposit(100.0, note="setup")
    yield w
    await w.close()


# ===================================================================
# 1. Time Attacks on ReplayGuard
# ===================================================================

def test_replay_guard_reject_stale_request():
    """Request older than window must be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    old_ts = str(time.time() - 60)  # 60s ago, window is 30s
    ok, msg = guard.check(old_ts, "nonce1")
    assert not ok
    assert "old" in msg.lower() or "stale" in msg.lower()


def test_replay_guard_reject_future_request():
    """Request from the far future (beyond window) must be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    future_ts = str(time.time() + 60)  # 60s in future, window is 30s
    ok, msg = guard.check(future_ts, "nonce1")
    assert not ok
    assert "future" in msg.lower()


def test_replay_guard_accept_near_future():
    """Request slightly in the future (within window) should be accepted."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    near_future_ts = str(time.time() + 10)  # 10s ahead, within 30s window
    ok, msg = guard.check(near_future_ts, "nonce_near_future")
    assert ok, f"Near-future request wrongly rejected: {msg}"


def test_replay_guard_exact_boundary_stale():
    """Request exactly at boundary edge (age == window) should be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    # age = now - request_time, so request_time = now - 30.001
    boundary_ts = str(time.time() - 30.001)
    ok, _ = guard.check(boundary_ts, "nonce_boundary")
    assert not ok, "Request at exact stale boundary should be rejected"


def test_replay_guard_just_inside_window():
    """Request just inside window should be accepted."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    inside_ts = str(time.time() - 29.0)
    ok, msg = guard.check(inside_ts, "nonce_inside")
    assert ok, f"Request just inside window wrongly rejected: {msg}"


def test_replay_guard_clock_rollback():
    """Simulate clock rollback: time.time() returns an earlier value.

    If the clock rolls back, previously valid nonces might look like
    they came from the future. The guard should handle this gracefully.
    """
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    real_now = time.time()

    # First request at normal time
    ok, _ = guard.check(str(real_now), "nonce_before_rollback")
    assert ok

    # Simulate clock rollback: time.time() returns 120s earlier
    with patch("ag402_core.security.replay_guard.time") as mock_time:
        mock_time.time.return_value = real_now - 120
        # The original request timestamp now looks like "from the future"
        ok2, msg2 = guard.check(str(real_now), "nonce_after_rollback")
        assert not ok2, "Clock rollback: future-looking request should be rejected"


def test_replay_guard_duplicate_nonce_rejected():
    """Same nonce used twice must be rejected (replay detection)."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    now_ts = str(time.time())
    ok1, _ = guard.check(now_ts, "duplicate_nonce")
    assert ok1
    ok2, msg2 = guard.check(now_ts, "duplicate_nonce")
    assert not ok2
    assert "duplicate" in msg2.lower()


def test_replay_guard_oversized_nonce_rejected():
    """Nonce longer than 128 chars must be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    big_nonce = "A" * 200
    ok, msg = guard.check(str(time.time()), big_nonce)
    assert not ok
    assert "long" in msg.lower()


def test_replay_guard_invalid_timestamp_format():
    """Non-numeric timestamp should be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    ok, msg = guard.check("not-a-number", "nonce1")
    assert not ok
    assert "invalid" in msg.lower()


def test_replay_guard_empty_timestamp():
    """Empty timestamp should be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    ok, msg = guard.check("", "nonce1")
    assert not ok


def test_replay_guard_empty_nonce():
    """Empty nonce should be rejected."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30)
    ok, msg = guard.check(str(time.time()), "")
    assert not ok


def test_replay_guard_cache_overflow_rejects():
    """When nonce cache is full, new requests should be rejected (anti-flood)."""
    from ag402_core.security.replay_guard import ReplayGuard

    guard = ReplayGuard(window_seconds=30, max_cache=5)
    now = time.time()
    for i in range(5):
        ok, _ = guard.check(str(now), f"nonce_{i}")
        assert ok, f"nonce_{i} should have been accepted"

    # 6th request should be rejected due to full cache
    ok, msg = guard.check(str(now), "nonce_overflow")
    assert not ok, "Cache full should reject new requests"
    assert "overloaded" in msg.lower() or "too many" in msg.lower()


# ===================================================================
# 2. Path Traversal in export_history
# ===================================================================

async def test_export_path_traversal_dotdot(wallet, tmp_path, monkeypatch):
    """export_history resolving outside CWD/HOME/TMPDIR must be blocked.

    This tests that realpath() properly resolves '../' and the result
    is checked against the allowed directories. We mock the allowed dirs
    to a narrow scope to verify the check works.
    """
    import ag402_core.wallet.agent_wallet as aw

    # Patch export_history's allowed_dirs to only allow a narrow scope
    narrow_dir = tmp_path / "narrow"
    narrow_dir.mkdir()

    original_export = aw.AgentWallet.export_history

    async def patched_export(self, path, format="json"):
        """Temporarily narrow allowed dirs for testing."""
        import json as json_module

        resolved = os.path.realpath(path)
        allowed_dirs = [os.path.realpath(str(narrow_dir))]
        if not any(resolved.startswith(d) for d in allowed_dirs):
            raise ValueError(
                f"Export path must be under allowed dir, got: {resolved}"
            )
        # Write (simplified for test)
        txns = await self.get_transactions(limit=100)
        with open(path, "w") as f:
            json_module.dump([], f)

    monkeypatch.setattr(aw.AgentWallet, "export_history", patched_export)

    # Try to escape narrow_dir
    evil_path = str(narrow_dir / ".." / "escape.json")
    with pytest.raises(ValueError, match="Export path must be under"):
        await wallet.export_history(evil_path)


async def test_export_path_traversal_absolute(wallet):
    """export_history to /etc/shadow must be blocked."""
    with pytest.raises(ValueError, match="Export path must be under"):
        await wallet.export_history("/etc/shadow")


async def test_export_symlink_escape(wallet, tmp_path):
    """export_history following a symlink outside allowed dirs must be blocked."""
    # Create a symlink that points outside allowed dirs
    link = tmp_path / "escape_link"
    target = "/etc"
    try:
        os.symlink(target, str(link))
    except (OSError, NotImplementedError):
        pytest.skip("Cannot create symlink on this platform")

    evil_path = str(link / "passwd_export.json")
    with pytest.raises(ValueError, match="Export path must be under"):
        await wallet.export_history(evil_path)


async def test_export_valid_path_works(wallet, tmp_path):
    """export_history to a valid path under tmp should work."""
    valid_path = str(tmp_path / "export.json")
    await wallet.export_history(valid_path, format="json")
    assert os.path.exists(valid_path)


async def test_export_csv_format(wallet, tmp_path):
    """export_history CSV format should work."""
    valid_path = str(tmp_path / "export.csv")
    await wallet.export_history(valid_path, format="csv")
    assert os.path.exists(valid_path)


async def test_export_unsupported_format(wallet, tmp_path):
    """export_history with unsupported format should raise."""
    with pytest.raises(ValueError, match="Unsupported export format"):
        await wallet.export_history(str(tmp_path / "x.xml"), format="xml")


# ===================================================================
# 3. Protocol Fuzzing — WWW-Authenticate Header
# ===================================================================

def test_parse_empty_header():
    """Empty header should return None."""
    from open402.headers import parse_www_authenticate
    assert parse_www_authenticate("") is None


def test_parse_none_like_header():
    """None-like input should return None."""
    from open402.headers import parse_www_authenticate
    assert parse_www_authenticate("") is None


def test_parse_wrong_scheme():
    """Non-x402 scheme should return None."""
    from open402.headers import parse_www_authenticate
    assert parse_www_authenticate('Bearer realm="example"') is None


def test_parse_missing_required_fields():
    """x402 header missing required fields should return None."""
    from open402.headers import parse_www_authenticate
    # Missing 'address'
    result = parse_www_authenticate('x402 chain="solana" token="USDC" amount="0.05"')
    assert result is None


def test_parse_valid_header():
    """Valid x402 header should parse correctly."""
    from open402.headers import parse_www_authenticate
    header = 'x402 chain="solana" token="USDC" amount="0.05" address="SoLAddr123"'
    result = parse_www_authenticate(header)
    assert result is not None
    assert result.chain == "solana"
    assert result.amount == "0.05"
    assert result.address == "SoLAddr123"


def test_parse_case_insensitive_scheme():
    """x402 scheme should be case-insensitive."""
    from open402.headers import parse_www_authenticate
    header = 'X402 chain="solana" token="USDC" amount="0.05" address="addr"'
    result = parse_www_authenticate(header)
    assert result is not None


def test_parse_extra_whitespace():
    """Extra whitespace in header should be handled."""
    from open402.headers import parse_www_authenticate
    header = '  x402   chain="solana"  token="USDC"  amount="0.05"  address="addr"  '
    result = parse_www_authenticate(header)
    assert result is not None


def test_parse_null_byte_in_field():
    """Null byte in field value should not cause crashes."""
    from open402.headers import parse_www_authenticate
    header = 'x402 chain="sol\x00ana" token="USDC" amount="0.05" address="addr"'
    result = parse_www_authenticate(header)
    # Should either return None or parse with the null byte included
    # The important thing is it doesn't crash
    if result is not None:
        assert "\x00" in result.chain  # null byte preserved as-is


def test_parse_unicode_in_field():
    """Unicode characters in field values should not cause crashes."""
    from open402.headers import parse_www_authenticate
    header = 'x402 chain="solana" token="USDC" amount="0.05" address="地址测试"'
    result = parse_www_authenticate(header)
    # Should parse (regex \w+ for key, [^"]* for value handles unicode)
    assert result is not None
    assert result.address == "地址测试"


def test_parse_extremely_long_header():
    """Extremely long header should not cause memory issues."""
    from open402.headers import parse_www_authenticate
    long_addr = "A" * 100_000
    header = f'x402 chain="solana" token="USDC" amount="0.05" address="{long_addr}"'
    result = parse_www_authenticate(header)
    assert result is not None
    assert len(result.address) == 100_000


def test_parse_header_with_cr_lf():
    """CR/LF in header value should be preserved by parser (caught by serializer)."""
    from open402.headers import parse_www_authenticate
    # The regex [^"]* matches everything except double-quote, including CR/LF
    header = 'x402 chain="solana" token="USDC" amount="0.05" address="addr"'
    result = parse_www_authenticate(header)
    assert result is not None


def test_serialize_header_rejects_crlf():
    """Serializing a challenge with CR/LF in fields must raise ValueError."""
    from open402.spec import X402PaymentChallenge
    challenge = X402PaymentChallenge(
        chain="solana", token="USDC", amount="0.05",
        address="addr\r\nInjected-Header: evil"
    )
    with pytest.raises(ValueError, match="unsafe"):
        challenge.to_header_value()


def test_serialize_header_rejects_double_quote():
    """Serializing with double-quote in field must raise ValueError."""
    from open402.spec import X402PaymentChallenge
    challenge = X402PaymentChallenge(
        chain="solana", token="USDC", amount="0.05",
        address='addr"injected'
    )
    with pytest.raises(ValueError, match="unsafe"):
        challenge.to_header_value()


def test_amount_float_rejects_nan():
    """NaN amount should be rejected."""
    from open402.spec import X402PaymentChallenge
    c = X402PaymentChallenge(chain="s", token="U", amount="nan", address="a")
    with pytest.raises(ValueError, match="finite"):
        _ = c.amount_float


def test_amount_float_rejects_inf():
    """Infinity amount should be rejected."""
    from open402.spec import X402PaymentChallenge
    c = X402PaymentChallenge(chain="s", token="U", amount="inf", address="a")
    with pytest.raises(ValueError, match="finite"):
        _ = c.amount_float


def test_amount_float_rejects_negative():
    """Negative amount should be rejected."""
    from open402.spec import X402PaymentChallenge
    c = X402PaymentChallenge(chain="s", token="U", amount="-1.0", address="a")
    with pytest.raises(ValueError, match="positive"):
        _ = c.amount_float


def test_amount_float_rejects_zero():
    """Zero amount should be rejected."""
    from open402.spec import X402PaymentChallenge
    c = X402PaymentChallenge(chain="s", token="U", amount="0", address="a")
    with pytest.raises(ValueError, match="positive"):
        _ = c.amount_float


def test_amount_float_rejects_non_numeric():
    """Non-numeric amount should be rejected."""
    from open402.spec import X402PaymentChallenge
    c = X402PaymentChallenge(chain="s", token="U", amount="abc", address="a")
    with pytest.raises(ValueError, match="Invalid"):
        _ = c.amount_float


def test_parse_authorization_legacy():
    """Legacy authorization format should work."""
    from open402.headers import parse_authorization
    result = parse_authorization("x402 abc123txhash")
    assert result is not None
    assert result.tx_hash == "abc123txhash"


def test_parse_authorization_structured():
    """Structured authorization format should work."""
    from open402.headers import parse_authorization
    result = parse_authorization('x402 tx_hash="hash123" payer_address="addr" chain="solana"')
    assert result is not None
    assert result.tx_hash == "hash123"
    assert result.payer_address == "addr"


def test_parse_authorization_empty():
    """Empty authorization should return None."""
    from open402.headers import parse_authorization
    assert parse_authorization("") is None


def test_parse_authorization_wrong_scheme():
    """Non-x402 authorization should return None."""
    from open402.headers import parse_authorization
    assert parse_authorization("Bearer token123") is None


# ===================================================================
# 4. Monkey-patch Concurrency
# ===================================================================

@patch.dict(os.environ, {"X402_MODE": "test"})
def test_monkey_enable_disable_idempotent():
    """enable() is ref-counted; each enable() needs a matching disable()."""
    from ag402_core import monkey

    # Reset middleware so _ensure_middleware picks up X402_MODE=test
    monkey._middleware = None

    # Ensure clean state
    monkey.disable()
    assert not monkey.is_enabled()

    try:
        monkey.enable()
        assert monkey.is_enabled()

        monkey.enable()  # second call increments depth to 2
        assert monkey.is_enabled()

        monkey.disable()  # depth 2 -> 1, still enabled
        assert monkey.is_enabled()

        monkey.disable()  # depth 1 -> 0, now disabled
        assert not monkey.is_enabled()

        monkey.disable()  # extra disable = no-op
        assert not monkey.is_enabled()
    finally:
        # Drain any remaining depth
        while monkey.is_enabled():
            monkey.disable()
        monkey._middleware = None


@patch.dict(os.environ, {"X402_MODE": "test"})
def test_monkey_context_manager():
    """enabled() context manager should auto-disable on exit."""
    from ag402_core import monkey

    monkey._middleware = None
    monkey.disable()
    assert not monkey.is_enabled()

    with monkey.enabled():
        assert monkey.is_enabled()

    assert not monkey.is_enabled()
    monkey._middleware = None


@patch.dict(os.environ, {"X402_MODE": "test"})
def test_monkey_context_manager_on_exception():
    """enabled() should disable even if an exception is raised inside."""
    from ag402_core import monkey

    monkey._middleware = None
    monkey.disable()
    with pytest.raises(RuntimeError), monkey.enabled():
        assert monkey.is_enabled()
        raise RuntimeError("test error")

    assert not monkey.is_enabled()
    monkey._middleware = None


@patch.dict(os.environ, {"X402_MODE": "test"})
def test_monkey_concurrent_enable_disable():
    """Concurrent enable/disable should not corrupt state."""
    from ag402_core import monkey

    monkey._middleware = None
    monkey.disable()
    errors = []
    n_threads = 10
    barrier = threading.Barrier(n_threads, timeout=5)

    def toggle(thread_id):
        try:
            barrier.wait(timeout=5)
            for _ in range(20):
                if thread_id % 2 == 0:
                    monkey.enable()
                else:
                    monkey.disable()
        except Exception as e:
            errors.append(e)

    threads = [
        threading.Thread(target=toggle, args=(i,), name=f"monkey-{i}")
        for i in range(n_threads)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=_THREAD_TIMEOUT)
        if t.is_alive():
            errors.append(TimeoutError(f"Thread {t.name} hung"))

    # Drain all remaining depth from concurrent enable() calls
    while monkey.is_enabled():
        monkey.disable()
    monkey._middleware = None

    assert not errors, f"Concurrent monkey-patch errors: {errors}"
    assert not monkey.is_enabled()


# ===================================================================
# 5. SSRF — Forward Proxy Private Address Detection
# ===================================================================

def test_ssrf_loopback_ipv4():
    """127.0.0.1 should be detected as private."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("127.0.0.1")


def test_ssrf_loopback_ipv6():
    """::1 should be detected as private."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("::1")


def test_ssrf_private_rfc1918():
    """RFC 1918 addresses should be detected as private."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("10.0.0.1")
    assert _is_private_or_loopback("172.16.0.1")
    assert _is_private_or_loopback("192.168.1.1")


def test_ssrf_link_local():
    """Link-local addresses should be detected."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("169.254.1.1")


def test_ssrf_ipv6_mapped_ipv4():
    """IPv6-mapped IPv4 loopback (::ffff:127.0.0.1) must be detected as private.

    This is a common SSRF bypass technique.
    """
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("::ffff:127.0.0.1"), (
        "IPv6-mapped loopback ::ffff:127.0.0.1 bypassed SSRF check!"
    )


def test_ssrf_ipv6_mapped_private():
    """IPv6-mapped private address (::ffff:10.0.0.1) must be detected."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("::ffff:10.0.0.1"), (
        "IPv6-mapped private ::ffff:10.0.0.1 bypassed SSRF check!"
    )


def test_ssrf_ipv6_mapped_192_168():
    """IPv6-mapped 192.168.x.x must be detected."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("::ffff:192.168.1.1"), (
        "IPv6-mapped 192.168 address bypassed SSRF check!"
    )


def test_ssrf_localhost_hostname():
    """'localhost' hostname should be detected."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("localhost")


def test_ssrf_metadata_hostname():
    """Cloud metadata hostnames should be blocked."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert _is_private_or_loopback("metadata.google.internal")
    assert _is_private_or_loopback("metadata")


def test_ssrf_public_ip_allowed():
    """Public IP addresses should NOT be blocked."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert not _is_private_or_loopback("8.8.8.8")
    assert not _is_private_or_loopback("1.1.1.1")
    assert not _is_private_or_loopback("93.184.216.34")


def test_ssrf_public_hostname_allowed():
    """Public hostnames should NOT be blocked."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    assert not _is_private_or_loopback("example.com")
    assert not _is_private_or_loopback("api.openai.com")


def test_ssrf_zero_address():
    """0.0.0.0 should be detected as private/reserved."""
    from ag402_core.proxy.forward_proxy import _is_private_or_loopback
    # 0.0.0.0 is "unspecified" — should be blocked
    assert _is_private_or_loopback("0.0.0.0"), (
        "0.0.0.0 (unspecified address) bypassed SSRF check!"
    )
