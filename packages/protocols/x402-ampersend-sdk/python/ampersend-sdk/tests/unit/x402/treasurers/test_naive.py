"""Unit tests for NaiveTreasurer."""

from unittest.mock import MagicMock

import pytest
from ampersend_sdk.x402 import X402Wallet
from ampersend_sdk.x402.treasurers import (
    NaiveTreasurer,
)


@pytest.mark.asyncio
class TestNaiveTreasurer:
    """Test NaiveTreasurer."""

    async def test_onPaymentRequired(self) -> None:
        mock_wallet = MagicMock(spec=X402Wallet)
        mock_wallet.create_payment.return_value = MagicMock(name="PaymentPayload")

        treasurer = NaiveTreasurer(wallet=mock_wallet)

        # Mock payment required response
        mock_payment_required = MagicMock(name="x402PaymentRequiredResponse")
        mock_payment_required.accepts = [
            MagicMock(
                scheme="exact",
                pay_to="0x9876543210987654321098765432109876543210",
                asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                max_amount_required="1000000",
                max_timeout_seconds=3600,
                network="base-sepolia",
                extra={"version": "2", "name": "USDC"},
            )
        ]

        # Should not raise any errors
        result = await treasurer.onPaymentRequired(mock_payment_required)
        assert result is not None

    async def test_onStatus_is_noop(self) -> None:
        """Test that onStatus does nothing for naive treasurer."""
        mock_wallet = MagicMock(spec=X402Wallet)
        mock_wallet.create_payment.return_value = MagicMock(name="PaymentPayload")

        treasurer = NaiveTreasurer(wallet=mock_wallet)

        # Should not raise any errors
        await treasurer.onStatus(
            status=MagicMock(),
            authorization=MagicMock(authorization_id="test-id", payment=MagicMock()),
            context=None,
        )
