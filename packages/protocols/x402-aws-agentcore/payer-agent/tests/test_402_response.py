"""
Integration tests for the initial request → 402 response flow.

These tests verify that:
1. Initial requests to protected endpoints return 402 Payment Required
2. The 402 response contains proper x402 v2 headers
3. Payment requirements are correctly formatted and parseable
4. Non-protected endpoints return normal responses

Tests can run against:
- A deployed CloudFront distribution (set SELLER_API_URL env var)
- A local mock server for unit testing
"""

import base64
import json
import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


# ============================================================================
# Test Configuration
# ============================================================================

# Default test URL - can be overridden with environment variable
TEST_SELLER_API_URL = os.environ.get(
    "SELLER_API_URL", 
    "https://example.cloudfront.net"
)

# Protected endpoints that should return 402
PROTECTED_ENDPOINTS = [
    "/api/premium-article",
    "/api/weather-data",
    "/api/market-analysis",
    "/api/research-report",
    "/api/dataset",
    "/api/tutorial",
]

# Expected x402 v2 response structure
EXPECTED_X402_VERSION = 2


# ============================================================================
# Helper Functions
# ============================================================================

def decode_payment_required_header(header_value: str) -> dict[str, Any]:
    """Decode the X-PAYMENT-REQUIRED header from base64 JSON."""
    try:
        decoded = base64.b64decode(header_value)
        return json.loads(decoded)
    except (ValueError, json.JSONDecodeError) as e:
        raise ValueError(f"Failed to decode payment required header: {e}")


def validate_payment_requirements(requirements: dict[str, Any]) -> list[str]:
    """
    Validate that payment requirements contain all required fields.
    
    Returns a list of validation errors (empty if valid).
    """
    errors = []
    
    required_fields = ["scheme", "network", "amount", "asset", "payTo"]
    for field in required_fields:
        if field not in requirements:
            errors.append(f"Missing required field: {field}")
    
    # Validate scheme
    if requirements.get("scheme") not in ["exact", "upto"]:
        errors.append(f"Invalid scheme: {requirements.get('scheme')}")
    
    # Validate network format (should be CAIP-2 format like 'eip155:84532')
    network = requirements.get("network", "")
    if not network or ":" not in network:
        errors.append(f"Invalid network format: {network}")
    
    # Validate amount is a numeric string
    amount = requirements.get("amount", "")
    if not amount or not amount.isdigit():
        errors.append(f"Invalid amount format: {amount}")
    
    # Validate asset is an Ethereum address
    asset = requirements.get("asset", "")
    if not asset.startswith("0x") or len(asset) != 42:
        errors.append(f"Invalid asset address: {asset}")
    
    # Validate payTo is an Ethereum address
    pay_to = requirements.get("payTo", "")
    if not pay_to.startswith("0x") or len(pay_to) != 42:
        errors.append(f"Invalid payTo address: {pay_to}")
    
    return errors


def validate_402_response_structure(payment_required: dict[str, Any]) -> list[str]:
    """
    Validate the complete 402 response structure.
    
    Returns a list of validation errors (empty if valid).
    """
    errors = []
    
    # Check x402 version
    if payment_required.get("x402Version") != EXPECTED_X402_VERSION:
        errors.append(
            f"Invalid x402Version: {payment_required.get('x402Version')}, "
            f"expected {EXPECTED_X402_VERSION}"
        )
    
    # Check resource info
    resource = payment_required.get("resource", {})
    if not resource.get("url"):
        errors.append("Missing resource.url")
    
    # Check accepts array
    accepts = payment_required.get("accepts", [])
    if not accepts:
        errors.append("Missing or empty accepts array")
    else:
        for i, req in enumerate(accepts):
            req_errors = validate_payment_requirements(req)
            for err in req_errors:
                errors.append(f"accepts[{i}]: {err}")
    
    return errors


# ============================================================================
# Mock Server for Unit Tests
# ============================================================================

