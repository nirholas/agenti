"""
Gateway Target Mock for Local Testing.

This module provides a mock implementation of the Gateway target endpoints
(content server) for local testing without requiring deployed infrastructure.

The mock simulates:
- MCP tool discovery responses
- 402 Payment Required responses (x402 v2 protocol)
- Payment verification and content delivery
- Settlement confirmation responses

Usage:
    from tests.mocks import GatewayTargetMock
    
    # Create mock
    mock = GatewayTargetMock()
    
    # Use in tests with httpx mocking
    mock_response = mock.create_mock_response("/api/premium-article")
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_response
        )
        # ... test code ...

For integration with pytest fixtures, see conftest.py.
"""

import base64
import json
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from unittest.mock import MagicMock


@dataclass
class GatewayTargetMockConfig:
    """
    Configuration for the Gateway target mock.
    
    Attributes:
        base_url: Base URL for the mock Gateway
        default_price_usdc: Default price in USDC units (1 USDC = 1,000,000 units)
        default_network: Default blockchain network (CAIP-2 format)
        default_asset: Default payment asset address (USDC on Base Sepolia)
        default_recipient: Default payment recipient address
    """
    base_url: str = "https://mock-gateway.example.com"
    default_price_usdc: str = "1000"  # 0.001 USDC in units
    default_network: str = "eip155:84532"  # Base Sepolia
    default_asset: str = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"  # USDC
    default_recipient: str = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"


@dataclass
class MockContentEndpoint:
    """
    Definition of a mock content endpoint.
    
    Attributes:
        path: URL path for the endpoint (e.g., "/api/premium-article")
        name: Tool name for MCP discovery (e.g., "get_premium_article")
        description: Human-readable description of the endpoint
        price_usdc_units: Price in USDC units (1 USDC = 1,000,000 units)
        content: Content to return when payment is verified
        requires_payment: Whether the endpoint requires payment
    """
    path: str
    name: str
    description: str
    price_usdc_units: str
    content: dict[str, Any]
    requires_payment: bool = True


