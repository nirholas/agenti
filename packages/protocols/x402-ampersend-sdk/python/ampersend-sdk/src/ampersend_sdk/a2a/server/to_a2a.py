import logging
from typing import Optional, Union

from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCard
from google.adk.a2a.utils.agent_card_builder import AgentCardBuilder
from google.adk.a2a.utils.agent_to_a2a import _load_agent_card
from google.adk.agents import BaseAgent
from google.adk.artifacts import InMemoryArtifactService
from google.adk.auth.credential_service.in_memory_credential_service import (
    InMemoryCredentialService,
)
from google.adk.cli.utils.logs import setup_adk_logger
from google.adk.memory import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from starlette.applications import Starlette
from x402_a2a import get_extension_declaration

from . import X402A2aAgentExecutor
from .facilitator_x402_server_executor import create_facilitator_executor_factory


def to_a2a(
    agent: BaseAgent,
    *,
    host: str = "localhost",
    port: int = 8001,
    protocol: str = "http",
    agent_card: Optional[Union[AgentCard, str]] = None,
) -> Starlette:
    """Convert an ADK agent to a A2A Starlette application.

    Args:
        agent: The ADK agent to convert
        host: The host for the A2A RPC URL (default: "localhost")
        port: The port for the A2A RPC URL (default: 8000)
        protocol: The protocol for the A2A RPC URL (default: "http")
        agent_card: Optional pre-built AgentCard object or path to agent card
                    JSON. If not provided, will be built automatically from the
                    agent.

    Returns:
        A Starlette application that can be run with uvicorn

    Example:
        agent = MyAgent()
        app = to_a2a(agent, host="localhost", port=8000, protocol="http")
        # Then run with: uvicorn module:app --host localhost --port 8000

        # Or with custom agent card:
        app = to_a2a(agent, agent_card=my_custom_agent_card)
    """
    # Set up ADK logging to ensure logs are visible when using uvicorn directly
    setup_adk_logger(logging.INFO)  # type: ignore[no-untyped-call]

    async def create_runner() -> Runner:
        """Create a runner for the agent."""
        return Runner(
            app_name=agent.name or "adk_agent",
            agent=agent,
            # Use minimal services - in a real implementation these could be configured
            artifact_service=InMemoryArtifactService(),
            session_service=InMemorySessionService(),  # type: ignore[no-untyped-call]
            memory_service=InMemoryMemoryService(),  # type: ignore[no-untyped-call]
            credential_service=InMemoryCredentialService(),  # type: ignore[no-untyped-call]
        )

    # Create A2A components
    task_store = InMemoryTaskStore()

    agent_executor = X402A2aAgentExecutor(
        runner=create_runner,
        x402_executor_factory=create_facilitator_executor_factory(),
    )

    request_handler = DefaultRequestHandler(
        agent_executor=agent_executor, task_store=task_store
    )

    # Use provided agent card or build one from the agent
    rpc_url = f"{protocol}://{host}:{port}/"
    provided_agent_card = _load_agent_card(agent_card)

    card_builder = AgentCardBuilder(
        agent=agent,
        rpc_url=rpc_url,
    )

    # Create a Starlette app that will be configured during startup
    app = Starlette()

    # Add startup handler to build the agent card and configure A2A routes
    async def setup_a2a() -> None:
        # Use provided agent card or build one asynchronously
        if provided_agent_card is not None:
            final_agent_card = provided_agent_card
        else:
            final_agent_card = await card_builder.build()

        # Add "x402" to the agent card capabilities extensions
        extensions = final_agent_card.capabilities.extensions or []
        extensions.append(get_extension_declaration())  # type: ignore[arg-type]
        final_agent_card.capabilities.extensions = extensions

        # Create the A2A Starlette application
        a2a_app = A2AStarletteApplication(
            agent_card=final_agent_card,
            http_handler=request_handler,
        )

        # Add A2A routes to the main app
        a2a_app.add_routes_to_app(
            app,
        )

    # Store the setup function to be called during startup
    app.add_event_handler("startup", setup_a2a)

    return app
