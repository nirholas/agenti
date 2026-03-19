"""Tests for the payment provider abstraction layer."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from ag402_core.config import RunMode, X402Config
from ag402_core.payment.base import BasePaymentProvider, PaymentResult
from ag402_core.payment.registry import ConfigError, PaymentProviderRegistry
from ag402_core.payment.solana_adapter import MockSolanaAdapter

# ---------------------------------------------------------------------------
# MockSolanaAdapter unit tests
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_adapter() -> MockSolanaAdapter:
    return MockSolanaAdapter(balance=50.0)


async def test_mock_adapter_pay(mock_adapter: MockSolanaAdapter) -> None:
    """MockSolanaAdapter.pay() returns success with a tx_hash."""
    result = await mock_adapter.pay(to_address="RecipientAddress111", amount=1.5)

    assert isinstance(result, PaymentResult)
    assert result.success is True
    assert result.tx_hash.startswith("mock_tx_")
    assert len(result.tx_hash) > 10
    assert result.error == ""


async def test_mock_adapter_balance(mock_adapter: MockSolanaAdapter) -> None:
    """MockSolanaAdapter.check_balance() returns the configured value."""
    balance = await mock_adapter.check_balance()
    assert balance == 50.0

    # Balance decreases after a payment
    await mock_adapter.pay(to_address="Someone", amount=10.0)
    assert await mock_adapter.check_balance() == 40.0


async def test_mock_adapter_verify(mock_adapter: MockSolanaAdapter) -> None:
    """MockSolanaAdapter.verify_payment() only accepts hashes issued by .pay().

    S1-3: Arbitrary mock_tx_ prefixed hashes are no longer accepted;
    only hashes actually recorded by .pay() pass verification.
    """
    # Unrecorded mock_tx_ hash must be rejected (S1-3 security fix)
    assert await mock_adapter.verify_payment("mock_tx_abcdef12") is False
    # Empty or too-short tx_hash should be rejected
    assert await mock_adapter.verify_payment("") is False
    assert await mock_adapter.verify_payment("short") is False
    # Previously issued payment should verify
    result = await mock_adapter.pay(to_address="Addr1", amount=1.0)
    assert await mock_adapter.verify_payment(result.tx_hash) is True


async def test_mock_adapter_address(mock_adapter: MockSolanaAdapter) -> None:
    """MockSolanaAdapter.get_address() returns a non-empty string."""
    address = mock_adapter.get_address()
    assert isinstance(address, str)
    assert len(address) > 0


# ---------------------------------------------------------------------------
# PaymentProviderRegistry tests
# ---------------------------------------------------------------------------


async def test_registry_auto_test_mode() -> None:
    """In test mode the registry auto-resolves to MockSolanaAdapter."""
    config = X402Config(mode=RunMode.TEST)
    provider = PaymentProviderRegistry.get_provider("auto", config=config)
    assert isinstance(provider, MockSolanaAdapter)


async def test_registry_auto_no_config() -> None:
    """No keys configured in production mode -> ConfigError."""
    config = X402Config(
        mode=RunMode.PRODUCTION,
        solana_private_key="",
    )
    # Also make sure STRIPE_SECRET_KEY is not set in the env
    with patch.dict(os.environ, {}, clear=False):
        env = os.environ.copy()
        env.pop("STRIPE_SECRET_KEY", None)
        with patch.dict(os.environ, env, clear=True), pytest.raises(ConfigError):
            PaymentProviderRegistry.get_provider("auto", config=config)


async def test_registry_solana_without_package() -> None:
    """Request 'solana' provider but solana package not installed -> ImportError."""
    import sys
    from unittest.mock import patch

    # Temporarily hide solana/solders from sys.modules so the lazy import
    # inside SolanaAdapter.__init__ raises ImportError.
    hidden = {}
    for mod_name in list(sys.modules):
        if mod_name == "solana" or mod_name.startswith("solana.") or \
           mod_name == "solders" or mod_name.startswith("solders."):
            hidden[mod_name] = sys.modules.pop(mod_name)

    import ag402_core.payment.solana_adapter as _sa_mod

    def _fail_import(name, *a, **kw):
        if name.startswith("solana") or name.startswith("solders"):
            raise ImportError(f"No module named '{name}'")
        return original_import(name, *a, **kw)

    original_import = __builtins__["__import__"] if isinstance(__builtins__, dict) else __builtins__.__import__

    try:
        with patch("builtins.__import__", side_effect=_fail_import), \
             pytest.raises(ImportError, match="ag402-core\\[crypto\\]"):
            _sa_mod.SolanaAdapter(
                private_key="FakeKey",
                rpc_url="http://localhost:8899",
            )
    finally:
        # Restore hidden modules
        sys.modules.update(hidden)


# ---------------------------------------------------------------------------
# PaymentResult dataclass sanity
# ---------------------------------------------------------------------------


def test_payment_result_defaults() -> None:
    """PaymentResult has sensible defaults for optional fields."""
    r = PaymentResult(tx_hash="abc123", success=True)
    assert r.error == ""
    assert r.chain == ""


def test_mock_adapter_is_base_provider() -> None:
    """MockSolanaAdapter is a proper subclass of BasePaymentProvider."""
    assert issubclass(MockSolanaAdapter, BasePaymentProvider)


# ---------------------------------------------------------------------------
# Memo field tests
# ---------------------------------------------------------------------------


def test_payment_result_memo_default() -> None:
    """PaymentResult has an empty memo by default."""
    r = PaymentResult(tx_hash="abc123", success=True)
    assert hasattr(r, "memo")
    assert r.memo == ""


async def test_mock_adapter_pay_memo(mock_adapter: MockSolanaAdapter) -> None:
    """MockSolanaAdapter.pay() returns PaymentResult with memo='Ag402-v1'."""
    result = await mock_adapter.pay(to_address="RecipientAddress111", amount=1.0)
    assert result.memo == "Ag402-v1"
