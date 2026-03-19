"""Ampersend SDK - Payment capabilities for AI agents."""

from ampersend_sdk.a2a.client import (
    create_ampersend_client_factory,
    create_ampersend_toolset,
)
from ampersend_sdk.ampersend import (
    AmpersendTreasurer,
    create_ampersend_treasurer,
)
from ampersend_sdk.ampersend.management import (
    AgentInitData,
    AgentResponse,
    AmpersendManagementClient,
    SpendConfig,
)
from ampersend_sdk.x402.http import create_ampersend_http_client

__all__ = [
    # Agent management
    "AmpersendManagementClient",
    "AgentInitData",
    "AgentResponse",
    "SpendConfig",
    # Simplified factories (recommended)
    "create_ampersend_treasurer",
    "create_ampersend_toolset",
    "create_ampersend_client_factory",
    "create_ampersend_http_client",
    # Classes (for type hints)
    "AmpersendTreasurer",
]
