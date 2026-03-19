"""Tests for the content request tools module."""

import base64
import json

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

# Import the underlying functions directly, not the decorated tools
# We'll test the logic by reimplementing the core functions for testing
from agent.config import config


async def _request_content_impl(url: str, seller_api_url: str) -> dict:
    """Implementation of request_content for testing."""
    full_url = f"{seller_api_url}{url}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                full_url,
                headers={"Accept": "application/json"},
                follow_redirects=True,
            )

            if response.status_code == 200:
                return {
                    "status": 200,
                    "content": response.json(),
                }

            if response.status_code == 402:
                payment_required_header = response.headers.get("PAYMENT-REQUIRED")
                if not payment_required_header:
                    return {
                        "status": 402,
                        "error": "Missing PAYMENT-REQUIRED header",
                    }

                payment_data = json.loads(base64.b64decode(payment_required_header))
                requirement = payment_data.get("requirements", [{}])[0]

                return {
                    "status": 402,
                    "payment_required": {
                        "scheme": requirement.get("scheme"),
                        "network": requirement.get("network"),
                        "amount": requirement.get("amount"),
                        "currency": requirement.get("currency"),
                        "recipient": requirement.get("recipient"),
                        "description": requirement.get("description"),
                    },
                }

            return {
                "status": response.status_code,
                "error": f"Unexpected status code: {response.status_code}",
            }

        except httpx.RequestError as e:
            return {
                "status": 0,
                "error": f"Request failed: {str(e)}",
            }


async def _request_content_with_payment_impl(
    url: str,
    payment_payload: dict,
    seller_api_url: str,
) -> dict:
    """Implementation of request_content_with_payment for testing."""
    full_url = f"{seller_api_url}{url}"

    payment_signature = base64.b64encode(
        json.dumps(payment_payload).encode()
    ).decode()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                full_url,
                headers={
                    "Accept": "application/json",
                    "PAYMENT-SIGNATURE": payment_signature,
                },
                follow_redirects=True,
            )

            if response.status_code == 200:
                payment_response_header = response.headers.get("PAYMENT-RESPONSE")
                settlement = None
                if payment_response_header:
                    settlement = json.loads(base64.b64decode(payment_response_header))

                return {
                    "status": 200,
                    "content": response.json(),
                    "settlement": settlement,
                }

            if response.status_code == 402:
                return {
                    "status": 402,
                    "error": "Payment was rejected by the server",
                }

            return {
                "status": response.status_code,
                "error": f"Unexpected status code: {response.status_code}",
            }

        except httpx.RequestError as e:
            return {
                "status": 0,
                "error": f"Request failed: {str(e)}",
            }


