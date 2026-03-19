"""
MCP (Model Context Protocol) Tool Discovery Client.

This module provides a client for discovering and invoking tools via the
AgentCore Gateway's MCP endpoint. The Gateway exposes content tools as
MCP tools that the agent can discover dynamically.

The MCP client:
1. Discovers available tools from the Gateway MCP endpoint
2. Converts MCP tool definitions to Strands-compatible tool functions
3. Handles x402 payment headers during tool invocation
4. Provides caching for tool discovery responses

Usage:
    from agent.mcp_client import MCPClient, discover_mcp_tools
    
    # Create client
    client = MCPClient(gateway_url="https://gateway.example.com")
    
    # Discover tools
    tools = await client.discover_tools()
    
    # Get Strands-compatible tool functions
    tool_functions = client.get_strands_tools()
    
    # Use with agent
    agent = create_payer_agent(additional_tools=tool_functions)
"""

import base64
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from functools import wraps

import httpx
from strands import tool

from .config import config
from .tracing import get_tracer
from .metrics import get_metrics_emitter


@dataclass
class MCPToolParameter:
    """Parameter definition for an MCP tool."""
    name: str
    type: str
    description: str = ""
    required: bool = False
    default: Any = None


@dataclass
class MCPToolDefinition:
    """Definition of an MCP tool discovered from the Gateway."""
    name: str
    description: str
    operation_id: str
    category: str = ""
    tags: list[str] = field(default_factory=list)
    parameters: list[MCPToolParameter] = field(default_factory=list)
    requires_payment: bool = False
    payment_info: dict[str, Any] = field(default_factory=dict)
    endpoint_path: str = ""
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "description": self.description,
            "operation_id": self.operation_id,
            "category": self.category,
            "tags": self.tags,
            "parameters": [
                {
                    "name": p.name,
                    "type": p.type,
                    "description": p.description,
                    "required": p.required,
                }
                for p in self.parameters
            ],
            "requires_payment": self.requires_payment,
            "payment_info": self.payment_info,
        }


@dataclass
class MCPDiscoveryResponse:
    """Response from MCP tool discovery."""
    success: bool
    tools: list[MCPToolDefinition] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    cached: bool = False
    discovered_at: float = field(default_factory=time.time)


@dataclass
class MCPInvocationResponse:
    """Response from MCP tool invocation."""
    success: bool
    status_code: int = 0
    data: Any = None
    payment_required: Optional[dict[str, Any]] = None
    payment_response: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    headers: dict[str, str] = field(default_factory=dict)


@dataclass
class MCPClientConfig:
    """Configuration for the MCP client."""
    gateway_url: str = ""
    mcp_discovery_path: str = "/mcp/tools"
    mcp_invoke_path: str = "/mcp/invoke"
    timeout_seconds: int = 30
    cache_ttl_seconds: int = 300
    enable_caching: bool = True


