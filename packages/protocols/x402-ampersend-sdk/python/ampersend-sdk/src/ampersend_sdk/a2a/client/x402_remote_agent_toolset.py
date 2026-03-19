"""X402 Remote Agent Toolset for ADK.

Provides tools for local ADK agents to interact with remote A2A agents
with automatic x402 payment handling.
"""

import uuid
from typing import Any, Callable, Optional

import httpx
from a2a.client import A2ACardResolver, ClientConfig
from a2a.types import (
    AgentCard,
    Artifact,
    JSONRPCErrorResponse,
    Message,
    Part,
    Role,
    Task,
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatusUpdateEvent,
    TextPart,
)
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.base_toolset import BaseToolset
from google.adk.tools.function_tool import FunctionTool
from google.adk.tools.tool_context import ToolContext

from ...x402.treasurer import X402Treasurer
from .x402_client_composed import X402ClientComposed
from .x402_client_factory import X402ClientFactory

# Type alias for task callback
TaskUpdateCallback = Callable[[Task], None]


class X402RemoteAgentToolset(BaseToolset):
    """Toolset for interacting with remote A2A agents via x402.

    Provides tools to list and send messages to remote A2A agents with automatic
    payment handling and per-agent conversation context management.

    The toolset discovers remote agents on initialization and exposes them as
    ADK tools that can be used by a local orchestrator agent.

    Example:
        ```python
        from ampersend_sdk import create_ampersend_treasurer
        from ampersend_sdk.a2a.client import X402RemoteAgentToolset
        from google.adk import Agent

        # Create treasurer (one-liner setup)
        treasurer = create_ampersend_treasurer(
            smart_account_address="0x...",
            session_key_private_key="0x...",
        )

        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["https://agent.example.com"],
            treasurer=treasurer,
        )

        # Create orchestrator agent
        agent = Agent(
            name="orchestrator",
            model="gemini-2.0-flash",
            tools=[toolset],
            before_agent_callback=toolset.get_before_agent_callback(),
        )
        ```

    Attributes:
        remote_agent_urls: List of remote agent base URLs to connect to.
        treasurer: X402Treasurer instance for payment authorization.
        state_key_prefix: Key prefix for storing agent contexts in ADK state.
        httpx_client: HTTP client for making requests (optional).
        task_callback: Optional callback called with Task updates during execution.
    """

    def __init__(
        self,
        remote_agent_urls: list[str],
        treasurer: X402Treasurer,
        *,
        state_key_prefix: str = "x402_agent_contexts",
        httpx_client: Optional[httpx.AsyncClient] = None,
        task_callback: Optional[TaskUpdateCallback] = None,
        **kwargs: Any,
    ):
        """Initialize the remote agent toolset.

        Args:
            remote_agent_urls: List of remote agent base URLs to connect to.
            treasurer: X402Treasurer for payment authorization.
            state_key_prefix: Key prefix for storing agent contexts in ADK state.
                Defaults to "x402_agent_contexts".
            httpx_client: Optional HTTP client. If not provided, creates a default
                client with 30 second timeout.
            task_callback: Optional callback called with Task updates during streaming
                responses. Useful for displaying progress or logging. Signature:
                Callable[[Task], None].
            **kwargs: Additional arguments passed to BaseToolset.
        """
        super().__init__(**kwargs)

        self.remote_agent_urls = remote_agent_urls
        self.treasurer = treasurer
        self.state_key_prefix = state_key_prefix
        self.httpx_client = httpx_client or httpx.AsyncClient(timeout=30)
        self.task_callback = task_callback

        # Will be populated in before_agent_callback
        self._remote_clients: dict[str, X402ClientComposed] = {}
        self._agent_cards: dict[str, AgentCard] = {}
        self._initialized = False

        # Artifact chunking state (for streaming artifacts)
        self._artifact_chunks: dict[str, list[Artifact]] = {}

        # Create client factory for creating X402 clients
        # Pass our httpx_client so A2A clients use the same timeout
        self._client_factory = X402ClientFactory(
            treasurer=self.treasurer,
            config=ClientConfig(httpx_client=self.httpx_client),
        )

    def get_before_agent_callback(
        self,
    ) -> Any:
        """Get the before_agent_callback for Agent initialization.

        Returns:
            Async callback function that discovers remote agents.
        """
        return self._before_agent_callback

    async def _before_agent_callback(self, callback_context: CallbackContext) -> None:
        """Discover remote agents before agent execution.

        This callback is called by ADK before the agent starts processing.
        It discovers all remote agents and creates X402 clients for them.

        Args:
            callback_context: ADK callback context (not used, required by interface).
        """
        if self._initialized:
            return

        for url in self.remote_agent_urls:
            # Resolve agent card
            card = await A2ACardResolver(self.httpx_client, url).get_agent_card()

            # Check for duplicate agent names
            if card.name in self._agent_cards:
                raise ValueError(
                    f"Cannot add two agents with the same name: {card.name}"
                )

            # Create X402 client for this agent
            client = self._client_factory.create(card=card)

            # X402ClientFactory returns X402ClientComposed
            if not isinstance(client, X402ClientComposed):
                raise TypeError(f"Expected X402ClientComposed, got {type(client)}")

            # Store client and card
            self._remote_clients[card.name] = client
            self._agent_cards[card.name] = card

        self._initialized = True

    async def get_tools(
        self, readonly_context: Optional[ReadonlyContext] = None
    ) -> list[BaseTool]:
        """Get the list of tools provided by this toolset.

        Args:
            readonly_context: Optional context for filtering tools (not used).

        Returns:
            List of BaseTool instances wrapped with FunctionTool.
        """
        return [
            FunctionTool(func=self.x402_a2a_list_agents),
            FunctionTool(func=self.x402_a2a_get_agent_details),
            FunctionTool(func=self.x402_a2a_send_to_agent),
        ]

    def x402_a2a_list_agents(self) -> list[dict[str, str]]:
        """List available remote agents.

        Returns a list of remote agents that this toolset can communicate with,
        including their names and descriptions.

        Returns:
            List of dicts with 'name' and 'description' keys for each agent.

        Example:
            ```python
            [
                {
                    "name": "subgraph_agent",
                    "description": "Agent for querying blockchain data via The Graph"
                }
            ]
            ```
        """
        return [
            {"name": card.name, "description": card.description}
            for card in self._agent_cards.values()
        ]

    def x402_a2a_get_agent_details(self, agent_name: str) -> dict[str, Any]:
        """Get detailed information about a specific remote agent.

        Returns the full agent card with capabilities, skills, version, and
        other metadata for a specific agent.

        Args:
            agent_name: Name of the agent to get details for (from x402_a2a_list_agents).

        Returns:
            Dict containing agent card details including:
            - name: Agent name
            - description: Agent description
            - url: Agent URL
            - version: Agent version
            - capabilities: Streaming support and content types
            - skills: Available skills/capabilities
            - documentation_url: Link to agent documentation (if available)

        Raises:
            ValueError: If agent_name is not found in available agents.

        Example:
            To use this tool, the LLM would call:
            ```
            x402_a2a_get_agent_details(agent_name="subgraph_agent")
            ```

            Returns detailed information about the agent's capabilities,
            supported skills, and documentation.
        """
        if agent_name not in self._agent_cards:
            available = ", ".join(self._agent_cards.keys())
            raise ValueError(
                f"Agent '{agent_name}' not found. Available agents: {available}"
            )

        card = self._agent_cards[agent_name]

        # Return structured agent card information
        return {
            "name": card.name,
            "description": card.description,
            "url": card.url,
            "version": card.version,
            "capabilities": {
                "streaming": card.capabilities.streaming,
            },
            "skills": [skill.model_dump() for skill in card.skills],
            "documentation_url": card.documentation_url,
        }

    async def x402_a2a_send_to_agent(
        self, agent_name: str, message: str, tool_context: ToolContext
    ) -> str:
        """Send a message to a specific remote agent.

        Sends a message to the named remote agent and returns the response.
        Payments are handled automatically by the x402 middleware.
        Conversation context is maintained per-agent in ADK state.

        Args:
            agent_name: Name of the remote agent to contact (from x402_a2a_list_agents).
            message: Message text to send to the agent.
            tool_context: ADK tool context (auto-injected, provides state access).

        Returns:
            Response text from the remote agent.

        Raises:
            ValueError: If agent_name is not found in available agents.

        Example:
            To use this tool, the LLM would call:
            ```
            x402_a2a_send_to_agent(
                agent_name="subgraph_agent",
                message="Query Uniswap V3 pools on Base"
            )
            ```
        """
        # Validate agent exists
        if agent_name not in self._remote_clients:
            available = ", ".join(self._agent_cards.keys())
            raise ValueError(
                f"Agent '{agent_name}' not found. Available agents: {available}"
            )

        client = self._remote_clients[agent_name]

        # Get conversation context for this agent from ADK state
        context_id = self._get_context_id(agent_name, tool_context)

        # Construct A2A message
        request = Message(
            message_id=str(uuid.uuid4()),
            role=Role.user,
            parts=[Part(root=TextPart(text=message))],
            context_id=context_id,
        )

        # Send message - x402 middleware handles payments automatically
        # Response is AsyncIterator[ClientEvent | Message]
        task = None
        async for response in client.send_message(request):
            # Handle errors
            if isinstance(response, JSONRPCErrorResponse):
                error = response.error
                raise RuntimeError(
                    f"Agent '{agent_name}' returned error: {error.message} "
                    f"(Code: {error.code})"
                )

            # Handle Message response (early return)
            if isinstance(response, Message):
                # Message means interaction is complete
                return self._extract_text_from_message(response)

            # Otherwise it's ClientEvent: (Task, Event | None) tuple
            task, event = response

            # Process streaming events
            if event:
                if isinstance(event, TaskArtifactUpdateEvent):
                    # Handle streaming artifacts
                    self._process_artifact_event(task, event)
                elif isinstance(event, TaskStatusUpdateEvent):
                    # Status update - task.status already updated by client
                    pass

            # Call user callback if provided
            if self.task_callback:
                self.task_callback(task)

        # After iteration completes
        if task is None:
            raise RuntimeError(f"No response received from agent '{agent_name}'")

        # Update context for next message
        if task.context_id:
            self._update_context_id(agent_name, task.context_id, tool_context)

        return self._extract_text_from_task(task)

    def _get_context_id(
        self, agent_name: str, tool_context: ToolContext
    ) -> Optional[str]:
        """Get conversation context ID for an agent from ADK state.

        Args:
            agent_name: Name of the agent.
            tool_context: ADK tool context with state access.

        Returns:
            Context ID for this agent, or None if no prior conversation.
        """
        contexts: dict[str, Any] = tool_context.state.get(self.state_key_prefix, {})
        context_id: Optional[str] = contexts.get(agent_name)
        return context_id

    def _update_context_id(
        self, agent_name: str, context_id: str, tool_context: ToolContext
    ) -> None:
        """Update conversation context ID for an agent in ADK state.

        Args:
            agent_name: Name of the agent.
            context_id: New context ID to store.
            tool_context: ADK tool context with state access.
        """
        contexts = tool_context.state.setdefault(self.state_key_prefix, {})
        contexts[agent_name] = context_id
        tool_context.state[self.state_key_prefix] = contexts

    def _extract_text_from_message(self, message: Message) -> str:
        """Extract text from a Message response.

        Args:
            message: A2A Message object.

        Returns:
            Concatenated text from all TextPart parts.
        """
        text_parts = []
        for part in message.parts:
            if isinstance(part.root, TextPart):
                text_parts.append(part.root.text)
        return " ".join(text_parts) if text_parts else ""

    def _extract_text_from_task(self, task: Task) -> str:
        """Extract text from a Task response.

        Args:
            task: A2A Task object.

        Returns:
            Concatenated text from task artifacts, or status message.
        """
        if task.status.state in (TaskState.completed, TaskState.failed):
            # Extract text from artifacts
            final_text = []
            if task.artifacts:
                for artifact in task.artifacts:
                    for part in artifact.parts:
                        if isinstance(part.root, TextPart):
                            final_text.append(part.root.text)

            if final_text:
                return " ".join(final_text)

            # Fallback if no text artifacts
            return f"Task {task.status.state.value}"

        # Task still in progress
        return f"Task status: {task.status.state.value}"

    def _process_artifact_event(
        self, task: Task, event: TaskArtifactUpdateEvent
    ) -> None:
        """Process streaming artifact events.

        Handles chunked artifact streaming by buffering partial artifacts
        and assembling them into complete artifacts in the task.

        Args:
            task: Task being updated.
            event: Artifact update event with chunk information.
        """
        artifact = event.artifact
        artifact_id = artifact.artifact_id

        if not event.append:
            # First chunk or complete artifact
            if event.last_chunk is None or event.last_chunk:
                # Complete artifact in one go - add directly to task
                if not task.artifacts:
                    task.artifacts = []
                task.artifacts.append(artifact)
            else:
                # First chunk of streaming artifact - start buffering
                self._artifact_chunks[artifact_id] = [artifact]
        else:
            # Append chunk to existing artifact
            if artifact_id in self._artifact_chunks:
                # Add parts to buffered artifact
                current_artifact = self._artifact_chunks[artifact_id][-1]
                current_artifact.parts.extend(artifact.parts)

                if event.last_chunk:
                    # Done streaming - move from buffer to task
                    if not task.artifacts:
                        task.artifacts = []
                    task.artifacts.append(current_artifact)
                    # Clean up buffer
                    del self._artifact_chunks[artifact_id]