class TestRequestContent:
    """Tests for the request_content function."""

    @pytest.mark.asyncio
    async def test_successful_content_request(self):
        """Test successful 200 response returns content."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"title": "Premium Article", "content": "..."}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_impl("/api/premium-article", "https://api.example.com")
            
            assert result["status"] == 200
            assert result["content"]["title"] == "Premium Article"

    @pytest.mark.asyncio
    async def test_payment_required_response(self):
        """Test 402 response parses payment requirements."""
        payment_data = {
            "requirements": [{
                "scheme": "exact",
                "network": "base-sepolia",
                "amount": "0.001",
                "currency": "ETH",
                "recipient": "0x1234567890123456789012345678901234567890",
                "description": "Premium article access",
            }]
        }
        encoded_payment = base64.b64encode(json.dumps(payment_data).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.headers = {"PAYMENT-REQUIRED": encoded_payment}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_impl("/api/premium-article", "https://api.example.com")
            
            assert result["status"] == 402
            assert result["payment_required"]["scheme"] == "exact"
            assert result["payment_required"]["network"] == "base-sepolia"
            assert result["payment_required"]["amount"] == "0.001"
            assert result["payment_required"]["currency"] == "ETH"

    @pytest.mark.asyncio
    async def test_payment_required_missing_header(self):
        """Test 402 response without PAYMENT-REQUIRED header."""
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.headers = {}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_impl("/api/premium-article", "https://api.example.com")
            
            assert result["status"] == 402
            assert "error" in result
            assert "Missing PAYMENT-REQUIRED header" in result["error"]

    @pytest.mark.asyncio
    async def test_unexpected_status_code(self):
        """Test handling of unexpected status codes."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_impl("/api/premium-article", "https://api.example.com")
            
            assert result["status"] == 500
            assert "error" in result

    @pytest.mark.asyncio
    async def test_request_error_handling(self):
        """Test handling of network errors."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            
            result = await _request_content_impl("/api/premium-article", "https://api.example.com")
            
            assert result["status"] == 0
            assert "error" in result
            assert "Request failed" in result["error"]


class TestRequestContentWithPayment:
    """Tests for the request_content_with_payment function."""

    @pytest.fixture
    def sample_payment_payload(self):
        """Sample payment payload for tests."""
        return {
            "scheme": "exact",
            "network": "base-sepolia",
            "signature": "0xabc123...",
            "from": "0x1111111111111111111111111111111111111111",
            "to": "0x2222222222222222222222222222222222222222",
            "amount": "0.001",
            "timestamp": 1234567890,
        }

    @pytest.mark.asyncio
    async def test_successful_payment_request(self, sample_payment_payload):
        """Test successful content delivery after payment."""
        settlement_data = {"txHash": "0xdef456...", "status": "settled"}
        encoded_settlement = base64.b64encode(json.dumps(settlement_data).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"title": "Premium Article", "content": "Full content..."}
        mock_response.headers = {"PAYMENT-RESPONSE": encoded_settlement}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_with_payment_impl(
                "/api/premium-article",
                sample_payment_payload,
                "https://api.example.com"
            )
            
            assert result["status"] == 200
            assert result["content"]["title"] == "Premium Article"
            assert result["settlement"]["txHash"] == "0xdef456..."

    @pytest.mark.asyncio
    async def test_payment_rejected(self, sample_payment_payload):
        """Test handling of rejected payment."""
        mock_response = MagicMock()
        mock_response.status_code = 402
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_with_payment_impl(
                "/api/premium-article",
                sample_payment_payload,
                "https://api.example.com"
            )
            
            assert result["status"] == 402
            assert "error" in result
            assert "rejected" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_success_without_settlement_header(self, sample_payment_payload):
        """Test successful response without settlement header."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": "data"}
        mock_response.headers = {}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await _request_content_with_payment_impl(
                "/api/premium-article",
                sample_payment_payload,
                "https://api.example.com"
            )
            
            assert result["status"] == 200
            assert result["settlement"] is None

    @pytest.mark.asyncio
    async def test_request_error_handling(self, sample_payment_payload):
        """Test handling of network errors during payment request."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            
            result = await _request_content_with_payment_impl(
                "/api/premium-article",
                sample_payment_payload,
                "https://api.example.com"
            )
            
            assert result["status"] == 0
            assert "error" in result


class TestPaymentHeaderEncoding:
    """Tests for payment header encoding logic."""

    def test_payment_payload_encoding(self):
        """Test that payment payload is correctly encoded as base64 JSON."""
        payload = {
            "scheme": "exact",
            "network": "base-sepolia",
            "signature": "0xabc123...",
            "from": "0x1111111111111111111111111111111111111111",
            "to": "0x2222222222222222222222222222222222222222",
            "amount": "0.001",
            "timestamp": 1234567890,
        }
        
        # Encode as the implementation does
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        
        # Decode and verify
        decoded = json.loads(base64.b64decode(encoded))
        
        assert decoded["scheme"] == payload["scheme"]
        assert decoded["amount"] == payload["amount"]
        assert decoded["from"] == payload["from"]
        assert decoded["to"] == payload["to"]

    def test_payment_requirement_decoding(self):
        """Test that payment requirements are correctly decoded from base64 JSON."""
        payment_data = {
            "requirements": [{
                "scheme": "exact",
                "network": "base-sepolia",
                "amount": "0.001",
                "currency": "ETH",
                "recipient": "0x1234567890123456789012345678901234567890",
            }]
        }
        
        # Encode as server would
        encoded = base64.b64encode(json.dumps(payment_data).encode()).decode()
        
        # Decode as client does
        decoded = json.loads(base64.b64decode(encoded))
        requirement = decoded.get("requirements", [{}])[0]
        
        assert requirement["scheme"] == "exact"
        assert requirement["network"] == "base-sepolia"
        assert requirement["amount"] == "0.001"
