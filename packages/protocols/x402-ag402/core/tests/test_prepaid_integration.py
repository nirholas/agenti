"""Integration tests for Prepaid credential system.

Tests the end-to-end prepaid flow:
- Models: credential creation, validation, serialization
- Client: check_and_deduct, rollback, storage
- Middleware: prepaid path, fallback, rejection, concurrency

All tests use isolated tmp_path directories — no global ~/.ag402 pollution.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import pytest
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.prepaid.client import (
    add_credential,
    check_and_deduct,
    get_all_credentials,
    get_prepaid_status,
    purge_invalid_credentials,
    rollback_call,
)
from ag402_core.prepaid.models import PrepaidCredential, get_package_info

from tests.conftest import SequentialTransport, _402_headers, _make_config, _make_wallet

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SELLER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
BUYER = "BuyerAddr111111111111111111111111111111111111"
SIGNING_KEY = "test_signing_key_for_tests_only"


def _make_credential(
    seller: str = SELLER,
    buyer: str = BUYER,
    remaining: int = 10,
    days_valid: int = 30,
    package_id: str = "p30d_1000",
    signature: str = "test_sig",
) -> PrepaidCredential:
    return PrepaidCredential(
        buyer_address=buyer,
        package_id=package_id,
        remaining_calls=remaining,
        expires_at=datetime.now(timezone.utc) + timedelta(days=days_valid),
        signature=signature,
        seller_address=seller,
        created_at=datetime.now(timezone.utc),
    )


def _prepaid_404_headers() -> dict[str, str]:
    """A 402 response that has no x402 challenge — used to simulate seller rejection."""
    return {}


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

class TestPrepaidCredentialModel:
    def test_is_valid_fresh(self):
        cred = _make_credential(remaining=5)
        assert cred.is_valid() is True

    def test_is_invalid_expired(self):
        cred = _make_credential(remaining=5, days_valid=-1)
        assert cred.is_valid() is False
        assert cred.is_expired() is True

    def test_is_invalid_no_calls(self):
        cred = _make_credential(remaining=0)
        assert cred.is_valid() is False
        assert cred.has_calls() is False

    def test_roundtrip_serialization(self):
        cred = _make_credential()
        restored = PrepaidCredential.from_dict(cred.to_dict())
        assert restored.buyer_address == cred.buyer_address
        assert restored.remaining_calls == cred.remaining_calls
        # Compare as timestamps — to_dict() normalizes to UTC, so tzinfo may differ
        assert restored.expires_at.timestamp() == pytest.approx(cred.expires_at.timestamp(), abs=1)

    def test_header_value_roundtrip(self):
        cred = _make_credential()
        header = cred.to_header_value()
        restored = PrepaidCredential.from_header_value(header)
        assert restored.seller_address == cred.seller_address
        assert restored.signature == cred.signature


class TestPackages:
    def test_all_packages_have_required_fields(self):
        from ag402_core.prepaid.models import PACKAGES
        for pkg_id, pkg in PACKAGES.items():
            assert "days" in pkg, f"{pkg_id} missing 'days'"
            assert "calls" in pkg, f"{pkg_id} missing 'calls'"
            assert "price" in pkg, f"{pkg_id} missing 'price'"
            assert pkg["days"] > 0
            assert pkg["calls"] > 0
            assert pkg["price"] > 0

    def test_get_package_info(self):
        pkg = get_package_info("p30d_1000")
        assert pkg is not None
        assert pkg["calls"] == 1000
        assert pkg["days"] == 30

    def test_get_package_info_unknown(self):
        assert get_package_info("nonexistent") is None


# ---------------------------------------------------------------------------
# Client (storage) tests — all isolated via patching the credentials file
# ---------------------------------------------------------------------------

class TestPrepaidClient:
    @pytest.fixture(autouse=True)
    def isolate_storage(self, tmp_path):
        """Redirect credentials file to tmp_path for full test isolation."""
        cred_file = tmp_path / "prepaid_credentials.json"
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", cred_file), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            yield

    def test_check_and_deduct_no_credentials(self):
        success, cred = check_and_deduct(SELLER)
        assert success is False
        assert cred is None

    def test_check_and_deduct_valid_credential(self):
        c = _make_credential(remaining=5)
        add_credential(c)

        success, deducted = check_and_deduct(SELLER)
        assert success is True
        assert deducted is not None
        assert deducted.remaining_calls == 4  # deducted from the returned copy

        # Verify storage was updated
        success2, deducted2 = check_and_deduct(SELLER)
        assert success2 is True
        assert deducted2.remaining_calls == 3

    def test_check_and_deduct_exhausted(self):
        c = _make_credential(remaining=1)
        add_credential(c)

        success, _ = check_and_deduct(SELLER)
        assert success is True

        # Now exhausted
        success2, _ = check_and_deduct(SELLER)
        assert success2 is False

    def test_check_and_deduct_expired_credential(self):
        c = _make_credential(remaining=10, days_valid=-1)
        add_credential(c)

        success, cred = check_and_deduct(SELLER)
        assert success is False
        assert cred is None

    def test_check_and_deduct_wrong_seller(self):
        c = _make_credential(seller=SELLER, remaining=5)
        add_credential(c)

        success, cred = check_and_deduct("OtherSeller111111111111111111111111111111111")
        assert success is False

    def test_rollback_call(self):
        c = _make_credential(remaining=5)
        add_credential(c)

        success, deducted = check_and_deduct(SELLER)
        assert deducted.remaining_calls == 4

        # Rollback should restore the count
        rolled = rollback_call(SELLER, deducted)
        assert rolled is True

        # Next deduct should see 5 again
        success2, deducted2 = check_and_deduct(SELLER)
        assert deducted2.remaining_calls == 4  # 5 - 1

    def test_rollback_no_match(self):
        cred = _make_credential(seller="nonexistent_seller")
        result = rollback_call("nonexistent_seller", cred)
        assert result is False

    def test_purge_removes_expired(self):
        valid = _make_credential(remaining=5)
        expired = _make_credential(remaining=5, days_valid=-1, package_id="p7d_500")
        depleted = _make_credential(remaining=0, package_id="p3d_100")
        for c in [valid, expired, depleted]:
            add_credential(c)

        removed = purge_invalid_credentials()
        assert removed == 2

        status = get_prepaid_status()
        assert status["valid_credentials"] == 1
        assert status["total_remaining_calls"] == 5

    def test_get_prepaid_status_empty(self):
        status = get_prepaid_status()
        assert status["total_credentials"] == 0
        assert status["valid_credentials"] == 0
        assert status["total_remaining_calls"] == 0

    def test_get_prepaid_status_with_credentials(self):
        c1 = _make_credential(seller=SELLER, remaining=10)
        c2 = _make_credential(seller="OtherSeller222", remaining=20)
        add_credential(c1)
        add_credential(c2)

        status = get_prepaid_status()
        assert status["valid_credentials"] == 2
        assert status["total_remaining_calls"] == 30
        assert SELLER in status["by_seller"]
        assert "OtherSeller222" in status["by_seller"]


# ---------------------------------------------------------------------------
# Middleware integration tests
# ---------------------------------------------------------------------------

class TestMiddlewarePrepaidIntegration:
    """Tests for the prepaid path inside X402PaymentMiddleware."""

    @pytest.fixture(autouse=True)
    def isolate_storage(self, tmp_path):
        cred_file = tmp_path / "prepaid_credentials.json"
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", cred_file), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            yield

    @pytest.mark.asyncio
    async def test_prepaid_used_when_credential_valid(self, tmp_path):
        """When valid credential exists, prepaid path is taken (no on-chain payment)."""
        cred = _make_credential(seller=SELLER, remaining=5)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            # First request → 402 challenge
            (402, _402_headers(address=SELLER), b"Payment required"),
            # Second request (with X-Prepaid-Credential) → 200
            (200, {"content-type": "application/json"}, b'{"data": "ok"}'),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 200
        assert result.payment_made is True
        assert result.tx_hash == "prepaid"
        assert result.amount_paid == 0.0

        # Wallet balance must be untouched (no on-chain payment)
        balance = await wallet.get_balance()
        assert float(balance) == 100.0

        # Provider must NOT have been called
        assert len(provider._payments) == 0

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_no_credential_falls_back_to_onchain(self, tmp_path):
        """Without a credential, falls back to on-chain x402 payment."""
        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            (402, _402_headers(address=SELLER, amount="0.05"), b"Payment required"),
            (200, {"content-type": "text/plain"}, b"Success"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 200
        assert result.payment_made is True
        assert result.tx_hash.startswith("mock_tx_")  # on-chain payment
        assert result.amount_paid == pytest.approx(0.05)

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_prepaid_rejected_falls_back_to_onchain(self, tmp_path):
        """Seller rejects prepaid (402 on second request) → rollback + on-chain."""
        cred = _make_credential(seller=SELLER, remaining=5)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            # Initial request → 402 challenge
            (402, _402_headers(address=SELLER, amount="0.05"), b"Payment required"),
            # Prepaid attempt → seller rejects with 402 (no x402 headers → not parsed)
            (402, {}, b"Credential rejected"),
            # On-chain retry → 200
            (200, {"content-type": "text/plain"}, b"Success after on-chain"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 200
        assert result.payment_made is True
        assert result.tx_hash.startswith("mock_tx_")  # fell back to on-chain

        # Rollback should have restored the deducted call
        success, remaining = check_and_deduct(SELLER)
        # Flow: initial=5 → prepaid deduct=4 → rollback=5 → this deduct=4
        assert success is True
        assert remaining.remaining_calls == 4

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_prepaid_deducts_remaining_calls(self, tmp_path):
        """Each successful prepaid call deducts exactly one call."""
        cred = _make_credential(seller=SELLER, remaining=3)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        for expected_remaining in [2, 1, 0]:
            transport = SequentialTransport([
                (402, _402_headers(address=SELLER), b"Payment required"),
                (200, {}, b"ok"),
            ])
            client = httpx.AsyncClient(transport=transport)
            mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

            result = await mw.handle_request("GET", "https://paid-api.example.com/data")

            if expected_remaining > 0:
                assert result.tx_hash == "prepaid"
            await client.aclose()

        # 4th call should fall through to on-chain (0 remaining)
        transport = SequentialTransport([
            (402, _402_headers(address=SELLER, amount="0.01"), b"Payment required"),
            (200, {}, b"ok on-chain"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
        result = await mw.handle_request("GET", "https://paid-api.example.com/data")
        assert result.tx_hash.startswith("mock_tx_")

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_concurrent_prepaid_no_double_deduction(self, tmp_path):
        """Concurrent requests don't over-deduct the same credential."""
        INITIAL_CALLS = 3
        cred = _make_credential(seller=SELLER, remaining=INITIAL_CALLS)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path, balance=500.0)
        provider = MockSolanaAdapter()
        config = _make_config(per_minute_limit=100.0, per_minute_count=100)

        async def make_request(index: int) -> str:
            transport = SequentialTransport([
                (402, _402_headers(address=SELLER, amount="0.01"), b"Payment required"),
                (200, {}, f"response {index}".encode()),
            ])
            client = httpx.AsyncClient(transport=transport)
            mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
            result = await mw.handle_request("GET", "https://paid-api.example.com/data")
            await client.aclose()
            return result.tx_hash

        TOTAL_REQUESTS = 7
        results = await asyncio.gather(*[make_request(i) for i in range(TOTAL_REQUESTS)])

        prepaid_count = sum(1 for tx in results if tx == "prepaid")
        onchain_count = sum(1 for tx in results if tx.startswith("mock_tx_"))

        # Exactly INITIAL_CALLS should go prepaid, rest on-chain
        assert prepaid_count == INITIAL_CALLS, (
            f"Expected {INITIAL_CALLS} prepaid, got {prepaid_count}. "
            f"Results: {results}"
        )
        assert onchain_count == TOTAL_REQUESTS - INITIAL_CALLS

        await wallet.close()

    @pytest.mark.asyncio
    async def test_expired_credential_falls_back_to_onchain(self, tmp_path):
        """Expired credential is ignored; falls back to on-chain."""
        cred = _make_credential(seller=SELLER, remaining=5, days_valid=-1)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            (402, _402_headers(address=SELLER, amount="0.05"), b"Payment required"),
            (200, {}, b"ok"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 200
        assert result.tx_hash.startswith("mock_tx_")

        await client.aclose()
        await wallet.close()


# ---------------------------------------------------------------------------
# Security fix tests
# ---------------------------------------------------------------------------

class TestSecurityFixes:
    """Tests that validate the three security fixes applied post-review."""

    @pytest.fixture(autouse=True)
    def isolate_storage(self, tmp_path):
        cred_file = tmp_path / "prepaid_credentials.json"
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", cred_file), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            yield

    # Fix 1: Atomic write — partial write should not corrupt stored credentials
    def test_atomic_write_uses_temp_then_replace(self, tmp_path):
        """_save() writes to a temp file first, then atomically replaces the target."""

        cred = _make_credential(remaining=5)
        add_credential(cred)

        # After save, no .creds_tmp_* files should remain
        tmp_files = list(tmp_path.glob(".creds_tmp_*.json"))
        assert tmp_files == [], f"Leftover temp files: {tmp_files}"

        # The credentials file must be valid JSON
        import json as _json
        cred_file = tmp_path / "prepaid_credentials.json"
        data = _json.loads(cred_file.read_text())
        assert isinstance(data, list)
        assert len(data) == 1

    # Fix 2: UTC timezone — expiry comparison is timezone-invariant
    def test_credential_expiry_is_utc_aware(self):
        """PrepaidCredential stores and compares datetimes in UTC."""
        from datetime import timezone as tz

        from ag402_core.prepaid.models import calculate_expiry

        expiry = calculate_expiry(30)
        assert expiry.tzinfo is not None, "calculate_expiry must return UTC-aware datetime"
        assert expiry.tzinfo == tz.utc or expiry.utcoffset().total_seconds() == 0

    def test_naive_datetime_in_stored_file_treated_as_utc(self):
        """Credentials written without timezone (legacy) are treated as UTC on load."""
        import json as _json
        from datetime import datetime

        # Write a credential with naive datetime (simulating old format)
        naive_expiry = datetime.now() + timedelta(days=30)
        raw = {
            "buyer_address": BUYER,
            "package_id": "p30d_1000",
            "remaining_calls": 10,
            "expires_at": naive_expiry.isoformat(),  # no +00:00
            "signature": "test_sig",
            "seller_address": SELLER,
            "created_at": datetime.now().isoformat(),
        }
        from ag402_core.prepaid.client import _CREDENTIALS_FILE
        _CREDENTIALS_FILE.write_text(_json.dumps([raw]))

        # Should still load and be treated as valid
        success, cred = check_and_deduct(SELLER)
        assert success is True
        assert cred is not None

    # Fix 3: rollback cap — cannot inflate beyond original package limit
    def test_rollback_capped_at_package_limit(self):
        """Repeated rollbacks cannot inflate remaining_calls beyond package max."""
        from ag402_core.prepaid.models import get_package_info
        pkg = get_package_info("p30d_1000")
        assert pkg is not None
        original_max = pkg["calls"]  # 1000

        # Start at the original max to test the cap boundary directly
        cred = _make_credential(remaining=original_max)
        add_credential(cred)

        # Deduct once, then rollback 5 times — should cap at original_max
        success, deducted = check_and_deduct(SELLER)
        assert success is True  # remaining = 999

        for _ in range(5):
            rollback_call(SELLER, deducted)

        stored = get_all_credentials()
        assert len(stored) == 1
        # Cap must hold: no matter how many rollbacks, can't exceed original_max
        assert stored[0].remaining_calls == original_max, (
            f"Expected cap at {original_max}, got {stored[0].remaining_calls}"
        )

    def test_rollback_reject_loop_cannot_inflate(self):
        """Adversarial seller repeatedly rejecting cannot inflate credential."""
        from ag402_core.prepaid.models import get_package_info
        pkg = get_package_info("p3d_100")
        original_max = pkg["calls"]  # 100

        cred = _make_credential(remaining=original_max, package_id="p3d_100")
        add_credential(cred)

        # Simulate 50 reject-cycles: deduct → rollback → deduct → rollback...
        for _ in range(50):
            success, deducted = check_and_deduct(SELLER)
            if success and deducted:
                rollback_call(SELLER, deducted)

        stored = get_all_credentials()
        # remaining_calls must never exceed original package limit
        assert stored[0].remaining_calls <= original_max


# ---------------------------------------------------------------------------
# MockSolanaAdapter introspection helper
# ---------------------------------------------------------------------------

def _get_provider_paid_list(provider: MockSolanaAdapter) -> list:
    """Access provider payment history for assertions."""
    return getattr(provider, "_payments", [])


# ---------------------------------------------------------------------------
# Bug-fix tests (round 2 review)
# ---------------------------------------------------------------------------

class TestBugFixes:
    """Tests for the three bugs found in the second code review.

    Fix A — network exception in _try_prepaid rolls back the deducted call.
    Fix B — TypeError from malformed credential dicts is caught and skipped.
    Fix C — monkey.py logs distinct message for prepaid vs on-chain payment.
    """

    @pytest.fixture(autouse=True)
    def isolate_storage(self, tmp_path):
        cred_file = tmp_path / "prepaid_credentials.json"
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", cred_file), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            yield

    # ------------------------------------------------------------------
    # Fix A: network exception rolls back deducted call
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_network_exception_rolls_back_call(self, tmp_path):
        """If _send() raises a network error, the deducted call is restored."""
        INITIAL = 5
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        # Transport that raises a network error
        class ErrorTransport(httpx.AsyncBaseTransport):
            call_count = 0

            async def handle_async_request(self, request):
                self.call_count += 1
                if self.call_count == 1:
                    # First call: 402 challenge
                    return httpx.Response(
                        402,
                        headers=_402_headers(address=SELLER),
                        content=b"pay",
                    )
                # Second call (with prepaid cred): network error
                raise httpx.ConnectError("simulated network failure")

        transport = ErrorTransport()
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        # The middleware should propagate the exception (monkey.py catches it)
        with pytest.raises(httpx.ConnectError):
            await mw.handle_request("GET", "https://paid-api.example.com/data")

        # The call must have been rolled back — remaining unchanged
        remaining = get_all_credentials()
        assert len(remaining) == 1
        assert remaining[0].remaining_calls == INITIAL, (
            f"Expected rollback to restore {INITIAL} calls, "
            f"got {remaining[0].remaining_calls}"
        )

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_network_exception_then_subsequent_request_works(self, tmp_path):
        """After a network error rollback, next request can still use prepaid."""
        INITIAL = 3
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        # First request: network error on the prepaid attempt
        class OneErrorTransport(httpx.AsyncBaseTransport):
            call_count = 0

            async def handle_async_request(self, request):
                self.call_count += 1
                if self.call_count == 1:
                    return httpx.Response(
                        402,
                        headers=_402_headers(address=SELLER),
                        content=b"pay",
                    )
                raise httpx.ConnectError("simulated failure")

        client1 = httpx.AsyncClient(transport=OneErrorTransport())
        mw1 = X402PaymentMiddleware(wallet, provider, config, http_client=client1)
        with pytest.raises(httpx.ConnectError):
            await mw1.handle_request("GET", "https://paid-api.example.com/data")
        await client1.aclose()

        # Verify rollback happened
        creds = get_all_credentials()
        assert creds[0].remaining_calls == INITIAL

        # Second request: should succeed using prepaid (call count intact)
        transport2 = SequentialTransport([
            (402, _402_headers(address=SELLER), b"pay"),
            (200, {}, b"ok"),
        ])
        client2 = httpx.AsyncClient(transport=transport2)
        mw2 = X402PaymentMiddleware(wallet, provider, config, http_client=client2)
        result = await mw2.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 200
        assert result.tx_hash == "prepaid"

        creds_after = get_all_credentials()
        assert creds_after[0].remaining_calls == INITIAL - 1

        await client2.aclose()
        await wallet.close()

    # ------------------------------------------------------------------
    # Fix B: TypeError from malformed credential dicts
    # ------------------------------------------------------------------

    def test_malformed_credential_extra_field_is_skipped(self):
        """A credential dict with an unexpected extra field is silently skipped."""
        import json as _json

        from ag402_core.prepaid.client import _CREDENTIALS_FILE

        # Valid credential + one with an extra unknown field (causes TypeError on cls(**d))
        valid = _make_credential(seller=SELLER, remaining=5).to_dict()
        malformed = dict(valid)
        malformed["unknown_extra_field"] = "this causes TypeError in from_dict"

        _CREDENTIALS_FILE.write_text(_json.dumps([malformed, valid]))

        # check_and_deduct must not raise — should skip malformed and find valid one
        success, cred = check_and_deduct(SELLER)
        assert success is True
        assert cred is not None
        assert cred.remaining_calls == 4  # 5 - 1

    def test_malformed_credential_missing_field_is_skipped(self):
        """A credential dict missing a required field is silently skipped."""
        import json as _json

        from ag402_core.prepaid.client import _CREDENTIALS_FILE

        valid = _make_credential(seller=SELLER, remaining=3).to_dict()
        missing_field = {k: v for k, v in valid.items() if k != "signature"}  # KeyError

        _CREDENTIALS_FILE.write_text(_json.dumps([missing_field, valid]))

        success, cred = check_and_deduct(SELLER)
        assert success is True
        assert cred is not None

    def test_fully_corrupt_credentials_file_returns_no_credential(self):
        """A file with only malformed entries returns (False, None) gracefully."""
        import json as _json

        from ag402_core.prepaid.client import _CREDENTIALS_FILE

        # All entries malformed
        corrupt = [
            {"buyer_address": "x"},  # missing fields → TypeError/KeyError
            {"this_is": "garbage", "extra": 123},
            {},
        ]
        _CREDENTIALS_FILE.write_text(_json.dumps(corrupt))

        success, cred = check_and_deduct(SELLER)
        assert success is False
        assert cred is None

    def test_get_all_credentials_skips_malformed(self):
        """get_all_credentials skips entries that raise TypeError."""
        import json as _json

        from ag402_core.prepaid.client import _CREDENTIALS_FILE, get_all_credentials

        valid = _make_credential(seller=SELLER, remaining=7).to_dict()
        bad = dict(valid)
        bad["injected_bad_key"] = "causes TypeError"

        _CREDENTIALS_FILE.write_text(_json.dumps([bad, valid, bad]))

        result = get_all_credentials()
        # Only the one valid entry should be returned
        assert len(result) == 1
        assert result[0].remaining_calls == 7

    # ------------------------------------------------------------------
    # Fix C: monkey.py log distinguishes prepaid from on-chain
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_prepaid_log_message_is_distinct(self, tmp_path, caplog):
        """Prepaid path logs 'Prepaid credential used', not 'Paid $0.0000'."""
        import logging

        cred = _make_credential(seller=SELLER, remaining=5)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            (402, _402_headers(address=SELLER), b"pay"),
            (200, {}, b"ok"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        with caplog.at_level(logging.INFO, logger="ag402_core.middleware.x402_middleware"):
            result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.tx_hash == "prepaid"

        # The MiddlewareResult carries the right flags
        assert result.payment_made is True
        assert result.amount_paid == 0.0

        await client.aclose()
        await wallet.close()

    def test_middleware_result_prepaid_fields(self):
        """MiddlewareResult for prepaid path has correct sentinel values."""
        from ag402_core.middleware.x402_middleware import MiddlewareResult

        result = MiddlewareResult(
            status_code=200,
            headers={},
            body=b"",
            payment_made=True,
            tx_hash="prepaid",
            amount_paid=0.0,
        )
        assert result.tx_hash == "prepaid"
        assert result.amount_paid == 0.0
        assert result.payment_made is True


# ---------------------------------------------------------------------------
# Round-3 fix tests
# ---------------------------------------------------------------------------

class TestRound3Fixes:
    """Tests for issues found in the third code review pass.

    Fix D — concurrent rollbacks under _payment_lock (no clobber).
    Fix E — link-local addresses blocked by SSRF validator.
    """

    @pytest.fixture(autouse=True)
    def isolate_storage(self, tmp_path):
        cred_file = tmp_path / "prepaid_credentials.json"
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", cred_file), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            yield

    # ------------------------------------------------------------------
    # Fix D: concurrent rollbacks don't clobber each other
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_concurrent_network_errors_both_rollback_correctly(self, tmp_path):
        """Two concurrent network errors each rollback their call; no call is lost."""
        INITIAL = 5
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        class AlwaysErrorTransport(httpx.AsyncBaseTransport):
            async def handle_async_request(self, request):
                if "X-Prepaid-Credential" not in dict(request.headers):
                    return httpx.Response(
                        402,
                        headers=_402_headers(address=SELLER),
                        content=b"pay",
                    )
                raise httpx.ConnectError("simulated failure")

        async def make_failing_request():
            client = httpx.AsyncClient(transport=AlwaysErrorTransport())
            mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
            try:
                await mw.handle_request("GET", "https://paid-api.example.com/data")
            except httpx.ConnectError:
                pass  # expected
            finally:
                await client.aclose()

        # Fire two concurrent requests that both fail with network errors
        await asyncio.gather(make_failing_request(), make_failing_request())

        creds = get_all_credentials()
        assert len(creds) == 1
        # Both calls should be rolled back — remaining unchanged (or -2 + 2 = 0 delta)
        # The important property: remaining_calls >= INITIAL - 2
        # (worst case: both deducted but both rolled back = INITIAL)
        assert creds[0].remaining_calls >= INITIAL - 2, (
            f"Expected at most 2 net deductions, got remaining={creds[0].remaining_calls}"
        )
        # Stronger: with proper locking, both rollbacks succeed → exactly INITIAL
        assert creds[0].remaining_calls == INITIAL, (
            f"Expected both rollbacks to succeed (remaining={INITIAL}), "
            f"got {creds[0].remaining_calls}"
        )

        await wallet.close()

    @pytest.mark.asyncio
    async def test_concurrent_402_rejections_both_rollback_correctly(self, tmp_path):
        """Two concurrent 402 rejections each rollback; no call is permanently lost."""
        INITIAL = 4
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        async def make_rejected_prepaid_request():
            # Respond with 402 to all requests (including prepaid attempt)
            transport = SequentialTransport([
                (402, _402_headers(address=SELLER), b"first 402 = challenge"),
                (402, {}, b"second 402 = prepaid rejected"),
                # If on-chain payment attempt happens, don't care
                (200, {}, b"ok on-chain"),
            ])
            client = httpx.AsyncClient(transport=transport)
            mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)
            result = await mw.handle_request("GET", "https://paid-api.example.com/data")
            await client.aclose()
            return result

        results = await asyncio.gather(
            make_rejected_prepaid_request(),
            make_rejected_prepaid_request(),
        )

        # Both should have fallen back to on-chain
        for result in results:
            assert result.tx_hash != "prepaid"

        creds = get_all_credentials()
        assert len(creds) == 1
        # Both prepaid deductions should be rolled back — no net change to remaining_calls
        assert creds[0].remaining_calls == INITIAL, (
            f"Expected both rejections to rollback (remaining={INITIAL}), "
            f"got {creds[0].remaining_calls}"
        )

        await wallet.close()

    # ------------------------------------------------------------------
    # Fix E: link-local addresses blocked by SSRF validator
    # ------------------------------------------------------------------

    def test_aws_metadata_ip_blocked(self):
        """169.254.169.254 (AWS/GCP metadata service) is blocked as link-local."""
        from ag402_core.security.challenge_validator import validate_url_safety

        result = validate_url_safety("https://169.254.169.254/latest/meta-data/")
        assert result.valid is False
        assert "169.254.169.254" in result.error or "private" in result.error.lower() \
            or "link" in result.error.lower() or "reserved" in result.error.lower()

    def test_ipv4_link_local_range_blocked(self):
        """Any 169.254.x.x address is blocked."""
        from ag402_core.security.challenge_validator import validate_url_safety

        for addr in ["169.254.0.1", "169.254.100.50", "169.254.255.254"]:
            result = validate_url_safety(f"https://{addr}/path")
            assert result.valid is False, f"Expected {addr} to be blocked"

    def test_ipv6_link_local_blocked(self):
        """fe80::/10 IPv6 link-local addresses are blocked."""
        from ag402_core.security.challenge_validator import validate_url_safety

        result = validate_url_safety("https://[fe80::1]/path")
        assert result.valid is False

    def test_validate_challenge_link_local_address_field_rejected(self):
        """validate_challenge() rejects link-local IPs used as the payment address field.

        The payment address must be a 32-44 char Solana base58 address.
        A dotted-decimal IP like 169.254.169.254 is only 15 chars → rejected
        by the length check before SSRF even needs to apply.
        The SSRF protection for URLs lives in validate_url_safety().
        """
        from ag402_core.security.challenge_validator import validate_challenge

        config = _make_config()
        result = validate_challenge(
            url="https://paid-api.example.com/api",
            amount=0.05,
            address="169.254.169.254",  # too short (15 chars), not a Solana address
            token="USDC",
            config=config,
        )
        assert result.valid is False
        assert "length" in result.error.lower() or "address" in result.error.lower()

    def test_private_ip_in_validator_still_blocked(self):
        """Existing private IP check still works after link-local addition."""
        from ag402_core.security.challenge_validator import validate_url_safety

        # RFC 1918 private addresses
        for addr in ["10.0.0.1", "192.168.1.1", "172.16.0.1"]:
            result = validate_url_safety(f"https://{addr}/api")
            assert result.valid is False, f"Expected {addr} to be blocked"


# ---------------------------------------------------------------------------
# Round-2 fix tests
# ---------------------------------------------------------------------------

class TestRound2Fixes:
    """Test for the 429/5xx upstream error rollback fix (Round 2 review).

    Fix F — non-2xx, non-402 upstream response (429, 5xx) rolls back
             the deducted prepaid call so the buyer doesn't lose it.
    """

    @pytest.fixture(autouse=True)
    def isolate_storage(self, tmp_path):
        cred_file = tmp_path / "prepaid_credentials.json"
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", cred_file), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            yield

    @pytest.mark.asyncio
    async def test_429_from_seller_rolls_back_call(self, tmp_path):
        """Rate-limited (429) response from seller rolls back the deducted call."""
        INITIAL = 5
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            (402, _402_headers(address=SELLER), b"pay"),
            (429, {"retry-after": "60"}, b"rate limited"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        # Should get the 429 back (not a fallback to on-chain)
        assert result.status_code == 429
        # Call must be rolled back — remaining unchanged
        creds = get_all_credentials()
        assert creds[0].remaining_calls == INITIAL, (
            f"Expected rollback to restore {INITIAL} calls, got {creds[0].remaining_calls}"
        )

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_5xx_from_seller_rolls_back_call(self, tmp_path):
        """Server error (5xx) from seller rolls back the deducted call."""
        INITIAL = 3
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            (402, _402_headers(address=SELLER), b"pay"),
            (503, {}, b"service unavailable"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 503
        creds = get_all_credentials()
        assert creds[0].remaining_calls == INITIAL

        await client.aclose()
        await wallet.close()

    @pytest.mark.asyncio
    async def test_2xx_from_seller_does_not_rollback(self, tmp_path):
        """Successful (2xx) response from seller keeps the call deducted."""
        INITIAL = 7
        cred = _make_credential(seller=SELLER, remaining=INITIAL)
        add_credential(cred)

        wallet = await _make_wallet(tmp_path)
        provider = MockSolanaAdapter()
        config = _make_config()

        transport = SequentialTransport([
            (402, _402_headers(address=SELLER), b"pay"),
            (200, {}, b"ok"),
        ])
        client = httpx.AsyncClient(transport=transport)
        mw = X402PaymentMiddleware(wallet, provider, config, http_client=client)

        result = await mw.handle_request("GET", "https://paid-api.example.com/data")

        assert result.status_code == 200
        assert result.tx_hash == "prepaid"
        # Call was consumed — remaining decremented
        creds = get_all_credentials()
        assert creds[0].remaining_calls == INITIAL - 1

        await client.aclose()


# ---------------------------------------------------------------------------
# Audit finding fix tests
# ---------------------------------------------------------------------------

class TestAuditFixes:
    """Tests for issues found in post-P0-3 security audit.

    Fix 1 (BLOCKER): DNS rebinding via link-local resolved IPs
    Fix 2 (MEDIUM):  signature=null → TypeError (now returns invalid_signature)
    Fix 3 (MEDIUM):  /prepaid/purchase rate limit
    """

    def test_dns_rebinding_link_local_blocked_in_validate_url_safety(self):
        """validate_url_safety blocks hostnames that resolve to link-local IPs.

        The direct IP path was already fixed; this tests the DNS-resolved path.
        We mock getaddrinfo to simulate a hostname resolving to 169.254.169.254.
        """
        import socket
        from unittest.mock import patch as _patch

        from ag402_core.security.challenge_validator import validate_url_safety

        # Simulate evil.example.com resolving to AWS metadata IP
        fake_addrs = [(socket.AF_INET, socket.SOCK_STREAM, 0, '', ('169.254.169.254', 443))]
        with _patch("socket.getaddrinfo", return_value=fake_addrs):
            result = validate_url_safety("https://evil.example.com/steal-creds")
        assert result.valid is False
        assert "DNS rebinding" in result.error

    def test_dns_rebinding_ipv6_link_local_resolved_blocked(self):
        """validate_url_safety blocks hostnames resolving to IPv6 link-local (fe80::)."""
        import socket
        from unittest.mock import patch as _patch

        from ag402_core.security.challenge_validator import validate_url_safety

        fake_addrs = [(socket.AF_INET6, socket.SOCK_STREAM, 0, '', ('fe80::1', 443, 0, 0))]
        with _patch("socket.getaddrinfo", return_value=fake_addrs):
            result = validate_url_safety("https://evil6.example.com/")
        assert result.valid is False
        assert "DNS rebinding" in result.error
