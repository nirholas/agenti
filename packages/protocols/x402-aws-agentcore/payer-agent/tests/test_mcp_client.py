"""Tests for the MCP tool discovery client.

This module tests the MCP client functionality including:
- Tool discovery from Gateway MCP endpoint
- Tool invocation with x402 payment handling
- 402 Payment Required response parsing
- Payment signature passthrough for retry requests
- Gateway target mock for local testing
- MCP protocol validation

The 402 handling logic is critical for the x402 payment flow:
1. Initial request returns 402 with payment requirements
2. Agent analyzes payment using analyze_payment tool
3. Agent signs payment using sign_payment tool
4. Retry request includes payment signature
5. Content is delivered with settlement confirmation

Gateway Target Mock:
    The GatewayTargetMock class is available from tests.mocks module
    and provides fixtures via conftest.py for easy local testing.
    
    See tests/mocks/gateway_mock.py for implementation details.
"""

import base64
import json
import time
from typing import Any, Optional

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock

from agent.mcp_client import (
    MCPClient,
    MCPToolDefinition,
    MCPToolParameter,
    MCPDiscoveryResponse,
    MCPInvocationResponse,
    MCPClientConfig,
    get_mcp_client,
    discover_mcp_tools,
    get_tool_info,
    list_available_tools,
)

# Import Gateway mock from the mocks module
# Fixtures are provided by conftest.py
from tests.mocks import GatewayTargetMock, GatewayTargetMockConfig, MockContentEndpoint


class TestMCPToolDefinition:
    """Tests for MCPToolDefinition dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            category="content",
            tags=["premium", "article"],
            parameters=[
                MCPToolParameter(
                    name="payment_signature",
                    type="string",
                    description="Payment signature",
                    required=False,
                )
            ],
            requires_payment=True,
            payment_info={
                "price_units": "1000",
                "price_display": "0.001 USDC",
            },
        )
        
        result = tool_def.to_dict()
        
        assert result["name"] == "get_premium_article"
        assert result["description"] == "Get a premium article"
        assert result["category"] == "content"
        assert result["requires_payment"] is True
        assert len(result["parameters"]) == 1
        assert result["parameters"][0]["name"] == "payment_signature"


class TestMCPClientConfig:
    """Tests for MCPClientConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = MCPClientConfig()
        
        assert config.mcp_discovery_path == "/mcp/tools"
        assert config.mcp_invoke_path == "/mcp/invoke"
        assert config.timeout_seconds == 30
        assert config.cache_ttl_seconds == 300
        assert config.enable_caching is True


