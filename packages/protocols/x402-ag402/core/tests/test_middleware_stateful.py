"""Tests for x402 middleware state machine integration -- P0-2 fix.

Key test: After chain payment succeeds but retry fails,
the middleware must NOT rollback the local wallet deduction.
Instead, it marks the order as DELIVERING for async retry.
"""

from __future__ import annotations

import httpx
import pytest
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.payment.base import PaymentResult
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.wallet.payment_order import OrderState, PaymentOrderStore

from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet


async def _make_order_store(tmp_path) -> PaymentOrderStore:
    db_path = str(tmp_path / "orders.db")
    store = PaymentOrderStore(db_path=db_path)
    await store.init_db()
    return store


# --- P0-2 critical test: retry failure must NOT rollback ---


@pytest.mark.asyncio
async def test_retry_failure_does_NOT_rollback_after_chain_payment(tmp_path):
    """CRITICAL: When chain payment succeeds but retry returns 500,
    the local wallet deduction must NOT be rolled back,
    and the order must be in DELIVERING state for background retry."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()
    order_store = await _make_order_store(tmp_path)

    transport = SequentialTransport([
        # First call -> 402
        (402, _402_headers(amount="0.05"), b"Pay"),
        # Retry returns 500 error
        (500, {}, b"Internal server error"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=order_store,
    )
    result = await mw.handle_request("GET", "https://example.com/api")

    # Payment was made on-chain
    assert result.payment_made
    assert result.tx_hash.startswith("mock_tx_")

    # CRITICAL: Balance should NOT be restored — chain payment was real
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(99.95)  # 100 - 0.05

    # Order should be in DELIVERING state (for async retry)
    assert result.error != ""
    # The order should exist in the store
    delivering = await order_store.get_by_state(OrderState.DELIVERING)
    assert len(delivering) == 1
    assert delivering[0].tx_hash == result.tx_hash

    await client.aclose()
    await order_store.close()
    await wallet.close()


@pytest.mark.asyncio
async def test_chain_payment_failure_DOES_rollback(tmp_path):
    """When chain payment fails (before broadcast), wallet should be rolled back."""
    wallet = await _make_wallet(tmp_path)
    config = _make_config()
    order_store = await _make_order_store(tmp_path)

    class FailingProvider(MockSolanaAdapter):
        async def pay(self, to_address, amount, token="USDC", *, request_id=""):
            return PaymentResult(tx_hash="", success=False, error="Network timeout")

    provider = FailingProvider()

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=order_store,
    )
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 402
    assert "Payment failed" in result.error
    assert not result.payment_made

    # Balance should be restored (chain payment never happened)
    assert float(await wallet.get_balance()) == pytest.approx(100.0)

    # Order should be REFUNDED
    refunded = await order_store.get_by_state(OrderState.REFUNDED)
    assert len(refunded) == 1

    await client.aclose()
    await order_store.close()
    await wallet.close()


@pytest.mark.asyncio
async def test_successful_payment_flow_marks_success(tmp_path):
    """Full happy path: 402 -> pay -> retry 200 -> order is SUCCESS."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()
    order_store = await _make_order_store(tmp_path)

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
        (200, {"content-type": "text/plain"}, b"Weather: sunny"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=order_store,
    )
    result = await mw.handle_request("GET", "https://example.com/weather")

    assert result.status_code == 200
    assert result.payment_made
    assert float(await wallet.get_balance()) == pytest.approx(99.95)

    # Order should be SUCCESS
    success_orders = await order_store.get_by_state(OrderState.SUCCESS)
    assert len(success_orders) == 1
    assert success_orders[0].tx_hash == result.tx_hash

    await client.aclose()
    await order_store.close()
    await wallet.close()


@pytest.mark.asyncio
async def test_idempotency_key_in_retry_headers(tmp_path):
    """Retry request must include Idempotency-Key header."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()
    order_store = await _make_order_store(tmp_path)

    # Custom transport that captures request headers
    captured_headers = []

    class HeaderCapturingTransport(httpx.AsyncBaseTransport):
        def __init__(self, responses):
            self._responses = list(responses)
            self._idx = 0

        async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
            captured_headers.append(dict(request.headers))
            if self._idx >= len(self._responses):
                return httpx.Response(500, content=b"No more")
            status, hdrs, body = self._responses[self._idx]
            self._idx += 1
            return httpx.Response(status, headers=hdrs, content=body)

    transport = HeaderCapturingTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
        (200, {"content-type": "text/plain"}, b"OK"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(
        wallet, provider, config,
        http_client=client,
        order_store=order_store,
    )
    await mw.handle_request("GET", "https://example.com/api")

    # The retry request (second call) must have Idempotency-Key
    assert len(captured_headers) == 2
    retry_hdrs = captured_headers[1]
    assert "idempotency-key" in retry_hdrs or "Idempotency-Key" in retry_hdrs
    # The key should be the order_id
    idem_key = retry_hdrs.get("idempotency-key", retry_hdrs.get("Idempotency-Key", ""))
    assert idem_key != ""

    await client.aclose()
    await order_store.close()
    await wallet.close()


@pytest.mark.asyncio
async def test_middleware_backwards_compat_without_order_store(tmp_path):
    """Middleware without order_store should still work (graceful degradation)."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
        (200, {"content-type": "text/plain"}, b"OK"),
    ])
    client = httpx.AsyncClient(transport=transport)

    # No order_store provided
    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 200
    assert result.payment_made

    await client.aclose()
    await wallet.close()
