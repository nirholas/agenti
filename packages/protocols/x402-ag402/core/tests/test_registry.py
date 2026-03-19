"""Tests for payment registry — provider auto-detection and lazy loading."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from ag402_core.config import RunMode, X402Config
from ag402_core.payment.registry import ConfigError, PaymentProviderRegistry


class TestRegistryAutoDetect:
    """Provider auto-detection based on environment."""

    def test_test_mode_returns_mock(self):
        """X402_MODE=test should return MockSolanaAdapter."""
        config = X402Config(mode=RunMode.TEST)
        provider = PaymentProviderRegistry.get_provider("auto", config=config)
        from ag402_core.payment.solana_adapter import MockSolanaAdapter
        assert isinstance(provider, MockSolanaAdapter)

    def test_explicit_mock_provider(self):
        """Explicitly requesting 'mock' should return MockSolanaAdapter."""
        provider = PaymentProviderRegistry.get_provider("mock")
        from ag402_core.payment.solana_adapter import MockSolanaAdapter
        assert isinstance(provider, MockSolanaAdapter)

    def test_unknown_provider_raises(self):
        """Requesting unknown provider should raise ValueError."""
        with pytest.raises(ValueError, match="Unknown"):
            PaymentProviderRegistry.get_provider("unknown_provider_xyz")

    def test_stripe_raises_not_implemented(self):
        """Requesting stripe should raise NotImplementedError."""
        with pytest.raises(NotImplementedError, match="V2"):
            PaymentProviderRegistry.get_provider("stripe")

    def test_mock_provider_has_required_methods(self):
        """MockSolanaAdapter should implement all BasePaymentProvider methods."""
        provider = PaymentProviderRegistry.get_provider("mock")
        assert hasattr(provider, "pay")
        assert hasattr(provider, "check_balance")
        assert hasattr(provider, "verify_payment")
        assert hasattr(provider, "get_address")
        assert callable(provider.pay)
        assert callable(provider.check_balance)

    def test_auto_production_no_key_raises(self):
        """Auto mode in production without keys should raise ConfigError."""
        config = X402Config(mode=RunMode.PRODUCTION, solana_private_key="")
        env_clean = {k: v for k, v in os.environ.items() if k != "STRIPE_SECRET_KEY"}
        with patch.dict(os.environ, env_clean, clear=True), pytest.raises(ConfigError):
            PaymentProviderRegistry.get_provider("auto", config=config)

    def test_solana_without_key_raises(self):
        """Requesting solana without key should raise ConfigError."""
        config = X402Config(mode=RunMode.PRODUCTION, solana_private_key="")
        with pytest.raises(ConfigError):
            PaymentProviderRegistry.get_provider("solana", config=config)
