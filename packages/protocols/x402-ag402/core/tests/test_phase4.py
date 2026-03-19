"""Phase 4 tests: replay guard, RPC retry, dual-mode fallback, stress tests."""

from __future__ import annotations

import asyncio
import time

import httpx
import pytest
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.payment.retry import MultiEndpointClient, retry_with_backoff
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.security.replay_guard import ReplayGuard, generate_replay_headers
from ag402_core.wallet.agent_wallet import AgentWallet

from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

# =====================================================================
# Phase 4.1: Replay Guard Tests
# =====================================================================


class TestReplayGuard:
    def test_fresh_request_accepted(self):
        guard = ReplayGuard(window_seconds=5)
        ts = f"{time.time():.3f}"
        nonce = "unique-nonce-1"
        ok, err = guard.check(ts, nonce)
        assert ok
        assert err == ""

    def test_stale_request_rejected(self):
        guard = ReplayGuard(window_seconds=5)
        old_ts = f"{time.time() - 10:.3f}"  # 10 seconds ago
        ok, err = guard.check(old_ts, "nonce-1")
        assert not ok
        assert "too old" in err

    def test_future_request_rejected(self):
        guard = ReplayGuard(window_seconds=5)
        future_ts = f"{time.time() + 10:.3f}"  # 10 seconds from now
        ok, err = guard.check(future_ts, "nonce-1")
        assert not ok
        assert "future" in err

    def test_duplicate_nonce_rejected(self):
        guard = ReplayGuard(window_seconds=5)
        ts = f"{time.time():.3f}"
        nonce = "same-nonce"
        ok1, _ = guard.check(ts, nonce)
        assert ok1
        ok2, err2 = guard.check(ts, nonce)
        assert not ok2
        assert "Duplicate nonce" in err2

    def test_missing_timestamp_rejected(self):
        guard = ReplayGuard(window_seconds=5)
        ok, err = guard.check("", "nonce-1")
        assert not ok
        assert "Missing" in err

    def test_missing_nonce_rejected(self):
        guard = ReplayGuard(window_seconds=5)
        ok, err = guard.check(f"{time.time():.3f}", "")
        assert not ok
        assert "Missing" in err

    def test_invalid_timestamp_rejected(self):
        guard = ReplayGuard(window_seconds=5)
        ok, err = guard.check("not-a-number", "nonce-1")
        assert not ok
        assert "Invalid timestamp" in err

    def test_generate_replay_headers(self):
        headers = generate_replay_headers()
        assert "X-x402-Timestamp" in headers
        assert "X-x402-Nonce" in headers
        # Timestamp should be close to now
        ts = float(headers["X-x402-Timestamp"])
        assert abs(ts - time.time()) < 2.0
        # Nonce should be 32-char hex
        assert len(headers["X-x402-Nonce"]) == 32

    def test_nonce_cache_pruning(self):
        guard = ReplayGuard(window_seconds=5, max_cache=10)
        ts = f"{time.time():.3f}"
        # Fill cache beyond max
        for i in range(20):
            guard.check(ts, f"nonce-{i}")
        # Cache should be pruned
        assert len(guard._seen_nonces) <= 10


# =====================================================================
# Phase 4.2: RPC Retry + Failover Tests
# =====================================================================


class TestRetryWithBackoff:
    @pytest.mark.asyncio
    async def test_succeeds_on_first_try(self):
        call_count = 0

        async def good_func():
            nonlocal call_count
            call_count += 1
            return "ok"

        result = await retry_with_backoff(good_func, max_retries=3, base_delay=0.01)
        assert result == "ok"
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_retries_on_failure(self):
        call_count = 0

        async def flaky_func():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("RPC down")
            return "recovered"

        result = await retry_with_backoff(flaky_func, max_retries=3, base_delay=0.01)
        assert result == "recovered"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_exhausts_retries(self):
        async def always_fail():
            raise ConnectionError("permanently down")

        with pytest.raises(ConnectionError):
            await retry_with_backoff(always_fail, max_retries=2, base_delay=0.01)


class TestMultiEndpointClient:
    def test_starts_with_primary(self):
        client = MultiEndpointClient("http://primary", ["http://backup1"])
        assert client.current_url == "http://primary"

    def test_failover_switches(self):
        client = MultiEndpointClient("http://primary", ["http://backup1", "http://backup2"])
        new = client.failover()
        assert new == "http://backup1"
        assert client.current_url == "http://backup1"

    def test_failover_exhausted(self):
        client = MultiEndpointClient("http://primary")
        new = client.failover()
        assert new is None

    def test_reset_returns_to_primary(self):
        client = MultiEndpointClient("http://primary", ["http://backup1"])
        client.failover()
        assert client.current_url == "http://backup1"
        client.reset()
        assert client.current_url == "http://primary"


