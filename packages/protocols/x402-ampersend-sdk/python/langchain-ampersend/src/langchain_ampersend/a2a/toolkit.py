"""A2A Toolkit for LangChain with x402 payment support."""

import json
import uuid
from typing import Type

import httpx
from a2a.client import A2ACardResolver, ClientConfig
from a2a.types import (
    AgentCard,
    JSONRPCErrorResponse,
    Message,
    Part,
    Role,
    Task,
    TaskState,
    TextPart,
)
from ampersend_sdk.a2a.client import X402ClientFactory
from ampersend_sdk.a2a.client.x402_client_composed import X402ClientComposed
from ampersend_sdk.x402.treasurer import X402Treasurer
from langchain_core.tools import BaseTool
from pydantic import BaseModel, ConfigDict, Field


class A2AToolkit:
    """LangChain toolkit for calling a remote A2A agent with automatic x402 payments.

    Example:
        ```python
        from langchain_ampersend import A2AToolkit, create_ampersend_treasurer
        from langchain.agents import create_agent

        # Create treasurer (one-liner setup)
        treasurer = create_ampersend_treasurer(
            smart_account_address="0x...",
            session_key_private_key="0x...",
        )

        toolkit = A2AToolkit(
            remote_agent_url="https://agent.example.com",
            treasurer=treasurer,
        )
        await toolkit.initialize()

        agent = create_agent(llm, toolkit.get_tools())
        ```
    """

    def __init__(
        self,
        remote_agent_url: str,
        treasurer: X402Treasurer,
        httpx_client: httpx.AsyncClient | None = None,
    ):
        """Initialize the toolkit.

        Args:
            remote_agent_url: URL of the remote A2A agent.
            treasurer: X402Treasurer for payment authorization.
            httpx_client: Optional HTTP client. Defaults to 30s timeout.
        """
        self.remote_agent_url = remote_agent_url
        self.treasurer = treasurer
        self.httpx_client = httpx_client or httpx.AsyncClient(timeout=30)

        self._client: X402ClientComposed | None = None
        self._card: AgentCard | None = None
        self._context_id: str | None = None

    async def initialize(self) -> None:
        """Discover the remote agent. Must call before using tools."""
        if self._client is not None:
            return

        self._card = await A2ACardResolver(
            self.httpx_client, self.remote_agent_url
        ).get_agent_card()

        factory = X402ClientFactory(
            treasurer=self.treasurer,
            config=ClientConfig(httpx_client=self.httpx_client),
        )
        client = factory.create(card=self._card)

        if not isinstance(client, X402ClientComposed):
            raise TypeError(f"Expected X402ClientComposed, got {type(client)}")

        self._client = client

    def get_tools(self) -> list[BaseTool]:
        """Return LangChain tools for interacting with the remote agent.

        Returns:
            List of BaseTool instances.
        """
        return [
            GetAgentDetailsTool(toolkit=self),
            SendMessageTool(toolkit=self),
        ]

    async def _send_message(self, message: str) -> str:
        """Send a message to the remote agent.

        Args:
            message: Message text to send.

        Returns:
            Response text from the agent.

        Raises:
            RuntimeError: If agent not initialized or returns error.
        """
        if self._client is None or self._card is None:
            raise RuntimeError("Toolkit not initialized. Call initialize() first.")

        request = Message(
            message_id=str(uuid.uuid4()),
            role=Role.user,
            parts=[Part(root=TextPart(text=message))],
            context_id=self._context_id,
        )

        task: Task | None = None
        async for response in self._client.send_message(request):
            if isinstance(response, JSONRPCErrorResponse):
                error = response.error
                raise RuntimeError(f"Agent error: {error.message} (Code: {error.code})")

            if isinstance(response, Message):
                return self._extract_text_from_message(response)

            task, _ = response

        if task is None:
            raise RuntimeError("No response received from agent")

        if task.context_id:
            self._context_id = task.context_id

        return self._extract_text_from_task(task)

    def _extract_text_from_message(self, message: Message) -> str:
        """Extract text from a Message response."""
        text_parts = []
        for part in message.parts:
            if isinstance(part.root, TextPart):
                text_parts.append(part.root.text)
        return " ".join(text_parts) if text_parts else ""

    def _extract_text_from_task(self, task: Task) -> str:
        """Extract text from a Task response."""
        if task.status.state in (TaskState.completed, TaskState.failed):
            final_text = []
            if task.artifacts:
                for artifact in task.artifacts:
                    for part in artifact.parts:
                        if isinstance(part.root, TextPart):
                            final_text.append(part.root.text)

            if final_text:
                return " ".join(final_text)

            return f"Task {task.status.state.value}"

        return f"Task status: {task.status.state.value}"


class GetAgentDetailsTool(BaseTool):
    """Tool to get details about the remote A2A agent."""

    name: str = "a2a_get_agent_details"
    description: str = (
        "Get the capabilities and skills of the remote A2A agent. "
        "Call this to understand what the agent can do before sending messages."
    )
    toolkit: A2AToolkit

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _run(self) -> str:
        """Get agent details synchronously."""
        if self.toolkit._card is None:
            return json.dumps({"error": "Toolkit not initialized"})

        card = self.toolkit._card
        return json.dumps(
            {
                "name": card.name,
                "description": card.description,
                "skills": [skill.model_dump() for skill in card.skills],
            }
        )

    async def _arun(self) -> str:
        """Get agent details asynchronously."""
        return self._run()


class SendMessageInput(BaseModel):
    """Input schema for SendMessageTool."""

    message: str = Field(description="The message to send to the remote agent")


class SendMessageTool(BaseTool):
    """Tool to send a message to the remote A2A agent."""

    name: str = "a2a_send_message"
    description: str = (
        "Send a message to the remote A2A agent. "
        "Payments are handled automatically. "
        "Returns the agent's response."
    )
    args_schema: Type[BaseModel] | None = SendMessageInput  # pyright: ignore[reportIncompatibleVariableOverride]
    toolkit: A2AToolkit

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _run(self, message: str) -> str:
        """Synchronous execution not supported."""
        raise NotImplementedError(
            "SendMessageTool requires async execution. Use _arun() instead."
        )

    async def _arun(self, message: str) -> str:
        """Send message to remote agent asynchronously."""
        return await self.toolkit._send_message(message)
