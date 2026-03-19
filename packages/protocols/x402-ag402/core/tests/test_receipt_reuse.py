"""Tests for P1-RECEIPT-REUSE fix: receipt grace window + delivery retry worker.

Covers three layers:
1. PersistentReplayGuard grace window (replay_guard.py)
   - NEW tx_hash recorded and allowed
   - WITHIN_GRACE tx_hash allowed for retry within window
   - EXPIRED tx_hash rejected after grace window
   - Delivered tx_hash rejected (no retry needed)
   - Response caching and retrieval
2. DeliveryWorker (delivery_worker.py)
   - Retries stale DELIVERING orders
   - Respects exponential backoff
   - Transitions to FAILED after max retries
   - Transitions to SUCCESS on successful retry
3. Gateway integration (gateway.py)
   - New tx_hash proxied and response cached
   - Retry within grace window returns cached response
   - Retry within grace window re-proxies if no cache (upstream failed)
   - Expired tx_hash rejected
4. Payment order state machine
   - DELIVERING -> FAILED transition
   - FAILED is terminal
5. Middleware integration
   - Delivery worker starts/stops with middleware lifecycle
"""

from __future__ import annotations

import asyncio
import json
import time
from unittest.mock import AsyncMock

import httpx
import pytest
from ag402_core.delivery_worker import DeliveryWorker
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.security.replay_guard import (
    PersistentReplayGuard,
    TxHashStatus,
)
from ag402_core.wallet.payment_order import (
    InvalidStateTransition,
    OrderState,
    PaymentOrder,
    PaymentOrderStore,
)

from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

# ═══════════════════════════════════════════════════════════════════
# 1. PersistentReplayGuard grace window tests
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_guard_new_tx_hash_returns_new(tmp_path):
    """A never-seen tx_hash should return NEW."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"), grace_seconds=300)
    await guard.init_db()

    status = await guard.check_tx_status("tx_abc123")
    assert status == TxHashStatus.NEW

    await guard.close()


@pytest.mark.asyncio
async def test_guard_recorded_tx_within_grace(tmp_path):
    """A recorded but undelivered tx_hash within grace window returns WITHIN_GRACE."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"), grace_seconds=300)
    await guard.init_db()

    # Record the tx_hash
    is_new = await guard.check_and_record_tx("tx_abc123")
    assert is_new is True

    # Check status — should be within grace
    status = await guard.check_tx_status("tx_abc123")
    assert status == TxHashStatus.WITHIN_GRACE

    await guard.close()


@pytest.mark.asyncio
async def test_guard_delivered_tx_returns_expired(tmp_path):
    """A delivered tx_hash should return EXPIRED (no retry needed)."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"), grace_seconds=300)
    await guard.init_db()

    await guard.check_and_record_tx("tx_delivered")
    await guard.mark_delivered("tx_delivered")

    status = await guard.check_tx_status("tx_delivered")
    assert status == TxHashStatus.EXPIRED

    await guard.close()


@pytest.mark.asyncio
async def test_guard_expired_grace_window(tmp_path):
    """A tx_hash past the grace window should return EXPIRED."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"), grace_seconds=1)
    await guard.init_db()

    await guard.check_and_record_tx("tx_old")

    # Wait for grace to expire
    await asyncio.sleep(1.5)

    status = await guard.check_tx_status("tx_old")
    assert status == TxHashStatus.EXPIRED

    await guard.close()


@pytest.mark.asyncio
async def test_guard_response_cache_roundtrip(tmp_path):
    """Cached responses should be retrievable."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"))
    await guard.init_db()

    await guard.check_and_record_tx("tx_cached")
    await guard.cache_response(
        "tx_cached",
        status_code=200,
        headers={"content-type": "application/json"},
        body=b'{"result": "ok"}',
    )

    cached = await guard.get_cached_response("tx_cached")
    assert cached is not None
    status_code, headers, body = cached
    assert status_code == 200
    assert headers["content-type"] == "application/json"
    assert body == b'{"result": "ok"}'

    await guard.close()


@pytest.mark.asyncio
async def test_guard_no_cache_returns_none(tmp_path):
    """get_cached_response for uncached tx_hash returns None."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"))
    await guard.init_db()

    cached = await guard.get_cached_response("tx_nocache")
    assert cached is None

    await guard.close()


