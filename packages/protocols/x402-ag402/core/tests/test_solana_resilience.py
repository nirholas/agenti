"""
Solana Adapter Resilience Tests — Network Anomalies & Edge Cases

Tests SolanaAdapter's behavior under:
  - RPC timeout (asyncio.TimeoutError)
  - RPC connection failure (ConnectionError, OSError)
  - Transaction confirmation timeout (sent ok, confirm hangs)
  - ATA check timeout (graceful degradation)
  - check_balance() timeout → returns 0.0
  - verify_payment() timeout → returns False
  - verify_payment() with intermittent failures (retry logic)
  - Partial failure: blockhash ok, send_transaction fails
  - Network jitter: slow RPC responses
  - Post-close usage

All mock tests use patch on the AsyncClient methods — no real RPC calls.
Devnet timing tests (T11) measure real transaction latency.
"""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

solana_mod = pytest.importorskip("solana", reason="solana-py not installed")
solders_mod = pytest.importorskip("solders", reason="solders not installed")

import base58
from ag402_core.payment.solana_adapter import SolanaAdapter
from solders.hash import Hash as SoldersHash
from solders.keypair import Keypair
from solders.signature import Signature

# ---------------------------------------------------------------------------
# Generate a valid test keypair (random, no funds)
# ---------------------------------------------------------------------------
_TEST_KP = Keypair()
_TEST_PRIVKEY = base58.b58encode(bytes(_TEST_KP)).decode()
_TEST_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
_TEST_RPC = "https://api.devnet.solana.com"
_SELLER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"


def _make_adapter(confirm_timeout: int = 5) -> SolanaAdapter:
    """Create a SolanaAdapter with a short timeout for testing."""
    return SolanaAdapter(
        private_key=_TEST_PRIVKEY,
        rpc_url=_TEST_RPC,
        usdc_mint=_TEST_MINT,
        confirm_timeout=confirm_timeout,
    )


def _mock_blockhash_resp():
    """Build a mock get_latest_blockhash response with a real Hash."""
    mock_bh = MagicMock()
    mock_bh.value.blockhash = SoldersHash.default()
    return mock_bh


def _mock_send_resp(sig_str: str = "5" * 88):
    """Build a mock send_transaction response with a real Signature."""
    mock_resp = MagicMock()
    mock_resp.value = Signature.default()
    return mock_resp


def _mock_acct_info(exists: bool = False):
    """Build a mock get_account_info response."""
    mock = MagicMock()
    mock.value = MagicMock() if exists else None
    return mock


def _mock_confirm_resp(err=None):
    """Build a mock confirm_transaction response with optional error."""
    mock = MagicMock()
    mock.value.err = err
    return mock


# ===================================================================
# T1: RPC Timeout on pay() — critical RPC calls hang
# ===================================================================
class TestPayRPCTimeout:
    """pay() should return success=False when critical RPC calls time out."""

    @pytest.mark.asyncio
    async def test_blockhash_timeout_returns_failure(self):
        """get_latest_blockhash hangs → pay() returns failure."""
        adapter = _make_adapter(confirm_timeout=1)

        async def _hang(*a, **kw):
            await asyncio.sleep(999)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = _hang

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success
        assert result.chain == "solana"

    @pytest.mark.asyncio
    async def test_send_transaction_timeout_returns_failure(self):
        """send_transaction hangs → pay() returns failure."""
        adapter = _make_adapter(confirm_timeout=1)

        async def _hang(*a, **kw):
            await asyncio.sleep(999)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = _hang

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success

    @pytest.mark.asyncio
    async def test_connection_error_returns_failure(self):
        """ConnectionError during blockhash fetch → failure."""
        adapter = _make_adapter(confirm_timeout=2)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(
            side_effect=ConnectionError("Connection refused")
        )

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success
        assert "Connection refused" in result.error

    @pytest.mark.asyncio
    async def test_oserror_returns_failure(self):
        """OSError (network unreachable) → failure."""
        adapter = _make_adapter(confirm_timeout=2)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(
            side_effect=OSError("Network is unreachable")
        )

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success


