"""Tests for security hardening — challenge validator and auth hardening."""

from __future__ import annotations

import logging

import pytest
from ag402_core.config import RunMode, X402Config
from ag402_core.gateway.auth import PaymentVerifier
from ag402_core.security.challenge_validator import (
    validate_challenge,
)

# =====================================================================
# Helper to make a test config quickly
# =====================================================================


def _cfg(**overrides) -> X402Config:
    defaults = {
        "mode": RunMode.TEST,
        "single_tx_limit": 5.0,
        "per_minute_limit": 100.0,
        "per_minute_count": 1000,
    }
    defaults.update(overrides)
    return X402Config(**defaults)


# Valid Solana-style base58 address (44 chars, no 0/O/I/l)
VALID_ADDR = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"


# =====================================================================
# 5.1 Challenge Validator Tests
# =====================================================================


class TestChallengeValidatorAcceptsValid:
    """Valid challenges should be accepted."""

    def test_valid_https_challenge(self):
        config = _cfg()
        result = validate_challenge(
            url="https://api.example.com/data",
            amount=1.0,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True
        assert result.error == ""

    def test_valid_http_localhost(self):
        config = _cfg()
        result = validate_challenge(
            url="http://localhost:8080/api",
            amount=0.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True

    def test_valid_http_127_0_0_1(self):
        config = _cfg()
        result = validate_challenge(
            url="http://127.0.0.1:4020/pay",
            amount=0.1,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True

    def test_valid_small_amount(self):
        config = _cfg(single_tx_limit=5.0)
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.001,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True

    def test_valid_at_limit_amount(self):
        config = _cfg(single_tx_limit=2.0)
        result = validate_challenge(
            url="https://example.com/api",
            amount=2.0,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True


class TestChallengeValidatorRejectsInvalidAmount:
    def test_zero_amount(self):
        config = _cfg()
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.0,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "must be > 0" in result.error

    def test_negative_amount(self):
        config = _cfg()
        result = validate_challenge(
            url="https://example.com/api",
            amount=-1.0,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "must be > 0" in result.error

    def test_amount_exceeds_limit(self):
        config = _cfg(single_tx_limit=1.0)
        result = validate_challenge(
            url="https://example.com/api",
            amount=1.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "exceeds" in result.error


class TestChallengeValidatorRejectsInvalidAddress:
    def test_address_too_short(self):
        config = _cfg()
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address="ShortAddr",
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "length" in result.error

    def test_address_too_long(self):
        config = _cfg()
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address="A" * 50,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "length" in result.error

    def test_address_with_zero(self):
        """Base58 does not include '0'."""
        config = _cfg()
        # 44-char address with a '0' — invalid base58
        bad_addr = "0WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWW"
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=bad_addr,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "base58" in result.error.lower()

    def test_address_with_capital_o(self):  # noqa: N802
        """Base58 does not include 'O'."""
        config = _cfg()
        bad_addr = "OWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWW"
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=bad_addr,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "base58" in result.error.lower()

    def test_address_with_capital_i(self):  # noqa: N802
        """Base58 does not include 'I'."""
        config = _cfg()
        bad_addr = "IWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWW"
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=bad_addr,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "base58" in result.error.lower()

    def test_address_with_lowercase_l(self):
        """Base58 does not include 'l'."""
        config = _cfg()
        bad_addr = "lWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWW"
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=bad_addr,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "base58" in result.error.lower()


class TestChallengeValidatorRejectsInvalidToken:
    def test_unknown_token(self):
        config = _cfg()
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=VALID_ADDR,
            token="ETH",
            config=config,
        )
        assert result.valid is False
        assert "not allowed" in result.error

    def test_empty_token(self):
        config = _cfg()
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=VALID_ADDR,
            token="",
            config=config,
        )
        assert result.valid is False
        assert "not allowed" in result.error


class TestChallengeValidatorRejectsHTTP:
    def test_http_on_public_host(self):
        config = _cfg()
        result = validate_challenge(
            url="http://api.example.com/data",
            amount=0.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "HTTPS required" in result.error

    def test_http_localhost_allowed(self):
        config = _cfg()
        result = validate_challenge(
            url="http://localhost:8080/api",
            amount=0.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True

    def test_ftp_rejected(self):
        config = _cfg()
        result = validate_challenge(
            url="ftp://example.com/file",
            amount=0.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "HTTPS required" in result.error


class TestChallengeValidatorTrustedAddresses:
    def test_trusted_whitelist_accepts(self):
        config = _cfg(trusted_addresses=[VALID_ADDR])
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True

    def test_trusted_whitelist_rejects_unknown(self):
        other_addr = "BrFdxnkT4f6xyJKGfpcJEsRnKFqN9Gg2bJvNqHptq5c"
        config = _cfg(trusted_addresses=[VALID_ADDR])
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=other_addr,
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "whitelist" in result.error.lower()

    def test_empty_whitelist_accepts_any(self):
        """When trusted_addresses is empty, any valid address is accepted."""
        config = _cfg(trusted_addresses=[])
        result = validate_challenge(
            url="https://example.com/api",
            amount=0.5,
            address=VALID_ADDR,
            token="USDC",
            config=config,
        )
        assert result.valid is True


# =====================================================================
# 5.6 Auth.py Hardening Tests
# =====================================================================


class TestPaymentVerifierHardened:
    def test_production_mode_without_provider_raises(self):
        """Production mode config without provider -> ValueError."""
        config = X402Config(mode=RunMode.PRODUCTION)
        with pytest.raises(ValueError, match="Production mode requires"):
            PaymentVerifier(provider=None, config=config)

    def test_test_mode_without_provider_logs_warning(self, caplog):
        """Test mode without provider should log WARNING."""
        config = X402Config(mode=RunMode.TEST)
        with caplog.at_level(logging.WARNING):
            PaymentVerifier(provider=None, config=config)
        assert any("test mode" in r.message.lower() for r in caplog.records)

    def test_test_mode_with_real_key_logs_warning(self, caplog):
        """Test mode with real private key should warn."""
        config = X402Config(
            mode=RunMode.TEST,
            solana_private_key="SomeRealKeyHere",
        )
        with caplog.at_level(logging.WARNING):
            PaymentVerifier(provider=None, config=config)
        assert any("private key" in r.message.lower() for r in caplog.records)

    @pytest.mark.asyncio
    async def test_backwards_compat_no_config(self):
        """PaymentVerifier without config still works (backwards compat)."""
        verifier = PaymentVerifier()
        result = await verifier.verify("x402 test_tx_hash")
        assert result.valid is True

    @pytest.mark.asyncio
    async def test_test_mode_with_config_accepts_proof(self):
        """PaymentVerifier in test mode with config accepts valid proof."""
        config = X402Config(mode=RunMode.TEST)
        verifier = PaymentVerifier(provider=None, config=config)
        result = await verifier.verify("x402 test_tx_hash")
        assert result.valid is True
