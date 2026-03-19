"""Tests for ag402_core.monkey — enable/disable/enabled monkey-patch."""

from __future__ import annotations

import asyncio

import ag402_core
import ag402_core.monkey as monkey_mod
import httpx
import pytest


@pytest.fixture(autouse=True)
def _test_mode_env(monkeypatch):
    """Set X402_MODE=test so enable() can resolve a MockSolanaAdapter."""
    monkeypatch.setenv("X402_MODE", "test")


@pytest.fixture(autouse=True)
def _cleanup():
    """Ensure monkey-patch is disabled after each test."""
    import httpx
    _orig_send = getattr(monkey_mod, '_original_httpx_send', None) or httpx.AsyncClient.send
    yield
    # Fully drain enable depth (handles both bool and refcount implementations)
    for _ in range(10):
        if not ag402_core.is_enabled():
            break
        monkey_mod.disable()
    # Explicitly restore httpx/requests if still patched
    if monkey_mod._patched_httpx and monkey_mod._original_httpx_send is not None:
        httpx.AsyncClient.send = monkey_mod._original_httpx_send
    # Reset global state
    monkey_mod._middleware = None
    monkey_mod._middleware_init_lock = None
    monkey_mod._enable_depth = 0
    monkey_mod._patched_httpx = False
    monkey_mod._patched_requests = False
    monkey_mod._original_httpx_send = None
    monkey_mod._original_requests_send = None


class TestEnableDisable:
    def test_enable_sets_flag(self):
        ag402_core.enable()
        assert ag402_core.is_enabled()

    def test_disable_clears_flag(self):
        ag402_core.enable()
        ag402_core.disable()
        assert not ag402_core.is_enabled()

    def test_enable_idempotent(self):
        ag402_core.enable()
        ag402_core.enable()  # should not crash
        assert ag402_core.is_enabled()

    def test_disable_idempotent(self):
        ag402_core.disable()  # should not crash when not enabled
        assert not ag402_core.is_enabled()

    def test_httpx_patched(self):
        original_send = httpx.AsyncClient.send
        ag402_core.enable()
        assert httpx.AsyncClient.send is not original_send
        ag402_core.disable()
        assert httpx.AsyncClient.send is original_send

    def test_context_manager(self):
        with ag402_core.enabled():
            assert ag402_core.is_enabled()
        assert not ag402_core.is_enabled()


class TestPassthrough:
    """Ensure non-402 responses pass through completely untouched."""

    @pytest.mark.asyncio
    async def test_200_passthrough(self):
        """200 responses must be returned exactly as-is."""
        ag402_core.enable()

        # Create a mock transport that returns 200
        class MockTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                return httpx.Response(200, json={"ok": True}, request=request)

        async with httpx.AsyncClient(transport=MockTransport()) as client:
            resp = await client.get("https://example.com/free-api")
            assert resp.status_code == 200
            assert resp.json() == {"ok": True}

    @pytest.mark.asyncio
    async def test_404_passthrough(self):
        """404 responses must pass through."""
        ag402_core.enable()

        class MockTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                return httpx.Response(404, text="Not found", request=request)

        async with httpx.AsyncClient(transport=MockTransport()) as client:
            resp = await client.get("https://example.com/missing")
            assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_500_passthrough(self):
        """500 responses must pass through."""
        ag402_core.enable()

        class MockTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                return httpx.Response(500, text="Internal error", request=request)

        async with httpx.AsyncClient(transport=MockTransport()) as client:
            resp = await client.get("https://example.com/broken")
            assert resp.status_code == 500

    @pytest.mark.asyncio
    async def test_402_without_x402_passthrough(self):
        """402 without x402 WWW-Authenticate header must pass through."""
        ag402_core.enable()

        class MockTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                return httpx.Response(
                    402,
                    text="Payment required",
                    headers={"www-authenticate": "Basic realm=billing"},
                    request=request,
                )

        async with httpx.AsyncClient(transport=MockTransport()) as client:
            resp = await client.get("https://example.com/paywall")
            assert resp.status_code == 402

    @pytest.mark.asyncio
    async def test_disabled_402_passthrough(self):
        """When disabled, even x402 402 should pass through."""
        # NOT calling enable()
        class MockTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                return httpx.Response(402, text="Pay up", request=request)

        async with httpx.AsyncClient(transport=MockTransport()) as client:
            resp = await client.get("https://example.com/paid")
            assert resp.status_code == 402