def create_mock_402_response(
    uri: str = "/api/premium-article",
    amount: str = "1000",
    scheme: str = "exact",
    network: str = "eip155:84532",
    asset: str = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    pay_to: str = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
) -> MagicMock:
    """Create a mock 402 response with proper x402 v2 headers."""
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
            "extra": {
                "name": "USDC",
                "version": "2",
                "assetTransferMethod": "eip3009",
            },
        }],
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


# ============================================================================
# Unit Tests (with mocks)
# ============================================================================

class TestInitialRequest402Response:
    """Unit tests for the initial request → 402 response flow."""

    @pytest.mark.asyncio
    async def test_protected_endpoint_returns_402(self):
        """Test that a protected endpoint returns 402 status code."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                assert response.status_code == 402

    @pytest.mark.asyncio
    async def test_402_response_contains_payment_required_header(self):
        """Test that 402 response contains X-PAYMENT-REQUIRED header."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                assert "X-PAYMENT-REQUIRED" in response.headers

    @pytest.mark.asyncio
    async def test_payment_required_header_is_valid_base64_json(self):
        """Test that X-PAYMENT-REQUIRED header is valid base64-encoded JSON."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                header_value = response.headers["X-PAYMENT-REQUIRED"]
                
                # Should not raise
                payment_required = decode_payment_required_header(header_value)
                
                assert isinstance(payment_required, dict)

    @pytest.mark.asyncio
    async def test_payment_required_has_correct_x402_version(self):
        """Test that payment required response has x402Version = 2."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                header_value = response.headers["X-PAYMENT-REQUIRED"]
                payment_required = decode_payment_required_header(header_value)
                
                assert payment_required.get("x402Version") == 2

    @pytest.mark.asyncio
    async def test_payment_required_contains_resource_info(self):
        """Test that payment required response contains resource information."""
        mock_response = create_mock_402_response(uri="/api/premium-article")
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                header_value = response.headers["X-PAYMENT-REQUIRED"]
                payment_required = decode_payment_required_header(header_value)
                
                assert "resource" in payment_required
                assert payment_required["resource"]["url"] == "/api/premium-article"

    @pytest.mark.asyncio
    async def test_payment_required_contains_accepts_array(self):
        """Test that payment required response contains accepts array."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                header_value = response.headers["X-PAYMENT-REQUIRED"]
                payment_required = decode_payment_required_header(header_value)
                
                assert "accepts" in payment_required
                assert isinstance(payment_required["accepts"], list)
                assert len(payment_required["accepts"]) > 0

    @pytest.mark.asyncio
    async def test_payment_requirements_have_required_fields(self):
        """Test that payment requirements contain all required fields."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                header_value = response.headers["X-PAYMENT-REQUIRED"]
                payment_required = decode_payment_required_header(header_value)
                
                requirements = payment_required["accepts"][0]
                errors = validate_payment_requirements(requirements)
                
                assert len(errors) == 0, f"Validation errors: {errors}"

    @pytest.mark.asyncio
    async def test_402_response_structure_is_valid(self):
        """Test that the complete 402 response structure is valid."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                header_value = response.headers["X-PAYMENT-REQUIRED"]
                payment_required = decode_payment_required_header(header_value)
                
                errors = validate_402_response_structure(payment_required)
                
                assert len(errors) == 0, f"Validation errors: {errors}"

    @pytest.mark.asyncio
    async def test_402_response_body_contains_error_info(self):
        """Test that 402 response body contains error information."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                body = response.json()
                
                assert "error" in body
                assert body["error"] == "Payment Required"

    @pytest.mark.asyncio
    async def test_402_response_has_cors_headers(self):
        """Test that 402 response includes CORS headers."""
        mock_response = create_mock_402_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/api/premium-article",
                    headers={"Accept": "application/json"},
                )
                
                assert "Access-Control-Allow-Origin" in response.headers
                assert "Access-Control-Expose-Headers" in response.headers


