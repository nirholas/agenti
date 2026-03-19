"""
Tests for payment signing functionality.

These tests verify that the sign_payment tool:
1. Creates properly structured payment payloads for x402 v2
2. Signs messages using EIP-712 typed data
3. Handles errors gracefully
4. Returns correct payload format for x402 v2 protocol
"""

import json
import time
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# ============================================================================
# Test Data Fixtures
# ============================================================================

MOCK_WALLET_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
MOCK_RECIPIENT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_SIGNATURE = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
MOCK_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"


def create_mock_wallet_provider(
    address: str = MOCK_WALLET_ADDRESS,
    signature: str = MOCK_SIGNATURE,
) -> MagicMock:
    """Create a mock wallet provider for testing."""
    mock_provider = MagicMock()
    mock_provider.get_address.return_value = address
    mock_provider.sign_message.return_value = signature
    mock_provider.sign_typed_data.return_value = signature
    return mock_provider


# ============================================================================
# Payment Signing Tests
# ============================================================================

class TestSignPaymentPayloadStructure:
    """Tests for the structure of signed payment payloads."""

    def test_sign_payment_returns_success_with_valid_inputs(self):
        """Test that sign_payment returns success with valid inputs."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",  # atomic units
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert "payload" in result

    def test_sign_payment_payload_contains_x402_version(self):
        """Test that signed payload contains x402 version 2."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["payload"]["x402Version"] == 2

    def test_sign_payment_payload_contains_accepted_field(self):
        """Test that signed payload contains the accepted field with payment requirements."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            accepted = result["payload"]["accepted"]
            assert accepted["scheme"] == "exact"
            assert "network" in accepted
            assert accepted["amount"] == "1000"
            assert accepted["payTo"] == MOCK_RECIPIENT_ADDRESS

    def test_sign_payment_payload_contains_signature(self):
        """Test that signed payload contains a signature in the payload field."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert "payload" in result["payload"]
            assert "signature" in result["payload"]["payload"]
            assert result["payload"]["payload"]["signature"] == MOCK_SIGNATURE

    def test_sign_payment_payload_contains_authorization(self):
        """Test that signed payload contains authorization details."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            auth = result["payload"]["payload"]["authorization"]
            assert auth["from"] == MOCK_WALLET_ADDRESS
            assert auth["to"] == MOCK_RECIPIENT_ADDRESS
            assert auth["value"] == "1000"
            assert "validAfter" in auth
            assert "validBefore" in auth
            assert "nonce" in auth


class TestSignPaymentMessageSigning:
    """Tests for the message signing process."""

    def test_sign_payment_calls_wallet_sign_typed_data(self):
        """Test that sign_payment calls the wallet's sign_typed_data method."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            mock_provider.sign_typed_data.assert_called_once()

    def test_sign_payment_typed_data_has_eip712_structure(self):
        """Test that the typed data has proper EIP-712 structure."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            # Get the typed data that was signed
            call_args = mock_provider.sign_typed_data.call_args
            typed_data = call_args[0][0]
            
            # Should have EIP-712 structure
            assert "types" in typed_data
            assert "primaryType" in typed_data
            assert "domain" in typed_data
            assert "message" in typed_data
            assert typed_data["primaryType"] == "TransferWithAuthorization"

    def test_sign_payment_falls_back_to_sign_message(self):
        """Test that sign_payment falls back to sign_message if sign_typed_data fails."""
        mock_provider = create_mock_wallet_provider()
        mock_provider.sign_typed_data.side_effect = AttributeError("No sign_typed_data")
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            mock_provider.sign_message.assert_called_once()


class TestSignPaymentErrorHandling:
    """Tests for error handling in sign_payment."""

    def test_sign_payment_handles_wallet_error(self):
        """Test that sign_payment handles wallet provider errors gracefully."""
        mock_provider = MagicMock()
        mock_provider.get_address.side_effect = Exception("Wallet connection failed")
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is False
            assert "error" in result

    def test_sign_payment_handles_signing_error(self):
        """Test that sign_payment handles signing errors gracefully."""
        mock_provider = MagicMock()
        mock_provider.get_address.return_value = MOCK_WALLET_ADDRESS
        mock_provider.sign_typed_data.side_effect = Exception("Signing failed")
        mock_provider.sign_message.side_effect = Exception("Signing failed")
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is False
            assert "error" in result
            assert "Signing failed" in result["error"]

    def test_sign_payment_handles_unsupported_network(self):
        """Test that sign_payment handles unsupported networks."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="unsupported-network",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is False
            assert "error" in result
            assert "Unsupported network" in result["error"]


