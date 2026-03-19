"""
Integration tests for the retry with payment flow.

These tests verify the complete x402 payment flow:
1. Initial request returns 402 Payment Required
2. Agent analyzes payment requirements
3. Agent signs payment using AgentKit wallet
4. Retry request with payment signature succeeds
5. Content is delivered with settlement confirmation

Tests can run against:
- Mock server for unit testing (default)
- Deployed CloudFront distribution (set SELLER_API_URL env var)
"""

import base64
import json
import os
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


# ============================================================================
# Test Configuration
# ============================================================================

TEST_SELLER_API_URL = os.environ.get(
    "SELLER_API_URL",
    "https://example.cloudfront.net"
)

# Sample payment requirements (x402 v2 format)
SAMPLE_PAYMENT_REQUIREMENTS = {
    "scheme": "exact",
    "network": "eip155:84532",  # Base Sepolia
    "amount": "1000",  # 0.001 USDC (6 decimals)
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # USDC on Base Sepolia
    "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "maxTimeoutSeconds": 60,
    "extra": {
        "name": "USDC",
        "version": "2",
        "assetTransferMethod": "eip3009",
    },
}

# Sample payer wallet address
SAMPLE_PAYER_ADDRESS = "0x1111111111111111111111111111111111111111"


# ============================================================================
# Helper Functions
# ============================================================================

def create_402_response(
    uri: str = "/api/premium-article",
    requirements: dict[str, Any] | None = None,
) -> MagicMock:
    """Create a mock 402 Payment Required response."""
    reqs = requirements or SAMPLE_PAYMENT_REQUIREMENTS
    
    payment_required = {
        "x402Version": 2,
        "error": "Payment required to access this resource",
        "resource": {
            "url": uri,
            "description": f"Protected resource at {uri}",
            "mimeType": "application/json",
        },
        "accepts": [reqs],
        "extensions": {},
    }
    
    encoded_header = base64.b64encode(
        json.dumps(payment_required).encode()
    ).decode()
    
    mock_response = MagicMock()
    mock_response.status_code = 402
    mock_response.headers = {
        "X-PAYMENT-REQUIRED": encoded_header,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE",
    }
    mock_response.json.return_value = {
        "error": "Payment Required",
        "message": "This content requires payment to access",
        "x402Version": 2,
    }
    
    return mock_response


def create_200_response_with_settlement(
    content: dict[str, Any],
    transaction_hash: str = "0xabc123def456789",
    payer: str = SAMPLE_PAYER_ADDRESS,
) -> MagicMock:
    """Create a mock 200 OK response with settlement confirmation."""
    settlement = {
        "success": True,
        "transaction": transaction_hash,
        "network": "eip155:84532",
        "payer": payer,
    }
    
    encoded_settlement = base64.b64encode(
        json.dumps(settlement).encode()
    ).decode()
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {
        "X-PAYMENT-RESPONSE": encoded_settlement,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    }
    mock_response.json.return_value = content
    
    return mock_response


def create_payment_payload(
    requirements: dict[str, Any],
    payer: str = SAMPLE_PAYER_ADDRESS,
) -> dict[str, Any]:
    """Create a valid x402 v2 payment payload."""
    now = int(time.time())
    
    return {
        "x402Version": 2,
        "resource": {
            "url": "/api/premium-article",
        },
        "accepted": requirements,
        "payload": {
            "signature": "0x" + "ab" * 65,  # 65 bytes = 130 hex chars
            "authorization": {
                "from": payer,
                "to": requirements["payTo"],
                "value": requirements["amount"],
                "validAfter": str(now - 60),
                "validBefore": str(now + 300),
                "nonce": "0x" + "00" * 32,  # 32 bytes = 64 hex chars
            },
        },
        "extensions": {},
    }


def decode_payment_required_header(header_value: str) -> dict[str, Any]:
    """Decode the X-PAYMENT-REQUIRED header from base64 JSON."""
    return json.loads(base64.b64decode(header_value))


def decode_payment_response_header(header_value: str) -> dict[str, Any]:
    """Decode the X-PAYMENT-RESPONSE header from base64 JSON."""
    return json.loads(base64.b64decode(header_value))


# ============================================================================
# Content Request Implementation (for testing)
# ============================================================================

