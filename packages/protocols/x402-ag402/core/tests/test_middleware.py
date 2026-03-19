"""Tests for x402 middleware, budget guard, and security."""

from __future__ import annotations

import logging

import httpx
import pytest
from ag402_core.middleware.budget_guard import BudgetGuard
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.payment.base import PaymentResult
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.security.key_guard import PrivateKeyFilter, install_key_guard

from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

# --- Middleware Tests ---


@pytest.mark.asyncio
async def test_normal_request_passthrough(tmp_path):
    """Non-402 response passes through unchanged."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()

    transport = SequentialTransport([
        (200, {"content-type": "application/json"}, b'{"result": "ok"}'),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 200
    assert result.body == b'{"result": "ok"}'
    assert not result.payment_made
    assert result.tx_hash == ""
    assert await wallet.get_balance() == 100.0

    await client.aclose()
    await wallet.close()


@pytest.mark.asyncio
async def test_402_triggers_payment_and_retry(tmp_path):
    """402 with x402 headers -> pay -> retry -> success."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()

    transport = SequentialTransport([
        # First call -> 402
        (402, _402_headers(amount="0.05"), b"Payment required"),
        # Second call (retry) -> 200
        (200, {"content-type": "text/plain"}, b"Weather: sunny"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/weather")

    assert result.status_code == 200
    assert result.body == b"Weather: sunny"
    assert result.payment_made
    assert result.tx_hash.startswith("mock_tx_")
    assert result.amount_paid == 0.05
    assert float(await wallet.get_balance()) == pytest.approx(99.95)

    await client.aclose()
    await wallet.close()


@pytest.mark.asyncio
async def test_402_without_x402_passthrough(tmp_path):
    """402 without x402 headers passes through as-is."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()

    transport = SequentialTransport([
        # 402 without x402 WWW-Authenticate header
        (402, {"content-type": "text/plain"}, b"Pay via Stripe"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 402
    assert result.body == b"Pay via Stripe"
    assert not result.payment_made
    assert await wallet.get_balance() == 100.0

    await client.aclose()
    await wallet.close()


@pytest.mark.asyncio
async def test_budget_exceeded_blocks_payment(tmp_path):
    """Amount > single_tx_limit -> blocked, no payment."""
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config(single_tx_limit=0.01)  # Very low limit

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 402
    # Blocked either by challenge validation or budget guard
    assert "denied" in result.error.lower() or "validation failed" in result.error.lower()
    assert not result.payment_made
    assert await wallet.get_balance() == 100.0

    await client.aclose()
    await wallet.close()


@pytest.mark.asyncio
async def test_payment_failure_triggers_rollback(tmp_path):
    """Payment provider returns failure -> wallet rollback."""
    wallet = await _make_wallet(tmp_path)
    config = _make_config()

    # Custom mock that always fails payment
    class FailingProvider(MockSolanaAdapter):
        async def pay(self, to_address, amount, token="USDC", *, request_id=""):
            return PaymentResult(tx_hash="", success=False, error="Network timeout")

    provider = FailingProvider()

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 402
    assert "Payment failed" in result.error
    # Balance should be restored after rollback
    assert float(await wallet.get_balance()) == pytest.approx(100.0)

    await client.aclose()
    await wallet.close()


@pytest.mark.asyncio
async def test_retry_failure_does_NOT_rollback(tmp_path):
    """Payment succeeds but retry returns error -> wallet is NOT rolled back.

    After chain broadcast, the payment is real and must not be undone.
    See P0-2 state machine fix.
    """
    wallet = await _make_wallet(tmp_path)
    provider = MockSolanaAdapter()
    config = _make_config()

    transport = SequentialTransport([
        (402, _402_headers(amount="0.05"), b"Pay"),
        # Retry returns 500 error
        (500, {}, b"Internal server error"),
    ])
    client = httpx.AsyncClient(transport=transport)

    mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
    result = await mw.handle_request("GET", "https://example.com/api")

    assert result.status_code == 500
    assert "Retry failed" in result.error
    assert result.payment_made  # Payment was made on-chain
    # Balance should NOT be restored — chain payment was real
    assert float(await wallet.get_balance()) == pytest.approx(99.95)

    await client.aclose()
    await wallet.close()


# --- Budget Guard Tests ---


@pytest.mark.asyncio
async def test_budget_guard_daily_limit(tmp_path):
    """Daily limit check prevents exceeding MAX_DAILY_SPEND."""
    wallet = await _make_wallet(tmp_path, balance=1000.0)
    config = _make_config(single_tx_limit=5.0)
    guard = BudgetGuard(wallet, config)

    # Spend up to near the limit
    for _ in range(9):
        await wallet.deduct(1.0, "addr")

    # This should still be allowed (total = 10.0)
    result = await guard.check(1.0)
    assert result.allowed

    # Spend the 10th dollar
    await wallet.deduct(1.0, "addr")

    # Now ANY amount should be denied
    result = await guard.check(0.01)
    assert not result.allowed
    assert "exceed limit" in result.reason

    await wallet.close()


# --- Key Guard Tests ---


def test_key_guard_filters_private_key():
    """PrivateKeyFilter redacts sensitive data in logs."""
    filt = PrivateKeyFilter()

    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname="", lineno=0,
        msg="Loading private_key from file", args=(), exc_info=None,
    )
    filt.filter(record)
    assert "private_key" not in record.msg
    assert "[REDACTED]" in record.msg


def test_key_guard_filters_secret_key():
    """PrivateKeyFilter redacts secret_key pattern."""
    filt = PrivateKeyFilter()

    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname="", lineno=0,
        msg="secret_key=abc123", args=(), exc_info=None,
    )
    filt.filter(record)
    assert "secret_key" not in record.msg
    assert "[REDACTED]" in record.msg


def test_key_guard_allows_safe_messages():
    """PrivateKeyFilter allows messages without sensitive data."""
    filt = PrivateKeyFilter()

    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname="", lineno=0,
        msg="Processing payment of $0.05", args=(), exc_info=None,
    )
    filt.filter(record)
    assert record.msg == "Processing payment of $0.05"


def test_install_key_guard():
    """install_key_guard adds filter to root logger."""
    # Clean up any existing filters first
    root = logging.getLogger()
    root.filters = [f for f in root.filters if not isinstance(f, PrivateKeyFilter)]

    install_key_guard()
    assert any(isinstance(f, PrivateKeyFilter) for f in root.filters)

    # Calling again should not duplicate
    install_key_guard()
    count = sum(1 for f in root.filters if isinstance(f, PrivateKeyFilter))
    assert count == 1

    # Clean up
    root.filters = [f for f in root.filters if not isinstance(f, PrivateKeyFilter)]