class TestReentrancyGuard:
    """Ensure middleware's internal requests don't trigger recursive interception."""

    @pytest.mark.asyncio
    async def test_no_recursive_interception_on_middleware_internal_402(self, tmp_path):
        """When _patched_send delegates to middleware and middleware's _send
        gets another 402, the inner 402 must NOT be re-intercepted.

        Without a re-entrancy guard this causes infinite recursion:
        _patched_send -> mw.handle_request -> mw._send -> _patched_send -> ...
        """
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.solana_adapter import MockSolanaAdapter

        from tests.conftest import _402_headers, _make_config, _make_wallet

        call_count = 0

        class Always402Transport(httpx.AsyncBaseTransport):
            """Transport that always returns 402 with valid x402 headers."""
            async def handle_async_request(self, request):
                nonlocal call_count
                call_count += 1
                # Safety: if we exceed 5 calls we're in a recursion loop
                if call_count > 5:
                    raise RecursionError("Infinite recursion detected in test")
                return httpx.Response(
                    402,
                    headers=_402_headers(amount="0.01"),
                    content=b"Payment required",
                )

        wallet = await _make_wallet(tmp_path, balance=100.0)
        provider = MockSolanaAdapter()
        config = _make_config()

        # Create middleware with a client that uses the always-402 transport.
        # Crucially, this client is also subject to the class-level monkey patch.
        transport = Always402Transport()
        mw_client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=mw_client)

        # Inject the middleware into monkey module state so _patched_send uses it
        monkey_mod._middleware = mw
        monkey_mod._middleware._wallet_initialized = True
        ag402_core.enable()

        # Make a request through a DIFFERENT client (also patched at class level)
        user_client = httpx.AsyncClient(transport=transport)
        try:
            resp = await user_client.get("https://example.com/always-402")
            # The middleware should pay once and retry. The retry also gets 402,
            # but that inner 402 must NOT trigger a second payment cycle.
            # Instead it should be returned as-is (402) with payment_made info.
            # The monkey patch builds an httpx.Response from MiddlewareResult,
            # so we check the final status.
            # With a guard: middleware pays once, retry 402 is returned, no recursion.
            # Without a guard: infinite recursion / RecursionError.
            assert resp.status_code in (200, 402)
            # Must not have recursed — transport should be called a bounded number of times
            # (1 from monkey patch initial, 1 from middleware initial forward, 1 from retry = 3)
            assert call_count <= 4, f"Too many transport calls ({call_count}), likely recursion"
            # Provider should have paid at most once
            assert len(provider._payments) <= 1
        finally:
            await user_client.aclose()
            await mw_client.aclose()
            await wallet.close()


class TestEnabledNesting:
    """Ensure nested enabled() context managers work correctly."""

    def test_nested_enabled_stays_active_after_inner_exit(self):
        """Inner enabled() exit must NOT disable the outer scope."""
        with ag402_core.enabled():
            assert ag402_core.is_enabled()
            with ag402_core.enabled():
                assert ag402_core.is_enabled()
            # After inner exit, outer must still be active
            assert ag402_core.is_enabled(), (
                "Inner enabled().__exit__ broke the outer scope"
            )
        # After outer exit, should be disabled
        assert not ag402_core.is_enabled()

    def test_nested_enabled_httpx_stays_patched(self):
        """httpx must remain patched while any enabled() scope is active."""
        original_send = httpx.AsyncClient.send
        with ag402_core.enabled():
            assert httpx.AsyncClient.send is not original_send
            with ag402_core.enabled():
                assert httpx.AsyncClient.send is not original_send
            # Inner exit: httpx must still be patched
            assert httpx.AsyncClient.send is not original_send, (
                "httpx unpatched while outer enabled() still active"
            )
        # Outer exit: httpx must be restored
        assert httpx.AsyncClient.send is original_send

    def test_triple_nesting(self):
        """Three levels of nesting must all work correctly."""
        with ag402_core.enabled():
            with ag402_core.enabled():
                with ag402_core.enabled():
                    assert ag402_core.is_enabled()
                assert ag402_core.is_enabled()
            assert ag402_core.is_enabled()
        assert not ag402_core.is_enabled()

    def test_enable_disable_balance(self):
        """Multiple enable() calls require matching disable() calls."""
        ag402_core.enable()
        ag402_core.enable()
        ag402_core.enable()
        assert ag402_core.is_enabled()

        ag402_core.disable()
        assert ag402_core.is_enabled(), "Should still be enabled (depth=2)"
        ag402_core.disable()
        assert ag402_core.is_enabled(), "Should still be enabled (depth=1)"
        ag402_core.disable()
        assert not ag402_core.is_enabled(), "Should be disabled (depth=0)"

    def test_extra_disable_is_noop(self):
        """disable() when already at depth 0 is a safe no-op."""
        ag402_core.enable()
        ag402_core.disable()
        assert not ag402_core.is_enabled()
        ag402_core.disable()  # extra call — should not crash
        assert not ag402_core.is_enabled()


