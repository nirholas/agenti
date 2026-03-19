"""
Tests for agent payment analysis functionality.

These tests verify that the agent can:
1. Parse 402 response payment requirements
2. Analyze payment requirements using the analyze_payment tool
3. Make correct payment decisions based on wallet balance and payment details
"""

import base64
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from agent.tools.payment import analyze_payment


# ============================================================================
# Test Data Fixtures
# ============================================================================

def create_payment_requirement(
    scheme: str = "exact",
    network: str = "base-sepolia",
    amount: str = "0.001",
    currency: str = "ETH",
    recipient: str = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    description: str = "Premium article access",
) -> dict[str, Any]:
    """Create a payment requirement dictionary."""
    return {
        "scheme": scheme,
        "network": network,
        "amount": amount,
        "currency": currency,
        "recipient": recipient,
        "description": description,
    }


def create_402_payment_header(
    uri: str = "/api/premium-article",
    amount: str = "1000",
    scheme: str = "exact",
    network: str = "eip155:84532",
    asset: str = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    pay_to: str = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
) -> str:
    """Create a base64-encoded payment required header."""
    payment_required = {
        "x402Version": 2,
        "error": "Payment required to access this resource",
        "resource": {
            "url": uri,
            "description": f"Protected resource at {uri}",
            "mimeType": "application/json",
        },
        "accepts": [{
            "scheme": scheme,
            "network": network,
            "amount": amount,
            "asset": asset,
            "payTo": pay_to,
            "maxTimeoutSeconds": 60,
        }],
    }
    return base64.b64encode(json.dumps(payment_required).encode()).decode()


# ============================================================================
# Payment Analysis Decision Tests
# ============================================================================

class TestPaymentAnalysisDecisions:
    """Tests for payment analysis decision logic."""

    def test_approve_payment_with_sufficient_balance(self):
        """Test that payment is approved when balance is sufficient."""
        requirement = create_payment_requirement(
            amount="0.001",
            currency="ETH",
            description="Premium article",
        )
        
        result = analyze_payment(
            amount=requirement["amount"],
            currency=requirement["currency"],
            recipient=requirement["recipient"],
            description=requirement["description"],
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is True
        assert result["risk_level"] == "low"

    def test_reject_payment_with_insufficient_balance(self):
        """Test that payment is rejected when balance is insufficient."""
        requirement = create_payment_requirement(
            amount="0.5",
            currency="ETH",
            description="Expensive content",
        )
        
        result = analyze_payment(
            amount=requirement["amount"],
            currency=requirement["currency"],
            recipient=requirement["recipient"],
            description=requirement["description"],
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"
        assert "insufficient" in result["reasoning"].lower()

    def test_reject_payment_exceeding_threshold(self):
        """Test that payment is rejected when amount exceeds demo threshold."""
        requirement = create_payment_requirement(
            amount="0.02",  # Above 0.01 threshold
            currency="ETH",
            description="High-value content",
        )
        
        result = analyze_payment(
            amount=requirement["amount"],
            currency=requirement["currency"],
            recipient=requirement["recipient"],
            description=requirement["description"],
            wallet_balance="1.0",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "medium"
        assert "exceeds" in result["reasoning"].lower()

    def test_reject_payment_with_invalid_recipient(self):
        """Test that payment is rejected for invalid recipient address."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="invalid-address",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"
        assert "invalid" in result["reasoning"].lower()


class TestPaymentAnalysisEdgeCases:
    """Tests for edge cases in payment analysis."""

    def test_exact_balance_equals_amount(self):
        """Test payment when balance exactly equals amount."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Content",
            wallet_balance="0.001",
        )
        
        assert result["should_pay"] is True

    def test_zero_amount_payment(self):
        """Test payment with zero amount (free content)."""
        result = analyze_payment(
            amount="0",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Free content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is True

    def test_very_small_amount(self):
        """Test payment with very small amount."""
        result = analyze_payment(
            amount="0.0001",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Micro-payment content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is True
        assert result["risk_level"] == "low"

    def test_amount_at_threshold_boundary(self):
        """Test payment at exactly the threshold amount (0.01)."""
        result = analyze_payment(
            amount="0.01",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Content at threshold",
            wallet_balance="1.0",
        )
        
        # 0.01 is at threshold, should be approved (> 0.01 check)
        assert result["should_pay"] is True


class TestPaymentAnalysisInputValidation:
    """Tests for input validation in payment analysis."""

    def test_invalid_amount_format(self):
        """Test handling of invalid amount format."""
        result = analyze_payment(
            amount="not-a-number",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"

    def test_invalid_balance_format(self):
        """Test handling of invalid balance format."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Content",
            wallet_balance="invalid",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"

    def test_recipient_address_too_short(self):
        """Test rejection of recipient address that is too short."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x1234",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"

    def test_recipient_address_missing_0x_prefix(self):
        """Test rejection of recipient address without 0x prefix."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"


class TestPaymentAnalysisWithParsed402Response:
    """Tests for payment analysis using parsed 402 response data."""

    def test_analyze_payment_from_402_header(self):
        """Test analyzing payment from a parsed 402 response header."""
        # Create a 402 header
        header = create_402_payment_header(
            uri="/api/premium-article",
            amount="1000",  # In atomic units
            pay_to="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        )
        
        # Parse the header
        payment_data = json.loads(base64.b64decode(header))
        requirement = payment_data["accepts"][0]
        
        # Convert atomic units to ETH for analysis (1000 wei = 0.000000000000001 ETH)
        amount_eth = str(int(requirement["amount"]) / 1e18)
        
        result = analyze_payment(
            amount=amount_eth,
            currency="ETH",
            recipient=requirement["payTo"],
            description=f"Content at {payment_data['resource']['url']}",
            wallet_balance="0.1",
        )
        
        # Very small amount should be approved
        assert result["should_pay"] is True

    def test_analyze_multiple_payment_options(self):
        """Test analyzing when multiple payment options are available."""
        # Simulate a 402 response with multiple payment options
        payment_options = [
            {"amount": "0.001", "currency": "ETH"},
            {"amount": "0.005", "currency": "ETH"},
            {"amount": "0.01", "currency": "ETH"},
        ]
        
        wallet_balance = "0.008"
        recipient = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        
        # Find the best option (highest amount that can be afforded)
        affordable_options = []
        for option in payment_options:
            result = analyze_payment(
                amount=option["amount"],
                currency=option["currency"],
                recipient=recipient,
                description="Content",
                wallet_balance=wallet_balance,
            )
            if result["should_pay"]:
                affordable_options.append(option)
        
        # Should be able to afford the first two options
        assert len(affordable_options) == 2
        assert affordable_options[0]["amount"] == "0.001"
        assert affordable_options[1]["amount"] == "0.005"


class TestPaymentAnalysisReasoningOutput:
    """Tests for payment analysis reasoning output."""

    def test_approval_reasoning_includes_amount(self):
        """Test that approval reasoning includes the payment amount."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Premium article",
            wallet_balance="0.1",
        )
        
        assert "0.001" in result["reasoning"]
        assert "ETH" in result["reasoning"]

    def test_rejection_reasoning_explains_cause(self):
        """Test that rejection reasoning explains the cause."""
        result = analyze_payment(
            amount="0.5",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        # Reasoning should mention the balance issue
        assert "0.1" in result["reasoning"] or "insufficient" in result["reasoning"].lower()

    def test_reasoning_includes_description(self):
        """Test that approval reasoning includes the content description."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            description="Premium research report",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is True
        assert "Premium research report" in result["reasoning"]
