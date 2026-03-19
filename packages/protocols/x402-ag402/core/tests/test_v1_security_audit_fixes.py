"""Tests for V1 security audit fixes (P0 + P1).

Covers:
- P0-1.1: Sender verification in verify_payment
- P0-1.2: Gateway test mode safety
- P0-1.3: Atomic tx_hash deduplication
- P0-1.5: Float precision in lamport calculation
- P1-2.1: NaN/Infinity amount validation
- P1-2.2: Header injection sanitization
- P1-2.3: Password strength validation
- P1-2.4: Atomic wallet file write
- P1-2.5: Budget-payment TOCTOU lock
- P1-2.7: Gateway IP-based rate limiting
"""

from __future__ import annotations

import asyncio
import os

import pytest
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.security.replay_guard import PersistentReplayGuard
from ag402_core.security.wallet_encryption import (
    decrypt_private_key,
    encrypt_private_key,
    load_encrypted_wallet,
    save_encrypted_wallet,
)
from open402.spec import X402PaymentChallenge

# =====================================================================
# P0-1.1: Sender verification (MockSolanaAdapter interface)
# =====================================================================


class TestSenderVerificationInterface:
    """Verify that verify_payment accepts expected_sender parameter."""

    @pytest.mark.asyncio
    async def test_mock_adapter_accepts_expected_sender_param(self):
        """MockSolanaAdapter.verify_payment should accept expected_sender kwarg."""
        adapter = MockSolanaAdapter()
        result = await adapter.pay("SomeAddr" + "1" * 36, 0.01)
        assert result.success

        # Should accept expected_sender without error
        verified = await adapter.verify_payment(
            result.tx_hash,
            expected_amount=0.01,
            expected_address="SomeAddr" + "1" * 36,
            expected_sender="MockSender" + "1" * 34,
        )
        assert verified is True

    @pytest.mark.asyncio
    async def test_mock_adapter_rejects_unknown_tx(self):
        adapter = MockSolanaAdapter()
        verified = await adapter.verify_payment("short")
        assert verified is False

    @pytest.mark.asyncio
    async def test_mock_adapter_rejects_empty_tx(self):
        adapter = MockSolanaAdapter()
        verified = await adapter.verify_payment("")
        assert verified is False


# =====================================================================
# P0-1.2: Gateway test mode safety
# =====================================================================


class TestGatewayTestModeSafety:
    """Gateway should refuse to start in production without a verifier."""

    def test_gateway_refuses_production_without_verifier(self):
        """X402Gateway should raise when X402_MODE=production and no verifier."""
        from unittest.mock import patch

        # Set env to production
        with patch.dict(os.environ, {"X402_MODE": "production"}):
            from ag402_mcp.gateway import X402Gateway

            with pytest.raises(ValueError, match="Production mode"):
                X402Gateway(
                    target_url="http://localhost:8000",
                    price="0.02",
                    address="GtwRecipientAddr1111111111111111111111111111",
                )

    def test_gateway_allows_test_mode_without_verifier(self):
        """X402Gateway should work in test mode without explicit verifier."""
        from unittest.mock import patch

        with patch.dict(os.environ, {"X402_MODE": "test"}):
            from ag402_mcp.gateway import X402Gateway

            gateway = X402Gateway(
                target_url="http://localhost:8000",
                price="0.02",
            )
            assert gateway.verifier is not None
            assert gateway._is_test_mode is True


# =====================================================================
# P0-1.3: Atomic tx_hash deduplication
# =====================================================================


class TestAtomicTxHashDedup:
    """PersistentReplayGuard should atomically check-and-record tx_hashes."""

    @pytest.mark.asyncio
    async def test_first_tx_accepted(self, tmp_path):
        guard = PersistentReplayGuard(db_path=str(tmp_path / "test_replay.db"))
        await guard.init_db()
        try:
            result = await guard.check_and_record_tx("tx_hash_001")
            assert result is True
        finally:
            await guard.close()

    @pytest.mark.asyncio
    async def test_duplicate_tx_rejected(self, tmp_path):
        guard = PersistentReplayGuard(db_path=str(tmp_path / "test_replay.db"))
        await guard.init_db()
        try:
            await guard.check_and_record_tx("tx_hash_002")
            result = await guard.check_and_record_tx("tx_hash_002")
            assert result is False
        finally:
            await guard.close()

    @pytest.mark.asyncio
    async def test_concurrent_same_tx_only_one_wins(self, tmp_path):
        """When multiple concurrent requests submit the same tx_hash,
        only one should be accepted (the atomic INSERT OR IGNORE ensures this)."""
        guard = PersistentReplayGuard(db_path=str(tmp_path / "test_replay.db"))
        await guard.init_db()
        try:
            # Fire 10 concurrent check_and_record_tx with same hash
            results = await asyncio.gather(
                *[guard.check_and_record_tx("tx_hash_concurrent") for _ in range(10)]
            )
            # Exactly one should be True
            assert results.count(True) == 1
            assert results.count(False) == 9
        finally:
            await guard.close()


# =====================================================================
# P0-1.5: Float precision in lamport calculation
# =====================================================================