# ===================================================================
# T2: Confirmation timeout — sent ok but confirm hangs
# ===================================================================
class TestConfirmationTimeout:
    """Sent successfully + confirmation timeout → still success=True."""

    @pytest.mark.asyncio
    async def test_confirm_timeout_still_returns_success(self):
        adapter = _make_adapter(confirm_timeout=2)

        async def _hang_confirm(*a, **kw):
            await asyncio.sleep(999)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = AsyncMock(return_value=_mock_send_resp())
        adapter._client.confirm_transaction = _hang_confirm

        result = await adapter.pay(_SELLER, 0.01)
        assert result.success, f"Expected success=True, got error: {result.error}"
        assert result.tx_hash
        assert result.memo == "Ag402-v1"

    @pytest.mark.asyncio
    async def test_confirm_raises_still_returns_success(self):
        """confirm_transaction raises RuntimeError → success=True."""
        adapter = _make_adapter(confirm_timeout=2)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = AsyncMock(return_value=_mock_send_resp())
        adapter._client.confirm_transaction = AsyncMock(
            side_effect=RuntimeError("Node restarting")
        )

        result = await adapter.pay(_SELLER, 0.01)
        assert result.success


# ===================================================================
# T3: ATA check failures — graceful degradation
# ===================================================================
class TestATACheckDegradation:
    """ATA check failure should not block payment."""

    @pytest.mark.asyncio
    async def test_ata_timeout_does_not_block(self):
        """ATA check hangs → pay() still sends transaction."""
        adapter = _make_adapter(confirm_timeout=1)

        async def _ata_hang(*a, **kw):
            await asyncio.sleep(999)

        send_called = []

        adapter._client = AsyncMock()
        adapter._client.get_account_info = _ata_hang
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())

        original_send = AsyncMock(return_value=_mock_send_resp())

        async def _track_send(*a, **kw):
            send_called.append(True)
            return await original_send(*a, **kw)

        adapter._client.send_transaction = _track_send
        adapter._client.confirm_transaction = AsyncMock(return_value=_mock_confirm_resp())

        result = await adapter.pay(_SELLER, 0.01)
        assert result.success, f"Payment should proceed: {result.error}"
        assert send_called

    @pytest.mark.asyncio
    async def test_ata_error_does_not_block(self):
        """ATA check raises OSError → pay() still proceeds."""
        adapter = _make_adapter(confirm_timeout=2)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(
            side_effect=OSError("ECONNRESET")
        )
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = AsyncMock(return_value=_mock_send_resp())
        adapter._client.confirm_transaction = AsyncMock(return_value=_mock_confirm_resp())

        result = await adapter.pay(_SELLER, 0.01)
        assert result.success


# ===================================================================
# T4: check_balance() under failures
# ===================================================================
class TestCheckBalanceResilience:

    @pytest.mark.asyncio
    async def test_timeout_returns_zero(self):
        adapter = _make_adapter(confirm_timeout=1)

        async def _hang(*a, **kw):
            await asyncio.sleep(999)

        with patch("spl.token.async_client.AsyncToken.get_balance", new=_hang):
            balance = await adapter.check_balance()
        assert balance == 0.0

    @pytest.mark.asyncio
    async def test_connection_error_returns_zero(self):
        adapter = _make_adapter(confirm_timeout=2)
        with patch(
            "spl.token.async_client.AsyncToken.get_balance",
            new=AsyncMock(side_effect=ConnectionError("ECONNRESET")),
        ):
            balance = await adapter.check_balance()
        assert balance == 0.0

    @pytest.mark.asyncio
    async def test_rpc_503_returns_zero(self):
        adapter = _make_adapter(confirm_timeout=2)
        with patch(
            "spl.token.async_client.AsyncToken.get_balance",
            new=AsyncMock(side_effect=Exception("503 Service Unavailable")),
        ):
            balance = await adapter.check_balance()
        assert balance == 0.0


