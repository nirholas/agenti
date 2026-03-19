"""Unit tests for Ampersend treasurer."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from ampersend_sdk.ampersend import AmpersendTreasurer, ApiClient
from ampersend_sdk.ampersend.types import (
    ApiResponseAgentPaymentAuthorization,
    AuthorizedRequirement,
    AuthorizedResponse,
    RejectedRequirement,
)
from ampersend_sdk.x402 import X402Authorization, X402Wallet
from x402.types import PaymentRequirements
from x402_a2a.types import PaymentStatus


@pytest.mark.asyncio
class TestAmpersendTreasurer:
    """Test AmpersendTreasurer."""

    async def test_authorize_payment(self) -> None:
        """Test authorizing a payment with API checks."""
        # Mocks
        api_client = AsyncMock(spec=ApiClient)

        # Create valid payment requirement
        requirement = PaymentRequirements(
            scheme="exact",
            network="base-sepolia",
            max_amount_required="1000000",
            resource="test-resource",
            description="Test payment",
            mime_type="application/json",
            pay_to="0x9876543210987654321098765432109876543210",
            max_timeout_seconds=3600,
            asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            extra={"version": "2", "name": "USDC"},
        )

        api_client.authorize_payment = AsyncMock(
            return_value=ApiResponseAgentPaymentAuthorization(
                authorized=AuthorizedResponse(
                    recommended=0,
                    requirements=[
                        AuthorizedRequirement(
                            requirement=requirement,
                            limits={
                                "dailyRemaining": "900000000",
                                "monthlyRemaining": "9900000000",
                            },
                        )
                    ],
                ),
                rejected=[],
            )
        )
        api_client.report_payment_event = AsyncMock()

        mock_wallet = MagicMock(spec=X402Wallet)
        mock_wallet.create_payment.return_value = MagicMock(name="PaymentPayload")

        # Create authorizer
        authorizer = AmpersendTreasurer(
            api_client=api_client,
            wallet=mock_wallet,
        )

        # Mock payment required response
        payment_required = MagicMock()
        payment_required.accepts = [requirement]

        # Authorize payment
        result = await authorizer.onPaymentRequired(payment_required)
        assert result is not None

        # Verify API client was called
        api_client.authorize_payment.assert_called_once()
        api_client.report_payment_event.assert_called_once()

    async def test_authorize_payment_rejected(self) -> None:
        """Test when API rejects authorization."""
        api_client = AsyncMock(spec=ApiClient)

        # Create valid requirement that will be rejected
        requirement = PaymentRequirements(
            scheme="exact",
            network="base",
            max_amount_required="1000000",
            resource="test-resource",
            description="Test payment",
            mime_type="application/json",
            pay_to="0x9876543210987654321098765432109876543210",
            max_timeout_seconds=3600,
            asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        )

        api_client.authorize_payment = AsyncMock(
            return_value=ApiResponseAgentPaymentAuthorization(
                authorized=AuthorizedResponse(recommended=None, requirements=[]),
                rejected=[
                    RejectedRequirement(
                        requirement=requirement, reason="Insufficient funds"
                    )
                ],
            )
        )

        mock_wallet = MagicMock(spec=X402Wallet)
        mock_wallet.create_payment.return_value = MagicMock(name="PaymentPayload")

        authorizer = AmpersendTreasurer(
            api_client=api_client,
            wallet=mock_wallet,
        )

        payment_required = MagicMock()
        payment_required.accepts = [requirement]

        result = await authorizer.onPaymentRequired(payment_required)

        assert result is None

        # API was called but payment was not reported
        api_client.authorize_payment.assert_called_once()
        api_client.report_payment_event.assert_not_called()

    async def test_onStatus_reports_event(self) -> None:
        """Test that onStatus reports payment events."""
        # Mock API client
        api_client = AsyncMock(spec=ApiClient)
        api_client.report_payment_event = AsyncMock()

        mock_wallet = MagicMock(spec=X402Wallet)
        mock_wallet.create_payment.return_value = MagicMock(name="PaymentPayload")

        authorizer = AmpersendTreasurer(
            api_client=api_client,
            wallet=mock_wallet,
        )

        # Mock payment status
        payment = MagicMock()
        auth_id = "test-auth-id"

        # Test payment verified status
        await authorizer.onStatus(
            status=PaymentStatus.PAYMENT_VERIFIED,
            authorization=X402Authorization(
                authorization_id=auth_id,
                payment=payment,
                selected_requirement=MagicMock(),
            ),
            context={"test": "data"},
        )

        # Should report event
        api_client.report_payment_event.assert_called_once()
        call_args = api_client.report_payment_event.call_args
        assert call_args[1]["event_id"] == auth_id
        assert call_args[1]["payment"] == payment
        assert call_args[1]["event"].type == "accepted"
