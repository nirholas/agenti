"""
Solana Devnet Integration Tests — Phase 1 (SolanaAdapter)

TDD: These tests are written FIRST, then we run them against the real devnet
to discover and fix bugs in SolanaAdapter.

Run with:
    PYTHONPATH=core /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 \
      -m pytest core/tests/test_devnet_solana.py -v -s --timeout=120

Prerequisites:
    - Buyer keypair at ~/.ag402/devnet-buyer.json (with SOL)
    - Seller keypair at ~/.ag402/devnet-seller.json (with SOL)
    - `pip install 'ag402-core[crypto]'`
"""

from __future__ import annotations

import asyncio
import functools

import pytest

# Skip entire module if crypto deps not installed
solana = pytest.importorskip("solana", reason="solana-py not installed")
solders = pytest.importorskip("solders", reason="solders not installed")

# Import fixtures from conftest_devnet (session-scoped)
from ag402_core.payment.solana_adapter import SolanaAdapter

from tests.conftest_devnet import (
    _keypair_to_base58,
)

# Mark all tests in this module as devnet integration tests
pytestmark = [
    pytest.mark.devnet,
    pytest.mark.asyncio,
]

# Default per-test timeout in seconds
TEST_TIMEOUT = 60
SLOW_TEST_TIMEOUT = 90  # for tests involving finalized confirmation


def with_timeout(seconds: int = TEST_TIMEOUT):
    """Decorator: wrap an async test with asyncio.wait_for to enforce a hard timeout."""
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            await asyncio.wait_for(fn(*args, **kwargs), timeout=seconds)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# D1.1: SolanaAdapter can connect to devnet
# ---------------------------------------------------------------------------
class TestSolanaAdapterConnection:
    """Verify SolanaAdapter can initialize and connect to Devnet."""

    @with_timeout()
    async def test_init_connects_to_devnet(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
    ):
        """D1.1: SolanaAdapter.__init__() should not raise when connecting to devnet."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        assert adapter is not None
        adapter.close()

    @with_timeout()
    async def test_get_address_returns_buyer_pubkey(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, buyer_pubkey,
    ):
        """D1.3: get_address() should return the correct public key."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        assert adapter.get_address() == buyer_pubkey
        adapter.close()

    @with_timeout()
    async def test_invalid_confirmation_level_raises(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
    ):
        """Configuring invalid confirmation level should raise ValueError."""
        with pytest.raises(ValueError, match="confirmation_level"):
            SolanaAdapter(
                private_key=buyer_private_key_b58,
                rpc_url=rpc_url,
                usdc_mint=test_usdc_mint_str,
                confirmation_level="invalid",
            )