class TestMiddlewareInitRace:
    """Ensure _get_initialized_middleware handles concurrent calls safely."""

    @pytest.mark.asyncio
    async def test_concurrent_init_no_double_deposit(self, tmp_path):
        """Two concurrent _get_initialized_middleware calls must not double-deposit
        test funds. Only one deposit of 100.0 should occur.

        Without a lock, both coroutines see _wallet_initialized=False and
        both run init_db() + deposit(), resulting in balance=200.0.
        """
        from ag402_core.config import RunMode
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.solana_adapter import MockSolanaAdapter
        from ag402_core.wallet.agent_wallet import AgentWallet

        from tests.conftest import _make_config

        config = _make_config(mode=RunMode.TEST)
        wallet = AgentWallet(db_path=str(tmp_path / "race.db"))
        provider = MockSolanaAdapter()

        mw = X402PaymentMiddleware(wallet, provider, config)
        mw._wallet_initialized = False

        monkey_mod._middleware = mw

        # Widen the race window: wrap init_db to yield control mid-init
        original_init_db = wallet.init_db
        init_call_count = 0

        async def yielding_init_db():
            nonlocal init_call_count
            init_call_count += 1
            result = await original_init_db()
            # Yield control after init_db but before _wallet_initialized is set.
            # This lets the second coroutine also enter the init block.
            await asyncio.sleep(0)
            return result

        wallet.init_db = yielding_init_db

        # Launch two concurrent calls
        results = await asyncio.gather(
            monkey_mod._get_initialized_middleware(),
            monkey_mod._get_initialized_middleware(),
        )

        assert results[0] is results[1]

        # init_db should have been called only once
        assert init_call_count == 1, (
            f"init_db called {init_call_count} times (expected 1) — "
            f"missing lock around initialization"
        )

        # Wallet should have been deposited exactly once (100.0, not 200.0)
        balance = await wallet.get_balance()
        assert balance == 100.0, (
            f"Expected 100.0 from single deposit, got {balance} — "
            f"likely double-deposit from concurrent init"
        )

        await wallet.close()


class TestDisableCleanup:
    """Ensure disable() clears middleware state so re-enable gets fresh config."""

    def test_disable_clears_middleware(self):
        """disable() at depth=0 must set _middleware to None."""
        ag402_core.enable()
        assert monkey_mod._middleware is not None
        ag402_core.disable()
        assert monkey_mod._middleware is None, (
            "disable() did not clear _middleware — re-enable would reuse stale state"
        )

    def test_disable_clears_thread_pool(self):
        """disable() at depth=0 must shut down and clear _thread_pool."""
        ag402_core.enable()
        # Simulate that _thread_pool was created (normally only in Jupyter/async)
        import concurrent.futures
        monkey_mod._thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        ag402_core.disable()
        assert monkey_mod._thread_pool is None, (
            "disable() did not clear _thread_pool"
        )

    def test_nested_disable_preserves_middleware(self):
        """Nested disable() (depth > 0) must NOT clear middleware."""
        ag402_core.enable()
        ag402_core.enable()  # depth=2
        mw = monkey_mod._middleware
        ag402_core.disable()  # depth=1, still active
        assert monkey_mod._middleware is mw, (
            "Nested disable() cleared middleware while still active"
        )

    def test_reenable_gets_fresh_middleware(self):
        """After disable+enable cycle, middleware should be freshly created."""
        ag402_core.enable()
        old_mw = monkey_mod._middleware
        ag402_core.disable()
        ag402_core.enable()
        new_mw = monkey_mod._middleware
        assert new_mw is not old_mw, (
            "Re-enable reused old middleware instead of creating fresh one"
        )