class TestSignPaymentWithDifferentSchemes:
    """Tests for sign_payment with different payment schemes."""

    def test_sign_payment_with_exact_scheme(self):
        """Test signing payment with 'exact' scheme."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert result["payload"]["accepted"]["scheme"] == "exact"

    def test_sign_payment_with_upto_scheme(self):
        """Test signing payment with 'upto' scheme."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="upto",
                network="base-sepolia",
                amount="5000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert result["payload"]["accepted"]["scheme"] == "upto"


class TestSignPaymentWithDifferentNetworks:
    """Tests for sign_payment with different networks."""

    def test_sign_payment_with_base_sepolia(self):
        """Test signing payment on base-sepolia network."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert "84532" in result["payload"]["accepted"]["network"]

    def test_sign_payment_with_caip2_format(self):
        """Test signing payment with CAIP-2 network format."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="eip155:84532",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert result["payload"]["accepted"]["network"] == "eip155:84532"


class TestSignPaymentWithDifferentAmounts:
    """Tests for sign_payment with different payment amounts."""

    def test_sign_payment_with_small_amount(self):
        """Test signing payment with a small amount."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="100",  # 0.0001 USDC
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert result["payload"]["accepted"]["amount"] == "100"

    def test_sign_payment_with_larger_amount(self):
        """Test signing payment with a larger amount."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="10000",  # 0.01 USDC
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert result["payload"]["accepted"]["amount"] == "10000"

    def test_sign_payment_with_zero_amount(self):
        """Test signing payment with zero amount (free content)."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="0",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            assert result["success"] is True
            assert result["payload"]["accepted"]["amount"] == "0"


class TestSignPaymentX402Compatibility:
    """Tests for x402 v2 protocol compatibility of signed payments."""

    def test_signed_payload_is_x402_v2_compatible(self):
        """Test that the signed payload is compatible with x402 v2 protocol."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            payload = result["payload"]
            
            # x402 v2 required fields
            assert payload["x402Version"] == 2
            assert "accepted" in payload
            assert "payload" in payload
            
            # accepted field structure
            accepted = payload["accepted"]
            assert "scheme" in accepted
            assert "network" in accepted
            assert "amount" in accepted
            assert "payTo" in accepted
            assert "asset" in accepted
            
            # payload field structure
            inner_payload = payload["payload"]
            assert "signature" in inner_payload
            assert "authorization" in inner_payload

    def test_signed_payload_addresses_are_valid_ethereum(self):
        """Test that addresses in payload are valid Ethereum addresses."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            auth = result["payload"]["payload"]["authorization"]
            
            # Validate from address format
            assert auth["from"].startswith("0x")
            assert len(auth["from"]) == 42
            
            # Validate to address format
            assert auth["to"].startswith("0x")
            assert len(auth["to"]) == 42

    def test_signed_payload_has_valid_time_window(self):
        """Test that authorization has valid time window."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            before_time = int(time.time())
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            after_time = int(time.time())
            
            auth = result["payload"]["payload"]["authorization"]
            valid_after = int(auth["validAfter"])
            valid_before = int(auth["validBefore"])
            
            # validAfter should be slightly before current time
            assert valid_after <= before_time
            
            # validBefore should be in the future
            assert valid_before > after_time

    def test_signed_payload_has_hex_nonce(self):
        """Test that authorization nonce is a hex string."""
        mock_provider = create_mock_wallet_provider()
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            from agent.tools.payment import sign_payment
            
            result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",
                recipient=MOCK_RECIPIENT_ADDRESS,
            )
            
            nonce = result["payload"]["payload"]["authorization"]["nonce"]
            
            # Nonce should be a hex string starting with 0x
            assert nonce.startswith("0x")
            # 32 bytes = 64 hex chars + 2 for "0x"
            assert len(nonce) == 66
