"""
Test mocks for the payer-agent test suite.

This module provides mock implementations for external dependencies,
enabling local testing without requiring deployed infrastructure.

Available Mocks:
- GatewayTargetMock: Mock for Gateway target endpoints (content server)
- MockContentEndpoint: Definition of a mock content endpoint
- GatewayTargetMockConfig: Configuration for the Gateway mock

Usage:
    from tests.mocks import GatewayTargetMock, GatewayTargetMockConfig
    
    # Create mock with default configuration
    mock = GatewayTargetMock()
    
    # Create mock with custom configuration
    config = GatewayTargetMockConfig(
        base_url="https://custom-gateway.example.com",
        default_price_usdc="2000",
    )
    mock = GatewayTargetMock(config=config)
    
    # Add custom endpoints
    mock.add_endpoint(
        path="/api/custom-content",
        name="get_custom_content",
        description="Custom content endpoint",
        price_usdc_units="5000",
        content={"custom": "data"},
    )
    
    # Get mock responses
    response = mock.create_mock_response("/api/premium-article")
    assert response.status_code == 402  # No payment
    
    # With payment
    response = mock.create_mock_response("/api/premium-article", payment_signature="...")
    assert response.status_code == 200  # Content delivered
"""

from .gateway_mock import (
    GatewayTargetMock,
    GatewayTargetMockConfig,
    MockContentEndpoint,
)

__all__ = [
    "GatewayTargetMock",
    "GatewayTargetMockConfig", 
    "MockContentEndpoint",
]
