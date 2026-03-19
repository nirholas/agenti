"""Main agent definition for the x402 payer agent.

This module defines the payer agent that handles x402 payment flows.

ENTERPRISE-READY ARCHITECTURE:
The agent uses dynamic service discovery instead of hardcoded tools:
1. discover_services: Find available paid services from the Gateway
2. request_service: Access any discovered service by name
3. Autonomous purchasing with pre-approval lists

This enables:
- Dynamic tool/service discovery via Gateway MCP endpoint
- No hardcoded knowledge of available services
- Autonomous purchasing for pre-approved services
- User confirmation for non-approved purchases
"""

from typing import Callable, Optional

from strands import Agent
from strands.models import BedrockModel

from .config import config
from .tracing import init_tracing, get_tracer
from .tools.payment import (
    analyze_payment,
    sign_payment,
    get_wallet_balance,
    request_faucet_funds,
    check_faucet_eligibility,
)
from .tools.discovery import (
    discover_services,
    request_service,
    list_approved_services,
    check_service_approval,
)
from .tools.content import (
    request_content,
    request_content_with_payment,
)
from .mcp_client import MCPClient, discover_mcp_tools, get_mcp_client

# Core tools that are always available to the agent
# Discovery tools enable dynamic service discovery
# Payment tools handle x402 payment negotiation
CORE_TOOLS = [
    # Service Discovery (Enterprise-Ready)
    discover_services,
    request_service,
    list_approved_services,
    check_service_approval,
    # Payment Tools
    analyze_payment,
    sign_payment,
    get_wallet_balance,
    request_faucet_funds,
    check_faucet_eligibility,
    # Legacy content tools (kept for backward compatibility)
    request_content,
    request_content_with_payment,
]

SYSTEM_PROMPT = """You are an AI payment agent that helps users access paid services using the x402 protocol.

## IMPORTANT: Dynamic Service Discovery

You do NOT have hardcoded knowledge of available services. Instead, you MUST use the discover_services tool to find out what services are available. This is the enterprise-ready pattern.

## Your Tools

### Service Discovery Tools (USE THESE FIRST)
- discover_services: Find all available paid services from the Gateway. Call this to see what's available.
- request_service: Request any discovered service by name. Handles x402 payment flow automatically.
- list_approved_services: See which services are pre-approved for autonomous purchasing.
- check_service_approval: Check if a specific purchase is pre-approved.

### Wallet Tools
- get_wallet_balance: Check your USDC and ETH balance on Base Sepolia testnet
- request_faucet_funds: Request free testnet tokens (ETH or USDC)
- check_faucet_eligibility: Check if you can request faucet funds

### Payment Tools  
- analyze_payment: Evaluate payment requests and decide whether to approve
- sign_payment: Sign blockchain transactions using your AgentKit wallet

## Workflow for Accessing Paid Services

### Step 1: Discover Available Services
When a user asks about available services or wants to access content:
1. Call discover_services() to get the list of available services
2. Present the services to the user with their names, descriptions, and prices

### Step 2: Request a Service
When a user wants a specific service:
1. Call request_service(service_name="<name>") 
2. If you get a 402 response with payment_required:
   a. Check if the service is pre-approved using check_service_approval
   b. If pre-approved, proceed automatically
   c. If not pre-approved, ask the user for confirmation
3. Use sign_payment with the payment_required details
4. Call request_service again with the payment_payload
5. Return the content to the user

### Step 3: Autonomous Purchasing (Pre-Approved Services)
For services on the approved list:
1. Check approval with check_service_approval(service_name, price)
2. If approved, proceed without asking the user
3. Complete the payment and deliver the content
4. Inform the user what was purchased and the cost

## Example Conversations

User: "What services are available?"
→ Call discover_services() and present the list

User: "Get me the weather data"
→ Call request_service(service_name="get_weather_data")
→ Handle 402 response, check approval, sign payment, retry with payment
→ Return the weather data

User: "I want the research report"
→ Call request_service(service_name="get_research_report")
→ If not pre-approved, ask: "The research report costs 0.005 USDC. Should I proceed?"
→ On confirmation, complete the payment flow

## Payment Decision Guidelines
- Always check wallet balance before approving payments
- For pre-approved services, proceed automatically
- For non-approved services, always ask for user confirmation
- Explain the cost clearly before making any payment
- Report transaction details after successful payments

## Transparency Requirements
Always be transparent about:
- What services are available (use discover_services)
- Payment amounts and what they're for
- Whether a purchase was automatic (pre-approved) or required confirmation
- Transaction details after successful payments
- Any errors or issues encountered
"""