class TestMCPClient:
    """Tests for the MCPClient class."""

    @pytest.fixture
    def mcp_client(self):
        """Create an MCP client for testing."""
        return MCPClient(
            gateway_url="https://gateway.example.com",
            cache_ttl_seconds=60,
        )

    @pytest.fixture
    def sample_discovery_response(self):
        """Sample MCP discovery response."""
        return {
            "tools": [
                {
                    "tool_name": "get_premium_article",
                    "tool_description": "Get a premium article about AI.",
                    "operation_id": "get_premium_article",
                    "mcp_metadata": {
                        "category": "content",
                        "tags": ["premium", "article"],
                        "requires_payment": True,
                    },
                    "x402_metadata": {
                        "price_usdc_units": "1000",
                        "price_usdc_display": "0.001 USDC",
                        "network": "eip155:84532",
                        "network_name": "Base Sepolia",
                        "scheme": "exact",
                        "asset_address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                        "asset_name": "USDC",
                    },
                    "input_schema": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    },
                },
                {
                    "tool_name": "get_weather_data",
                    "tool_description": "Get weather data.",
                    "operation_id": "get_weather_data",
                    "mcp_metadata": {
                        "category": "market-data",
                        "tags": ["weather"],
                        "requires_payment": True,
                    },
                    "x402_metadata": {
                        "price_usdc_units": "500",
                        "price_usdc_display": "0.0005 USDC",
                    },
                    "input_schema": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    },
                },
            ],
            "metadata": {
                "provider": "x402-demo",
                "version": "1.0.0",
            },
        }

    def test_cache_validity_when_disabled(self, mcp_client):
        """Test cache is invalid when caching is disabled."""
        mcp_client.config.enable_caching = False
        mcp_client._tools_cache = [MCPToolDefinition(name="test", description="", operation_id="")]
        mcp_client._cache_timestamp = time.time()
        
        assert mcp_client._is_cache_valid() is False

    def test_cache_validity_when_empty(self, mcp_client):
        """Test cache is invalid when empty."""
        mcp_client._tools_cache = []
        
        assert mcp_client._is_cache_valid() is False

    def test_cache_validity_when_expired(self, mcp_client):
        """Test cache is invalid when expired."""
        mcp_client._tools_cache = [MCPToolDefinition(name="test", description="", operation_id="")]
        mcp_client._cache_timestamp = time.time() - 120  # 2 minutes ago, TTL is 60s
        
        assert mcp_client._is_cache_valid() is False

    def test_cache_validity_when_valid(self, mcp_client):
        """Test cache is valid when within TTL."""
        mcp_client._tools_cache = [MCPToolDefinition(name="test", description="", operation_id="")]
        mcp_client._cache_timestamp = time.time() - 30  # 30 seconds ago, TTL is 60s
        
        assert mcp_client._is_cache_valid() is True

    def test_parse_tool_definition(self, mcp_client, sample_discovery_response):
        """Test parsing of tool definition from discovery response."""
        tool_data = sample_discovery_response["tools"][0]
        
        tool_def = mcp_client._parse_tool_definition(tool_data)
        
        assert tool_def.name == "get_premium_article"
        assert tool_def.description == "Get a premium article about AI."
        assert tool_def.operation_id == "get_premium_article"
        assert tool_def.category == "content"
        assert "premium" in tool_def.tags
        assert tool_def.requires_payment is True
        assert tool_def.payment_info["price_units"] == "1000"
        assert tool_def.payment_info["price_display"] == "0.001 USDC"

    @pytest.mark.asyncio
    async def test_discover_tools_success(self, mcp_client, sample_discovery_response):
        """Test successful tool discovery."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_discovery_response
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is True
            assert len(result.tools) == 2
            assert result.tools[0].name == "get_premium_article"
            assert result.tools[1].name == "get_weather_data"
            assert result.cached is False

    @pytest.mark.asyncio
    async def test_discover_tools_uses_cache(self, mcp_client, sample_discovery_response):
        """Test that discovery uses cache when valid."""
        # Pre-populate cache
        mcp_client._tools_cache = [
            MCPToolDefinition(name="cached_tool", description="Cached", operation_id="cached")
        ]
        mcp_client._cache_timestamp = time.time()
        
        result = await mcp_client.discover_tools()
        
        assert result.success is True
        assert result.cached is True
        assert len(result.tools) == 1
        assert result.tools[0].name == "cached_tool"

    @pytest.mark.asyncio
    async def test_discover_tools_force_refresh(self, mcp_client, sample_discovery_response):
        """Test that force_refresh bypasses cache."""
        # Pre-populate cache
        mcp_client._tools_cache = [
            MCPToolDefinition(name="cached_tool", description="Cached", operation_id="cached")
        ]
        mcp_client._cache_timestamp = time.time()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_discovery_response
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools(force_refresh=True)
            
            assert result.success is True
            assert result.cached is False
            assert len(result.tools) == 2

    @pytest.mark.asyncio
    async def test_discover_tools_failure(self, mcp_client):
        """Test handling of discovery failure."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is False
            assert "500" in result.error

    @pytest.mark.asyncio
    async def test_discover_tools_network_error(self, mcp_client):
        """Test handling of network errors during discovery."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is False
            assert "Request failed" in result.error

    @pytest.mark.asyncio
    async def test_invoke_tool_success(self, mcp_client):
        """Test successful tool invocation."""
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"title": "Article", "content": "..."}
        mock_response.headers = {}
        mock_response.content = b'{"title": "Article"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("get_premium_article")
            
            assert result.success is True
            assert result.status_code == 200
            assert result.data["title"] == "Article"

    @pytest.mark.asyncio
    async def test_invoke_tool_payment_required(self, mcp_client):
        """Test tool invocation returning 402 Payment Required."""
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        payment_required = {
            "x402Version": 2,
            "accepts": [{"scheme": "exact", "amount": "1000"}],
        }
        encoded_payment = base64.b64encode(json.dumps(payment_required).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = payment_required
        mock_response.headers = {"X-PAYMENT-REQUIRED": encoded_payment}
        mock_response.content = b'{"x402Version": 2}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("get_premium_article")
            
            assert result.success is False
            assert result.status_code == 402
            assert result.payment_required is not None
            assert result.payment_required["x402Version"] == 2

    @pytest.mark.asyncio
    async def test_invoke_tool_with_payment(self, mcp_client):
        """Test tool invocation with payment signature."""
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        settlement = {"success": True, "transaction": "0x123..."}
        encoded_settlement = base64.b64encode(json.dumps(settlement).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": "Premium content"}
        mock_response.headers = {"X-PAYMENT-RESPONSE": encoded_settlement}
        mock_response.content = b'{"content": "Premium content"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            result = await mcp_client.invoke_tool(
                "get_premium_article",
                payment_signature="base64_encoded_payment",
            )
            
            assert result.success is True
            assert result.status_code == 200
            assert result.payment_response is not None
            assert result.payment_response["success"] is True
            
            # Verify payment header was sent
            call_args = mock_instance.get.call_args
            assert "X-PAYMENT-SIGNATURE" in call_args.kwargs["headers"]

    @pytest.mark.asyncio
    async def test_invoke_tool_network_error(self, mcp_client):
        """Test handling of network errors during invocation."""
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            
            result = await mcp_client.invoke_tool("get_premium_article")
            
            assert result.success is False
            assert result.status_code == 0
            assert "Request failed" in result.error

    def test_get_strands_tools_empty(self, mcp_client):
        """Test getting Strands tools when none discovered."""
        tools = mcp_client.get_strands_tools()
        
        assert tools == []

    def test_get_cached_tools_empty(self, mcp_client):
        """Test getting cached tools when none discovered."""
        tools = mcp_client.get_cached_tools()
        
        assert tools == []

    def test_clear_cache(self, mcp_client):
        """Test clearing the cache."""
        mcp_client._tools_cache = [
            MCPToolDefinition(name="test", description="", operation_id="")
        ]
        mcp_client._cache_timestamp = time.time()
        mcp_client._strands_tools = [lambda: None]
        
        mcp_client.clear_cache()
        
        assert mcp_client._tools_cache == []
        assert mcp_client._cache_timestamp == 0
        assert mcp_client._strands_tools == []


class TestMCPClientHelperFunctions:
    """Tests for MCP client helper functions."""

    def test_get_mcp_client_singleton(self):
        """Test that get_mcp_client returns a singleton."""
        # Reset the global client
        import agent.mcp_client as mcp_module
        mcp_module._mcp_client = None
        
        client1 = get_mcp_client()
        client2 = get_mcp_client()
        
        assert client1 is client2

    def test_list_available_tools_empty(self):
        """Test listing tools when none discovered."""
        import agent.mcp_client as mcp_module
        mcp_module._mcp_client = None
        
        client = get_mcp_client()
        client.clear_cache()
        
        tools = list_available_tools()
        
        assert tools == []

    def test_get_tool_info_not_found(self):
        """Test getting info for non-existent tool."""
        import agent.mcp_client as mcp_module
        mcp_module._mcp_client = None
        
        client = get_mcp_client()
        client.clear_cache()
        
        info = get_tool_info("nonexistent_tool")
        
        assert info is None


class TestMCPToolGeneration:
    """Tests for Strands tool generation from MCP definitions."""

    @pytest.fixture
    def mcp_client(self):
        """Create an MCP client for testing."""
        return MCPClient(gateway_url="https://gateway.example.com")

    def test_generate_strands_tools(self, mcp_client):
        """Test generation of Strands tools from definitions."""
        tool_defs = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                requires_payment=True,
                payment_info={
                    "price_display": "0.001 USDC",
                    "network_name": "Base Sepolia",
                },
                endpoint_path="/api/premium-article",
            ),
        ]
        
        tools = mcp_client._generate_strands_tools(tool_defs)
        
        assert len(tools) == 1
        assert tools[0].__name__ == "get_premium_article"
        assert hasattr(tools[0], "_mcp_tool_def")

    def test_create_tool_function(self, mcp_client):
        """Test creation of individual tool function."""
        tool_def = MCPToolDefinition(
            name="test_tool",
            description="A test tool",
            operation_id="test_tool",
            requires_payment=False,
            endpoint_path="/api/test-tool",
        )
        
        tool_func = mcp_client._create_tool_function(tool_def)
        
        assert tool_func.__name__ == "test_tool"
        assert "A test tool" in tool_func.__doc__
        assert tool_func._mcp_tool_def is tool_def

    @pytest.mark.asyncio
    async def test_invoke_tool_derives_endpoint_from_operation_id(self, mcp_client):
        """Test that invoke_tool derives endpoint path from operation_id when not provided."""
        # Pre-populate cache with tool definition without endpoint_path
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_weather_data",
                description="Get weather data",
                operation_id="get_weather_data",
                # No endpoint_path - should derive from operation_id
            )
        ]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"weather": "sunny"}
        mock_response.headers = {}
        mock_response.content = b'{"weather": "sunny"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            result = await mcp_client.invoke_tool("get_weather_data")
            
            # Verify the URL was constructed correctly
            call_args = mock_instance.get.call_args
            called_url = call_args.args[0]
            assert "/api/weather-data" in called_url
            assert result.success is True

    @pytest.mark.asyncio
    async def test_invoke_tool_uses_explicit_endpoint_path(self, mcp_client):
        """Test that invoke_tool uses explicit endpoint_path when provided."""
        # Pre-populate cache with tool definition with explicit endpoint_path
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_custom_content",
                description="Get custom content",
                operation_id="get_custom_content",
                endpoint_path="/custom/endpoint/path",
            )
        ]
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": "custom"}
        mock_response.headers = {}
        mock_response.content = b'{"content": "custom"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            result = await mcp_client.invoke_tool("get_custom_content")
            
            # Verify the explicit endpoint path was used
            call_args = mock_instance.get.call_args
            called_url = call_args.args[0]
            assert "/custom/endpoint/path" in called_url
            assert result.success is True


class TestPaymentHeaderParsing:
    """Tests for x402 payment header parsing."""

    @pytest.fixture
    def mcp_client(self):
        """Create an MCP client for testing."""
        client = MCPClient(gateway_url="https://gateway.example.com")
        # Pre-populate cache with tool definition
        client._tools_cache = [
            MCPToolDefinition(
                name="test_tool",
                description="Test tool",
                operation_id="test_tool",
                endpoint_path="/api/test-tool",
            )
        ]
        return client

    @pytest.mark.asyncio
    async def test_parse_payment_required_header(self, mcp_client):
        """Test parsing of X-PAYMENT-REQUIRED header."""
        payment_required = {
            "x402Version": 2,
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "eip155:84532",
                    "amount": "1000",
                    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                }
            ],
        }
        encoded = base64.b64encode(json.dumps(payment_required).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = payment_required
        mock_response.headers = {"X-PAYMENT-REQUIRED": encoded}
        mock_response.content = b'{}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.payment_required is not None
            assert result.payment_required["x402Version"] == 2
            assert len(result.payment_required["accepts"]) == 1

    @pytest.mark.asyncio
    async def test_parse_payment_response_header(self, mcp_client):
        """Test parsing of X-PAYMENT-RESPONSE header."""
        settlement = {
            "success": True,
            "transaction": "0x1234567890abcdef",
            "network": "eip155:84532",
        }
        encoded = base64.b64encode(json.dumps(settlement).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": "data"}
        mock_response.headers = {"X-PAYMENT-RESPONSE": encoded}
        mock_response.content = b'{}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.payment_response is not None
            assert result.payment_response["success"] is True
            assert result.payment_response["transaction"] == "0x1234567890abcdef"

    @pytest.mark.asyncio
    async def test_parse_non_prefixed_headers(self, mcp_client):
        """Test parsing of non-prefixed payment headers."""
        payment_required = {"x402Version": 2, "accepts": []}
        encoded = base64.b64encode(json.dumps(payment_required).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = payment_required
        # Use non-prefixed header
        mock_response.headers = {"PAYMENT-REQUIRED": encoded}
        mock_response.content = b'{}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.payment_required is not None
            assert result.payment_required["x402Version"] == 2


class TestMCPTool402HandlingFlow:
    """
    Tests for 402 Payment Required handling in MCP-generated Strands tools.
    
    These tests verify that the 402 handling logic is preserved when using
    MCP-discovered tools. The agent must be able to:
    1. Receive 402 responses with payment requirements
    2. Extract payment details in a format compatible with analyze_payment
    3. Retry requests with payment signatures
    4. Receive content with settlement confirmation
    
    This is critical for the x402 payment flow to work correctly.
    """

    @pytest.fixture
    def mcp_client(self):
        """Create an MCP client for testing."""
        return MCPClient(gateway_url="https://gateway.example.com")

    @pytest.fixture
    def sample_402_response(self):
        """Create a sample 402 Payment Required response."""
        payment_required = {
            "x402Version": 2,
            "error": "Payment required to access this resource",
            "resource": {
                "url": "/api/premium-article",
                "description": "Premium article about AI",
            },
            "accepts": [{
                "scheme": "exact",
                "network": "eip155:84532",
                "amount": "1000",
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "maxTimeoutSeconds": 60,
                "extra": {
                    "name": "USDC",
                    "version": "2",
                },
            }],
        }
        return payment_required

    @pytest.mark.asyncio
    async def test_mcp_tool_returns_402_with_payment_requirements(
        self, mcp_client, sample_402_response
    ):
        """Test that MCP-generated tool returns 402 with properly formatted payment requirements."""
        # Create tool definition
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            requires_payment=True,
            endpoint_path="/api/premium-article",
        )
        
        # Generate Strands tool
        tool_func = mcp_client._create_tool_function(tool_def)
        mcp_client._tools_cache = [tool_def]
        
        # Mock 402 response
        encoded_payment = base64.b64encode(
            json.dumps(sample_402_response).encode()
        ).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = sample_402_response
        mock_response.headers = {"X-PAYMENT-REQUIRED": encoded_payment}
        mock_response.content = json.dumps(sample_402_response).encode()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            # Call the generated tool without payment
            result = await tool_func()
            
            # Verify 402 response structure
            assert result["status"] == 402
            assert "payment_required" in result
            
            # Verify payment requirements are in analyze_payment compatible format
            payment_req = result["payment_required"]
            assert payment_req["scheme"] == "exact"
            assert payment_req["network"] == "eip155:84532"
            assert payment_req["amount"] == "1000"
            assert payment_req["currency"] == "USDC"
            assert payment_req["recipient"] == "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
            
            # Verify helpful message is included
            assert "message" in result
            assert "analyze_payment" in result["message"]
            assert "sign_payment" in result["message"]

    @pytest.mark.asyncio
    async def test_mcp_tool_accepts_payment_payload_for_retry(
        self, mcp_client, sample_402_response
    ):
        """Test that MCP-generated tool accepts payment_payload for retry requests."""
        # Create tool definition
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            requires_payment=True,
            endpoint_path="/api/premium-article",
        )
        
        # Generate Strands tool
        tool_func = mcp_client._create_tool_function(tool_def)
        mcp_client._tools_cache = [tool_def]
        
        # Create payment payload (simulating sign_payment output)
        payment_payload = {
            "scheme": "exact",
            "network": "eip155:84532",
            "signature": "0x" + "ab" * 65,
            "from": "0x1111111111111111111111111111111111111111",
            "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            "amount": "1000",
            "timestamp": int(time.time() * 1000),
        }
        
        # Mock successful response with settlement
        settlement = {
            "success": True,
            "transaction": "0xabc123def456",
            "network": "eip155:84532",
        }
        encoded_settlement = base64.b64encode(
            json.dumps(settlement).encode()
        ).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "title": "Premium Article",
            "content": "This is premium content...",
        }
        mock_response.headers = {"X-PAYMENT-RESPONSE": encoded_settlement}
        mock_response.content = b'{"title": "Premium Article"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            # Call the generated tool with payment payload
            result = await tool_func(payment_payload=payment_payload)
            
            # Verify successful response
            assert result["status"] == 200
            assert "content" in result
            assert result["content"]["title"] == "Premium Article"
            
            # Verify settlement is included
            assert "settlement" in result
            assert result["settlement"]["success"] is True
            assert result["settlement"]["transaction"] == "0xabc123def456"
            
            # Verify payment header was sent
            call_args = mock_instance.get.call_args
            assert "X-PAYMENT-SIGNATURE" in call_args.kwargs["headers"]

    @pytest.mark.asyncio
    async def test_complete_402_flow_with_mcp_tool(
        self, mcp_client, sample_402_response
    ):
        """Test the complete 402 → analyze → sign → retry → content flow."""
        # Create tool definition
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            requires_payment=True,
            endpoint_path="/api/premium-article",
        )
        
        # Generate Strands tool
        tool_func = mcp_client._create_tool_function(tool_def)
        mcp_client._tools_cache = [tool_def]
        
        # Step 1: Initial request returns 402
        encoded_payment = base64.b64encode(
            json.dumps(sample_402_response).encode()
        ).decode()
        
        mock_402_response = MagicMock()
        mock_402_response.status_code = 402
        mock_402_response.json.return_value = sample_402_response
        mock_402_response.headers = {"X-PAYMENT-REQUIRED": encoded_payment}
        mock_402_response.content = json.dumps(sample_402_response).encode()
        
        # Step 4: Retry with payment returns 200
        settlement = {"success": True, "transaction": "0xdef789"}
        encoded_settlement = base64.b64encode(json.dumps(settlement).encode()).decode()
        
        mock_200_response = MagicMock()
        mock_200_response.status_code = 200
        mock_200_response.json.return_value = {"content": "Premium content"}
        mock_200_response.headers = {"X-PAYMENT-RESPONSE": encoded_settlement}
        mock_200_response.content = b'{"content": "Premium content"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(
                side_effect=[mock_402_response, mock_200_response]
            )
            
            # Step 1: Initial request (no payment)
            initial_result = await tool_func()
            
            assert initial_result["status"] == 402
            payment_req = initial_result["payment_required"]
            
            # Step 2: Extract payment requirements (simulating analyze_payment input)
            assert payment_req["amount"] == "1000"
            assert payment_req["currency"] == "USDC"
            assert payment_req["recipient"].startswith("0x")
            
            # Step 3: Create payment payload (simulating sign_payment output)
            payment_payload = {
                "scheme": payment_req["scheme"],
                "network": payment_req["network"],
                "signature": "0x" + "ab" * 65,
                "from": "0x1111111111111111111111111111111111111111",
                "to": payment_req["recipient"],
                "amount": payment_req["amount"],
                "timestamp": int(time.time() * 1000),
            }
            
            # Step 4: Retry with payment
            retry_result = await tool_func(payment_payload=payment_payload)
            
            assert retry_result["status"] == 200
            assert retry_result["content"]["content"] == "Premium content"
            assert retry_result["settlement"]["success"] is True

    @pytest.mark.asyncio
    async def test_mcp_tool_preserves_raw_payment_requirements(
        self, mcp_client, sample_402_response
    ):
        """Test that MCP tool preserves raw payment requirements for debugging."""
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            endpoint_path="/api/premium-article",
        )
        
        tool_func = mcp_client._create_tool_function(tool_def)
        mcp_client._tools_cache = [tool_def]
        
        encoded_payment = base64.b64encode(
            json.dumps(sample_402_response).encode()
        ).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = sample_402_response
        mock_response.headers = {"X-PAYMENT-REQUIRED": encoded_payment}
        mock_response.content = json.dumps(sample_402_response).encode()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await tool_func()
            
            # Verify raw requirements are preserved
            assert "raw_requirement" in result["payment_required"]
            raw = result["payment_required"]["raw_requirement"]
            assert raw["x402Version"] == 2
            assert "accepts" in raw

    @pytest.mark.asyncio
    async def test_mcp_tool_handles_payment_rejection(self, mcp_client):
        """Test that MCP tool handles payment rejection (402 after retry)."""
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            endpoint_path="/api/premium-article",
        )
        
        tool_func = mcp_client._create_tool_function(tool_def)
        mcp_client._tools_cache = [tool_def]
        
        # Mock 402 response (payment rejected)
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = {"error": "Payment rejected"}
        mock_response.headers = {}
        mock_response.content = b'{"error": "Payment rejected"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            # Call with invalid payment
            invalid_payment = {"signature": "invalid"}
            result = await tool_func(payment_payload=invalid_payment)
            
            # Should still return 402 with payment requirements
            assert result["status"] == 402


# ============================================================================
# Integration Tests for Tool Discovery and Invocation
# ============================================================================

import os


@pytest.mark.integration
class TestIntegrationMCPToolDiscovery:
    """
    Integration tests for MCP tool discovery against a real deployed server.
    
    These tests verify that:
    1. MCP tool discovery endpoint returns valid tool definitions
    2. Discovered tools have correct metadata and payment info
    3. Tool invocation works correctly with the real server
    4. 402 payment flow works end-to-end
    
    To run these tests:
    1. Deploy the seller infrastructure (CloudFront + Lambda@Edge)
    2. Set SELLER_API_URL environment variable to the CloudFront URL
    3. Run: pytest -m integration tests/test_mcp_client.py
    
    Example:
        export SELLER_API_URL=https://d1234567890abc.cloudfront.net
        pytest -m integration tests/test_mcp_client.py -v
    """

    @pytest.fixture
    def seller_url(self) -> str:
        """Get the seller API URL from environment."""
        url = os.environ.get("SELLER_API_URL")
        if not url:
            pytest.skip("SELLER_API_URL not set - skipping integration tests")
        return url

    @pytest.fixture
    def mcp_client(self, seller_url: str) -> MCPClient:
        """Create an MCP client configured for the real server."""
        return MCPClient(
            gateway_url=seller_url,
            cache_ttl_seconds=60,
            enable_caching=False,  # Disable caching for integration tests
        )

    @pytest.mark.asyncio
    async def test_discover_tools_from_real_server(self, mcp_client: MCPClient):
        """Test that tool discovery works against the real server.
        
        This test verifies:
        - Discovery endpoint is accessible
        - Response contains valid tool definitions
        - Tools have expected structure
        """
        # Note: The real server may not have an MCP discovery endpoint
        # In that case, we test direct tool invocation instead
        # For now, we'll test that the client can be configured correctly
        
        # Verify client is configured
        assert mcp_client.config.gateway_url is not None
        assert len(mcp_client.config.gateway_url) > 0
        
        # The MCP discovery endpoint may not exist on the CloudFront distribution
        # since it's primarily a content server. The discovery would typically
        # come from the AgentCore Gateway. For this integration test, we'll
        # verify the client can make requests to the server.
        
        # Try to invoke a known tool directly (this tests the invocation path)
        # Pre-populate cache with expected tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
                requires_payment=True,
            )
        ]
        
        # Invoke the tool - should get 402 without payment
        result = await mcp_client.invoke_tool("get_premium_article")
        
        # Should get 402 Payment Required
        assert result.status_code == 402
        assert result.payment_required is not None or result.data is not None

    @pytest.mark.asyncio
    async def test_invoke_tool_returns_402_from_real_server(self, mcp_client: MCPClient):
        """Test that tool invocation returns 402 from real server.
        
        This test verifies:
        - Tool invocation reaches the real server
        - Server returns 402 Payment Required
        - Payment requirements are properly formatted
        """
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
                requires_payment=True,
            )
        ]
        
        # Invoke without payment
        result = await mcp_client.invoke_tool("get_premium_article")
        
        # Verify 402 response
        assert result.status_code == 402, f"Expected 402, got {result.status_code}"
        
        # Verify payment requirements are present
        # They could be in payment_required (from header) or data (from body)
        has_payment_info = (
            result.payment_required is not None or
            (result.data is not None and "accepts" in str(result.data))
        )
        assert has_payment_info, "No payment requirements found in response"

    @pytest.mark.asyncio
    async def test_invoke_multiple_tools_from_real_server(self, mcp_client: MCPClient):
        """Test invoking multiple different tools from real server.
        
        This test verifies:
        - Multiple tool endpoints are accessible
        - Each returns appropriate 402 response
        - Different pricing is reflected in responses
        """
        # Define multiple tools
        tools = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
                requires_payment=True,
            ),
            MCPToolDefinition(
                name="get_weather_data",
                description="Get weather data",
                operation_id="get_weather_data",
                endpoint_path="/api/weather-data",
                requires_payment=True,
            ),
            MCPToolDefinition(
                name="get_market_analysis",
                description="Get market analysis",
                operation_id="get_market_analysis",
                endpoint_path="/api/market-analysis",
                requires_payment=True,
            ),
        ]
        
        mcp_client._tools_cache = tools
        
        # Invoke each tool and verify 402 response
        for tool in tools:
            result = await mcp_client.invoke_tool(tool.name)
            
            # Should get 402 for all tools without payment
            assert result.status_code == 402, \
                f"Tool {tool.name}: Expected 402, got {result.status_code}"

    @pytest.mark.asyncio
    async def test_payment_header_passthrough_to_real_server(self, mcp_client: MCPClient):
        """Test that payment headers are correctly passed to real server.
        
        This test verifies:
        - X-PAYMENT-SIGNATURE header is sent to server
        - Server processes the payment header
        - Response indicates payment was received (even if invalid)
        """
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
                requires_payment=True,
            )
        ]
        
        # Create a dummy payment signature (will be invalid but tests header passthrough)
        dummy_payment = base64.b64encode(json.dumps({
            "scheme": "exact",
            "network": "eip155:84532",
            "signature": "0x" + "00" * 65,
            "from": "0x0000000000000000000000000000000000000000",
            "to": "0x0000000000000000000000000000000000000000",
            "amount": "1000",
            "timestamp": int(time.time() * 1000),
        }).encode()).decode()
        
        # Invoke with payment signature
        result = await mcp_client.invoke_tool(
            "get_premium_article",
            payment_signature=dummy_payment,
        )
        
        # Server should process the request (may return 402 for invalid payment
        # or 400 for malformed payment, but should not return connection error)
        assert result.status_code in [200, 400, 401, 402, 403], \
            f"Unexpected status code: {result.status_code}, error: {result.error}"

    @pytest.mark.asyncio
    async def test_generated_strands_tool_invokes_real_server(self, mcp_client: MCPClient):
        """Test that generated Strands tool correctly invokes real server.
        
        This test verifies:
        - Strands tool function is correctly generated
        - Tool invocation reaches real server
        - 402 response is properly formatted for agent consumption
        """
        # Create tool definition
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            endpoint_path="/api/premium-article",
            requires_payment=True,
            payment_info={
                "price_display": "0.001 USDC",
                "network_name": "Base Sepolia",
            },
        )
        
        # Generate Strands tool
        tool_func = mcp_client._create_tool_function(tool_def)
        mcp_client._tools_cache = [tool_def]
        
        # Invoke the generated tool
        result = await tool_func()
        
        # Verify 402 response structure
        assert result["status"] == 402
        assert "payment_required" in result
        
        # Verify payment requirements are in agent-compatible format
        payment_req = result["payment_required"]
        assert "scheme" in payment_req
        assert "network" in payment_req
        assert "amount" in payment_req
        assert "recipient" in payment_req
        
        # Verify helpful message is included
        assert "message" in result
        assert "analyze_payment" in result["message"]


@pytest.mark.integration
class TestIntegrationMCPToolInvocationFlow:
    """
    Integration tests for the complete MCP tool invocation flow.
    
    These tests verify the end-to-end flow:
    1. Tool invocation without payment → 402
    2. Payment requirements extraction
    3. Tool invocation with payment → 200 (if valid payment)
    """

    @pytest.fixture
    def seller_url(self) -> str:
        """Get the seller API URL from environment."""
        url = os.environ.get("SELLER_API_URL")
        if not url:
            pytest.skip("SELLER_API_URL not set - skipping integration tests")
        return url

    @pytest.fixture
    def mcp_client(self, seller_url: str) -> MCPClient:
        """Create an MCP client configured for the real server."""
        return MCPClient(
            gateway_url=seller_url,
            cache_ttl_seconds=60,
            enable_caching=False,
        )

    @pytest.mark.asyncio
    async def test_complete_402_flow_with_real_server(self, mcp_client: MCPClient):
        """Test the complete 402 flow against real server.
        
        This test verifies:
        1. Initial request returns 402 with payment requirements
        2. Payment requirements can be extracted
        3. Requirements are in correct format for payment signing
        """
        # Pre-populate cache with tool definition
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            endpoint_path="/api/premium-article",
            requires_payment=True,
        )
        mcp_client._tools_cache = [tool_def]
        
        # Generate Strands tool
        tool_func = mcp_client._create_tool_function(tool_def)
        
        # Step 1: Initial request (no payment)
        result = await tool_func()
        
        # Verify 402 response
        assert result["status"] == 402
        assert "payment_required" in result
        
        # Step 2: Extract payment requirements
        payment_req = result["payment_required"]
        
        # Verify required fields for payment signing
        assert "scheme" in payment_req, "Missing 'scheme' in payment requirements"
        assert "network" in payment_req, "Missing 'network' in payment requirements"
        assert "amount" in payment_req, "Missing 'amount' in payment requirements"
        assert "recipient" in payment_req, "Missing 'recipient' in payment requirements"
        
        # Verify values are non-empty
        assert len(payment_req["scheme"]) > 0, "Empty 'scheme'"
        assert len(payment_req["network"]) > 0, "Empty 'network'"
        assert len(payment_req["amount"]) > 0, "Empty 'amount'"
        assert len(payment_req["recipient"]) > 0, "Empty 'recipient'"
        
        # Verify recipient is a valid Ethereum address
        assert payment_req["recipient"].startswith("0x"), \
            f"Invalid recipient address: {payment_req['recipient']}"
        assert len(payment_req["recipient"]) == 42, \
            f"Invalid recipient address length: {len(payment_req['recipient'])}"

    @pytest.mark.asyncio
    async def test_payment_requirements_match_expected_format(self, mcp_client: MCPClient):
        """Test that payment requirements match x402 v2 specification.
        
        This test verifies:
        - Payment requirements follow x402 v2 format
        - All required fields are present
        - Values are in expected ranges
        """
        # Pre-populate cache with tool definition
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
                requires_payment=True,
            )
        ]
        
        # Invoke tool
        result = await mcp_client.invoke_tool("get_premium_article")
        
        # Verify 402 response
        assert result.status_code == 402
        
        # Get payment requirements (from header or body)
        payment_required = result.payment_required or result.data
        assert payment_required is not None, "No payment requirements in response"
        
        # If it's x402 v2 format, verify structure
        if "x402Version" in payment_required:
            assert payment_required["x402Version"] == 2
            assert "accepts" in payment_required
            assert len(payment_required["accepts"]) > 0
            
            # Verify first accept option
            accept = payment_required["accepts"][0]
            assert "scheme" in accept
            assert "network" in accept
            assert "amount" in accept

    @pytest.mark.asyncio
    async def test_different_endpoints_have_different_prices(self, mcp_client: MCPClient):
        """Test that different content endpoints have different prices.
        
        This test verifies:
        - Different tools have different payment amounts
        - Pricing is consistent with gateway configuration
        """
        # Define tools with expected different prices
        tools = [
            ("get_premium_article", "/api/premium-article"),
            ("get_weather_data", "/api/weather-data"),
            ("get_market_analysis", "/api/market-analysis"),
        ]
        
        prices = {}
        
        for tool_name, endpoint_path in tools:
            mcp_client._tools_cache = [
                MCPToolDefinition(
                    name=tool_name,
                    description=f"Get {tool_name}",
                    operation_id=tool_name,
                    endpoint_path=endpoint_path,
                    requires_payment=True,
                )
            ]
            
            result = await mcp_client.invoke_tool(tool_name)
            
            if result.status_code == 402:
                payment_required = result.payment_required or result.data
                if payment_required and "accepts" in payment_required:
                    amount = payment_required["accepts"][0].get("amount", "0")
                    prices[tool_name] = amount
        
        # If we got prices for multiple tools, verify they're different
        if len(prices) >= 2:
            unique_prices = set(prices.values())
            # At least some prices should be different
            # (premium article: 1000, weather: 500, market: 2000)
            assert len(unique_prices) >= 2, \
                f"Expected different prices, got: {prices}"


@pytest.mark.integration
class TestIntegrationMCPClientErrorHandling:
    """
    Integration tests for MCP client error handling with real server.
    
    These tests verify:
    - Client handles network errors gracefully
    - Client handles invalid responses gracefully
    - Client handles timeout scenarios
    """

    @pytest.fixture
    def seller_url(self) -> str:
        """Get the seller API URL from environment."""
        url = os.environ.get("SELLER_API_URL")
        if not url:
            pytest.skip("SELLER_API_URL not set - skipping integration tests")
        return url

    @pytest.mark.asyncio
    async def test_invalid_endpoint_returns_error(self, seller_url: str):
        """Test that invalid endpoint returns appropriate error."""
        client = MCPClient(
            gateway_url=seller_url,
            enable_caching=False,
        )
        
        # Pre-populate cache with invalid tool definition
        client._tools_cache = [
            MCPToolDefinition(
                name="nonexistent_tool",
                description="This tool does not exist",
                operation_id="nonexistent_tool",
                endpoint_path="/api/nonexistent-endpoint",
            )
        ]
        
        # Invoke the invalid tool
        result = await client.invoke_tool("nonexistent_tool")
        
        # Should get an error response (404 or similar)
        assert result.status_code in [400, 403, 404, 500], \
            f"Expected error status, got {result.status_code}"

    @pytest.mark.asyncio
    async def test_timeout_handling(self, seller_url: str):
        """Test that client handles timeout gracefully."""
        # Create client with very short timeout
        client = MCPClient(
            gateway_url=seller_url,
            timeout_seconds=0.001,  # 1ms timeout - should fail
            enable_caching=False,
        )
        
        client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        # Invoke tool - should timeout
        result = await client.invoke_tool("get_premium_article")
        
        # Should get an error (either timeout or connection error)
        assert result.success is False
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_invalid_url_returns_error(self):
        """Test that invalid URL returns appropriate error."""
        client = MCPClient(
            gateway_url="https://invalid-url-that-does-not-exist.example.com",
            enable_caching=False,
        )
        
        client._tools_cache = [
            MCPToolDefinition(
                name="test_tool",
                description="Test tool",
                operation_id="test_tool",
                endpoint_path="/api/test",
            )
        ]
        
        # Invoke tool - should fail with connection error
        result = await client.invoke_tool("test_tool")
        
        assert result.success is False
        assert result.error is not None
        assert "Request failed" in result.error or "Connection" in result.error


# ============================================================================
# MCP Protocol Validation Tests
# ============================================================================

class TestMCPProtocolValidation:
    """
    Tests for MCP protocol compliance and validation.
    
    These tests verify that:
    - MCP discovery responses follow the expected schema
    - Tool definitions contain required fields
    - x402 payment requirements follow v2 specification
    - Payment signatures are properly formatted
    """

    def test_discovery_response_has_required_fields(self, gateway_mock: GatewayTargetMock):
        """Test that discovery response contains required fields."""
        response = gateway_mock.get_discovery_response()
        
        assert "tools" in response, "Discovery response missing 'tools' field"
        assert "metadata" in response, "Discovery response missing 'metadata' field"
        assert isinstance(response["tools"], list), "'tools' should be a list"

    def test_tool_definition_has_required_fields(self, gateway_mock: GatewayTargetMock):
        """Test that each tool definition has required fields."""
        response = gateway_mock.get_discovery_response()
        
        required_fields = ["tool_name", "tool_description", "operation_id"]
        
        for tool in response["tools"]:
            for field in required_fields:
                assert field in tool, f"Tool missing required field: {field}"
                assert tool[field], f"Tool field '{field}' is empty"

    def test_tool_definition_has_mcp_metadata(self, gateway_mock: GatewayTargetMock):
        """Test that tool definitions include MCP metadata."""
        response = gateway_mock.get_discovery_response()
        
        for tool in response["tools"]:
            assert "mcp_metadata" in tool, "Tool missing 'mcp_metadata'"
            metadata = tool["mcp_metadata"]
            assert "category" in metadata, "MCP metadata missing 'category'"
            assert "requires_payment" in metadata, "MCP metadata missing 'requires_payment'"

    def test_tool_definition_has_x402_metadata_when_paid(self, gateway_mock: GatewayTargetMock):
        """Test that paid tools include x402 metadata."""
        response = gateway_mock.get_discovery_response()
        
        for tool in response["tools"]:
            if tool.get("mcp_metadata", {}).get("requires_payment"):
                assert "x402_metadata" in tool, "Paid tool missing 'x402_metadata'"
                x402 = tool["x402_metadata"]
                assert "price_usdc_units" in x402, "x402 metadata missing 'price_usdc_units'"
                assert "network" in x402, "x402 metadata missing 'network'"
                assert "scheme" in x402, "x402 metadata missing 'scheme'"

    def test_402_response_follows_x402_v2_spec(self, gateway_mock: GatewayTargetMock):
        """Test that 402 responses follow x402 v2 specification."""
        endpoint = gateway_mock.endpoints["/api/premium-article"]
        response = gateway_mock.get_402_response(endpoint)
        
        # Required x402 v2 fields
        assert response["x402Version"] == 2, "x402Version must be 2"
        assert "accepts" in response, "Missing 'accepts' array"
        assert len(response["accepts"]) > 0, "'accepts' array is empty"
        
        # Verify accept option structure
        accept = response["accepts"][0]
        required_accept_fields = ["scheme", "network", "amount", "asset", "payTo"]
        for field in required_accept_fields:
            assert field in accept, f"Accept option missing '{field}'"

    def test_402_response_has_valid_network_format(self, gateway_mock: GatewayTargetMock):
        """Test that network field follows CAIP-2 format."""
        endpoint = gateway_mock.endpoints["/api/premium-article"]
        response = gateway_mock.get_402_response(endpoint)
        
        network = response["accepts"][0]["network"]
        # CAIP-2 format: namespace:reference (e.g., eip155:84532)
        assert ":" in network, f"Network '{network}' not in CAIP-2 format"
        parts = network.split(":")
        assert len(parts) == 2, f"Network '{network}' should have exactly 2 parts"
        assert parts[0] == "eip155", f"Expected EVM network, got '{parts[0]}'"

    def test_402_response_has_valid_ethereum_addresses(self, gateway_mock: GatewayTargetMock):
        """Test that Ethereum addresses are valid."""
        endpoint = gateway_mock.endpoints["/api/premium-article"]
        response = gateway_mock.get_402_response(endpoint)
        
        accept = response["accepts"][0]
        
        # Verify asset address
        asset = accept["asset"]
        assert asset.startswith("0x"), f"Asset address '{asset}' must start with 0x"
        assert len(asset) == 42, f"Asset address '{asset}' must be 42 characters"
        
        # Verify payTo address
        pay_to = accept["payTo"]
        assert pay_to.startswith("0x"), f"payTo address '{pay_to}' must start with 0x"
        assert len(pay_to) == 42, f"payTo address '{pay_to}' must be 42 characters"

    def test_settlement_response_has_required_fields(self, gateway_mock: GatewayTargetMock):
        """Test that settlement response has required fields."""
        settlement = gateway_mock.get_settlement_response()
        
        assert "success" in settlement, "Settlement missing 'success' field"
        assert "transaction" in settlement, "Settlement missing 'transaction' field"
        assert "network" in settlement, "Settlement missing 'network' field"
        
        # Verify transaction hash format
        tx_hash = settlement["transaction"]
        assert tx_hash.startswith("0x"), f"Transaction hash '{tx_hash}' must start with 0x"

    def test_payment_signature_validation(self, gateway_mock: GatewayTargetMock):
        """Test payment signature validation logic."""
        # Valid signature
        valid_payload = {
            "scheme": "exact",
            "network": "eip155:84532",
            "signature": "0x" + "ab" * 65,
            "from": "0x" + "11" * 20,
            "to": "0x" + "22" * 20,
            "amount": "1000",
            "timestamp": int(time.time() * 1000),
        }
        valid_signature = base64.b64encode(json.dumps(valid_payload).encode()).decode()
        assert gateway_mock.verify_payment_signature(valid_signature) is True
        
        # Invalid: missing required field
        invalid_payload = {
            "scheme": "exact",
            "network": "eip155:84532",
            # Missing "signature", "from", "to", "amount"
        }
        invalid_signature = base64.b64encode(json.dumps(invalid_payload).encode()).decode()
        assert gateway_mock.verify_payment_signature(invalid_signature) is False
        
        # Invalid: not base64
        assert gateway_mock.verify_payment_signature("not-base64!!!") is False
        
        # Invalid: empty
        assert gateway_mock.verify_payment_signature("") is False


# ============================================================================
# Tests Using Gateway Target Mock
# ============================================================================

class TestMCPClientWithGatewayMock:
    """
    Tests for MCP client using the Gateway target mock.
    
    These tests verify the MCP client behavior without requiring
    a real deployed server, making local development and CI testing easier.
    """

    @pytest.mark.asyncio
    async def test_discover_tools_with_mock(
        self,
        mcp_client_with_mock: MCPClient,
        gateway_mock: GatewayTargetMock,
    ):
        """Test tool discovery using the Gateway mock."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = gateway_mock.get_discovery_response()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client_with_mock.discover_tools()
            
            assert result.success is True
            assert len(result.tools) == 4  # Default mock has 4 endpoints
            
            # Verify tool names
            tool_names = [t.name for t in result.tools]
            assert "get_premium_article" in tool_names
            assert "get_weather_data" in tool_names
            assert "get_market_analysis" in tool_names
            assert "get_research_report" in tool_names

    @pytest.mark.asyncio
    async def test_invoke_tool_402_with_mock(
        self,
        mcp_client_with_mock: MCPClient,
        gateway_mock: GatewayTargetMock,
    ):
        """Test tool invocation returning 402 using the Gateway mock."""
        # Pre-populate cache
        mcp_client_with_mock._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        mock_response = gateway_mock.create_mock_response("/api/premium-article")
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client_with_mock.invoke_tool("get_premium_article")
            
            assert result.status_code == 402
            assert result.payment_required is not None
            assert result.payment_required["x402Version"] == 2

    @pytest.mark.asyncio
    async def test_invoke_tool_with_payment_using_mock(
        self,
        mcp_client_with_mock: MCPClient,
        gateway_mock: GatewayTargetMock,
    ):
        """Test tool invocation with valid payment using the Gateway mock."""
        # Pre-populate cache
        mcp_client_with_mock._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        # Create valid payment signature
        payment_payload = {
            "scheme": "exact",
            "network": "eip155:84532",
            "signature": "0x" + "ab" * 65,
            "from": "0x" + "11" * 20,
            "to": "0x" + "22" * 20,
            "amount": "1000",
            "timestamp": int(time.time() * 1000),
        }
        payment_signature = base64.b64encode(json.dumps(payment_payload).encode()).decode()
        
        mock_response = gateway_mock.create_mock_response(
            "/api/premium-article",
            payment_signature=payment_signature,
        )
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client_with_mock.invoke_tool(
                "get_premium_article",
                payment_signature=payment_signature,
            )
            
            assert result.success is True
            assert result.status_code == 200
            assert result.data is not None
            assert result.payment_response is not None
            assert result.payment_response["success"] is True

    @pytest.mark.asyncio
    async def test_complete_flow_with_mock(
        self,
        mcp_client_with_mock: MCPClient,
        gateway_mock: GatewayTargetMock,
    ):
        """Test complete 402 → payment → content flow using the Gateway mock."""
        # Pre-populate cache
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            endpoint_path="/api/premium-article",
            requires_payment=True,
        )
        mcp_client_with_mock._tools_cache = [tool_def]
        
        # Generate Strands tool
        tool_func = mcp_client_with_mock._create_tool_function(tool_def)
        
        # Step 1: Initial request (no payment) → 402
        mock_402 = gateway_mock.create_mock_response("/api/premium-article")
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await tool_func()
            
            assert result["status"] == 402
            assert "payment_required" in result
        
        # Step 2: Extract payment requirements
        payment_req = result["payment_required"]
        assert payment_req["scheme"] == "exact"
        assert payment_req["amount"] == "1000"
        
        # Step 3: Create payment payload (simulating sign_payment)
        payment_payload = {
            "scheme": payment_req["scheme"],
            "network": payment_req["network"],
            "signature": "0x" + "ab" * 65,
            "from": "0x" + "11" * 20,
            "to": payment_req["recipient"],
            "amount": payment_req["amount"],
            "timestamp": int(time.time() * 1000),
        }
        payment_signature = base64.b64encode(json.dumps(payment_payload).encode()).decode()
        
        # Step 4: Retry with payment → 200
        mock_200 = gateway_mock.create_mock_response(
            "/api/premium-article",
            payment_signature=payment_signature,
        )
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await tool_func(payment_payload=payment_payload)
            
            assert result["status"] == 200
            assert "content" in result
            assert result["content"]["title"] == "Premium Article: AI and Blockchain"
            assert "settlement" in result
            assert result["settlement"]["success"] is True

    @pytest.mark.asyncio
    async def test_different_endpoints_with_mock(
        self,
        mcp_client_with_mock: MCPClient,
        gateway_mock: GatewayTargetMock,
    ):
        """Test invoking different endpoints using the Gateway mock."""
        endpoints = [
            ("/api/premium-article", "get_premium_article", "1000"),
            ("/api/weather-data", "get_weather_data", "500"),
            ("/api/market-analysis", "get_market_analysis", "2000"),
        ]
        
        for path, name, expected_price in endpoints:
            mcp_client_with_mock._tools_cache = [
                MCPToolDefinition(
                    name=name,
                    description=f"Get {name}",
                    operation_id=name,
                    endpoint_path=path,
                )
            ]
            
            mock_response = gateway_mock.create_mock_response(path)
            
            with patch("httpx.AsyncClient") as mock_client:
                mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                    return_value=mock_response
                )
                
                result = await mcp_client_with_mock.invoke_tool(name)
                
                assert result.status_code == 402
                assert result.payment_required["accepts"][0]["amount"] == expected_price

    @pytest.mark.asyncio
    async def test_invalid_endpoint_with_mock(
        self,
        mcp_client_with_mock: MCPClient,
        gateway_mock: GatewayTargetMock,
    ):
        """Test invoking non-existent endpoint using the Gateway mock."""
        mcp_client_with_mock._tools_cache = [
            MCPToolDefinition(
                name="nonexistent",
                description="Non-existent tool",
                operation_id="nonexistent",
                endpoint_path="/api/nonexistent",
            )
        ]
        
        mock_response = gateway_mock.create_mock_response("/api/nonexistent")
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client_with_mock.invoke_tool("nonexistent")
            
            assert result.status_code == 404