# ---------------------------------------------------------------------------
# D1.2: Balance checking
# ---------------------------------------------------------------------------
class TestSolanaAdapterBalance:
    """Verify check_balance() works against devnet."""

    @with_timeout()
    async def test_check_balance_returns_minted_amount(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        buyer_usdc_ata,  # ensures 1000 USDC minted
    ):
        """D1.2: check_balance() should return the minted USDC amount."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        balance = await adapter.check_balance()
        # E2E tests may run first and spend some USDC, so allow a tolerance
        assert balance >= 900.0, f"Expected >= 900 USDC, got {balance}"
        adapter.close()

    @with_timeout()
    async def test_check_balance_nonexistent_ata_returns_zero(
        self, rpc_url, test_usdc_mint_str, seller_keypair,
    ):
        """check_balance() for account with no ATA returns small amount (E2E tests may have sent tokens)."""
        # Seller may have received small amounts from E2E tests running first
        adapter = SolanaAdapter(
            private_key=_keypair_to_base58(seller_keypair),
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        balance = await adapter.check_balance()
        assert balance < 10.0, f"Expected < 10 USDC (near-zero), got {balance}"
        adapter.close()


# ---------------------------------------------------------------------------
# D1.4-D1.7: Payment execution and verification
# ---------------------------------------------------------------------------
class TestSolanaAdapterPayment:
    """Test real USDC transfer on devnet."""

    @with_timeout()
    async def test_pay_small_amount_succeeds(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata,
    ):
        """D1.4: pay() should execute a real SPL transfer and return success."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.01,  # $0.01
            token="USDC",
        )
        assert result.success, f"Payment failed: {result.error}"
        assert result.tx_hash, "tx_hash should not be empty"
        assert len(result.tx_hash) > 20, f"tx_hash too short: {result.tx_hash}"
        assert result.chain == "solana"
        assert result.memo == "Ag402-v1"

        # Store tx_hash for verification tests
        TestSolanaAdapterPayment._last_tx_hash = result.tx_hash
        TestSolanaAdapterPayment._last_amount = 0.01
        adapter.close()

    @with_timeout()
    async def test_verify_payment_basic(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
    ):
        """D1.5: verify_payment() should confirm the previous tx exists."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        # Basic verification — just check existence
        verified = await adapter.verify_payment(tx_hash)
        assert verified, f"Basic verification failed for tx {tx_hash}"
        adapter.close()

    @pytest.mark.flaky(reruns=2, reruns_delay=3)
    @with_timeout()
    async def test_verify_payment_with_amount_and_address(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey,
    ):
        """D1.6: verify_payment() should verify amount and recipient match."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(
            tx_hash,
            expected_amount=0.01,
            expected_address=seller_pubkey,
        )
        assert verified, f"Amount+address verification failed for tx {tx_hash}"
        adapter.close()

    @with_timeout()
    async def test_verify_payment_with_sender(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_pubkey,
    ):
        """D1.7: verify_payment() should verify sender matches."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(
            tx_hash,
            expected_amount=0.01,
            expected_address=seller_pubkey,
            expected_sender=buyer_pubkey,
        )
        assert verified, f"Sender verification failed for tx {tx_hash}"
        adapter.close()

    @with_timeout()
    async def test_verify_payment_wrong_sender_fails(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey,
    ):
        """D1.7b: verify_payment() with wrong sender should return False."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        # Use seller as "expected_sender" — should fail since buyer sent it
        verified = await adapter.verify_payment(
            tx_hash,
            expected_amount=0.01,
            expected_address=seller_pubkey,
            expected_sender=seller_pubkey,  # WRONG sender
        )
        assert not verified, "Should reject when sender doesn't match"
        adapter.close()

    @with_timeout()
    async def test_verify_payment_wrong_amount_fails(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey,
    ):
        """D3.1: verify_payment() with wrong amount should return False."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        # Expect $100 but only $0.01 was sent
        verified = await adapter.verify_payment(
            tx_hash,
            expected_amount=100.0,
            expected_address=seller_pubkey,
        )
        assert not verified, "Should reject when amount is too low"
        adapter.close()

    @with_timeout()
    async def test_verify_nonexistent_tx_fails(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
    ):
        """verify_payment() with a fake tx_hash should return False."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        # Random valid-format signature that doesn't exist
        fake_sig = "5" * 88
        verified = await adapter.verify_payment(fake_sig)
        assert not verified, "Should return False for nonexistent tx"
        adapter.close()


# ---------------------------------------------------------------------------
# D1.8: ATA auto-creation
# ---------------------------------------------------------------------------
class TestATAAutoCreation:
    """Test that pay() auto-creates recipient ATA if needed."""

    @pytest.mark.flaky(reruns=2, reruns_delay=5)
    @with_timeout(SLOW_TEST_TIMEOUT)
    async def test_pay_to_new_address_creates_ata(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        buyer_usdc_ata, solana_client,
    ):
        """D1.8: Paying to a new address should auto-create its ATA."""
        from solders.keypair import Keypair as SoldersKeypair
        # Generate a fresh keypair (no ATA yet)
        fresh_kp = SoldersKeypair()
        fresh_address = str(fresh_kp.pubkey())

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(
            to_address=fresh_address,
            amount=0.001,
            token="USDC",
        )
        assert result.success, f"Payment with ATA creation failed: {result.error}"

        # Verify ATA now exists (retry — devnet RPC can be flaky)
        from solders.pubkey import Pubkey
        from spl.token.instructions import get_associated_token_address as _get_ata
        fresh_pubkey = Pubkey.from_string(fresh_address)
        mint_pubkey = Pubkey.from_string(test_usdc_mint_str)
        ata = _get_ata(fresh_pubkey, mint_pubkey)
        info = None
        for _attempt in range(5):
            try:
                info = await solana_client.get_account_info(ata)
                if info.value is not None:
                    break
            except Exception:
                pass
            await asyncio.sleep(1)
        assert info is not None and info.value is not None, "ATA should have been created"
        adapter.close()


