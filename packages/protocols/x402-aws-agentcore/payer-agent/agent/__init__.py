"""x402 Payer Agent - AI agent for payment decisions."""

from .main import (
    create_payer_agent,
    create_payer_agent_with_mcp,
    get_core_tools,
    run_agent,
    run_agent_with_mcp,
    CORE_TOOLS,
    SYSTEM_PROMPT,
)
from .metrics import get_metrics_emitter, init_metrics, MetricsEmitter, PayerMetricName
from .mcp_client import (
    MCPClient,
    MCPToolDefinition,
    MCPDiscoveryResponse,
    MCPInvocationResponse,
    get_mcp_client,
    discover_mcp_tools,
    get_tool_info,
    list_available_tools,
)
from .runtime_client import (
    RuntimeClient,
    RuntimeClientConfig,
    InvocationResponse,
    create_runtime_client,
)

__all__ = [
    # Agent creation and execution
    "create_payer_agent",
    "create_payer_agent_with_mcp",
    "get_core_tools",
    "run_agent",
    "run_agent_with_mcp",
    "CORE_TOOLS",
    "SYSTEM_PROMPT",
    # Metrics
    "get_metrics_emitter",
    "init_metrics",
    "MetricsEmitter",
    "PayerMetricName",
    # MCP Client
    "MCPClient",
    "MCPToolDefinition",
    "MCPDiscoveryResponse",
    "MCPInvocationResponse",
    "get_mcp_client",
    "discover_mcp_tools",
    "get_tool_info",
    "list_available_tools",
    # Runtime Client (for invoking agents deployed to AgentCore Runtime)
    "RuntimeClient",
    "RuntimeClientConfig",
    "InvocationResponse",
    "create_runtime_client",
]