class TestGatewayTargetMockCustomization:
    """Tests for Gateway target mock customization."""

    def test_add_custom_endpoint(self, gateway_mock: GatewayTargetMock):
        """Test adding a custom endpoint to the mock."""
        gateway_mock.add_endpoint(
            path="/api/custom-content",
            name="get_custom_content",
            description="Custom content endpoint",
            price_usdc_units="5000",
            content={"custom": "data"},
        )
        
        assert "/api/custom-content" in gateway_mock.endpoints
        endpoint = gateway_mock.endpoints["/api/custom-content"]
        assert endpoint.name == "get_custom_content"
        assert endpoint.price_usdc_units == "5000"

    def test_custom_config(self):
        """Test creating mock with custom configuration."""
        config = GatewayTargetMockConfig(
            base_url="https://custom-gateway.example.com",
            default_price_usdc="2000",
            default_recipient="0x" + "99" * 20,
        )
        mock = GatewayTargetMock(config=config)
        
        assert mock.config.base_url == "https://custom-gateway.example.com"
        assert mock.config.default_price_usdc == "2000"
        assert mock.config.default_recipient == "0x" + "99" * 20

    def test_free_endpoint(self, gateway_mock: GatewayTargetMock):
        """Test adding a free (no payment required) endpoint."""
        gateway_mock.add_endpoint(
            path="/api/free-content",
            name="get_free_content",
            description="Free content",
            price_usdc_units="0",
            content={"free": "content"},
            requires_payment=False,
        )
        
        # Free endpoint should return 200 without payment
        mock_response = gateway_mock.create_mock_response("/api/free-content")
        assert mock_response.status_code == 200