# ===================================================================
# T5: verify_payment() under failures
# ===================================================================
class TestVerifyPaymentResilience:

    @pytest.mark.asyncio
    async def test_timeout_returns_false(self):
        adapter = _make_adapter(confirm_timeout=1)

        async def _hang(*a, **kw):
            await asyncio.sleep(999)

        adapter._client = AsyncMock()
        adapter._client.get_transaction = _hang

        verified = await adapter.verify_payment("5" * 88)
        assert verified is False

    @pytest.mark.asyncio
    async def test_connection_error_returns_false(self):
        adapter = _make_adapter(confirm_timeout=2)
        adapter._client = AsyncMock()
        adapter._client.get_transaction = AsyncMock(
            side_effect=ConnectionError("Connection reset")
        )

        verified = await adapter.verify_payment("5" * 88)
        assert verified is False

    @pytest.mark.asyncio
    async def test_intermittent_then_success(self):
        """First 2 calls return None, 3rd call returns a tx → verified."""
        adapter = _make_adapter(confirm_timeout=5)

        call_count = 0

        async def _intermittent(*a, **kw):
            nonlocal call_count
            call_count += 1
            resp = MagicMock()
            if call_count <= 2:
                resp.value = None
            else:
                resp.value = MagicMock()
                resp.value.transaction.meta = None
            return resp

        adapter._client = AsyncMock()
        adapter._client.get_transaction = _intermittent

        verified = await adapter.verify_payment("5" * 88)
        assert verified is True
        assert call_count >= 3

    @pytest.mark.asyncio
    async def test_all_retries_none_returns_false(self):
        """All 5 retry attempts return None → False."""
        adapter = _make_adapter(confirm_timeout=5)

        call_count = 0

        async def _always_none(*a, **kw):
            nonlocal call_count
            call_count += 1
            resp = MagicMock()
            resp.value = None
            return resp

        adapter._client = AsyncMock()
        adapter._client.get_transaction = _always_none

        verified = await adapter.verify_payment("5" * 88)
        assert verified is False
        assert call_count == 5


# ===================================================================
# T6: Network jitter — slow but successful
# ===================================================================
class TestNetworkJitter:

    @pytest.mark.asyncio
    async def test_slow_blockhash_within_timeout(self):
        """Blockhash takes 0.5s with 5s timeout → success."""
        adapter = _make_adapter(confirm_timeout=5)

        async def _slow_bh(*a, **kw):
            await asyncio.sleep(0.3)
            return _mock_blockhash_resp()

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(True))
        adapter._client.get_latest_blockhash = _slow_bh
        adapter._client.send_transaction = AsyncMock(return_value=_mock_send_resp())
        adapter._client.confirm_transaction = AsyncMock(return_value=_mock_confirm_resp())

        result = await adapter.pay(_SELLER, 0.01)
        assert result.success

    @pytest.mark.asyncio
    async def test_slow_send_within_timeout(self):
        """send_transaction takes 0.5s with 5s timeout → success."""
        adapter = _make_adapter(confirm_timeout=5)

        async def _slow_send(*a, **kw):
            await asyncio.sleep(0.3)
            return _mock_send_resp()

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = _slow_send
        adapter._client.confirm_transaction = AsyncMock(return_value=_mock_confirm_resp())

        result = await adapter.pay(_SELLER, 0.01)
        assert result.success