class GatewayTargetMock:
    """
    Mock for Gateway target endpoints for local testing.
    
    This mock simulates the behavior of content endpoints registered
    as Gateway targets, including:
    - MCP tool discovery responses
    - 402 Payment Required responses
    - Payment verification and content delivery
    - x402 v2 protocol compliance
    
    The mock is designed to be used with pytest and httpx mocking
    to enable local testing without requiring deployed infrastructure.
    
    Example:
        mock = GatewayTargetMock()
        mock.add_endpoint("/api/premium-article", "get_premium_article", ...)
        
        # Use in tests
        response = mock.create_mock_response("/api/premium-article")
        assert response.status_code == 402
        
        # With payment
        response = mock.create_mock_response("/api/premium-article", payment_signature="...")
        assert response.status_code == 200
    
    Attributes:
        config: Mock configuration
        endpoints: Dictionary of registered endpoints
    """
    
    def __init__(self, config: Optional[GatewayTargetMockConfig] = None):
        """
        Initialize the Gateway target mock.
        
        Args:
            config: Optional configuration. Uses defaults if not provided.
        """
        self.config = config or GatewayTargetMockConfig()
        self.endpoints: dict[str, MockContentEndpoint] = {}
        self._setup_default_endpoints()
    
    def _setup_default_endpoints(self) -> None:
        """Set up default content endpoints for testing."""
        self.add_endpoint(
            path="/api/premium-article",
            name="get_premium_article",
            description="Get a premium article about AI and blockchain",
            price_usdc_units="1000",
            content={
                "title": "Premium Article: AI and Blockchain",
                "content": "This is premium content about AI and blockchain integration...",
                "author": "Demo Author",
                "published_at": "2024-01-15T10:00:00Z",
            },
        )
        self.add_endpoint(
            path="/api/weather-data",
            name="get_weather_data",
            description="Get real-time weather data",
            price_usdc_units="500",
            content={
                "location": "San Francisco, CA",
                "temperature": 72,
                "conditions": "Sunny",
                "humidity": 45,
                "wind_speed": 8,
                "forecast": "Clear skies expected for the next 3 days",
            },
        )
        self.add_endpoint(
            path="/api/market-analysis",
            name="get_market_analysis",
            description="Get market analysis report",
            price_usdc_units="2000",
            content={
                "market": "Cryptocurrency",
                "trend": "Bullish",
                "analysis": "Market analysis indicates positive momentum...",
                "top_performers": ["BTC", "ETH", "SOL"],
                "risk_level": "Medium",
            },
        )
        self.add_endpoint(
            path="/api/research-report",
            name="get_research_report",
            description="Get detailed research report",
            price_usdc_units="5000",
            content={
                "title": "Q4 2024 Technology Trends Report",
                "summary": "Comprehensive analysis of emerging technology trends...",
                "sections": ["AI/ML", "Blockchain", "Cloud Computing"],
                "page_count": 45,
            },
        )
    
    def add_endpoint(
        self,
        path: str,
        name: str,
        description: str,
        price_usdc_units: str,
        content: dict[str, Any],
        requires_payment: bool = True,
    ) -> None:
        """
        Add a content endpoint to the mock.
        
        Args:
            path: URL path for the endpoint
            name: Tool name for MCP discovery
            description: Human-readable description
            price_usdc_units: Price in USDC units
            content: Content to return when payment is verified
            requires_payment: Whether the endpoint requires payment
        """
        self.endpoints[path] = MockContentEndpoint(
            path=path,
            name=name,
            description=description,
            price_usdc_units=price_usdc_units,
            content=content,
            requires_payment=requires_payment,
        )
    
    def remove_endpoint(self, path: str) -> bool:
        """
        Remove an endpoint from the mock.
        
        Args:
            path: URL path of the endpoint to remove
            
        Returns:
            True if endpoint was removed, False if not found
        """
        if path in self.endpoints:
            del self.endpoints[path]
            return True
        return False
    
    def get_discovery_response(self) -> dict[str, Any]:
        """
        Generate MCP tool discovery response.
        
        Returns:
            Dictionary containing MCP tool definitions for all endpoints
        """
        tools = []
        for endpoint in self.endpoints.values():
            tool = {
                "tool_name": endpoint.name,
                "tool_description": endpoint.description,
                "operation_id": endpoint.name,
                "endpoint_path": endpoint.path,
                "mcp_metadata": {
                    "category": "content",
                    "tags": ["premium", "paid"] if endpoint.requires_payment else ["free"],
                    "requires_payment": endpoint.requires_payment,
                },
                "x402_metadata": {
                    "price_usdc_units": endpoint.price_usdc_units,
                    "price_usdc_display": f"{int(endpoint.price_usdc_units) / 1000000:.6f} USDC",
                    "network": self.config.default_network,
                    "network_name": "Base Sepolia",
                    "scheme": "exact",
                    "asset_address": self.config.default_asset,
                    "asset_name": "USDC",
                } if endpoint.requires_payment else {},
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "payment_payload": {
                            "type": "object",
                            "description": "Payment payload from sign_payment tool",
                        },
                    },
                    "required": [],
                },
            }
            tools.append(tool)
        
        return {
            "tools": tools,
            "metadata": {
                "provider": "x402-demo-mock",
                "version": "1.0.0",
                "total_tools": len(tools),
            },
        }
    
    def get_402_response(self, endpoint: MockContentEndpoint) -> dict[str, Any]:
        """
        Generate x402 v2 compliant 402 Payment Required response.
        
        Args:
            endpoint: The endpoint that requires payment
            
        Returns:
            Dictionary containing x402 v2 payment requirements
        """
        return {
            "x402Version": 2,
            "error": "Payment required to access this resource",
            "resource": {
                "url": endpoint.path,
                "description": endpoint.description,
            },
            "accepts": [{
                "scheme": "exact",
                "network": self.config.default_network,
                "amount": endpoint.price_usdc_units,
                "asset": self.config.default_asset,
                "payTo": self.config.default_recipient,
                "maxTimeoutSeconds": 60,
                "extra": {
                    "name": "USDC",
                    "version": "2",
                },
            }],
        }
    
    def get_settlement_response(self, transaction_hash: Optional[str] = None) -> dict[str, Any]:
        """
        Generate payment settlement response.
        
        Args:
            transaction_hash: Optional transaction hash. Generated if not provided.
            
        Returns:
            Dictionary containing settlement confirmation
        """
        return {
            "success": True,
            "transaction": transaction_hash or f"0x{'ab' * 32}",
            "network": self.config.default_network,
            "settledAt": int(time.time() * 1000),
        }
    
    def verify_payment_signature(self, payment_signature: str) -> bool:
        """
        Verify a payment signature (mock implementation).
        
        In a real implementation, this would verify the cryptographic signature.
        For testing, we accept any non-empty signature that can be decoded
        and contains the required fields.
        
        Args:
            payment_signature: Base64-encoded payment payload
            
        Returns:
            True if signature is valid, False otherwise
        """
        if not payment_signature:
            return False
        try:
            decoded = json.loads(base64.b64decode(payment_signature))
            # Check for required fields per x402 v2 spec
            required_fields = ["scheme", "network", "signature", "from", "to", "amount"]
            return all(field in decoded for field in required_fields)
        except Exception:
            return False
    
    def create_mock_response(
        self,
        path: str,
        payment_signature: Optional[str] = None,
    ) -> MagicMock:
        """
        Create a mock HTTP response for a given path.
        
        This method creates a MagicMock configured to behave like an
        httpx.Response, suitable for use with unittest.mock.patch.
        
        Args:
            path: The endpoint path
            payment_signature: Optional Base64-encoded payment signature
            
        Returns:
            MagicMock configured as an HTTP response
        """
        endpoint = self.endpoints.get(path)
        if not endpoint:
            # 404 for unknown endpoints
            mock_response = MagicMock()
            mock_response.status_code = 404
            mock_response.json.return_value = {"error": "Not found", "path": path}
            mock_response.headers = {}
            mock_response.content = json.dumps({"error": "Not found"}).encode()
            return mock_response
        
        if endpoint.requires_payment and not payment_signature:
            # 402 Payment Required
            payment_required = self.get_402_response(endpoint)
            encoded_payment = base64.b64encode(
                json.dumps(payment_required).encode()
            ).decode()
            
            mock_response = MagicMock()
            mock_response.status_code = 402
            mock_response.json.return_value = payment_required
            mock_response.headers = {"X-PAYMENT-REQUIRED": encoded_payment}
            mock_response.content = json.dumps(payment_required).encode()
            return mock_response
        
        if payment_signature and not self.verify_payment_signature(payment_signature):
            # Invalid payment signature
            error_response = {
                "error": "Invalid payment signature",
                "details": "Payment signature could not be verified",
            }
            mock_response = MagicMock()
            mock_response.status_code = 402
            mock_response.json.return_value = error_response
            mock_response.headers = {}
            mock_response.content = json.dumps(error_response).encode()
            return mock_response
        
        # 200 OK with content
        settlement = self.get_settlement_response()
        encoded_settlement = base64.b64encode(
            json.dumps(settlement).encode()
        ).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = endpoint.content
        mock_response.headers = {"X-PAYMENT-RESPONSE": encoded_settlement}
        mock_response.content = json.dumps(endpoint.content).encode()
        return mock_response
    
    def create_valid_payment_signature(
        self,
        endpoint_path: str,
        from_address: str = "0x1111111111111111111111111111111111111111",
    ) -> str:
        """
        Create a valid payment signature for testing.
        
        This is a helper method to create properly formatted payment
        signatures for testing the payment flow.
        
        Args:
            endpoint_path: Path of the endpoint to pay for
            from_address: Payer's wallet address
            
        Returns:
            Base64-encoded payment signature
        """
        endpoint = self.endpoints.get(endpoint_path)
        if not endpoint:
            raise ValueError(f"Unknown endpoint: {endpoint_path}")
        
        payment_payload = {
            "scheme": "exact",
            "network": self.config.default_network,
            "signature": "0x" + "ab" * 65,  # Mock signature
            "from": from_address,
            "to": self.config.default_recipient,
            "amount": endpoint.price_usdc_units,
            "asset": self.config.default_asset,
            "timestamp": int(time.time() * 1000),
            "nonce": f"nonce-{int(time.time())}",
        }
        
        return base64.b64encode(json.dumps(payment_payload).encode()).decode()