class TestGzipResponseHandling:
    """Ensure gzip-encoded upstream responses don't cause double-decompression."""

    @pytest.mark.asyncio
    async def test_gzip_response_no_double_decompress(self, tmp_path):
        """When upstream returns Content-Encoding: gzip, the monkey-patch must
        strip encoding headers from the re-wrapped response to prevent httpx
        from attempting to decompress already-decoded content.

        Regression test for: zlib error: incorrect header check
        (paid successfully but body couldn't be read due to double-decompression)
        """
        import gzip

        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.solana_adapter import MockSolanaAdapter

        from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

        # Prepare a gzip-compressed body (simulating what Cloudflare/CDN sends)
        plain_body = b'{"report": "audit data", "status": "ok"}'
        gzip_body = gzip.compress(plain_body)

        # Response sequence: first 402 challenge, then 200 with gzip body
        transport = SequentialTransport([
            (402, _402_headers(amount="0.01"), b"Payment required"),
            (200, {
                "content-type": "application/json",
                "content-encoding": "gzip",
            }, gzip_body),
        ])

        wallet = await _make_wallet(tmp_path, balance=100.0)
        provider = MockSolanaAdapter()
        config = _make_config()

        mw_client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=mw_client)

        monkey_mod._middleware = mw
        monkey_mod._middleware._wallet_initialized = True
        ag402_core.enable()

        user_client = httpx.AsyncClient(transport=transport)
        try:
            resp = await user_client.get("https://example.com/paid-api")
            # Must succeed — NOT raise zlib error
            assert resp.status_code == 200
            # Body must be the decoded plaintext, not garbled
            assert resp.json() == {"report": "audit data", "status": "ok"}
            # content-encoding must NOT be in the final response headers
            assert "content-encoding" not in resp.headers
        finally:
            await user_client.aclose()
            await mw_client.aclose()
            await wallet.close()

    @pytest.mark.asyncio
    async def test_transfer_encoding_stripped(self, tmp_path):
        """transfer-encoding header must also be stripped from re-wrapped responses."""
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.solana_adapter import MockSolanaAdapter

        from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

        transport = SequentialTransport([
            (402, _402_headers(amount="0.01"), b"Payment required"),
            (200, {
                "content-type": "text/plain",
                "transfer-encoding": "chunked",
            }, b"hello world"),
        ])

        wallet = await _make_wallet(tmp_path, balance=100.0)
        provider = MockSolanaAdapter()
        config = _make_config()

        mw_client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=mw_client)

        monkey_mod._middleware = mw
        monkey_mod._middleware._wallet_initialized = True
        ag402_core.enable()

        user_client = httpx.AsyncClient(transport=transport)
        try:
            resp = await user_client.get("https://example.com/paid-api")
            assert resp.status_code == 200
            assert resp.text == "hello world"
            assert "transfer-encoding" not in resp.headers
        finally:
            await user_client.aclose()
            await mw_client.aclose()
            await wallet.close()

    @pytest.mark.asyncio
    async def test_content_length_matches_decoded_body(self, tmp_path):
        """content-length must reflect the decoded body size, not the compressed
        wire size.  If stale content-length is passed through, consumers may
        silently truncate the response.

        Regression test for: silent data truncation after gzip decompression.
        """
        import gzip

        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.solana_adapter import MockSolanaAdapter

        from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

        # Large payload so compressed vs uncompressed sizes differ significantly
        plain_body = b'{"data": "' + b'x' * 1000 + b'", "status": "ok"}'
        gzip_body = gzip.compress(plain_body)
        assert len(gzip_body) < len(plain_body), "test setup: gzip must shrink body"

        transport = SequentialTransport([
            (402, _402_headers(amount="0.01"), b"Payment required"),
            (200, {
                "content-type": "application/json",
                "content-encoding": "gzip",
                "content-length": str(len(gzip_body)),  # compressed size
            }, gzip_body),
        ])

        wallet = await _make_wallet(tmp_path, balance=100.0)
        provider = MockSolanaAdapter()
        config = _make_config()

        mw_client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=mw_client)

        monkey_mod._middleware = mw
        monkey_mod._middleware._wallet_initialized = True
        ag402_core.enable()

        user_client = httpx.AsyncClient(transport=transport)
        try:
            resp = await user_client.get("https://example.com/paid-api")
            assert resp.status_code == 200
            # Full body must be readable (no truncation)
            body = resp.content
            assert len(body) == len(plain_body), (
                f"Body truncated: got {len(body)} bytes, expected {len(plain_body)}"
            )
            # content-length in headers must match actual body (or be absent)
            if "content-length" in resp.headers:
                assert int(resp.headers["content-length"]) == len(body)
        finally:
            await user_client.aclose()
            await mw_client.aclose()
            await wallet.close()
