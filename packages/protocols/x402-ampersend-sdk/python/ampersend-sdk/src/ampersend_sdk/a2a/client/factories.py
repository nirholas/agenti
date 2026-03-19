"""Simplified factory functions for Ampersend A2A clients.

These factories provide one-liner setup for common use cases,
eliminating the need to manually create treasurers and wallets.
"""

from typing import Optional

import httpx
from a2a.client import ClientConfig, Consumer

from .x402_client_factory import X402ClientFactory
from .x402_remote_agent_toolset import TaskUpdateCallback, X402RemoteAgentToolset

DEFAULT_API_URL = "https://api.ampersend.ai"


def create_ampersend_toolset(
    *,
    remote_agent_urls: list[str],
    smart_account_address: str,
    session_key_private_key: str,
    api_url: str = DEFAULT_API_URL,
    httpx_client: Optional[httpx.AsyncClient] = None,
    task_callback: Optional[TaskUpdateCallback] = None,
) -> X402RemoteAgentToolset:
    """
    Create an X402RemoteAgentToolset with minimal configuration.

    This is the recommended way to create a toolset for ADK agents
    that need to communicate with remote A2A agents with automatic
    payment handling.

    Args:
        remote_agent_urls: List of remote A2A agent URLs to connect to.
        smart_account_address: The smart account address (0x...).
        session_key_private_key: The session key private key (0x...).
        api_url: Ampersend API URL (defaults to production).
        httpx_client: Optional custom HTTP client.
        task_callback: Optional callback for task updates during streaming.

    Returns:
        Configured X402RemoteAgentToolset ready for use with ADK agents.

    Example:
        ```python
        from ampersend_sdk import create_ampersend_toolset
        from google.adk import Agent

        toolset = create_ampersend_toolset(
            remote_agent_urls=["https://agent.example.com"],
            smart_account_address="0x1234...",
            session_key_private_key="0xabcd...",
        )

        agent = Agent(
            name="orchestrator",
            model="gemini-2.0-flash",
            tools=[toolset],
            before_agent_callback=toolset.get_before_agent_callback(),
        )
        ```
    """
    from ampersend_sdk.ampersend import create_ampersend_treasurer

    treasurer = create_ampersend_treasurer(
        smart_account_address=smart_account_address,
        session_key_private_key=session_key_private_key,
        api_url=api_url,
    )

    return X402RemoteAgentToolset(
        remote_agent_urls=remote_agent_urls,
        treasurer=treasurer,
        httpx_client=httpx_client,
        task_callback=task_callback,
    )


def create_ampersend_client_factory(
    *,
    smart_account_address: str,
    session_key_private_key: str,
    config: ClientConfig,
    api_url: str = DEFAULT_API_URL,
    consumers: Optional[list[Consumer]] = None,
) -> X402ClientFactory:
    """
    Create an X402ClientFactory with minimal configuration.

    This factory creates A2A clients with automatic payment handling.
    Use this when you need more control over client creation than
    what `create_ampersend_toolset` provides.

    Args:
        smart_account_address: The smart account address (0x...).
        session_key_private_key: The session key private key (0x...).
        config: A2A ClientConfig for client settings.
        api_url: Ampersend API URL (defaults to production).
        consumers: Optional list of A2A consumers.

    Returns:
        Configured X402ClientFactory for creating A2A clients.

    Example:
        ```python
        from ampersend_sdk import create_ampersend_client_factory
        from a2a.client import ClientConfig

        factory = create_ampersend_client_factory(
            smart_account_address="0x1234...",
            session_key_private_key="0xabcd...",
            config=ClientConfig(),
        )

        client = factory.create(card=agent_card)
        ```
    """
    from ampersend_sdk.ampersend import create_ampersend_treasurer

    treasurer = create_ampersend_treasurer(
        smart_account_address=smart_account_address,
        session_key_private_key=session_key_private_key,
        api_url=api_url,
    )

    return X402ClientFactory(
        treasurer=treasurer,
        config=config,
        consumers=consumers,
    )