# ---------------------------------------------------------------------------
# D1.9: Memo verification (via transaction inspection)
# ---------------------------------------------------------------------------
class TestMemoInjection:
    """Verify that transactions include the Ag402-v1 memo."""

    @with_timeout()
    async def test_transaction_has_memo(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata, solana_client,
    ):
        """D1.9: Transaction should contain Ag402-v1 memo instruction."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.001,
            token="USDC",
        )
        assert result.success, f"Payment failed: {result.error}"

        # Inspect the transaction on-chain for memo
        from solders.signature import Signature
        sig = Signature.from_string(result.tx_hash)
        resp = await solana_client.get_transaction(
            sig, max_supported_transaction_version=0,
        )
        assert resp.value is not None, "Transaction not found"

        # Check log messages for memo
        meta = resp.value.transaction.meta
        assert meta is not None, "Transaction has no meta"
        log_messages = meta.log_messages or []
        # Memo program logs the memo data
        memo_found = any("Ag402-v1" in msg for msg in log_messages)
        assert memo_found, (
            f"Ag402-v1 memo not found in logs: {log_messages}"
        )
        adapter.close()


# ---------------------------------------------------------------------------
# D1.10: Close / cleanup
# ---------------------------------------------------------------------------
class TestSolanaAdapterCleanup:
    """Test adapter cleanup."""

    @with_timeout()
    async def test_close_clears_keypair(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
    ):
        """D1.10: close() should clear the private key from memory."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        assert adapter.get_address()  # works before close
        adapter.close()
        assert adapter._keypair is None, "Keypair should be None after close"
        assert adapter._client is None, "Client should be None after close"


# ---------------------------------------------------------------------------
# D3.4: Insufficient balance
# ---------------------------------------------------------------------------
class TestInsufficientBalance:
    """Test error handling when buyer has insufficient USDC."""

    @with_timeout()
    async def test_pay_more_than_balance_fails(
        self, rpc_url, test_usdc_mint_str,
        seller_pubkey, funded_accounts,
    ):
        """D3.4: Paying more than available balance should return success=False."""
        # Use a completely fresh keypair with zero USDC to guarantee
        # insufficient balance — avoids contamination from E2E tests
        from solders.keypair import Keypair as SoldersKeypair
        fresh_kp = SoldersKeypair()
        adapter = SolanaAdapter(
            private_key=_keypair_to_base58(fresh_kp),
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        # Try to pay $1000 — fresh keypair has no USDC and no ATA
        result = await adapter.pay(
            to_address=seller_pubkey,
            amount=1000.0,
            token="USDC",
        )
        assert not result.success, "Should fail when balance insufficient"
        assert result.error, "Should have error message"
        adapter.close()


# ---------------------------------------------------------------------------
# D3.6: Confirmation level test
# ---------------------------------------------------------------------------
class TestConfirmationLevel:
    """Test different confirmation levels."""

    @pytest.mark.flaky(reruns=2, reruns_delay=5)
    @with_timeout(SLOW_TEST_TIMEOUT)
    async def test_finalized_confirmation(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata,
    ):
        """D3.6: Payment with finalized confirmation should work (slower)."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
            confirmation_level="finalized",
        )
        result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.001,
            token="USDC",
        )
        # finalized takes longer but should still succeed
        assert result.success, f"Finalized payment failed: {result.error}"
        adapter.close()
