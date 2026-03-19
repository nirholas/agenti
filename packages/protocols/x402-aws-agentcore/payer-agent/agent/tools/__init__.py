"""Tools for the x402 payer agent.

This module organizes tools into categories:

1. Service Discovery Tools (Enterprise-Ready):
   - discover_services: Find available paid services from the Gateway
   - request_service: Request any discovered service by name
   - list_approved_services: List pre-approved services for autonomous purchasing
   - check_service_approval: Check if a purchase is pre-approved

2. Core Payment Tools:
   - analyze_payment: Analyze payment requirements and decide whether to pay
   - sign_payment: Sign a payment using the AgentKit wallet
   - get_wallet_balance: Get current wallet balance
   - request_faucet_funds: Request testnet tokens from faucet
   - check_faucet_eligibility: Check if wallet is eligible for faucet

3. Content Tools (Legacy - use discover_services + request_service instead):
   - request_content: Request content from seller API
   - request_content_with_payment: Request content with signed payment
"""

# Service discovery tools (enterprise-ready pattern)
from .discovery import (
    discover_services,
    request_service,
    list_approved_services,
    check_service_approval,
)

# Core payment tools
from .payment import (
    analyze_payment,
    sign_payment,
    get_wallet_balance,
    request_faucet_funds,
    check_faucet_eligibility,
)

# Content tools (legacy)
from .content import request_content, request_content_with_payment

# Discovery tools - the enterprise-ready way to find and use services
DISCOVERY_TOOLS = [
    discover_services,
    request_service,
    list_approved_services,
    check_service_approval,
]

# Export core tools as the primary interface
CORE_TOOLS = [
    analyze_payment,
    sign_payment,
    get_wallet_balance,
]

# Faucet tools (for testnet use)
FAUCET_TOOLS = [
    request_faucet_funds,
    check_faucet_eligibility,
]

# Content tools (legacy - prefer discovery tools)
CONTENT_TOOLS = [
    request_content,
    request_content_with_payment,
]

__all__ = [
    # Discovery tools
    "discover_services",
    "request_service",
    "list_approved_services",
    "check_service_approval",
    # Core payment tools
    "analyze_payment",
    "sign_payment",
    "get_wallet_balance",
    # Faucet tools
    "request_faucet_funds",
    "check_faucet_eligibility",
    # Content tools (legacy)
    "request_content",
    "request_content_with_payment",
    # Tool collections
    "DISCOVERY_TOOLS",
    "CORE_TOOLS",
    "FAUCET_TOOLS",
    "CONTENT_TOOLS",
]