@pytest.mark.asyncio
async def test_guard_check_and_record_idempotent(tmp_path):
    """check_and_record_tx returns False on second call (still atomic)."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"))
    await guard.init_db()

    assert await guard.check_and_record_tx("tx_dup") is True
    assert await guard.check_and_record_tx("tx_dup") is False

    await guard.close()


@pytest.mark.asyncio
async def test_guard_prune_removes_old_entries(tmp_path):
    """prune() should remove expired entries and response cache."""
    guard = PersistentReplayGuard(db_path=str(tmp_path / "r.db"), grace_seconds=1)
    await guard.init_db()

    await guard.check_and_record_tx("tx_prune")
    await guard.cache_response("tx_prune", 200, {}, b"data")

    await asyncio.sleep(1.5)
    pruned = await guard.prune(max_age_seconds=1)
    assert pruned >= 1

    # tx should now be completely gone
    status = await guard.check_tx_status("tx_prune")
    assert status == TxHashStatus.NEW

    await guard.close()


# ═══════════════════════════════════════════════════════════════════
# 2. Payment Order state machine: FAILED state tests
# ═══════════════════════════════════════════════════════════════════


class TestFailedState:
    def test_delivering_to_failed(self):
        """DELIVERING -> FAILED should be allowed."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx1")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="solana_tx")
        order.transition_to(OrderState.DELIVERING)
        order.transition_to(OrderState.FAILED, error_message="Retries exhausted")
        assert order.state == OrderState.FAILED
        assert "exhausted" in order.error_message.lower()

    def test_failed_is_terminal(self):
        """Cannot transition out of FAILED."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx1")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="solana_tx")
        order.transition_to(OrderState.DELIVERING)
        order.transition_to(OrderState.FAILED)
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.SUCCESS)

    def test_failed_from_created_is_invalid(self):
        """Cannot go directly from CREATED to FAILED."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.FAILED)

    def test_failed_state_value(self):
        """FAILED state should have correct string value."""
        assert OrderState.FAILED.value == "FAILED"

    async def test_store_failed_order(self, tmp_path):
        """FAILED orders should persist and load correctly."""
        db_path = str(tmp_path / "orders.db")
        store = PaymentOrderStore(db_path=db_path)
        await store.init_db()

        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="w1")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx1")
        order.transition_to(OrderState.DELIVERING)
        order.transition_to(OrderState.FAILED, error_message="Max retries")
        await store.save(order)

        loaded = await store.get(order.order_id)
        assert loaded is not None
        assert loaded.state == OrderState.FAILED
        assert loaded.error_message == "Max retries"

        await store.close()


# ═══════════════════════════════════════════════════════════════════
# 3. DeliveryWorker tests
# ═══════════════════════════════════════════════════════════════════


async def _make_order_store(tmp_path) -> PaymentOrderStore:
    db_path = str(tmp_path / "orders.db")
    store = PaymentOrderStore(db_path=db_path)
    await store.init_db()
    return store


def _make_delivering_order(
    tx_hash: str = "tx_stuck",
    retry_count: int = 0,
    age_seconds: float = 120,
) -> PaymentOrder:
    """Create an order stuck in DELIVERING state."""
    order = PaymentOrder(
        amount=0.05,
        to_address="RecipientAddr111",
        token="USDC",
        chain="solana",
        request_url="https://api.example.com/data",
        request_method="GET",
        request_headers=json.dumps({"user-agent": "test"}),
    )
    order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="w1")
    order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash=tx_hash)
    order.transition_to(OrderState.DELIVERING)
    order.retry_count = retry_count
    # Backdate to make it stale
    order.updated_at = time.time() - age_seconds
    return order