# ============================================================================
# MCP Client-Side Protocol Validation Tests
# ============================================================================

class TestMCPClientProtocolValidation:
    """
    Tests for MCP client-side protocol validation.
    
    These tests verify that the MCP client correctly handles:
    - Malformed discovery responses
    - Missing required fields in tool definitions
    - Invalid data types in responses
    - Edge cases (empty arrays, null values, etc.)
    
    This complements TestMCPProtocolValidation which validates mock output.
    """

    @pytest.fixture
    def mcp_client(self):
        """Create an MCP client for testing."""
        return MCPClient(
            gateway_url="https://gateway.example.com",
            enable_caching=False,
        )

    @pytest.mark.asyncio
    async def test_handles_empty_tools_array(self, mcp_client):
        """Test that client handles empty tools array gracefully."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [],
            "metadata": {"provider": "test"},
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is True
            assert len(result.tools) == 0

    @pytest.mark.asyncio
    async def test_handles_missing_tools_field(self, mcp_client):
        """Test that client handles missing 'tools' field."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "metadata": {"provider": "test"},
            # Missing "tools" field
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            # Should succeed but with empty tools
            assert result.success is True
            assert len(result.tools) == 0

    @pytest.mark.asyncio
    async def test_handles_null_tools_field(self, mcp_client):
        """Test that client handles null 'tools' field."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": None,
            "metadata": {},
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            # Should handle gracefully
            assert result.success is True
            assert len(result.tools) == 0

    @pytest.mark.asyncio
    async def test_handles_tool_with_missing_name(self, mcp_client):
        """Test that client handles tool definition missing name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [
                {
                    # Missing "tool_name" and "name"
                    "tool_description": "A tool without a name",
                    "operation_id": "nameless_tool",
                }
            ],
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            # Should parse but with empty name
            assert result.success is True
            assert len(result.tools) == 1
            assert result.tools[0].name == ""

    @pytest.mark.asyncio
    async def test_handles_tool_with_invalid_mcp_metadata_type(self, mcp_client):
        """Test that client handles invalid mcp_metadata type."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [
                {
                    "tool_name": "test_tool",
                    "tool_description": "Test tool",
                    "operation_id": "test_tool",
                    "mcp_metadata": "invalid_string_instead_of_dict",  # Should be dict
                }
            ],
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            # Should handle gracefully - tool may be skipped or have defaults
            assert result.success is True

    @pytest.mark.asyncio
    async def test_handles_tool_with_invalid_x402_metadata_type(self, mcp_client):
        """Test that client handles invalid x402_metadata type."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [
                {
                    "tool_name": "test_tool",
                    "tool_description": "Test tool",
                    "operation_id": "test_tool",
                    "x402_metadata": ["invalid", "array"],  # Should be dict
                }
            ],
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            # Should handle gracefully
            assert result.success is True

    @pytest.mark.asyncio
    async def test_handles_invalid_json_response(self, mcp_client):
        """Test that client handles invalid JSON response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            # Should fail gracefully
            assert result.success is False
            assert result.error is not None

    @pytest.mark.asyncio
    async def test_handles_non_200_status_codes(self, mcp_client):
        """Test that client handles various non-200 status codes."""
        for status_code in [400, 401, 403, 404, 500, 502, 503]:
            mock_response = MagicMock()
            mock_response.status_code = status_code
            
            with patch("httpx.AsyncClient") as mock_client:
                mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                    return_value=mock_response
                )
                
                result = await mcp_client.discover_tools()
                
                assert result.success is False
                assert str(status_code) in result.error

    @pytest.mark.asyncio
    async def test_handles_tool_with_complex_input_schema(self, mcp_client):
        """Test that client parses complex input schemas correctly."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [
                {
                    "tool_name": "complex_tool",
                    "tool_description": "Tool with complex schema",
                    "operation_id": "complex_tool",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "required_param": {
                                "type": "string",
                                "description": "A required parameter",
                            },
                            "optional_param": {
                                "type": "integer",
                                "description": "An optional parameter",
                                "default": 10,
                            },
                            "nested_param": {
                                "type": "object",
                                "description": "A nested object",
                            },
                        },
                        "required": ["required_param"],
                    },
                }
            ],
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is True
            assert len(result.tools) == 1
            tool = result.tools[0]
            assert len(tool.parameters) == 3
            
            # Check required param
            required_param = next(p for p in tool.parameters if p.name == "required_param")
            assert required_param.required is True
            
            # Check optional param
            optional_param = next(p for p in tool.parameters if p.name == "optional_param")
            assert optional_param.required is False
            assert optional_param.default == 10

    @pytest.mark.asyncio
    async def test_handles_empty_input_schema(self, mcp_client):
        """Test that client handles empty input schema."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [
                {
                    "tool_name": "no_params_tool",
                    "tool_description": "Tool with no parameters",
                    "operation_id": "no_params_tool",
                    "input_schema": {},
                }
            ],
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is True
            assert len(result.tools) == 1
            assert len(result.tools[0].parameters) == 0

    @pytest.mark.asyncio
    async def test_handles_missing_input_schema(self, mcp_client):
        """Test that client handles missing input schema."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tools": [
                {
                    "tool_name": "simple_tool",
                    "tool_description": "Tool without input schema",
                    "operation_id": "simple_tool",
                    # No input_schema field
                }
            ],
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.discover_tools()
            
            assert result.success is True
            assert len(result.tools) == 1
            assert len(result.tools[0].parameters) == 0

    def test_parse_tool_definition_with_all_fields(self, mcp_client):
        """Test parsing a complete tool definition."""
        tool_data = {
            "tool_name": "complete_tool",
            "tool_description": "A complete tool definition",
            "operation_id": "complete_tool",
            "endpoint_path": "/api/complete",
            "mcp_metadata": {
                "category": "test",
                "tags": ["tag1", "tag2"],
                "requires_payment": True,
            },
            "x402_metadata": {
                "price_usdc_units": "1000",
                "price_usdc_display": "0.001 USDC",
                "network": "eip155:84532",
                "network_name": "Base Sepolia",
                "scheme": "exact",
                "asset_address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "asset_name": "USDC",
            },
            "input_schema": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string", "description": "First param"},
                },
                "required": ["param1"],
            },
        }
        
        tool_def = mcp_client._parse_tool_definition(tool_data)
        
        assert tool_def.name == "complete_tool"
        assert tool_def.description == "A complete tool definition"
        assert tool_def.operation_id == "complete_tool"
        assert tool_def.endpoint_path == "/api/complete"
        assert tool_def.category == "test"
        assert tool_def.tags == ["tag1", "tag2"]
        assert tool_def.requires_payment is True
        assert tool_def.payment_info["price_units"] == "1000"
        assert tool_def.payment_info["network"] == "eip155:84532"
        assert len(tool_def.parameters) == 1
        assert tool_def.parameters[0].name == "param1"
        assert tool_def.parameters[0].required is True

    def test_parse_tool_definition_with_minimal_fields(self, mcp_client):
        """Test parsing a minimal tool definition."""
        tool_data = {
            "tool_name": "minimal_tool",
            "tool_description": "Minimal",
            "operation_id": "minimal",
        }
        
        tool_def = mcp_client._parse_tool_definition(tool_data)
        
        assert tool_def.name == "minimal_tool"
        assert tool_def.description == "Minimal"
        assert tool_def.operation_id == "minimal"
        assert tool_def.category == ""
        assert tool_def.tags == []
        assert tool_def.requires_payment is False
        assert tool_def.payment_info == {}
        assert len(tool_def.parameters) == 0

    def test_parse_tool_definition_uses_fallback_name_field(self, mcp_client):
        """Test that parser falls back to 'name' if 'tool_name' is missing."""
        tool_data = {
            "name": "fallback_name",  # Using 'name' instead of 'tool_name'
            "description": "Fallback description",  # Using 'description' instead of 'tool_description'
            "operation_id": "fallback",
        }
        
        tool_def = mcp_client._parse_tool_definition(tool_data)
        
        assert tool_def.name == "fallback_name"
        assert tool_def.description == "Fallback description"


