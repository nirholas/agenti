"""
Pytest configuration and fixtures for payer-agent tests.

This module provides shared fixtures for testing the payer agent,
including the Gateway target mock for local testing without
requiring deployed infrastructure.

Usage:
    # In your test file, fixtures are automatically available
    
    def test_something(gateway_mock):
        response = gateway_mock.create_mock_response("/api/premium-article")
        assert response.status_code == 402
    
    @pytest.mark.asyncio
    async def test_mcp_client(mcp_client_with_mock, gateway_mock):
        # mcp_client_with_mock is pre-configured to use the gateway_mock
        result = await mcp_client_with_mock.discover_tools()
        assert result.success
"""

import os
import pytest
from unittest.mock import AsyncMock, patch

from tests.mocks import GatewayTargetMock, GatewayTargetMockConfig


# ============================================================================
# Gateway Target Mock Fixtures
# ============================================================================

@pytest.fixture
def gateway_mock_config() -> GatewayTargetMockConfig:
    """
    Create a Gateway target mock configuration.
    
    Override this fixture to customize the mock configuration.
    
    Returns:
        GatewayTargetMockConfig with default values
    """
    return GatewayTargetMockConfig(
        base_url="https://mock-gateway.example.com",
        default_price_usdc="1000",
        default_network="eip155:84532",
        default_asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        default_recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    )


@pytest.fixture
def gateway_mock(gateway_mock_config: GatewayTargetMockConfig) -> GatewayTargetMock:
    """
    Create a Gateway target mock for testing.
    
    The mock comes pre-configured with default content endpoints:
    - /api/premium-article (1000 units)
    - /api/weather-data (500 units)
    - /api/market-analysis (2000 units)
    - /api/research-report (5000 units)
    
    Returns:
        GatewayTargetMock instance
    """
    return GatewayTargetMock(config=gateway_mock_config)


@pytest.fixture
def mcp_client_with_mock(gateway_mock: GatewayTargetMock):
    """
    Create an MCP client configured to use the Gateway mock.
    
    This fixture creates an MCPClient instance configured with
    the mock Gateway URL and caching disabled for testing.
    
    Returns:
        MCPClient configured for mock testing
    """
    from agent.mcp_client import MCPClient
    
    client = MCPClient(
        gateway_url=gateway_mock.config.base_url,
        cache_ttl_seconds=60,
        enable_caching=False,
    )
    return client


# ============================================================================
# Environment-based Fixtures
# ============================================================================

@pytest.fixture
def seller_api_url() -> str:
    """
    Get the seller API URL from environment.
    
    This fixture is used for integration tests that require
    a real deployed server.
    
    Returns:
        Seller API URL from SELLER_API_URL environment variable
        
    Raises:
        pytest.skip: If SELLER_API_URL is not set
    """
    url = os.environ.get("SELLER_API_URL")
    if not url:
        pytest.skip("SELLER_API_URL not set - skipping integration tests")
    return url


@pytest.fixture
def gateway_api_url() -> str:
    """
    Get the Gateway API URL from environment.
    
    This fixture is used for integration tests that require
    a real deployed AgentCore Gateway.
    
    Returns:
        Gateway API URL from GATEWAY_API_URL environment variable
        
    Raises:
        pytest.skip: If GATEWAY_API_URL is not set
    """
    url = os.environ.get("GATEWAY_API_URL")
    if not url:
        pytest.skip("GATEWAY_API_URL not set - skipping integration tests")
    return url


# ============================================================================
# Mock HTTP Client Fixtures
# ============================================================================

@pytest.fixture
def mock_httpx_client():
    """
    Create a mock httpx.AsyncClient for testing.
    
    This fixture provides a context manager that patches httpx.AsyncClient
    and returns the mock instance for configuration.
    
    Usage:
        def test_something(mock_httpx_client, gateway_mock):
            mock_response = gateway_mock.create_mock_response("/api/test")
            
            with mock_httpx_client as mock_client:
                mock_client.get.return_value = mock_response
                # ... test code ...
    
    Yields:
        Mock httpx.AsyncClient instance
    """
    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_client.return_value.__aenter__.return_value = mock_instance
        yield mock_instance


# ============================================================================
# Payment Fixtures
# ============================================================================

@pytest.fixture
def valid_payment_payload(gateway_mock: GatewayTargetMock) -> dict:
    """
    Create a valid payment payload for testing.
    
    Returns:
        Dictionary containing a valid payment payload
    """
    import time
    
    return {
        "scheme": "exact",
        "network": gateway_mock.config.default_network,
        "signature": "0x" + "ab" * 65,
        "from": "0x1111111111111111111111111111111111111111",
        "to": gateway_mock.config.default_recipient,
        "amount": "1000",
        "asset": gateway_mock.config.default_asset,
        "timestamp": int(time.time() * 1000),
        "nonce": f"nonce-{int(time.time())}",
    }


@pytest.fixture
def valid_payment_signature(valid_payment_payload: dict) -> str:
    """
    Create a valid Base64-encoded payment signature for testing.
    
    Returns:
        Base64-encoded payment signature string
    """
    import base64
    import json
    
    return base64.b64encode(json.dumps(valid_payment_payload).encode()).decode()


# ============================================================================
# Pytest Configuration
# ============================================================================

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test (requires deployed infrastructure)",
    )
    config.addinivalue_line(
        "markers",
        "slow: mark test as slow running",
    )


def pytest_collection_modifyitems(config, items):
    """
    Modify test collection to skip integration tests by default.
    
    Integration tests are skipped unless:
    - The --run-integration flag is passed
    - The required environment variables are set
    """
    if config.getoption("--run-integration", default=False):
        return
    
    skip_integration = pytest.mark.skip(
        reason="Integration tests skipped. Use --run-integration to run."
    )
    
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)


def pytest_addoption(parser):
    """Add custom command line options."""
    parser.addoption(
        "--run-integration",
        action="store_true",
        default=False,
        help="Run integration tests (requires deployed infrastructure)",
    )