# =====================================================================
# Phase 4.3: Dual-Mode Fallback Tests
# =====================================================================


@pytest.mark.asyncio
async def test_fallback_api_key_on_non_x402_402(tmp_path):
    """Non-x402 402 with fallback API key -> retry with Bearer token."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config(fallback_api_key="sk-test-12345")

    transport = SequentialTransport([
        # First call -> 402 without x402 headers (e.g. standard Stripe-style)
        (402, {"content-type": "text/plain"}, b"Payment required"),
        # Second call (fallback with API key) -> 200
        (200, {"content-type": "application/json"}, b'{"data": "success"}'),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 200
    assert result.body == b'{"data": "success"}'
    assert not result.payment_made  # No x402 payment was made
    # Wallet untouched
    assert await wallet.get_balance() == 100.0
    await wallet.close()


@pytest.mark.asyncio
async def test_no_fallback_key_passes_through(tmp_path):
    """Non-x402 402 without fallback key -> pass through as-is."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()  # No fallback_api_key

    transport = SequentialTransport([
        (402, {"content-type": "text/plain"}, b"Payment required"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 402
    assert result.body == b"Payment required"
    await wallet.close()


# =====================================================================
# Phase 4.4: Stress Tests
# =====================================================================


@pytest.mark.asyncio
async def test_100_concurrent_wallet_operations(tmp_path):
    """100 concurrent deductions — no overdraft, no corruption."""
    # Use max_daily_spend=200 to avoid hitting the $10 daily limit
    db_path = str(tmp_path / "test.db")
    wallet = AgentWallet(db_path=db_path, max_daily_spend=200.0)
    await wallet.init_db()
    await wallet.deposit(100.0, note="test setup")

    results = []

    async def try_deduct(i: int):
        try:
            await wallet.deduct(1.0, f"addr_{i}")
            return True
        except Exception:
            return False

    tasks = [try_deduct(i) for i in range(100)]
    results = await asyncio.gather(*tasks)

    successes = sum(1 for r in results if r)
    assert successes == 100  # All should succeed (100 * $1 = $100 balance)
    assert float(await wallet.get_balance()) == pytest.approx(0.0)
    await wallet.close()


@pytest.mark.asyncio
async def test_100_concurrent_overdrawn(tmp_path):
    """100 concurrent deductions on $50 balance — exactly 50 succeed."""
    db_path = str(tmp_path / "test.db")
    wallet = AgentWallet(db_path=db_path, max_daily_spend=200.0)
    await wallet.init_db()
    await wallet.deposit(50.0, note="test setup")

    async def try_deduct(i: int):
        try:
            await wallet.deduct(1.0, f"addr_{i}")
            return True
        except Exception:
            return False

    tasks = [try_deduct(i) for i in range(100)]
    results = await asyncio.gather(*tasks)

    successes = sum(1 for r in results if r)
    assert successes == 50
    assert float(await wallet.get_balance()) == pytest.approx(0.0)
    await wallet.close()


@pytest.mark.asyncio
async def test_50_concurrent_middleware_requests(tmp_path):
    """50 concurrent requests through middleware — all complete without deadlock."""
    wallet = await _make_wallet(tmp_path, balance=1000.0)
    provider = MockSolanaAdapter(balance=1000.0)
    config = _make_config(single_tx_limit=1.0)

    completed = []

    async def make_request(i: int):
        transport = SequentialTransport([
            (402, _402_headers(amount="0.05"), b"Pay"),
            (200, {}, f"Response {i}".encode()),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
        result = await mw.handle_request("GET", f"https://example.com/api/{i}")
        completed.append(result)
        return result

    tasks = [make_request(i) for i in range(50)]
    await asyncio.gather(*tasks)

    assert len(completed) == 50
    successes = sum(1 for r in completed if r.status_code == 200)
    assert successes == 50
    # Each paid $0.05, total = $2.50
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(1000.0 - 50 * 0.05)
    await wallet.close()


@pytest.mark.asyncio
async def test_replay_guard_under_concurrent_load():
    """Concurrent replay guard checks — no false positives."""
    guard = ReplayGuard(window_seconds=5)

    async def check_unique(i: int):
        headers = generate_replay_headers()
        ok, err = guard.check(headers["X-x402-Timestamp"], headers["X-x402-Nonce"])
        return ok

    tasks = [check_unique(i) for i in range(100)]
    results = await asyncio.gather(*tasks)

    # All unique nonces should be accepted
    assert all(results)