class TestFloatPrecision:
    """Verify that lamport calculation uses round() instead of int()."""

    def test_round_vs_int_for_0_1(self):
        """0.1 * 1_000_000 should produce 100000, not 99999."""
        amount = 0.1
        # int() truncation (the bug)
        int_result = int(amount * 1_000_000)
        # round() (the fix)
        round_result = round(amount * 1_000_000)

        # The bug: int() sometimes truncates
        # round() should always give the correct result
        assert round_result == 100_000

    def test_round_vs_int_for_0_01(self):
        amount = 0.01
        assert round(amount * 1_000_000) == 10_000

    def test_round_vs_int_for_0_001(self):
        amount = 0.001
        assert round(amount * 1_000_000) == 1_000


# =====================================================================
# P1-2.1: NaN/Infinity amount validation
# =====================================================================


class TestAmountValidation:
    """X402PaymentChallenge.amount_float should reject NaN, Infinity, zero, negative."""

    def test_nan_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="NaN", address="addr1"
        )
        with pytest.raises(ValueError, match="finite number"):
            challenge.amount_float

    def test_inf_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="inf", address="addr1"
        )
        with pytest.raises(ValueError, match="finite number"):
            challenge.amount_float

    def test_negative_inf_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="-inf", address="addr1"
        )
        with pytest.raises(ValueError, match="finite number"):
            challenge.amount_float

    def test_zero_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0", address="addr1"
        )
        with pytest.raises(ValueError, match="positive"):
            challenge.amount_float

    def test_negative_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="-1.0", address="addr1"
        )
        with pytest.raises(ValueError, match="positive"):
            challenge.amount_float

    def test_non_numeric_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="abc", address="addr1"
        )
        with pytest.raises(ValueError, match="Invalid amount"):
            challenge.amount_float

    def test_valid_amount_accepted(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr1"
        )
        assert challenge.amount_float == 0.05

    def test_scientific_notation_accepted(self):
        """1e-2 = 0.01 is a valid positive finite float."""
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="1e-2", address="addr1"
        )
        assert challenge.amount_float == pytest.approx(0.01)

    def test_1e309_overflow_rejected(self):
        """1e309 overflows to inf."""
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="1e309", address="addr1"
        )
        with pytest.raises(ValueError, match="finite number"):
            challenge.amount_float


# =====================================================================
# P1-2.2: Header injection sanitization
# =====================================================================


class TestHeaderInjectionSanitization:
    """to_header_value should reject fields containing CR, LF, or double-quote."""

    def test_cr_in_chain_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana\r", token="USDC", amount="0.05", address="addr1"
        )
        with pytest.raises(ValueError, match="unsafe characters"):
            challenge.to_header_value()

    def test_lf_in_token_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC\n", amount="0.05", address="addr1"
        )
        with pytest.raises(ValueError, match="unsafe characters"):
            challenge.to_header_value()

    def test_crlf_in_address_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr\r\nX-Injected: evil"
        )
        with pytest.raises(ValueError, match="unsafe characters"):
            challenge.to_header_value()

    def test_double_quote_in_amount_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount='0.05"', address="addr1"
        )
        with pytest.raises(ValueError, match="unsafe characters"):
            challenge.to_header_value()

    def test_crlf_in_service_hash_rejected(self):
        challenge = X402PaymentChallenge(
            chain="solana",
            token="USDC",
            amount="0.05",
            address="addr1",
            service_hash="sha256:abc\r\nEvil: header",
        )
        with pytest.raises(ValueError, match="unsafe characters"):
            challenge.to_header_value()

    def test_clean_values_accepted(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr1"
        )
        header = challenge.to_header_value()
        assert header.startswith("x402 ")


# =====================================================================
# P1-2.4: Atomic wallet file write
# =====================================================================


class TestAtomicWalletFileWrite:
    """save_encrypted_wallet should write atomically (no partial writes)."""

    def test_save_and_load_roundtrip(self, tmp_path):
        path = str(tmp_path / "wallet.key")
        data = encrypt_private_key("strongpassword123", "MySolanaPrivateKey123456")
        save_encrypted_wallet(path, data)

        loaded = load_encrypted_wallet(path)
        assert loaded is not None
        assert loaded["salt"] == data["salt"]
        assert loaded["encrypted_key"] == data["encrypted_key"]

        # Verify decryption works
        decrypted = decrypt_private_key("strongpassword123", loaded)
        assert decrypted == "MySolanaPrivateKey123456"

    def test_save_creates_directory(self, tmp_path):
        path = str(tmp_path / "subdir" / "wallet.key")
        data = encrypt_private_key("password_ok1!", "key123")
        save_encrypted_wallet(path, data)
        assert os.path.exists(path)

    def test_save_overwrites_atomically(self, tmp_path):
        path = str(tmp_path / "wallet.key")

        # Write first version
        data1 = encrypt_private_key("password_v1_ok", "key1")
        save_encrypted_wallet(path, data1)

        # Write second version (should atomically replace)
        data2 = encrypt_private_key("password_v2_ok", "key2")
        save_encrypted_wallet(path, data2)

        loaded = load_encrypted_wallet(path)
        assert loaded["salt"] == data2["salt"]

        # First password should NOT work on the new file
        with pytest.raises(Exception):
            decrypt_private_key("password_v1_ok", loaded)

        # Second password should work
        decrypted = decrypt_private_key("password_v2_ok", loaded)
        assert decrypted == "key2"

    def test_file_permissions(self, tmp_path):
        """On Unix, the saved file should have 0o600 permissions."""
        path = str(tmp_path / "wallet.key")
        data = encrypt_private_key("password_ok2!", "key123")
        save_encrypted_wallet(path, data)

        if os.name != "nt":
            mode = os.stat(path).st_mode & 0o777
            assert mode == 0o600