def create_payer_agent(
    additional_tools: Optional[list[Callable]] = None,
    custom_system_prompt: Optional[str] = None,
) -> Agent:
    """Create and configure the x402 payer agent.
    
    Args:
        additional_tools: Optional list of additional tools to add to the agent.
                         These are typically MCP-discovered content tools.
        custom_system_prompt: Optional custom system prompt to override the default.
    
    Returns:
        Configured Agent instance with core payment tools and any additional tools.
    """
    # Initialize tracing
    init_tracing(
        service_name="x402-payer-agent",
        enable_console_export=config.otel_console_export,
    )
    
    model = BedrockModel(
        model_id=config.model_id,
        region_name=config.aws_region,
    )

    # Combine core tools with any additional (MCP-discovered) tools
    tools = list(CORE_TOOLS)
    if additional_tools:
        tools.extend(additional_tools)

    agent = Agent(
        model=model,
        tools=tools,
        system_prompt=custom_system_prompt or SYSTEM_PROMPT,
    )

    return agent


async def create_payer_agent_with_mcp(
    gateway_url: Optional[str] = None,
    custom_system_prompt: Optional[str] = None,
    force_discovery: bool = False,
) -> Agent:
    """Create a payer agent with MCP-discovered tools.
    
    This function discovers tools from the Gateway MCP endpoint and
    creates an agent with both core payment tools and discovered content tools.
    
    Args:
        gateway_url: Optional Gateway URL for MCP discovery.
                    Uses config.seller_api_url if not provided.
        custom_system_prompt: Optional custom system prompt.
        force_discovery: Force tool discovery even if cached.
    
    Returns:
        Configured Agent instance with core and MCP-discovered tools.
        
    Raises:
        RuntimeError: If MCP tool discovery fails.
    """
    # Discover MCP tools
    mcp_tools = await discover_mcp_tools(
        gateway_url=gateway_url,
        force_refresh=force_discovery,
    )
    
    # Create agent with discovered tools
    return create_payer_agent(
        additional_tools=mcp_tools,
        custom_system_prompt=custom_system_prompt,
    )


def get_core_tools() -> list[Callable]:
    """Get the list of core payment tools.
    
    These tools are always available to the agent and handle
    x402 payment negotiation and wallet operations.
    
    Returns:
        List of core tool functions.
    """
    return list(CORE_TOOLS)


async def run_agent(user_message: str, additional_tools: Optional[list[Callable]] = None) -> str:
    """Run the agent with a user message and return the response.
    
    Args:
        user_message: The user's input message.
        additional_tools: Optional list of additional tools (e.g., MCP-discovered tools).
    
    Returns:
        The agent's response as a string.
    """
    agent = create_payer_agent(additional_tools=additional_tools)
    tracer = get_tracer()
    
    with tracer.start_as_current_span("agent.run") as span:
        span.set_attribute("agent.message_length", len(user_message))
        span.set_attribute("agent.core_tools_count", len(CORE_TOOLS))
        span.set_attribute("agent.additional_tools_count", len(additional_tools) if additional_tools else 0)
        # Strands Agent is callable directly
        response = agent(user_message)
        span.set_attribute("agent.response_length", len(str(response)))
        return str(response)


async def run_agent_with_mcp(
    user_message: str,
    gateway_url: Optional[str] = None,
    force_discovery: bool = False,
) -> str:
    """Run the agent with MCP-discovered tools.
    
    This function discovers tools from the Gateway MCP endpoint,
    creates an agent with those tools, and runs it with the user message.
    
    Args:
        user_message: The user's input message.
        gateway_url: Optional Gateway URL for MCP discovery.
        force_discovery: Force tool discovery even if cached.
    
    Returns:
        The agent's response as a string.
        
    Raises:
        RuntimeError: If MCP tool discovery fails.
    """
    agent = await create_payer_agent_with_mcp(
        gateway_url=gateway_url,
        force_discovery=force_discovery,
    )
    tracer = get_tracer()
    
    mcp_client = get_mcp_client()
    mcp_tools_count = len(mcp_client.get_strands_tools())
    
    with tracer.start_as_current_span("agent.run_with_mcp") as span:
        span.set_attribute("agent.message_length", len(user_message))
        span.set_attribute("agent.core_tools_count", len(CORE_TOOLS))
        span.set_attribute("agent.mcp_tools_count", mcp_tools_count)
        # Strands Agent is callable directly
        response = agent(user_message)
        span.set_attribute("agent.response_length", len(str(response)))
        return str(response)


# Entry point for local testing
if __name__ == "__main__":
    import asyncio
    
    async def main():
        # For local testing, try to discover MCP tools
        print("x402 Payer Agent initializing...")
        print("Core tools: analyze_payment, sign_payment, get_wallet_balance")
        
        try:
            # Try to discover MCP tools
            mcp_tools = await discover_mcp_tools()
            print(f"Discovered {len(mcp_tools)} MCP tools")
            for tool in mcp_tools:
                print(f"  - {tool.__name__}")
            
            agent = create_payer_agent(additional_tools=mcp_tools)
        except Exception as e:
            print(f"MCP discovery failed: {e}")
            print("Running with core tools only.")
            agent = create_payer_agent()
        
        print("-" * 50)
        print("Type 'quit' to exit.")

        while True:
            user_input = input("\nYou: ").strip()
            if user_input.lower() == "quit":
                break

            # Strands Agent is callable directly
            response = agent(user_input)
            print(f"\nAgent: {response}")

    asyncio.run(main())