@pytest.mark.asyncio
async def test_delivery_worker_retries_and_succeeds(tmp_path):
    """Worker should retry a stuck delivery and transition to SUCCESS."""
    store = await _make_order_store(tmp_path)
    order = _make_delivering_order(tx_hash="tx_retry_ok", retry_count=0, age_seconds=120)
    await store.save(order)

    # Mock httpx client that returns 200
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.request.return_value = httpx.Response(200, content=b'{"ok": true}')

    worker = DeliveryWorker(
        store,
        poll_interval=1,
        max_retries=5,
        base_backoff=1,  # 1s backoff for fast test
        stale_age=1,
        http_client=mock_client,
    )

    # Run a single poll cycle
    await worker._poll_and_retry()

    # Order should be SUCCESS
    loaded = await store.get(order.order_id)
    assert loaded.state == OrderState.SUCCESS

    await store.close()


@pytest.mark.asyncio
async def test_delivery_worker_retry_still_fails(tmp_path):
    """Worker should increment retry_count when retry still fails."""
    store = await _make_order_store(tmp_path)
    order = _make_delivering_order(tx_hash="tx_retry_fail", retry_count=0, age_seconds=120)
    await store.save(order)

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.request.return_value = httpx.Response(502, content=b"Bad Gateway")

    worker = DeliveryWorker(
        store,
        poll_interval=1,
        max_retries=5,
        base_backoff=1,
        stale_age=1,
        http_client=mock_client,
    )

    await worker._poll_and_retry()

    loaded = await store.get(order.order_id)
    assert loaded.state == OrderState.DELIVERING
    assert loaded.retry_count == 1
    assert "502" in loaded.error_message

    await store.close()


@pytest.mark.asyncio
async def test_delivery_worker_exhausts_retries_marks_failed(tmp_path):
    """Worker should mark order as FAILED after max retries."""
    store = await _make_order_store(tmp_path)
    order = _make_delivering_order(tx_hash="tx_exhausted", retry_count=5, age_seconds=120)
    await store.save(order)

    mock_client = AsyncMock(spec=httpx.AsyncClient)

    worker = DeliveryWorker(
        store,
        poll_interval=1,
        max_retries=5,
        base_backoff=1,
        stale_age=1,
        http_client=mock_client,
    )

    await worker._poll_and_retry()

    loaded = await store.get(order.order_id)
    assert loaded.state == OrderState.FAILED
    assert "exhausted" in loaded.error_message.lower()

    # httpx should NOT have been called
    mock_client.request.assert_not_called()

    await store.close()


@pytest.mark.asyncio
async def test_delivery_worker_respects_backoff(tmp_path):
    """Worker should skip orders whose backoff hasn't elapsed."""
    store = await _make_order_store(tmp_path)
    # retry_count=2 → backoff = 1 * 2^2 = 4s, but order was updated only 2s ago
    order = _make_delivering_order(tx_hash="tx_backoff", retry_count=2, age_seconds=2)
    await store.save(order)

    mock_client = AsyncMock(spec=httpx.AsyncClient)

    worker = DeliveryWorker(
        store,
        poll_interval=1,
        max_retries=5,
        base_backoff=1,
        stale_age=1,
        http_client=mock_client,
    )

    await worker._poll_and_retry()

    # Should NOT have attempted retry (backoff not elapsed)
    mock_client.request.assert_not_called()

    loaded = await store.get(order.order_id)
    assert loaded.state == OrderState.DELIVERING
    assert loaded.retry_count == 2  # unchanged

    await store.close()


@pytest.mark.asyncio
async def test_delivery_worker_network_error(tmp_path):
    """Worker should handle network errors gracefully."""
    store = await _make_order_store(tmp_path)
    order = _make_delivering_order(tx_hash="tx_neterr", retry_count=0, age_seconds=120)
    await store.save(order)

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.request.side_effect = httpx.ConnectError("Connection refused")

    worker = DeliveryWorker(
        store,
        poll_interval=1,
        max_retries=5,
        base_backoff=1,
        stale_age=1,
        http_client=mock_client,
    )

    await worker._poll_and_retry()

    loaded = await store.get(order.order_id)
    assert loaded.state == OrderState.DELIVERING
    assert loaded.retry_count == 1
    assert "network error" in loaded.error_message.lower()

    await store.close()