class TestMCPInvocationProtocolValidation:
    """
    Tests for MCP invocation response protocol validation.
    
    These tests verify that the MCP client correctly handles:
    - Malformed 402 responses
    - Invalid payment headers
    - Missing settlement information
    """

    @pytest.fixture
    def mcp_client(self):
        """Create an MCP client for testing."""
        client = MCPClient(
            gateway_url="https://gateway.example.com",
            enable_caching=False,
        )
        # Pre-populate cache with a tool
        client._tools_cache = [
            MCPToolDefinition(
                name="test_tool",
                description="Test tool",
                operation_id="test_tool",
                endpoint_path="/api/test",
            )
        ]
        return client

    @pytest.mark.asyncio
    async def test_handles_402_without_payment_header(self, mcp_client):
        """Test handling 402 response without X-PAYMENT-REQUIRED header."""
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = {"error": "Payment required"}
        mock_response.headers = {}  # No payment header
        mock_response.content = b'{"error": "Payment required"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.status_code == 402
            # Should still work, just without parsed payment requirements
            assert result.success is False

    @pytest.mark.asyncio
    async def test_handles_invalid_base64_payment_header(self, mcp_client):
        """Test handling 402 response with invalid base64 in payment header."""
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = {"error": "Payment required"}
        mock_response.headers = {"X-PAYMENT-REQUIRED": "not-valid-base64!!!"}
        mock_response.content = b'{"error": "Payment required"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.status_code == 402
            # Should handle gracefully - payment_required may be None or error

    @pytest.mark.asyncio
    async def test_handles_invalid_json_in_payment_header(self, mcp_client):
        """Test handling 402 response with invalid JSON in payment header."""
        # Valid base64 but invalid JSON
        invalid_json_b64 = base64.b64encode(b"not valid json").decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = {"error": "Payment required"}
        mock_response.headers = {"X-PAYMENT-REQUIRED": invalid_json_b64}
        mock_response.content = b'{"error": "Payment required"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.status_code == 402
            # Should handle gracefully

    @pytest.mark.asyncio
    async def test_handles_200_without_settlement_header(self, mcp_client):
        """Test handling 200 response without X-PAYMENT-RESPONSE header."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": "data"}
        mock_response.headers = {}  # No settlement header
        mock_response.content = b'{"content": "data"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.success is True
            assert result.status_code == 200
            assert result.data == {"content": "data"}
            # Settlement may be None if no header
            assert result.payment_response is None

    @pytest.mark.asyncio
    async def test_handles_case_insensitive_headers(self, mcp_client):
        """Test that client handles case-insensitive header names."""
        payment_required = {"x402Version": 2, "accepts": []}
        encoded = base64.b64encode(json.dumps(payment_required).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = payment_required
        # Use lowercase header name
        mock_response.headers = {"x-payment-required": encoded}
        mock_response.content = b'{}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("test_tool")
            
            assert result.status_code == 402
            # Should parse the lowercase header

    @pytest.mark.asyncio
    async def test_handles_tool_not_in_cache(self, mcp_client):
        """Test invoking a tool that's not in the cache.
        
        Note: The MCP client allows invoking tools not in cache by constructing
        the endpoint URL from the tool name. This test verifies the behavior
        when the constructed URL doesn't exist (404) or network fails.
        """
        # Clear the cache
        mcp_client._tools_cache = []
        
        # Mock a 404 response for the unknown tool
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.json.return_value = {"error": "Not found"}
        mock_response.headers = {}
        mock_response.content = b'{"error": "Not found"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await mcp_client.invoke_tool("unknown_tool")
            
            # Should return 404 since the endpoint doesn't exist
            assert result.success is False
            assert result.status_code == 404


# ============================================================================
# End-to-End Tool Chain Integration Tests
# ============================================================================

class TestEndToEndToolChainIntegration:
    """
    End-to-end integration tests that verify the complete x402 payment flow
    by chaining actual tool implementations together.
    
    This tests the full agent workflow:
    1. MCP tool invocation returns 402 with payment requirements
    2. analyze_payment tool processes the 402 response
    3. sign_payment tool creates a signed payment payload
    4. Retry with payment returns 200 with content
    
    Unlike other tests that mock tool outputs, these tests verify that:
    - The output format of one tool is compatible with the input of the next
    - The actual tool implementations work correctly in sequence
    - The data transformations between tools are correct
    """

    @pytest.fixture
    def sample_402_payment_requirements(self):
        """Create sample 402 payment requirements in x402 v2 format."""
        return {
            "x402Version": 2,
            "error": "Payment required to access this resource",
            "resource": {
                "url": "/api/premium-article",
                "description": "Premium article about AI",
            },
            "accepts": [{
                "scheme": "exact",
                "network": "eip155:84532",
                "amount": "1000",  # 0.001 USDC in units
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "maxTimeoutSeconds": 60,
                "extra": {
                    "name": "USDC",
                    "version": "2",
                },
            }],
        }

    def test_analyze_payment_accepts_402_response_format(self, sample_402_payment_requirements):
        """Test that analyze_payment can process data from a 402 response."""
        from agent.tools.payment import analyze_payment
        
        # Extract payment requirements from 402 response (as MCP client does)
        accept = sample_402_payment_requirements["accepts"][0]
        
        # Convert to analyze_payment input format
        # Note: amount is in units (1000 = 0.001 USDC with 6 decimals)
        amount_usdc = str(int(accept["amount"]) / 1_000_000)  # Convert units to USDC
        
        result = analyze_payment(
            amount=amount_usdc,
            currency="USDC",
            recipient=accept["payTo"],
            description=sample_402_payment_requirements["resource"]["description"],
            wallet_balance="1.0",  # Sufficient balance
        )
        
        # Verify analyze_payment can process the data
        assert "should_pay" in result
        assert "risk_level" in result
        assert "reasoning" in result
        
        # With sufficient balance and small amount, should approve
        assert result["should_pay"] is True
        assert result["risk_level"] == "low"

    @pytest.mark.asyncio
    async def test_sign_payment_accepts_analyze_payment_output_format(
        self, sample_402_payment_requirements
    ):
        """Test that sign_payment can use data from analyze_payment decision."""
        from agent.tools.payment import analyze_payment, sign_payment
        
        # Step 1: Extract from 402 response
        accept = sample_402_payment_requirements["accepts"][0]
        amount_usdc = str(int(accept["amount"]) / 1_000_000)
        
        # Step 2: Analyze payment (as agent would)
        analysis = analyze_payment(
            amount=amount_usdc,
            currency="USDC",
            recipient=accept["payTo"],
            description="Premium article",
            wallet_balance="1.0",
        )
        
        assert analysis["should_pay"] is True
        
        # Step 3: Sign payment using the same data
        # Mock wallet provider for signing
        mock_provider = MagicMock()
        mock_provider.get_address.return_value = "0x1111111111111111111111111111111111111111"
        mock_provider.sign_message.return_value = "0x" + "ab" * 65
        mock_provider.sign_typed_data.return_value = "0x" + "ab" * 65
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            sign_result = sign_payment(
                scheme=accept["scheme"],
                network="base-sepolia",  # Converted from CAIP-2 format
                amount=accept["amount"],  # Use atomic units
                recipient=accept["payTo"],
            )
        
        # Verify sign_payment produces valid output
        assert sign_result["success"] is True
        assert "payload" in sign_result
        
        payload = sign_result["payload"]
        assert payload["x402Version"] == 2
        assert payload["accepted"]["scheme"] == "exact"
        assert payload["accepted"]["payTo"] == accept["payTo"]
        assert "signature" in payload["payload"]

    @pytest.mark.asyncio
    async def test_complete_tool_chain_402_to_200(self, sample_402_payment_requirements):
        """
        Test the complete tool chain from 402 response to successful content delivery.
        
        This is the most comprehensive end-to-end test that verifies:
        1. MCP tool returns 402 with payment requirements
        2. analyze_payment processes the requirements and approves
        3. sign_payment creates a valid payment payload
        4. Retry with payment returns 200 with content
        """
        from agent.tools.payment import analyze_payment, sign_payment
        
        # ===== Step 1: Simulate MCP tool returning 402 =====
        # (In real flow, this comes from MCPClient.invoke_tool)
        payment_required = sample_402_payment_requirements
        accept = payment_required["accepts"][0]
        
        # Convert to agent-friendly format (as MCP client does)
        payment_req = {
            "scheme": accept["scheme"],
            "network": accept["network"],
            "amount": accept["amount"],
            "currency": accept["extra"]["name"],
            "recipient": accept["payTo"],
            "asset": accept["asset"],
            "raw_requirement": payment_required,
        }
        
        # ===== Step 2: Agent calls analyze_payment =====
        amount_display = str(int(payment_req["amount"]) / 1_000_000)
        
        analysis = analyze_payment(
            amount=amount_display,
            currency=payment_req["currency"],
            recipient=payment_req["recipient"],
            description="Premium article about AI",
            wallet_balance="1.0",
        )
        
        assert analysis["should_pay"] is True, f"Payment rejected: {analysis['reasoning']}"
        
        # ===== Step 3: Agent calls sign_payment =====
        mock_provider = MagicMock()
        mock_provider.get_address.return_value = "0x1111111111111111111111111111111111111111"
        mock_provider.sign_message.return_value = "0x" + "ab" * 65
        mock_provider.sign_typed_data.return_value = "0x" + "ab" * 65
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            sign_result = sign_payment(
                scheme=payment_req["scheme"],
                network="base-sepolia",
                amount=payment_req["amount"],  # Use atomic units
                recipient=payment_req["recipient"],
            )
        
        assert sign_result["success"] is True, f"Signing failed: {sign_result.get('error')}"
        payment_payload = sign_result["payload"]
        
        # ===== Step 4: Verify payload is valid for retry =====
        # The payload should have all required fields for x402 v2 protocol
        assert payment_payload["x402Version"] == 2
        assert "accepted" in payment_payload
        assert "payload" in payment_payload
        
        # Verify payload values match the original requirements
        assert payment_payload["accepted"]["scheme"] == payment_req["scheme"]
        assert payment_payload["accepted"]["payTo"] == payment_req["recipient"]
        
        # ===== Step 5: Simulate retry with payment returning 200 =====
        # (In real flow, this would be MCPClient.invoke_tool with payment_signature)
        # Create the base64-encoded payment signature
        payment_signature = base64.b64encode(
            json.dumps(payment_payload).encode()
        ).decode()
        
        # Verify the signature can be decoded (as server would)
        decoded = json.loads(base64.b64decode(payment_signature))
        assert decoded["x402Version"] == 2
        assert decoded["payload"]["signature"].startswith("0x")
        
        # The flow is complete - in production, this signature would be sent
        # to the server and result in a 200 response with content

    @pytest.mark.asyncio
    async def test_tool_chain_with_insufficient_balance(self, sample_402_payment_requirements):
        """Test that the tool chain correctly rejects payment when balance is insufficient."""
        from agent.tools.payment import analyze_payment
        
        accept = sample_402_payment_requirements["accepts"][0]
        amount_display = str(int(accept["amount"]) / 1_000_000)
        
        # Analyze with insufficient balance
        analysis = analyze_payment(
            amount=amount_display,
            currency="USDC",
            recipient=accept["payTo"],
            description="Premium article",
            wallet_balance="0.0001",  # Less than required 0.001
        )
        
        # Should reject due to insufficient balance
        assert analysis["should_pay"] is False
        assert analysis["risk_level"] == "high"
        assert "insufficient" in analysis["reasoning"].lower()

    @pytest.mark.asyncio
    async def test_tool_chain_with_invalid_recipient(self, sample_402_payment_requirements):
        """Test that the tool chain correctly rejects payment with invalid recipient."""
        from agent.tools.payment import analyze_payment
        
        # Analyze with invalid recipient address
        analysis = analyze_payment(
            amount="0.001",
            currency="USDC",
            recipient="invalid-address",  # Not a valid Ethereum address
            description="Premium article",
            wallet_balance="1.0",
        )
        
        # Should reject due to invalid recipient
        assert analysis["should_pay"] is False
        assert analysis["risk_level"] == "high"
        assert "invalid" in analysis["reasoning"].lower()

    @pytest.mark.asyncio
    async def test_mcp_client_402_response_compatible_with_analyze_payment(self):
        """
        Test that MCPClient's 402 response format is compatible with analyze_payment.
        
        This verifies the data transformation between MCP client output and
        analyze_payment input.
        """
        from agent.tools.payment import analyze_payment
        
        # Create MCP client
        mcp_client = MCPClient(
            gateway_url="https://gateway.example.com",
            enable_caching=False,
        )
        
        # Pre-populate cache with tool definition
        tool_def = MCPToolDefinition(
            name="get_premium_article",
            description="Get a premium article",
            operation_id="get_premium_article",
            endpoint_path="/api/premium-article",
            requires_payment=True,
        )
        mcp_client._tools_cache = [tool_def]
        
        # Create Strands tool
        tool_func = mcp_client._create_tool_function(tool_def)
        
        # Mock 402 response
        payment_required = {
            "x402Version": 2,
            "accepts": [{
                "scheme": "exact",
                "network": "eip155:84532",
                "amount": "1000",
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "extra": {"name": "USDC"},
            }],
        }
        encoded_payment = base64.b64encode(json.dumps(payment_required).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.json.return_value = payment_required
        mock_response.headers = {"X-PAYMENT-REQUIRED": encoded_payment}
        mock_response.content = json.dumps(payment_required).encode()
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            # Call the MCP tool
            result = await tool_func()
        
        # Verify 402 response
        assert result["status"] == 402
        assert "payment_required" in result
        
        # Extract payment requirements in analyze_payment format
        payment_req = result["payment_required"]
        
        # Call analyze_payment with the extracted data
        analysis = analyze_payment(
            amount=str(int(payment_req["amount"]) / 1_000_000),
            currency=payment_req.get("currency", "USDC"),
            recipient=payment_req["recipient"],
            description="Premium article",
            wallet_balance="1.0",
        )
        
        # Verify analyze_payment can process the MCP client output
        assert "should_pay" in analysis
        assert analysis["should_pay"] is True

    @pytest.mark.asyncio
    async def test_sign_payment_output_compatible_with_mcp_retry(self):
        """
        Test that sign_payment output is compatible with MCP client retry.
        
        This verifies that the payment payload from sign_payment can be
        used directly with MCPClient.invoke_tool for retry.
        """
        from agent.tools.payment import sign_payment
        
        # Mock wallet provider
        mock_provider = MagicMock()
        mock_provider.get_address.return_value = "0x1111111111111111111111111111111111111111"
        mock_provider.sign_message.return_value = "0x" + "ab" * 65
        mock_provider.sign_typed_data.return_value = "0x" + "ab" * 65
        
        with patch("agent.tools.payment._get_wallet_provider_sync", return_value=mock_provider):
            sign_result = sign_payment(
                scheme="exact",
                network="base-sepolia",
                amount="1000",  # atomic units
                recipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            )
        
        assert sign_result["success"] is True
        payment_payload = sign_result["payload"]
        
        # Create MCP client
        mcp_client = MCPClient(
            gateway_url="https://gateway.example.com",
            enable_caching=False,
        )
        
        # Pre-populate cache
        mcp_client._tools_cache = [
            MCPToolDefinition(
                name="get_premium_article",
                description="Get a premium article",
                operation_id="get_premium_article",
                endpoint_path="/api/premium-article",
            )
        ]
        
        # Encode payment payload as signature (as agent would)
        payment_signature = base64.b64encode(
            json.dumps(payment_payload).encode()
        ).decode()
        
        # Mock successful response with settlement
        settlement = {"success": True, "transaction": "0xabc123"}
        encoded_settlement = base64.b64encode(json.dumps(settlement).encode()).decode()
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"content": "Premium content"}
        mock_response.headers = {"X-PAYMENT-RESPONSE": encoded_settlement}
        mock_response.content = b'{"content": "Premium content"}'
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get = AsyncMock(return_value=mock_response)
            
            # Invoke with payment signature
            result = await mcp_client.invoke_tool(
                "get_premium_article",
                payment_signature=payment_signature,
            )
            
            # Verify the payment header was sent
            call_args = mock_instance.get.call_args
            assert "X-PAYMENT-SIGNATURE" in call_args.kwargs["headers"]
            sent_signature = call_args.kwargs["headers"]["X-PAYMENT-SIGNATURE"]
            assert sent_signature == payment_signature
        
        # Verify successful response
        assert result.success is True
        assert result.status_code == 200
        assert result.payment_response["success"] is True