# ===================================================================
# T7: Partial failure — some steps ok, later step fails
# ===================================================================
class TestPartialFailure:

    @pytest.mark.asyncio
    async def test_blockhash_ok_send_raises(self):
        """Blockhash ok → send_transaction raises → failure."""
        adapter = _make_adapter(confirm_timeout=3)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = AsyncMock(
            side_effect=Exception("insufficient funds for rent")
        )

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success
        assert "insufficient funds" in result.error.lower()

    @pytest.mark.asyncio
    async def test_preflight_failure(self):
        """Preflight simulation fails → failure with error message."""
        adapter = _make_adapter(confirm_timeout=3)

        adapter._client = AsyncMock()
        adapter._client.get_account_info = AsyncMock(return_value=_mock_acct_info(False))
        adapter._client.get_latest_blockhash = AsyncMock(return_value=_mock_blockhash_resp())
        adapter._client.send_transaction = AsyncMock(
            side_effect=Exception("SendTransactionPreflightFailure")
        )

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success
        assert result.error


# ===================================================================
# T8: close() then use — verify clean shutdown
# ===================================================================
class TestPostCloseUsage:

    @pytest.mark.asyncio
    async def test_pay_after_close(self):
        """pay() after close() returns failure, not crash."""
        adapter = _make_adapter()
        adapter.close()

        result = await adapter.pay(_SELLER, 0.01)
        assert not result.success

    @pytest.mark.asyncio
    async def test_balance_after_close(self):
        """check_balance() after close() returns 0.0."""
        adapter = _make_adapter()
        adapter.close()

        balance = await adapter.check_balance()
        assert balance == 0.0

    @pytest.mark.asyncio
    async def test_verify_after_close(self):
        """verify_payment() after close() returns False."""
        adapter = _make_adapter()
        adapter.close()

        verified = await adapter.verify_payment("5" * 88)
        assert verified is False


# ===================================================================
# T9: retry_with_backoff utility
# ===================================================================
class TestRetryWithBackoff:

    @pytest.mark.asyncio
    async def test_succeeds_on_third_attempt(self):
        from ag402_core.payment.retry import retry_with_backoff

        call_count = 0

        async def flaky():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError(f"Attempt {call_count}")
            return "ok"

        result = await retry_with_backoff(flaky, max_retries=3, base_delay=0.01)
        assert result == "ok"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_exhausts_all_retries(self):
        from ag402_core.payment.retry import retry_with_backoff

        async def always_fail():
            raise TimeoutError("RPC timed out")

        with pytest.raises(TimeoutError, match="RPC timed out"):
            await retry_with_backoff(always_fail, max_retries=2, base_delay=0.01)

    @pytest.mark.asyncio
    async def test_exponential_backoff(self):
        """Verify delay increases exponentially."""
        from ag402_core.payment.retry import retry_with_backoff

        timestamps = []

        async def track_time():
            timestamps.append(time.monotonic())
            raise RuntimeError("fail")

        with pytest.raises(RuntimeError):
            await retry_with_backoff(track_time, max_retries=2, base_delay=0.05)

        assert len(timestamps) == 3
        gap1 = timestamps[1] - timestamps[0]
        gap2 = timestamps[2] - timestamps[1]
        # Exponential: gap2 should be roughly 2x gap1
        assert gap2 >= gap1 * 0.8


# ===================================================================
# T10: MultiEndpointClient failover
# ===================================================================
class TestMultiEndpointFailover:

    def test_starts_with_primary(self):
        from ag402_core.payment.retry import MultiEndpointClient
        c = MultiEndpointClient("https://primary", ["https://backup1", "https://backup2"])
        assert c.current_url == "https://primary"

    def test_failover_cycles(self):
        from ag402_core.payment.retry import MultiEndpointClient
        c = MultiEndpointClient("https://primary", ["https://backup1", "https://backup2"])

        assert c.failover() == "https://backup1"
        assert c.failover() == "https://backup2"
        assert c.failover() is None

    def test_reset(self):
        from ag402_core.payment.retry import MultiEndpointClient
        c = MultiEndpointClient("https://primary", ["https://backup1"])
        c.failover()
        assert c.current_url == "https://backup1"
        c.reset()
        assert c.current_url == "https://primary"


