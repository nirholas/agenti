"""
End-to-End Local-Validator Integration Test

Tests the full flow: Buyer → Gateway (x402) → Seller
Using real SPL Token transfers on solana-test-validator.

Run with:
    # Terminal 1: start validator
    solana-test-validator --reset

    # Terminal 2: run tests
    cd core && python -m pytest tests/test_localnet_e2e.py -v -s --timeout=60
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
# D2.1: Gateway 402 challenge generation
# ---------------------------------------------------------------------------
class TestGatewayChallenge:

    def test_build_challenge(self, seller_pubkey, test_usdc_mint_str):
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

    @with_timeout()
    async def test_verifier_accepts_real_payment(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_pubkey, buyer_usdc_ata,
    ):
        """PaymentVerifier accepts a real on-chain payment proof."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(to_address=seller_pubkey, amount=0.01, token="USDC")
        assert pay_result.success, f"Payment failed: {pay_result.error}"

        verifier_adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
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

        proof = X402PaymentProof(
            tx_hash=pay_result.tx_hash,
            chain="solana",
            payer_address=buyer_pubkey,
        )
        auth_header = build_authorization(proof)

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
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_pubkey, buyer_usdc_ata,
    ):
        """Verifier rejects when expected amount > actual."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(to_address=seller_pubkey, amount=0.01, token="USDC")
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

        result = await verifier.verify(
            authorization=auth_header,
            expected_amount=1.00,
            expected_address=seller_pubkey,
        )
        assert not result.valid, "Should reject: amount too low"
        adapter.close()

    @with_timeout()
    async def test_verifier_rejects_fake_sender(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_usdc_ata,
    ):
        """Verifier rejects when payer_address doesn't match actual sender."""
        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(to_address=seller_pubkey, amount=0.01, token="USDC")
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
            payer_address=seller_pubkey,  # WRONG sender
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

    @with_timeout()
    async def test_replay_guard_blocks_reuse(
        self, buyer_private_key_b58, rpc_url, test_usdc_mint_str,
        seller_pubkey, buyer_pubkey, buyer_usdc_ata, tmp_path,
    ):
        """Same tx_hash twice is blocked by replay guard."""
        from ag402_core.security.replay_guard import PersistentReplayGuard

        adapter = SolanaAdapter(
            private_key=buyer_private_key_b58,
            rpc_url=rpc_url,
            usdc_mint=test_usdc_mint_str,
        )
        pay_result = await adapter.pay(to_address=seller_pubkey, amount=0.01, token="USDC")
        assert pay_result.success

        db_path = str(tmp_path / "replay_test.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()

        is_new = await guard.check_and_record_tx(pay_result.tx_hash)
        assert is_new, "First use should be accepted"

        is_new_again = await guard.check_and_record_tx(pay_result.tx_hash)
        assert not is_new_again, "Replay should be rejected"

        await guard.close()
        adapter.close()