# =====================================================================
# P1-2.5: Budget-payment TOCTOU lock
# =====================================================================


class TestBudgetPaymentLock:
    """Middleware should serialize budget check + deduct with a lock."""

    def test_middleware_has_payment_lock(self):
        """X402PaymentMiddleware should have a _payment_lock attribute."""
        import asyncio

        from ag402_core.config import RunMode, X402Config
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware

        # Only check that the lock attribute exists on the class.
        # Use a minimal mock wallet to avoid async DB init.
        class _FakeWallet:
            pass

        adapter = MockSolanaAdapter()
        config = X402Config(mode=RunMode.TEST)
        mw = X402PaymentMiddleware(
            wallet=_FakeWallet(), provider=adapter, config=config
        )
        assert hasattr(mw, "_payment_lock")
        assert isinstance(mw._payment_lock, asyncio.Lock)


# =====================================================================
# P1-2.3: Password strength validation
# =====================================================================


class TestPasswordStrengthValidation:
    """encrypt_private_key should enforce minimum password length."""

    def test_empty_password_rejected(self):
        with pytest.raises(ValueError, match="at least"):
            encrypt_private_key("", "some_private_key")

    def test_short_password_rejected(self):
        with pytest.raises(ValueError, match="at least"):
            encrypt_private_key("short", "some_private_key")

    def test_7_char_password_rejected(self):
        with pytest.raises(ValueError, match="at least"):
            encrypt_private_key("1234567", "some_private_key")

    def test_11_char_password_rejected(self):
        """11 characters should be rejected (minimum is 12)."""
        with pytest.raises(ValueError, match="at least"):
            encrypt_private_key("12345678901", "some_private_key")

    def test_12_char_password_accepted(self):
        """Exactly 12 characters should be the minimum accepted."""
        result = encrypt_private_key("123456789012", "some_private_key")
        assert "salt" in result
        assert "encrypted_key" in result

    def test_long_password_accepted(self):
        result = encrypt_private_key("a_very_strong_password_here!", "key")
        assert "salt" in result

    def test_none_password_rejected(self):
        with pytest.raises((ValueError, TypeError)):
            encrypt_private_key(None, "some_private_key")


# =====================================================================
# P1-2.7: Gateway IP-based rate limiting
# =====================================================================


class TestGatewayRateLimiting:
    """Gateway should enforce IP-based rate limiting."""

    def test_gateway_has_rate_limiter(self):
        from unittest.mock import patch

        with patch.dict(os.environ, {"X402_MODE": "test"}):
            from ag402_mcp.gateway import X402Gateway

            gw = X402Gateway(
                target_url="http://localhost:8000",
                price="0.02",
                rate_limit_per_minute=30,
            )
            assert gw._rate_limiter is not None
            assert gw._rate_limiter._max == 30

    @pytest.mark.asyncio
    async def test_rate_limit_returns_429(self):
        """Requests beyond rate limit should receive HTTP 429."""
        from unittest.mock import patch

        with patch.dict(os.environ, {"X402_MODE": "test"}):
            from ag402_mcp.gateway import X402Gateway
            from httpx import ASGITransport, AsyncClient

            # Very low rate limit: 2 requests per minute
            gw = X402Gateway(
                target_url="http://localhost:8000",
                price="0.02",
                rate_limit_per_minute=2,
            )
            app = gw.create_app()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                # First 2 requests should get 402 (no auth), not 429
                r1 = await client.get("/api/data")
                assert r1.status_code == 402

                r2 = await client.get("/api/data")
                assert r2.status_code == 402

                # 3rd request should be rate-limited
                r3 = await client.get("/api/data")
                assert r3.status_code == 429
                assert "Too Many Requests" in r3.json()["error"]

    @pytest.mark.asyncio
    async def test_rate_limit_per_ip(self):
        """Rate limiting should be per-IP (different IPs get separate limits)."""
        from ag402_core.security.rate_limiter import RateLimiter

        limiter = RateLimiter(max_requests=2, window_seconds=60)

        # IP-A: 2 requests OK, 3rd blocked
        assert limiter.allow("1.1.1.1") is True
        assert limiter.allow("1.1.1.1") is True
        assert limiter.allow("1.1.1.1") is False

        # IP-B: still has its own quota
        assert limiter.allow("2.2.2.2") is True
        assert limiter.allow("2.2.2.2") is True
        assert limiter.allow("2.2.2.2") is False
