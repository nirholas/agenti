"""
Solana Local-Validator Integration Tests — SolanaAdapter

Uses `solana-test-validator` for fast, reliable testing.

Run with:
    # Terminal 1: start validator
    solana-test-validator --reset

    # Terminal 2: run tests
    cd core && python -m pytest tests/test_localnet_solana.py -v -s --timeout=60
"""

from __future__ import annotations

import asyncio
import functools

import pytest

solana_mod = pytest.importorskip("solana", reason="solana-py not installed")
solders_mod = pytest.importorskip("solders", reason="solders not installed")

from ag402_core.payment.solana_adapter import SolanaAdapter

from tests.conftest_localnet import (
    _keypair_to_base58,
)

pytestmark = [
    pytest.mark.localnet,
    pytest.mark.asyncio,
]

TEST_TIMEOUT = 20


def with_timeout(seconds: int = TEST_TIMEOUT):
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            await asyncio.wait_for(fn(*args, **kwargs), timeout=seconds)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# D1.1: SolanaAdapter can connect
# ---------------------------------------------------------------------------
class TestSolanaAdapterConnection:

    @with_timeout()
    async def test_init_connects(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str):
        """SolanaAdapter.__init__() should not raise."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        assert adapter is not None
        adapter.close()

    @with_timeout()
    async def test_get_address(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, buyer_pubkey):
        """get_address() returns correct public key."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        assert adapter.get_address() == buyer_pubkey
        adapter.close()

    @with_timeout()
    async def test_invalid_confirmation_level(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str):
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

    @with_timeout()
    async def test_check_balance_minted(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, buyer_usdc_ata):
        """check_balance() returns the minted USDC amount."""
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
    async def test_check_balance_zero(self, seller_keypair, rpc_url, test_usdc_mint_str):
        """check_balance() for account with no ATA returns small amount (E2E tests may have sent tokens)."""
        adapter = SolanaAdapter(
            private_key=_keypair_to_base58(seller_keypair),
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        balance = await adapter.check_balance()
        # Seller may have received small amounts from E2E tests running first
        assert balance < 10.0, f"Expected < 10 USDC (near-zero), got {balance}"
        adapter.close()


# ---------------------------------------------------------------------------
# D1.4-D1.7: Payment execution and verification
# ---------------------------------------------------------------------------
class TestSolanaAdapterPayment:

    @with_timeout()
    async def test_pay_succeeds(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey, buyer_usdc_ata):
        """pay() executes a real SPL transfer and returns success."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(to_address=seller_pubkey, amount=0.01, token="USDC")
        assert result.success, f"Payment failed: {result.error}"
        assert result.tx_hash and len(result.tx_hash) > 20
        assert result.chain == "solana"
        assert result.memo == "Ag402-v1"
        TestSolanaAdapterPayment._last_tx_hash = result.tx_hash
        adapter.close()

    @with_timeout()
    async def test_verify_payment_basic(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str):
        """verify_payment() confirms the previous tx exists."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(tx_hash)
        assert verified, f"Basic verification failed for tx {tx_hash}"
        adapter.close()

    @with_timeout()
    async def test_verify_payment_amount_and_address(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey):
        """verify_payment() verifies amount and recipient."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(tx_hash, expected_amount=0.01, expected_address=seller_pubkey)
        assert verified, "Amount+address verification failed"
        adapter.close()

    @with_timeout()
    async def test_verify_payment_sender(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey, buyer_pubkey):
        """verify_payment() verifies sender matches."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(tx_hash, expected_amount=0.01, expected_address=seller_pubkey, expected_sender=buyer_pubkey)
        assert verified, "Sender verification failed"
        adapter.close()

    @with_timeout()
    async def test_verify_wrong_sender_fails(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey):
        """verify_payment() with wrong sender returns False."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(tx_hash, expected_amount=0.01, expected_address=seller_pubkey, expected_sender=seller_pubkey)
        assert not verified, "Should reject wrong sender"
        adapter.close()

    @with_timeout()
    async def test_verify_wrong_amount_fails(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey):
        """verify_payment() with wrong amount returns False."""
        tx_hash = getattr(TestSolanaAdapterPayment, "_last_tx_hash", None)
        if not tx_hash:
            pytest.skip("No tx_hash from previous test")
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        verified = await adapter.verify_payment(tx_hash, expected_amount=100.0, expected_address=seller_pubkey)
        assert not verified, "Should reject wrong amount"
        adapter.close()

    @with_timeout()
    async def test_verify_nonexistent_tx(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str):
        """verify_payment() with fake tx_hash returns False."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        fake_sig = "5" * 88
        verified = await adapter.verify_payment(fake_sig)
        assert not verified
        adapter.close()


# ---------------------------------------------------------------------------
# D1.8: ATA auto-creation
# ---------------------------------------------------------------------------
class TestATAAutoCreation:

    @with_timeout()
    async def test_pay_to_new_address_creates_ata(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, buyer_usdc_ata, solana_client):
        """Paying to a new address auto-creates its ATA."""
        from solders.keypair import Keypair as SoldersKeypair
        from solders.pubkey import Pubkey
        from spl.token.instructions import get_associated_token_address

        fresh_kp = SoldersKeypair()
        fresh_address = str(fresh_kp.pubkey())

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(to_address=fresh_address, amount=0.001, token="USDC")
        assert result.success, f"Payment with ATA creation failed: {result.error}"

        # Wait for the ATA creation to be queryable at confirmed level
        await asyncio.sleep(1)

        fresh_pubkey = Pubkey.from_string(fresh_address)
        mint_pubkey = Pubkey.from_string(test_usdc_mint_str)
        ata = get_associated_token_address(fresh_pubkey, mint_pubkey)
        info = await solana_client.get_account_info(ata, commitment="confirmed")
        assert info.value is not None, "ATA should have been created"
        adapter.close()


# ---------------------------------------------------------------------------
# D1.9: Memo verification
# ---------------------------------------------------------------------------
class TestMemoInjection:

    @with_timeout()
    async def test_transaction_has_memo(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey, buyer_usdc_ata, solana_client):
        """Transaction contains Ag402-v1 memo instruction."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(to_address=seller_pubkey, amount=0.001, token="USDC")
        assert result.success, f"Payment failed: {result.error}"

        from solders.signature import Signature
        sig = Signature.from_string(result.tx_hash)

        # Wait a moment for tx to be queryable, then fetch with confirmed commitment
        import asyncio
        await asyncio.sleep(1)
        resp = await solana_client.get_transaction(
            sig, max_supported_transaction_version=0, commitment="confirmed"
        )
        assert resp.value is not None, "Transaction not found"

        meta = resp.value.transaction.meta
        assert meta is not None
        log_messages = meta.log_messages or []
        memo_found = any("Ag402-v1" in msg for msg in log_messages)
        assert memo_found, f"Ag402-v1 memo not found in logs: {log_messages}"
        adapter.close()


# ---------------------------------------------------------------------------
# D1.10: Close / cleanup
# ---------------------------------------------------------------------------
class TestSolanaAdapterCleanup:

    @with_timeout()
    async def test_close_clears_keypair(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str):
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        assert adapter.get_address()
        adapter.close()
        assert adapter._keypair is None
        assert adapter._client is None


# ---------------------------------------------------------------------------
# D3.4: Insufficient balance
# ---------------------------------------------------------------------------
class TestInsufficientBalance:

    @with_timeout()
    async def test_pay_more_than_balance_fails(self, seller_keypair, rpc_url, test_usdc_mint_str, seller_pubkey, funded_accounts):
        """Paying more than available balance returns success=False."""
        adapter = SolanaAdapter(
            private_key=_keypair_to_base58(seller_keypair),
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        result = await adapter.pay(to_address=seller_pubkey, amount=1000.0, token="USDC")
        assert not result.success
        assert result.error
        adapter.close()


# ---------------------------------------------------------------------------
# D3.6: Confirmation level
# ---------------------------------------------------------------------------
class TestConfirmationLevel:

    @with_timeout()
    async def test_confirmed_confirmation(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str, seller_pubkey, buyer_usdc_ata):
        """Payment with confirmed confirmation works on localnet."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
            confirmation_level="confirmed",
        )
        result = await adapter.pay(to_address=seller_pubkey, amount=0.001, token="USDC")
        assert result.success, f"Confirmed payment failed: {result.error}"
        adapter.close()

    def test_invalid_confirmation_level_rejects(self, buyer_private_key_b58, rpc_url, test_usdc_mint_str):
        """Invalid confirmation level raises ValueError."""
        with pytest.raises(ValueError, match="confirmation_level"):
            SolanaAdapter(
                private_key=buyer_private_key_b58,
                rpc_url=rpc_url,
                usdc_mint=test_usdc_mint_str,
                confirmation_level="invalid",
            )