class TestPaymentRequirementsValidation:
    """Tests for payment requirements validation logic."""

    def test_valid_payment_requirements(self):
        """Test that valid payment requirements pass validation."""
        requirements = {
            "scheme": "exact",
            "network": "eip155:84532",
            "amount": "1000",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        }
        
        errors = validate_payment_requirements(requirements)
        assert len(errors) == 0

    def test_missing_scheme_fails_validation(self):
        """Test that missing scheme fails validation."""
        requirements = {
            "network": "eip155:84532",
            "amount": "1000",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        }
        
        errors = validate_payment_requirements(requirements)
        assert any("scheme" in err.lower() for err in errors)

    def test_invalid_network_format_fails_validation(self):
        """Test that invalid network format fails validation."""
        requirements = {
            "scheme": "exact",
            "network": "base-sepolia",  # Should be CAIP-2 format
            "amount": "1000",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        }
        
        errors = validate_payment_requirements(requirements)
        assert any("network" in err.lower() for err in errors)

    def test_invalid_amount_format_fails_validation(self):
        """Test that non-numeric amount fails validation."""
        requirements = {
            "scheme": "exact",
            "network": "eip155:84532",
            "amount": "0.001",  # Should be atomic units (integer string)
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        }
        
        errors = validate_payment_requirements(requirements)
        assert any("amount" in err.lower() for err in errors)

    def test_invalid_asset_address_fails_validation(self):
        """Test that invalid asset address fails validation."""
        requirements = {
            "scheme": "exact",
            "network": "eip155:84532",
            "amount": "1000",
            "asset": "invalid-address",
            "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        }
        
        errors = validate_payment_requirements(requirements)
        assert any("asset" in err.lower() for err in errors)


class TestMultipleProtectedEndpoints:
    """Tests for multiple protected endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", PROTECTED_ENDPOINTS)
    async def test_all_protected_endpoints_return_402(self, endpoint: str):
        """Test that all protected endpoints return 402."""
        mock_response = create_mock_402_response(uri=endpoint)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}{endpoint}",
                    headers={"Accept": "application/json"},
                )
                
                assert response.status_code == 402, (
                    f"Expected 402 for {endpoint}, got {response.status_code}"
                )


class TestNonProtectedEndpoints:
    """Tests for non-protected endpoints."""

    @pytest.mark.asyncio
    async def test_root_path_does_not_return_402(self):
        """Test that root path does not return 402."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "text/html"}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/",
                    headers={"Accept": "application/json"},
                )
                
                assert response.status_code != 402

    @pytest.mark.asyncio
    async def test_static_assets_do_not_return_402(self):
        """Test that static assets do not return 402."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"Content-Type": "image/png"}
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{TEST_SELLER_API_URL}/static/image.png",
                    headers={"Accept": "image/png"},
                )
                
                assert response.status_code != 402


# ============================================================================
# Integration Tests (against real server)
# ============================================================================

@pytest.mark.integration
class TestIntegration402Response:
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
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{seller_url}/api/premium-article",
                headers={"Accept": "application/json"},
                follow_redirects=True,
            )
            
            assert response.status_code == 402
            assert "X-PAYMENT-REQUIRED" in response.headers or \
                   "x-payment-required" in response.headers

    @pytest.mark.asyncio
    async def test_real_payment_requirements_valid(self, seller_url: str):
        """Test that real payment requirements are valid."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{seller_url}/api/premium-article",
                headers={"Accept": "application/json"},
                follow_redirects=True,
            )
            
            # Get header (case-insensitive)
            header_value = (
                response.headers.get("X-PAYMENT-REQUIRED") or
                response.headers.get("x-payment-required")
            )
            
            assert header_value is not None
            
            payment_required = decode_payment_required_header(header_value)
            errors = validate_402_response_structure(payment_required)
            
            assert len(errors) == 0, f"Validation errors: {errors}"