@pytest.mark.asyncio
async def test_delivery_worker_stop(tmp_path):
    """Worker.stop() should terminate the run loop."""
    store = await _make_order_store(tmp_path)

    worker = DeliveryWorker(store, poll_interval=1, stale_age=1)
    task = asyncio.create_task(worker.run())

    await asyncio.sleep(0.5)
    worker.stop()

    # Should finish within a few seconds
    await asyncio.wait_for(task, timeout=5.0)
    assert not worker._running

    await store.close()


# ═══════════════════════════════════════════════════════════════════
# 4. Middleware delivery worker lifecycle tests
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_middleware_starts_delivery_worker(tmp_path):
    """Middleware should start the delivery worker when order_store is provided."""
    wallet = await _make_wallet(tmp_path)
    from ag402_core.payment.solana_adapter import MockSolanaAdapter
    provider = MockSolanaAdapter()
    config = _make_config()
    store = await _make_order_store(tmp_path)

    transport = SequentialTransport([])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=store,
    )

    await mw.start_delivery_worker()
    assert mw._delivery_worker_task is not None
    assert not mw._delivery_worker_task.done()

    await mw.stop_delivery_worker()
    assert mw._delivery_worker_task is None

    await client.aclose()
    await store.close()
    await wallet.close()


@pytest.mark.asyncio
async def test_middleware_no_worker_without_order_store(tmp_path):
    """Middleware should not start worker when no order_store."""
    wallet = await _make_wallet(tmp_path)
    from ag402_core.payment.solana_adapter import MockSolanaAdapter
    provider = MockSolanaAdapter()
    config = _make_config()

    transport = SequentialTransport([])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    await mw.start_delivery_worker()
    assert mw._delivery_worker_task is None

    await client.aclose()
    await wallet.close()


