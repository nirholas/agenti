"""
End-to-End Devnet Integration Test — Phase 2

Tests the full flow: Buyer → Gateway (x402) → Seller
Using real Solana devnet transactions.

Run with:
    PYTHONPATH=core /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 \
      -m pytest core/tests/test_devnet_e2e.py -v -s --timeout=180
"""

from __future__ import annotations

import asyncio
import functools

import pytest

solana_mod = pytest.importorskip("solana", reason="solana-py not installed")
solders_mod = pytest.importorskip("solders", reason="solders not installed")


from ag402_core.config import RunMode, X402Config
from ag402_core.gateway.auth import PaymentVerifier
from ag402_core.payment.solana_adapter import SolanaAdapter
from open402.headers import build_authorization, build_www_authenticate
from open402.spec import X402PaymentChallenge, X402PaymentProof

pytestmark = [
    pytest.mark.devnet,
    pytest.mark.asyncio,
]

# Default per-test timeout in seconds
TEST_TIMEOUT = 60


def with_timeout(seconds: int = TEST_TIMEOUT):
    """Decorator: wrap an async test with asyncio.wait_for to enforce a hard timeout."""
    def decorator(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            await asyncio.wait_for(fn(*args, **kwargs), timeout=seconds)
        return wrapper
    return decorator


# ---------------------------------------------------------------------------
# D2.1-D2.2: Gateway 402 challenge generation
# ---------------------------------------------------------------------------
class TestGatewayChallenge:
    """Test that the gateway generates correct x402 challenges."""

    def test_build_challenge_with_test_usdc(self, seller_pubkey, test_usdc_mint_str):
        """D2.1: Build a 402 challenge with correct parameters."""
        challenge = X402PaymentChallenge(
            amount="0.01",
            address=seller_pubkey,
            token="USDC",
            chain="solana",
        )
        www_auth = build_www_authenticate(challenge)
        assert "x402" in www_auth.lower() or "X402" in www_auth
        assert seller_pubkey in www_auth
        assert "0.01" in www_auth


# ---------------------------------------------------------------------------
# D2.5: Gateway verification of real tx
# ---------------------------------------------------------------------------
class TestGatewayVerification:
    """Test PaymentVerifier with real SolanaAdapter on devnet."""

    @pytest.mark.flaky(reruns=2, reruns_delay=5)
    @with_timeout()
    async def test_verifier_accepts_real_payment(
        self,
        buyer_private_key_b58,
        rpc_url,
        test_usdc_mint_str,
        seller_pubkey,
        buyer_pubkey,
        buyer_usdc_ata,
    ):
        """D2.5: PaymentVerifier should accept a real on-chain payment proof."""
        # Step 1: Make a real payment
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.01,
            token="USDC",
        )
        assert pay_result.success, f"Payment failed: {pay_result.error}"

        # Step 2: Create a verifier with the same adapter (server-side)
        # Create a separate adapter for server-side verification
        verifier_adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,  # key doesn't matter for verify
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        config = X402Config(
            mode=RunMode.PRODUCTION,
            solana_private_key=buyer_private_key_b58,
            solana_rpc_url=rpc_url,
            usdc_mint_address=test_usdc_mint_str,
        )
        verifier = PaymentVerifier(provider=verifier_adapter, config=config)

        # Step 3: Build the proof header (as buyer client would)
        proof = X402PaymentProof(
            tx_hash=pay_result.tx_hash,
            chain="solana",
            payer_address=buyer_pubkey,
        )
        auth_header = build_authorization(proof)

        # Step 4: Verify
        result = await verifier.verify(
            authorization=auth_header,
            expected_amount=0.01,
            expected_address=seller_pubkey,
        )
        assert result.valid, f"Verification failed: {result.error}"
        assert result.tx_hash == pay_result.tx_hash

        adapter.close()
        verifier_adapter.close()

    @with_timeout()
    async def test_verifier_rejects_wrong_amount(
        self,
        buyer_private_key_b58,
        rpc_url,
        test_usdc_mint_str,
        seller_pubkey,
        buyer_pubkey,
        buyer_usdc_ata,
    ):
        """D3.1: Verifier should reject when expected amount > actual."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.01,
            token="USDC",
        )
        assert pay_result.success

        config = X402Config(
            mode=RunMode.PRODUCTION,
            solana_private_key=buyer_private_key_b58,
            solana_rpc_url=rpc_url,
            usdc_mint_address=test_usdc_mint_str,
        )
        verifier = PaymentVerifier(provider=adapter, config=config)

        proof = X402PaymentProof(
            tx_hash=pay_result.tx_hash,
            chain="solana",
            payer_address=buyer_pubkey,
        )
        auth_header = build_authorization(proof)

        # Expect $1.00 but only $0.01 paid
        result = await verifier.verify(
            authorization=auth_header,
            expected_amount=1.00,
            expected_address=seller_pubkey,
        )
        assert not result.valid, "Should reject: amount too low"
        adapter.close()

    @with_timeout()
    async def test_verifier_rejects_fake_sender(
        self,
        buyer_private_key_b58,
        rpc_url,
        test_usdc_mint_str,
        seller_pubkey,
        buyer_usdc_ata,
    ):
        """D3.2: Verifier should reject when payer_address doesn't match actual sender."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.01,
            token="USDC",
        )
        assert pay_result.success

        config = X402Config(
            mode=RunMode.PRODUCTION,
            solana_private_key=buyer_private_key_b58,
            solana_rpc_url=rpc_url,
            usdc_mint_address=test_usdc_mint_str,
        )
        verifier = PaymentVerifier(provider=adapter, config=config)

        # Claim the seller sent it (lie)
        proof = X402PaymentProof(
            tx_hash=pay_result.tx_hash,
            chain="solana",
            payer_address=seller_pubkey,  # WRONG — buyer actually sent it
        )
        auth_header = build_authorization(proof)

        result = await verifier.verify(
            authorization=auth_header,
            expected_amount=0.01,
            expected_address=seller_pubkey,
        )
        assert not result.valid, "Should reject: sender mismatch"
        adapter.close()


# ---------------------------------------------------------------------------
# D2.8: Replay protection
# ---------------------------------------------------------------------------
class TestReplayProtection:
    """Test that the same tx_hash cannot be reused (gateway-level)."""

    @with_timeout()
    async def test_replay_guard_blocks_reuse(
        self,
        buyer_private_key_b58,
        rpc_url,
        test_usdc_mint_str,
        seller_pubkey,
        buyer_pubkey,
        buyer_usdc_ata,
        tmp_path,
    ):
        """D2.8: Using the same tx_hash twice should be blocked by replay guard."""
        from ag402_core.security.replay_guard import PersistentReplayGuard

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(
            to_address=seller_pubkey,
            amount=0.01,
            token="USDC",
        )
        assert pay_result.success

        # PersistentReplayGuard should accept first use
        db_path = str(tmp_path / "replay_test.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()

        is_new = await guard.check_and_record_tx(pay_result.tx_hash)
        assert is_new, "First use should be accepted"

        # Second use should be rejected
        is_new_again = await guard.check_and_record_tx(pay_result.tx_hash)
        assert not is_new_again, "Replay should be rejected"

        await guard.close()
        adapter.close()
