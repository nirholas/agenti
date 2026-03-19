"""Unit tests for API response models."""

from ampersend_sdk.ampersend.types import (
    ApiResponseAgentPaymentAuthorization,
    ApiResponseAgentPaymentEvent,
    AuthorizedRequirement,
    AuthorizedResponse,
    RejectedRequirement,
)
from x402.types import PaymentRequirements


class TestApiResponseAgentPaymentAuth:
    """Test ApiResponseAgentPaymentAuthorization model."""

    def test_successful_authorization_with_limits(self) -> None:
        """Test successful authorization response with limits."""
        # Create valid requirement
        requirement = PaymentRequirements(
            scheme="exact",
            network="base",
            max_amount_required="1000000",
            resource="test-resource",
            description="Test payment",
            mime_type="application/json",
            pay_to="0x9876543210987654321098765432109876543210",
            max_timeout_seconds=300,
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        )

        response = ApiResponseAgentPaymentAuthorization(
            authorized=AuthorizedResponse(
                recommended=0,
                requirements=[
                    AuthorizedRequirement(
                        requirement=requirement,
                        limits={
                            "dailyRemaining": "1000000000000000000",
                            "monthlyRemaining": "30000000000000000000",
                        },
                    )
                ],
            ),
            rejected=[],
        )

        assert len(response.authorized.requirements) == 1
        assert response.authorized.recommended == 0
        assert len(response.rejected) == 0
        assert (
            response.authorized.requirements[0].limits["dailyRemaining"]
            == "1000000000000000000"
        )
        assert (
            response.authorized.requirements[0].limits["monthlyRemaining"]
            == "30000000000000000000"
        )

    def test_denied_authorization_with_reason(self) -> None:
        """Test denied authorization response with reason."""
        # Create valid requirement
        requirement = PaymentRequirements(
            scheme="exact",
            network="base",
            max_amount_required="1000000",
            resource="test-resource",
            description="Test payment",
            mime_type="application/json",
            pay_to="0x9876543210987654321098765432109876543210",
            max_timeout_seconds=300,
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        )

        response = ApiResponseAgentPaymentAuthorization(
            authorized=AuthorizedResponse(recommended=None, requirements=[]),
            rejected=[
                RejectedRequirement(
                    requirement=requirement, reason="Daily spend limit exceeded"
                )
            ],
        )

        assert len(response.authorized.requirements) == 0
        assert response.authorized.recommended is None
        assert len(response.rejected) == 1
        assert response.rejected[0].reason == "Daily spend limit exceeded"

    def test_multiple_requirements_partial_auth(self) -> None:
        """Test partial authorization with multiple requirements."""
        # Create valid requirements
        req1 = PaymentRequirements(
            scheme="exact",
            network="base",
            max_amount_required="100000",
            resource="resource1",
            description="Test 1",
            mime_type="application/json",
            pay_to="0x1111111111111111111111111111111111111111",
            max_timeout_seconds=300,
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        )
        req2 = PaymentRequirements(
            scheme="exact",
            network="base",
            max_amount_required="200000",
            resource="resource2",
            description="Test 2",
            mime_type="application/json",
            pay_to="0x2222222222222222222222222222222222222222",
            max_timeout_seconds=300,
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        )
        req3 = PaymentRequirements(
            scheme="exact",
            network="base",
            max_amount_required="999999999",
            resource="resource3",
            description="Test 3",
            mime_type="application/json",
            pay_to="0x3333333333333333333333333333333333333333",
            max_timeout_seconds=300,
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        )

        response = ApiResponseAgentPaymentAuthorization(
            authorized=AuthorizedResponse(
                recommended=0,  # Cheapest one (req1)
                requirements=[
                    AuthorizedRequirement(
                        requirement=req1,
                        limits={
                            "dailyRemaining": "900000",
                            "monthlyRemaining": "9900000",
                        },
                    ),
                    AuthorizedRequirement(
                        requirement=req2,
                        limits={
                            "dailyRemaining": "800000",
                            "monthlyRemaining": "9800000",
                        },
                    ),
                ],
            ),
            rejected=[RejectedRequirement(requirement=req3, reason="Amount too high")],
        )

        assert len(response.authorized.requirements) == 2
        assert response.authorized.recommended == 0
        assert len(response.rejected) == 1
        assert response.rejected[0].reason == "Amount too high"

    def test_camel_case_parsing(self) -> None:
        """Test parsing with camelCase field names from JSON."""
        data = {
            "authorized": {
                "recommended": 0,
                "requirements": [
                    {
                        "requirement": {
                            "scheme": "exact",
                            "network": "base",
                            "maxAmountRequired": "500000000000000000",
                            "resource": "test",
                            "description": "Test",
                            "mimeType": "application/json",
                            "payTo": "0x1234567890123456789012345678901234567890",
                            "maxTimeoutSeconds": 300,
                            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                        },
                        "limits": {
                            "dailyRemaining": "500000000000000000",
                            "monthlyRemaining": "15000000000000000000",
                        },
                    }
                ],
            },
            "rejected": [],
        }

        response = ApiResponseAgentPaymentAuthorization.model_validate(data)

        assert len(response.authorized.requirements) == 1
        assert response.authorized.recommended == 0
        assert (
            response.authorized.requirements[0].limits["dailyRemaining"]
            == "500000000000000000"
        )


class TestApiResponseAgentPaymentEvent:
    """Test ApiResponseAgentPaymentEvent model."""

    def test_event_received_with_payment_id(self) -> None:
        """Test event response with payment ID."""
        data = {"received": True, "paymentId": "payment_12345"}

        response = ApiResponseAgentPaymentEvent.model_validate(data)

        assert response.received is True
        assert response.payment_id == "payment_12345"

    def test_event_received_without_payment_id(self) -> None:
        """Test event response without payment ID."""

        response = ApiResponseAgentPaymentEvent(received=True)

        assert response.received is True
        assert response.payment_id is None

    def test_event_not_received(self) -> None:
        """Test event not received response."""
        response = ApiResponseAgentPaymentEvent(received=False)

        assert response.received is False
        assert response.payment_id is None

    def test_snake_case_parsing(self) -> None:
        """Test parsing with snake_case field names."""
        data = {"received": True, "payment_id": "payment_67890"}

        response = ApiResponseAgentPaymentEvent.model_validate(data)

        assert response.received is True
        assert response.payment_id == "payment_67890"

    def test_camel_case_parsing(self) -> None:
        """Test parsing with camelCase field names."""
        data = {"received": True, "paymentId": "payment_camel_case"}

        response = ApiResponseAgentPaymentEvent.model_validate(data)

        assert response.received is True
        assert response.payment_id == "payment_camel_case"