class MCPClient:
    """
    Client for discovering and invoking MCP tools via AgentCore Gateway.
    
    The MCP client handles:
    - Tool discovery from the Gateway MCP endpoint
    - Caching of discovery responses
    - Tool invocation with x402 header passthrough
    - Conversion of MCP tools to Strands-compatible functions
    
    Attributes:
        config: MCP client configuration
        _tools_cache: Cached tool definitions
        _cache_timestamp: When the cache was last updated
    """
    
    def __init__(
        self,
        gateway_url: Optional[str] = None,
        mcp_discovery_path: str = "/mcp/tools",
        mcp_invoke_path: str = "/mcp/invoke",
        timeout_seconds: int = 30,
        cache_ttl_seconds: int = 300,
        enable_caching: bool = True,
    ):
        """
        Initialize the MCP client.
        
        Args:
            gateway_url: Base URL of the AgentCore Gateway
            mcp_discovery_path: Path for tool discovery endpoint
            mcp_invoke_path: Path for tool invocation endpoint
            timeout_seconds: Request timeout
            cache_ttl_seconds: How long to cache discovery responses
            enable_caching: Whether to cache discovery responses
        """
        self.config = MCPClientConfig(
            gateway_url=gateway_url or config.seller_api_url,
            mcp_discovery_path=mcp_discovery_path,
            mcp_invoke_path=mcp_invoke_path,
            timeout_seconds=timeout_seconds,
            cache_ttl_seconds=cache_ttl_seconds,
            enable_caching=enable_caching,
        )
        
        self._tools_cache: list[MCPToolDefinition] = []
        self._cache_timestamp: float = 0
        self._strands_tools: list[Callable] = []
    
    def _is_cache_valid(self) -> bool:
        """Check if the tools cache is still valid."""
        if not self.config.enable_caching:
            return False
        if not self._tools_cache:
            return False
        age = time.time() - self._cache_timestamp
        return age < self.config.cache_ttl_seconds
    
    def _parse_tool_definition(self, tool_data: dict[str, Any]) -> MCPToolDefinition:
        """Parse a tool definition from the discovery response."""
        # Parse parameters
        parameters = []
        input_schema = tool_data.get("input_schema", {})
        properties = input_schema.get("properties", {})
        required_params = input_schema.get("required", [])
        
        for param_name, param_info in properties.items():
            parameters.append(MCPToolParameter(
                name=param_name,
                type=param_info.get("type", "string"),
                description=param_info.get("description", ""),
                required=param_name in required_params,
                default=param_info.get("default"),
            ))
        
        # Parse payment info
        payment_info = {}
        x402_metadata = tool_data.get("x402_metadata", {})
        if x402_metadata:
            payment_info = {
                "price_units": x402_metadata.get("price_usdc_units", ""),
                "price_display": x402_metadata.get("price_usdc_display", ""),
                "network": x402_metadata.get("network", ""),
                "network_name": x402_metadata.get("network_name", ""),
                "scheme": x402_metadata.get("scheme", ""),
                "asset_address": x402_metadata.get("asset_address", ""),
                "asset_name": x402_metadata.get("asset_name", ""),
            }
        
        # Get MCP metadata
        mcp_metadata = tool_data.get("mcp_metadata", {})
        
        return MCPToolDefinition(
            name=tool_data.get("tool_name", tool_data.get("name", "")),
            description=tool_data.get("tool_description", tool_data.get("description", "")),
            operation_id=tool_data.get("operation_id", ""),
            category=mcp_metadata.get("category", ""),
            tags=mcp_metadata.get("tags", []),
            parameters=parameters,
            requires_payment=mcp_metadata.get("requires_payment", False),
            payment_info=payment_info,
            endpoint_path=tool_data.get("endpoint_path", ""),
        )
    
    async def discover_tools(self, force_refresh: bool = False) -> MCPDiscoveryResponse:
        """
        Discover available MCP tools from the Gateway.
        
        Args:
            force_refresh: Force refresh even if cache is valid
            
        Returns:
            MCPDiscoveryResponse with discovered tools
        """
        tracer = get_tracer()
        metrics = get_metrics_emitter()
        
        # Check cache
        if not force_refresh and self._is_cache_valid():
            return MCPDiscoveryResponse(
                success=True,
                tools=self._tools_cache,
                cached=True,
                discovered_at=self._cache_timestamp,
            )
        
        with tracer.start_as_current_span("mcp.discover_tools") as span:
            discovery_url = f"{self.config.gateway_url}{self.config.mcp_discovery_path}"
            span.set_attribute("mcp.discovery_url", discovery_url)
            
            start_time = time.time()
            
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.get(
                        discovery_url,
                        headers={"Accept": "application/json"},
                        timeout=self.config.timeout_seconds,
                    )
                    
                    latency_ms = (time.time() - start_time) * 1000
                    span.set_attribute("http.status_code", response.status_code)
                    span.set_attribute("mcp.discovery_latency_ms", latency_ms)
                    
                    if response.status_code != 200:
                        span.set_attribute("error.type", "discovery_failed")
                        metrics.record_mcp_discovery(
                            success=False,
                            latency_ms=latency_ms,
                            error=f"status_{response.status_code}",
                        )
                        return MCPDiscoveryResponse(
                            success=False,
                            error=f"Discovery failed with status {response.status_code}",
                        )
                    
                    try:
                        data = response.json()
                    except (json.JSONDecodeError, ValueError) as e:
                        span.set_attribute("error.type", "json_parse_error")
                        span.set_attribute("error.message", str(e))
                        metrics.record_mcp_discovery(
                            success=False,
                            latency_ms=latency_ms,
                            error="json_parse_error",
                        )
                        return MCPDiscoveryResponse(
                            success=False,
                            error=f"Failed to parse discovery response: {str(e)}",
                        )
                    
                    tools_data = data.get("tools") or []  # Handle None explicitly
                    
                    # Parse tool definitions
                    tools = []
                    for tool_data in tools_data:
                        try:
                            tool_def = self._parse_tool_definition(tool_data)
                            tools.append(tool_def)
                        except Exception as e:
                            span.add_event(
                                "tool_parse_error",
                                {"tool_name": tool_data.get("name", "unknown"), "error": str(e)},
                            )
                    
                    # Update cache
                    self._tools_cache = tools
                    self._cache_timestamp = time.time()
                    
                    # Generate Strands tools
                    self._strands_tools = self._generate_strands_tools(tools)
                    
                    span.set_attribute("mcp.tools_discovered", len(tools))
                    metrics.record_mcp_discovery(
                        success=True,
                        latency_ms=latency_ms,
                        tools_count=len(tools),
                    )
                    
                    return MCPDiscoveryResponse(
                        success=True,
                        tools=tools,
                        metadata=data.get("metadata", {}),
                        cached=False,
                        discovered_at=self._cache_timestamp,
                    )
                    
                except httpx.RequestError as e:
                    latency_ms = (time.time() - start_time) * 1000
                    span.set_attribute("error.type", "request_error")
                    span.set_attribute("error.message", str(e))
                    span.record_exception(e)
                    metrics.record_mcp_discovery(
                        success=False,
                        latency_ms=latency_ms,
                        error=str(e),
                    )
                    return MCPDiscoveryResponse(
                        success=False,
                        error=f"Request failed: {str(e)}",
                    )
    
    async def invoke_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any] = None,
        payment_signature: Optional[str] = None,
    ) -> MCPInvocationResponse:
        """
        Invoke an MCP tool via the Gateway.
        
        This method calls the actual content endpoint registered as a Gateway target.
        The endpoint path is determined from the tool definition discovered during
        MCP tool discovery.
        
        Args:
            tool_name: Name of the tool to invoke
            arguments: Tool arguments (currently unused for content tools)
            payment_signature: Optional x402 payment signature (Base64-encoded)
            
        Returns:
            MCPInvocationResponse with the result
        """
        tracer = get_tracer()
        metrics = get_metrics_emitter()
        
        # Find the tool definition to get the endpoint path
        tool_def = None
        for t in self._tools_cache:
            if t.name == tool_name:
                tool_def = t
                break
        
        # Determine the endpoint URL
        # If we have a tool definition with endpoint_path, use it
        # Otherwise, construct from operation_id (e.g., get_premium_article -> /api/premium-article)
        if tool_def and tool_def.endpoint_path:
            endpoint_path = tool_def.endpoint_path
        elif tool_def and tool_def.operation_id:
            # Convert operation_id to path: get_premium_article -> /api/premium-article
            path_name = tool_def.operation_id.replace("get_", "").replace("_", "-")
            endpoint_path = f"/api/{path_name}"
        else:
            # Fallback: use tool name
            path_name = tool_name.replace("get_", "").replace("_", "-")
            endpoint_path = f"/api/{path_name}"
        
        with tracer.start_as_current_span("mcp.invoke_tool") as span:
            span.set_attribute("mcp.tool_name", tool_name)
            span.set_attribute("mcp.endpoint_path", endpoint_path)
            span.set_attribute("mcp.has_payment", payment_signature is not None)
            
            # Build the full URL to the content endpoint
            invoke_url = f"{self.config.gateway_url}{endpoint_path}"
            
            # Build request headers
            headers = {
                "Accept": "application/json",
            }
            
            # Add payment signature header if provided
            if payment_signature:
                headers["X-PAYMENT-SIGNATURE"] = payment_signature
            
            start_time = time.time()
            
            async with httpx.AsyncClient() as client:
                try:
                    # Make GET request to the content endpoint
                    response = await client.get(
                        invoke_url,
                        headers=headers,
                        timeout=self.config.timeout_seconds,
                        follow_redirects=True,
                    )
                    
                    latency_ms = (time.time() - start_time) * 1000
                    span.set_attribute("http.status_code", response.status_code)
                    span.set_attribute("mcp.invoke_latency_ms", latency_ms)
                    
                    # Extract x402 headers
                    response_headers = dict(response.headers)
                    payment_required = None
                    payment_response = None
                    
                    # Check for payment required header (both X- prefixed and non-prefixed)
                    payment_required_header = (
                        response_headers.get("X-PAYMENT-REQUIRED") or
                        response_headers.get("x-payment-required") or
                        response_headers.get("PAYMENT-REQUIRED") or
                        response_headers.get("payment-required")
                    )
                    if payment_required_header:
                        try:
                            payment_required = json.loads(
                                base64.b64decode(payment_required_header)
                            )
                            span.set_attribute("mcp.payment_required", True)
                        except Exception:
                            payment_required = {"raw": payment_required_header}
                    
                    # Check for payment response header
                    payment_response_header = (
                        response_headers.get("X-PAYMENT-RESPONSE") or
                        response_headers.get("x-payment-response") or
                        response_headers.get("PAYMENT-RESPONSE") or
                        response_headers.get("payment-response")
                    )
                    if payment_response_header:
                        try:
                            payment_response = json.loads(
                                base64.b64decode(payment_response_header)
                            )
                            span.set_attribute("mcp.payment_settled", True)
                        except Exception:
                            payment_response = {"raw": payment_response_header}
                    
                    # Handle different status codes
                    if response.status_code == 200:
                        metrics.record_mcp_invocation(
                            success=True,
                            tool_name=tool_name,
                            latency_ms=latency_ms,
                        )
                        return MCPInvocationResponse(
                            success=True,
                            status_code=200,
                            data=response.json() if response.content else None,
                            payment_response=payment_response,
                            headers=response_headers,
                        )
                    
                    if response.status_code == 402:
                        span.set_attribute("mcp.payment_required", True)
                        
                        # Try to get payment requirements from response body if not in header
                        if not payment_required and response.content:
                            try:
                                payment_required = response.json()
                            except Exception:
                                pass
                        
                        metrics.record_mcp_invocation(
                            success=False,
                            tool_name=tool_name,
                            latency_ms=latency_ms,
                            payment_required=True,
                        )
                        return MCPInvocationResponse(
                            success=False,
                            status_code=402,
                            payment_required=payment_required,
                            data=response.json() if response.content else None,
                            headers=response_headers,
                        )
                    
                    # Other error status codes
                    metrics.record_mcp_invocation(
                        success=False,
                        tool_name=tool_name,
                        latency_ms=latency_ms,
                        error=f"status_{response.status_code}",
                    )
                    return MCPInvocationResponse(
                        success=False,
                        status_code=response.status_code,
                        error=f"Invocation failed with status {response.status_code}",
                        data=response.json() if response.content else None,
                        headers=response_headers,
                    )
                    
                except httpx.RequestError as e:
                    latency_ms = (time.time() - start_time) * 1000
                    span.set_attribute("error.type", "request_error")
                    span.set_attribute("error.message", str(e))
                    span.record_exception(e)
                    metrics.record_mcp_invocation(
                        success=False,
                        tool_name=tool_name,
                        latency_ms=latency_ms,
                        error=str(e),
                    )
                    return MCPInvocationResponse(
                        success=False,
                        status_code=0,
                        error=f"Request failed: {str(e)}",
                    )
    
    def _generate_strands_tools(
        self,
        tool_definitions: list[MCPToolDefinition],
    ) -> list[Callable]:
        """
        Generate Strands-compatible tool functions from MCP tool definitions.
        
        Args:
            tool_definitions: List of MCP tool definitions
            
        Returns:
            List of Strands tool functions
        """
        tools = []
        
        for tool_def in tool_definitions:
            # Create a tool function for each MCP tool
            tool_func = self._create_tool_function(tool_def)
            tools.append(tool_func)
        
        return tools
    
    def _create_tool_function(self, tool_def: MCPToolDefinition) -> Callable:
        """
        Create a Strands tool function from an MCP tool definition.
        
        The generated tool function handles the x402 payment flow:
        1. Makes initial request to the content endpoint
        2. If 402 is returned, extracts payment requirements for the agent
        3. Accepts payment_payload from sign_payment tool for retry
        
        Args:
            tool_def: MCP tool definition
            
        Returns:
            Strands-compatible tool function
        """
        # Capture tool definition in closure
        mcp_client = self
        tool_name = tool_def.name
        tool_description = tool_def.description
        endpoint_path = tool_def.endpoint_path
        
        # Build payment info string for description
        payment_info_str = ""
        if tool_def.requires_payment and tool_def.payment_info:
            payment_info_str = (
                f"\n\nPayment Required: {tool_def.payment_info.get('price_display', 'Unknown')} "
                f"on {tool_def.payment_info.get('network_name', 'Unknown network')}"
            )
        
        @tool
        async def mcp_tool(payment_payload: dict[str, Any] = None) -> dict[str, Any]:
            """
            {description}{payment_info}
            
            Args:
                payment_payload: Optional payment payload from sign_payment tool.
                                Required after receiving a 402 response.
                                Pass the 'payload' field from sign_payment result.
            
            Returns:
                Dictionary with status, content (if 200), or payment requirements (if 402)
            """
            # Encode payment payload as base64 if provided
            payment_signature = None
            if payment_payload:
                payment_signature = base64.b64encode(
                    json.dumps(payment_payload).encode()
                ).decode()
            
            response = await mcp_client.invoke_tool(
                tool_name=tool_name,
                arguments={},
                payment_signature=payment_signature,
            )
            
            if response.success:
                return {
                    "status": 200,
                    "content": response.data,
                    "settlement": response.payment_response,
                }
            
            if response.status_code == 402:
                # Extract payment requirements in a format compatible with analyze_payment
                payment_required = response.payment_required or {}
                accepts = payment_required.get("accepts", [{}])
                requirement = accepts[0] if accepts else {}
                
                # Get extra info for currency name
                extra = requirement.get("extra", {})
                
                return {
                    "status": 402,
                    "payment_required": {
                        "scheme": requirement.get("scheme", "exact"),
                        "network": requirement.get("network", ""),
                        "amount": requirement.get("amount", ""),
                        "currency": extra.get("name", "USDC"),
                        "recipient": requirement.get("payTo", ""),
                        "asset": requirement.get("asset", ""),
                        "description": f"Access to {tool_name}",
                        "raw_requirement": payment_required,
                    },
                    "message": (
                        "Payment required. Use analyze_payment to evaluate, "
                        "then sign_payment to create a signed payment, "
                        "then call this tool again with the payment_payload."
                    ),
                }
            
            return {
                "status": response.status_code,
                "error": response.error,
            }
        
        # Update function metadata
        mcp_tool.__name__ = tool_name
        mcp_tool.__doc__ = f"{tool_description}{payment_info_str}"
        
        # Store tool definition as attribute for reference
        mcp_tool._mcp_tool_def = tool_def
        
        return mcp_tool
    
    def get_strands_tools(self) -> list[Callable]:
        """
        Get Strands-compatible tool functions for discovered MCP tools.
        
        Returns:
            List of Strands tool functions
        """
        return self._strands_tools
    
    def get_cached_tools(self) -> list[MCPToolDefinition]:
        """
        Get cached tool definitions.
        
        Returns:
            List of cached MCPToolDefinition objects
        """
        return self._tools_cache
    
    def clear_cache(self) -> None:
        """Clear the tools cache."""
        self._tools_cache = []
        self._cache_timestamp = 0
        self._strands_tools = []