# ═══════════════════════════════════════════════════════════════════
# 5. Gateway grace window integration tests
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_gateway_new_tx_proxied_and_cached(tmp_path):
    """New tx_hash should be proxied and the response cached."""
    from ag402_core.gateway.auth import PaymentVerifier
    from ag402_mcp.gateway import X402Gateway
    from httpx import ASGITransport, AsyncClient

    replay_db = str(tmp_path / "replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        address="TestAddr111",
        verifier=PaymentVerifier(),
        replay_db_path=replay_db,
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()

    # Mock upstream returns 200
    mock_upstream_resp = httpx.Response(
        200, content=b'{"weather":"sunny"}',
        headers={"content-type": "application/json"},
    )

    import uuid
    tx_hash = f"tx_new_{uuid.uuid4().hex[:8]}"

    # Inject a mock http_client directly — ASGITransport does NOT trigger
    # FastAPI lifespan, so _http_client stays None and the fallback path
    # would create a real httpx.AsyncClient that tries to connect to
    # "http://mock-upstream", causing the test to hang.
    mock_upstream_client = AsyncMock()
    mock_upstream_client.request.return_value = mock_upstream_resp
    mock_upstream_client.aclose = AsyncMock()
    gateway._http_client = mock_upstream_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        response = await client.get(
            "/weather",
            headers={
                "Authorization": f"x402 {tx_hash}",
                "X-x402-Timestamp": str(int(time.time())),
                "X-x402-Nonce": uuid.uuid4().hex,
            },
        )

    assert response.status_code == 200

    # Verify the response was cached
    cached = await gateway._persistent_guard.get_cached_response(tx_hash)
    assert cached is not None
    assert cached[0] == 200

    # Verify tx_hash is marked delivered
    status = await gateway._persistent_guard.check_tx_status(tx_hash)
    assert status == TxHashStatus.EXPIRED  # Delivered = EXPIRED (no retry needed)

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_gateway_delivered_tx_rejected_on_reuse(tmp_path):
    """Successfully delivered tx_hash should be rejected on second use (no double-delivery)."""
    from ag402_core.gateway.auth import PaymentVerifier
    from ag402_mcp.gateway import X402Gateway
    from httpx import ASGITransport, AsyncClient

    replay_db = str(tmp_path / "replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        address="TestAddr222",
        verifier=PaymentVerifier(),
        replay_db_path=replay_db,
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()

    import uuid
    tx_hash = f"tx_grace_{uuid.uuid4().hex[:8]}"

    # First request: proxy succeeds
    mock_upstream_resp = httpx.Response(
        200, content=b'{"data":"original"}',
        headers={"content-type": "application/json"},
    )

    # Inject mock http_client directly to avoid lifespan issue
    mock_instance = AsyncMock()
    mock_instance.request.return_value = mock_upstream_resp
    mock_instance.aclose = AsyncMock()
    gateway._http_client = mock_instance

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        resp1 = await client.get(
            "/data",
            headers={
                "Authorization": f"x402 {tx_hash}",
                "X-x402-Timestamp": str(int(time.time())),
                "X-x402-Nonce": uuid.uuid4().hex,
            },
        )

    assert resp1.status_code == 200

    # Second request: same tx_hash, should be rejected (already delivered)
    mock_instance.request.reset_mock()

    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        resp2 = await client.get(
            "/data",
            headers={
                "Authorization": f"x402 {tx_hash}",
                "X-x402-Timestamp": str(int(time.time())),
                "X-x402-Nonce": uuid.uuid4().hex,
            },
        )

    # Since it's delivered, the status check will return EXPIRED → rejected.
    # This is correct: a successfully delivered tx should not be reused.
    assert resp2.status_code == 402  # Rejected as expired (already delivered)

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_gateway_grace_window_reproxi_after_upstream_failure(tmp_path):
    """When upstream fails, buyer should be able to retry within grace window."""
    from ag402_core.gateway.auth import PaymentVerifier
    from ag402_mcp.gateway import X402Gateway
    from httpx import ASGITransport, AsyncClient

    replay_db = str(tmp_path / "replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        address="TestAddr333",
        verifier=PaymentVerifier(),
        replay_db_path=replay_db,
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()

    import uuid
    tx_hash = f"tx_fail_retry_{uuid.uuid4().hex[:8]}"

    # Inject mock http_client directly to avoid lifespan issue
    mock_instance = AsyncMock()
    mock_instance.aclose = AsyncMock()
    gateway._http_client = mock_instance

    # First request: upstream returns 502 (failure)
    mock_fail_resp = httpx.Response(502, content=b"Bad Gateway")
    mock_instance.request.return_value = mock_fail_resp

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        resp1 = await client.get(
            "/data",
            headers={
                "Authorization": f"x402 {tx_hash}",
                "X-x402-Timestamp": str(int(time.time())),
                "X-x402-Nonce": uuid.uuid4().hex,
            },
        )

    # First request gets the 502 from upstream
    assert resp1.status_code == 502

    # Verify NOT marked as delivered (so grace window applies)
    status = await gateway._persistent_guard.check_tx_status(tx_hash)
    assert status == TxHashStatus.WITHIN_GRACE

    # Second request: same tx_hash, upstream now returns 200
    mock_ok_resp = httpx.Response(
        200, content=b'{"data":"success"}',
        headers={"content-type": "application/json"},
    )
    mock_instance.request.return_value = mock_ok_resp

    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        resp2 = await client.get(
            "/data",
            headers={
                "Authorization": f"x402 {tx_hash}",
                "X-x402-Timestamp": str(int(time.time())),
                "X-x402-Nonce": uuid.uuid4().hex,
            },
        )

    assert resp2.status_code == 200
    data = resp2.json()
    assert data["data"] == "success"

    # Now it should be marked as delivered
    status = await gateway._persistent_guard.check_tx_status(tx_hash)
    assert status == TxHashStatus.EXPIRED  # delivered

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_gateway_expired_tx_rejected(tmp_path):
    """Tx_hash past grace window should be rejected."""
    from ag402_core.gateway.auth import PaymentVerifier
    from ag402_mcp.gateway import X402Gateway
    from httpx import ASGITransport, AsyncClient

    replay_db = str(tmp_path / "replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        address="TestAddr444",
        verifier=PaymentVerifier(),
        replay_db_path=replay_db,
    )
    # Set grace window to 1 second for fast test
    gateway._persistent_guard = PersistentReplayGuard(
        db_path=replay_db, grace_seconds=1,
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()

    import uuid
    tx_hash = f"tx_expired_{uuid.uuid4().hex[:8]}"

    # Record the tx_hash
    await gateway._persistent_guard.check_and_record_tx(tx_hash)

    # Wait for grace to expire
    await asyncio.sleep(1.5)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        resp = await client.get(
            "/data",
            headers={
                "Authorization": f"x402 {tx_hash}",
                "X-x402-Timestamp": str(int(time.time())),
                "X-x402-Nonce": uuid.uuid4().hex,
            },
        )

    assert resp.status_code == 402  # Rejected

    await gateway._persistent_guard.close()


# ═══════════════════════════════════════════════════════════════════
# 6. End-to-end: middleware + delivery worker integration
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_e2e_retry_failure_then_worker_succeeds(tmp_path):
    """Full flow: payment succeeds, retry fails 502, delivery worker retries and succeeds."""
    from ag402_core.payment.solana_adapter import MockSolanaAdapter

    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()
    store = await _make_order_store(tmp_path)

    # First call: 402, retry returns 502
    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
        (502, {}, b"Bad Gateway"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=store,
        enable_delivery_worker=False,  # We'll drive the worker manually
    )
    result = await mw.handle_request("GET", "https://example.com/api")

    # Payment made but delivery failed
    assert result.payment_made
    assert result.status_code == 502

    # Order stuck in DELIVERING
    delivering = await store.get_by_state(OrderState.DELIVERING)
    assert len(delivering) == 1
    stuck_order = delivering[0]

    # Backdate so the worker considers it stale
    stuck_order.updated_at = time.time() - 120
    await store.update(stuck_order)

    # Now create a worker with a mock client that succeeds
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.request.return_value = httpx.Response(200, content=b'{"data":"ok"}')

    worker = DeliveryWorker(
        store,
        poll_interval=1,
        max_retries=5,
        base_backoff=1,
        stale_age=1,
        http_client=mock_client,
    )
    await worker._poll_and_retry()

    # Order should now be SUCCESS
    loaded = await store.get(stuck_order.order_id)
    assert loaded.state == OrderState.SUCCESS

    # Balance was NOT restored (chain payment is real)
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(99.95)

    await client.aclose()
    await store.close()
    await wallet.close()


@pytest.mark.asyncio
async def test_e2e_all_retries_exhausted_marks_failed(tmp_path):
    """Full flow: delivery fails repeatedly until FAILED state."""
    from ag402_core.payment.solana_adapter import MockSolanaAdapter

    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()
    store = await _make_order_store(tmp_path)

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
        (502, {}, b"Bad Gateway"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=store,
        delivery_max_retries=2,
        enable_delivery_worker=False,
    )
    result = await mw.handle_request("GET", "https://example.com/api")
    assert result.payment_made

    delivering = await store.get_by_state(OrderState.DELIVERING)
    assert len(delivering) == 1
    order = delivering[0]

    # Simulate max retries reached
    order.retry_count = 2
    order.updated_at = time.time() - 120
    await store.update(order)

    mock_client = AsyncMock(spec=httpx.AsyncClient)
    worker = DeliveryWorker(
        store, poll_interval=1, max_retries=2,
        base_backoff=1, stale_age=1, http_client=mock_client,
    )
    await worker._poll_and_retry()

    loaded = await store.get(order.order_id)
    assert loaded.state == OrderState.FAILED

    # Balance NOT restored
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(99.95)

    await client.aclose()
    await store.close()
    await wallet.close()