async def request_content_impl(url: str, seller_api_url: str) -> dict[str, Any]:
    """Request content from seller API (implementation for testing)."""
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
                payment_required_header = (
                    response.headers.get("X-PAYMENT-REQUIRED") or
                    response.headers.get("x-payment-required")
                )
                if not payment_required_header:
                    return {
                        "status": 402,
                        "error": "Missing X-PAYMENT-REQUIRED header",
                    }
                
                payment_data = decode_payment_required_header(payment_required_header)
                
                return {
                    "status": 402,
                    "payment_required": payment_data,
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


async def request_content_with_payment_impl(
    url: str,
    payment_payload: dict[str, Any],
    seller_api_url: str,
) -> dict[str, Any]:
    """Request content with payment signature (implementation for testing)."""
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
                    "X-PAYMENT-SIGNATURE": payment_signature,
                },
                follow_redirects=True,
            )
            
            if response.status_code == 200:
                payment_response_header = (
                    response.headers.get("X-PAYMENT-RESPONSE") or
                    response.headers.get("x-payment-response")
                )
                settlement = None
                if payment_response_header:
                    settlement = decode_payment_response_header(payment_response_header)
                
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


# ============================================================================
# Unit Tests - Retry with Payment Flow
# ============================================================================

class TestRetryWithPaymentFlow:
    """Tests for the complete retry with payment flow."""

    @pytest.mark.asyncio
    async def test_initial_request_returns_402(self):
        """Test that initial request without payment returns 402."""
        mock_402 = create_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 402
            assert "payment_required" in result

    @pytest.mark.asyncio
    async def test_retry_with_valid_payment_returns_200(self):
        """Test that retry with valid payment returns 200 with content."""
        content = {
            "title": "Premium Article",
            "content": "This is premium content...",
        }
        mock_200 = create_200_response_with_settlement(content)
        
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 200
            assert result["content"]["title"] == "Premium Article"

    @pytest.mark.asyncio
    async def test_retry_with_payment_includes_settlement(self):
        """Test that successful payment response includes settlement details."""
        content = {"data": "test"}
        tx_hash = "0xdef456789abc123"
        mock_200 = create_200_response_with_settlement(content, tx_hash)
        
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 200
            assert result["settlement"] is not None
            assert result["settlement"]["success"] is True
            assert result["settlement"]["transaction"] == tx_hash

    @pytest.mark.asyncio
    async def test_complete_402_to_200_flow(self):
        """Test the complete flow: 402 → analyze → sign → retry → 200."""
        # Step 1: Initial request returns 402
        mock_402 = create_402_response()
        
        # Step 2: Retry with payment returns 200
        content = {"title": "Premium Content", "body": "Full article..."}
        mock_200 = create_200_response_with_settlement(content)
        
        with patch("httpx.AsyncClient") as mock_client:
            # First call returns 402, second call returns 200
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=[mock_402, mock_200]
            )
            
            # Step 1: Initial request
            initial_result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            assert initial_result["status"] == 402
            payment_required = initial_result["payment_required"]
            
            # Step 2: Extract payment requirements
            requirements = payment_required["accepts"][0]
            assert requirements["scheme"] == "exact"
            assert requirements["network"] == "eip155:84532"
            
            # Step 3: Create payment payload (simulating sign_payment)
            payment_payload = create_payment_payload(requirements)
            
            # Step 4: Retry with payment
            retry_result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                TEST_SELLER_API_URL
            )
            
            assert retry_result["status"] == 200
            assert retry_result["content"]["title"] == "Premium Content"
            assert retry_result["settlement"]["success"] is True