# Global MCP client instance
_mcp_client: Optional[MCPClient] = None


def get_mcp_client() -> MCPClient:
    """Get or create the global MCP client instance."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPClient()
    return _mcp_client


async def discover_mcp_tools(
    gateway_url: Optional[str] = None,
    force_refresh: bool = False,
) -> list[Callable]:
    """
    Discover MCP tools and return Strands-compatible tool functions.
    
    This is a convenience function for discovering tools and getting
    them in a format ready for use with the Strands agent.
    
    Args:
        gateway_url: Optional Gateway URL (uses config default if not provided)
        force_refresh: Force refresh even if cache is valid
        
    Returns:
        List of Strands tool functions
        
    Raises:
        RuntimeError: If tool discovery fails
    """
    client = get_mcp_client()
    
    if gateway_url:
        client.config.gateway_url = gateway_url
    
    response = await client.discover_tools(force_refresh=force_refresh)
    
    if not response.success:
        raise RuntimeError(f"MCP tool discovery failed: {response.error}")
    
    return client.get_strands_tools()


def get_tool_info(tool_name: str) -> Optional[MCPToolDefinition]:
    """
    Get information about a specific MCP tool.
    
    Args:
        tool_name: Name of the tool
        
    Returns:
        MCPToolDefinition if found, None otherwise
    """
    client = get_mcp_client()
    for tool_def in client.get_cached_tools():
        if tool_def.name == tool_name:
            return tool_def
    return None


def list_available_tools() -> list[dict[str, Any]]:
    """
    List all available MCP tools with their metadata.
    
    Returns:
        List of tool information dictionaries
    """
    client = get_mcp_client()
    return [tool_def.to_dict() for tool_def in client.get_cached_tools()]
