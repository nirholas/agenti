"""Tests for the payment gateway auth (server side) -- PaymentVerifier only.

Gateway integration tests (X402Gateway) will be in the adapter package (Phase 3).
"""

from __future__ import annotations

import pytest
from ag402_core.gateway.auth import PaymentVerifier
from ag402_core.payment.solana_adapter import MockSolanaAdapter

# ---------------------------------------------------------------------------
# Test: PaymentVerifier with provider
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verifier_with_provider() -> None:
    """PaymentVerifier with a provider should call verify_payment.

    S1-3: Must use a tx_hash actually issued by the provider's .pay() method,
    since arbitrary mock_tx_ prefixed hashes are no longer accepted.
    """
    provider = MockSolanaAdapter()
    # Create a real payment so the tx_hash is recorded
    pay_result = await provider.pay("RecipientAddr", 0.01, "USDC")
    verifier = PaymentVerifier(provider=provider)

    result = await verifier.verify(f"x402 {pay_result.tx_hash}")
    assert result.valid is True
    assert result.tx_hash == pay_result.tx_hash


@pytest.mark.asyncio
async def test_verifier_without_provider() -> None:
    """PaymentVerifier without provider (test mode) should accept any x402 proof."""
    verifier = PaymentVerifier()

    result = await verifier.verify("x402 any_tx_hash_here")
    assert result.valid is True
    assert result.tx_hash == "any_tx_hash_here"


@pytest.mark.asyncio
async def test_verifier_rejects_bad_format() -> None:
    """PaymentVerifier should reject non-x402 authorization."""
    verifier = PaymentVerifier()

    result = await verifier.verify("Bearer some-token")
    assert result.valid is False
    assert "format" in result.error.lower()

    result2 = await verifier.verify("")
    assert result2.valid is False