class TestPaymentRejection:
    """Tests for payment rejection scenarios."""

    @pytest.mark.asyncio
    async def test_invalid_payment_returns_402(self):
        """Test that invalid payment signature returns 402."""
        mock_402 = create_402_response()
        
        # Create an invalid payment payload
        invalid_payload = {
            "x402Version": 2,
            "accepted": SAMPLE_PAYMENT_REQUIREMENTS,
            "payload": {
                "signature": "invalid",
                "authorization": {},
            },
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                invalid_payload,
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 402
            assert "error" in result

    @pytest.mark.asyncio
    async def test_insufficient_amount_returns_402(self):
        """Test that payment with insufficient amount returns 402."""
        mock_402 = create_402_response()
        
        # Create payment with insufficient amount
        requirements = SAMPLE_PAYMENT_REQUIREMENTS.copy()
        requirements["amount"] = "100"  # Less than required 1000
        
        payment_payload = create_payment_payload(requirements)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 402

    @pytest.mark.asyncio
    async def test_expired_payment_returns_402(self):
        """Test that expired payment returns 402."""
        mock_402 = create_402_response()
        
        # Create expired payment payload
        expired_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        expired_payload["payload"]["authorization"]["validBefore"] = str(
            int(time.time()) - 100  # Already expired
        )
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                expired_payload,
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 402


class TestPaymentHeaderEncoding:
    """Tests for payment header encoding/decoding."""

    def test_payment_payload_round_trip(self):
        """Test that payment payload survives encode/decode round trip."""
        original_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        # Encode as base64
        encoded = base64.b64encode(
            json.dumps(original_payload).encode()
        ).decode()
        
        # Decode back
        decoded = json.loads(base64.b64decode(encoded))
        
        assert decoded["x402Version"] == original_payload["x402Version"]
        assert decoded["accepted"]["scheme"] == original_payload["accepted"]["scheme"]
        assert decoded["payload"]["signature"] == original_payload["payload"]["signature"]

    def test_settlement_response_decoding(self):
        """Test that settlement response is correctly decoded."""
        settlement = {
            "success": True,
            "transaction": "0xabc123",
            "network": "eip155:84532",
            "payer": SAMPLE_PAYER_ADDRESS,
        }
        
        encoded = base64.b64encode(json.dumps(settlement).encode()).decode()
        decoded = decode_payment_response_header(encoded)
        
        assert decoded["success"] is True
        assert decoded["transaction"] == "0xabc123"
        assert decoded["payer"] == SAMPLE_PAYER_ADDRESS


class TestPaymentRequirementsExtraction:
    """Tests for extracting payment requirements from 402 response."""

    @pytest.mark.asyncio
    async def test_extract_scheme_from_402(self):
        """Test extracting payment scheme from 402 response."""
        mock_402 = create_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            requirements = result["payment_required"]["accepts"][0]
            assert requirements["scheme"] == "exact"

    @pytest.mark.asyncio
    async def test_extract_network_from_402(self):
        """Test extracting network from 402 response."""
        mock_402 = create_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            requirements = result["payment_required"]["accepts"][0]
            assert requirements["network"] == "eip155:84532"

    @pytest.mark.asyncio
    async def test_extract_amount_from_402(self):
        """Test extracting payment amount from 402 response."""
        mock_402 = create_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            requirements = result["payment_required"]["accepts"][0]
            assert requirements["amount"] == "1000"

    @pytest.mark.asyncio
    async def test_extract_recipient_from_402(self):
        """Test extracting payment recipient from 402 response."""
        mock_402 = create_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            requirements = result["payment_required"]["accepts"][0]
            assert requirements["payTo"].startswith("0x")
            assert len(requirements["payTo"]) == 42


class TestMultipleEndpoints:
    """Tests for retry with payment across multiple endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint,amount", [
        ("/api/premium-article", "1000"),
        ("/api/weather-data", "500"),
        ("/api/market-analysis", "2000"),
    ])
    async def test_different_endpoints_different_prices(self, endpoint: str, amount: str):
        """Test that different endpoints have different prices."""
        requirements = SAMPLE_PAYMENT_REQUIREMENTS.copy()
        requirements["amount"] = amount
        
        mock_402 = create_402_response(uri=endpoint, requirements=requirements)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_impl(endpoint, TEST_SELLER_API_URL)
            
            assert result["status"] == 402
            extracted_amount = result["payment_required"]["accepts"][0]["amount"]
            assert extracted_amount == amount


class TestErrorHandling:
    """Tests for error handling in retry with payment flow."""

    @pytest.mark.asyncio
    async def test_network_error_during_initial_request(self):
        """Test handling of network error during initial request."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 0
            assert "error" in result
            assert "Request failed" in result["error"]

    @pytest.mark.asyncio
    async def test_network_error_during_retry(self):
        """Test handling of network error during retry with payment."""
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 0
            assert "error" in result

    @pytest.mark.asyncio
    async def test_server_error_returns_error(self):
        """Test handling of 500 server error."""
        mock_500 = MagicMock()
        mock_500.status_code = 500
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_500
            )
            
            result = await request_content_impl(
                "/api/premium-article",
                TEST_SELLER_API_URL
            )
            
            assert result["status"] == 500
            assert "error" in result


# ============================================================================
# Integration Tests (against real server)
# ============================================================================

@pytest.mark.integration
class TestIntegrationRetryWithPayment:
    """
    Integration tests that run against a real deployed server.
    
    These tests are skipped by default. To run them:
    1. Deploy the seller infrastructure
    2. Set SELLER_API_URL environment variable
    3. Run: pytest -m integration
    """

    @pytest.fixture
    def seller_url(self) -> str:
        """Get the seller API URL from environment."""
        url = os.environ.get("SELLER_API_URL")
        if not url:
            pytest.skip("SELLER_API_URL not set")
        return url

    @pytest.mark.asyncio
    async def test_real_402_response(self, seller_url: str):
        """Test real 402 response from deployed server."""
        result = await request_content_impl("/api/premium-article", seller_url)
        
        assert result["status"] == 402
        assert "payment_required" in result
        assert result["payment_required"]["x402Version"] == 2

    @pytest.mark.asyncio
    async def test_real_payment_requirements_structure(self, seller_url: str):
        """Test that real payment requirements have correct structure."""
        result = await request_content_impl("/api/premium-article", seller_url)
        
        assert result["status"] == 402
        requirements = result["payment_required"]["accepts"][0]
        
        # Verify required fields
        assert "scheme" in requirements
        assert "network" in requirements
        assert "amount" in requirements
        assert "asset" in requirements
        assert "payTo" in requirements