# ===================================================================
# T11: Real devnet timing measurements (only in devnet sessions)
# ===================================================================
class TestDevnetTransactionTiming:
    """Measure real transaction latency. Only runs with -m devnet."""

    @pytest.mark.devnet
    @pytest.mark.asyncio
    async def test_measure_pay_latency(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata,
    ):
        """Measure 3× pay() latency on real devnet."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58, rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        timings = []
        for i in range(3):
            start = time.monotonic()
            result = await adapter.pay(to_address=seller_pubkey, amount=0.001, token="USDC")
            elapsed = time.monotonic() - start
            timings.append(elapsed)
            assert result.success, f"Payment {i+1} failed: {result.error}"
            print(f"  Payment {i+1}: {elapsed:.2f}s (tx: {result.tx_hash[:20]}...)")

        avg = sum(timings) / len(timings)
        print("\n  === Pay Latency ===")
        print(f"  Min: {min(timings):.2f}s | Max: {max(timings):.2f}s | Avg: {avg:.2f}s | Jitter: {max(timings)-min(timings):.2f}s")
        adapter.close()

    @pytest.mark.devnet
    @pytest.mark.asyncio
    async def test_measure_verify_latency(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata,
    ):
        """Measure verify_payment() latency on real devnet."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58, rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(to_address=seller_pubkey, amount=0.001, token="USDC")
        assert result.success
        tx_hash = result.tx_hash

        timings = []
        for i in range(3):
            start = time.monotonic()
            verified = await adapter.verify_payment(
                tx_hash, expected_amount=0.001, expected_address=seller_pubkey,
            )
            elapsed = time.monotonic() - start
            timings.append(elapsed)
            assert verified
            print(f"  Verify {i+1}: {elapsed:.2f}s")

        avg = sum(timings) / len(timings)
        print("\n  === Verify Latency ===")
        print(f"  Min: {min(timings):.2f}s | Max: {max(timings):.2f}s | Avg: {avg:.2f}s")
        adapter.close()

    @pytest.mark.devnet
    @pytest.mark.asyncio
    async def test_measure_balance_latency(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
    ):
        """Measure check_balance() latency."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58, rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        timings = []
        for i in range(5):
            start = time.monotonic()
            balance = await adapter.check_balance()
            elapsed = time.monotonic() - start
            timings.append(elapsed)
            print(f"  Balance {i+1}: {elapsed:.3f}s ({balance:.2f} USDC)")

        print("\n  === Balance Latency ===")
        print(f"  Min: {min(timings):.3f}s | Max: {max(timings):.3f}s | Avg: {sum(timings)/len(timings):.3f}s")
        adapter.close()

    @pytest.mark.devnet
    @pytest.mark.asyncio
    async def test_confirmed_vs_finalized(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata,
    ):
        """Compare confirmed vs finalized confirmation latency."""
        # Confirmed
        a1 = SolanaAdapter(
            private_key=buyer_private_key_b58, rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str, confirmation_level="confirmed",
        )
        start = time.monotonic()
        r1 = await a1.pay(to_address=seller_pubkey, amount=0.001, token="USDC")
        t_confirmed = time.monotonic() - start
        assert r1.success
        a1.close()

        # Finalized
        a2 = SolanaAdapter(
            private_key=buyer_private_key_b58, rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str, confirmation_level="finalized",
        )
        start = time.monotonic()
        r2 = await a2.pay(to_address=seller_pubkey, amount=0.001, token="USDC")
        t_finalized = time.monotonic() - start
        assert r2.success
        a2.close()

        print("\n  === Confirmation Comparison ===")
        print(f"  Confirmed:  {t_confirmed:.2f}s")
        print(f"  Finalized:  {t_finalized:.2f}s")
        print(f"  Diff:       {t_finalized - t_confirmed:+.2f}s")
