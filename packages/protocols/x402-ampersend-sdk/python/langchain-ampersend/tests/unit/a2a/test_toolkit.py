"""Unit tests for A2AToolkit."""

import json
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    Artifact,
    JSONRPCError,
    JSONRPCErrorResponse,
    Message,
    Part,
    Role,
    Task,
    TaskState,
    TaskStatus,
    TextPart,
)
from langchain_ampersend.a2a.toolkit import (
    A2AToolkit,
    GetAgentDetailsTool,
    SendMessageTool,
)


@pytest.fixture
def mock_treasurer() -> MagicMock:
    """Create a mock treasurer."""
    from ampersend_sdk.x402.treasurer import X402Treasurer

    return MagicMock(spec=X402Treasurer)


@pytest.fixture
def mock_agent_card() -> AgentCard:
    """Create a mock agent card."""
    return AgentCard(
        name="test_agent",
        description="A test agent for testing",
        url="http://test-agent.com",
        capabilities=AgentCapabilities(streaming=True),
        default_input_modes=[],
        default_output_modes=[],
        skills=[],
        version="1.0.0",
    )


@pytest.fixture
def mock_httpx_client() -> MagicMock:
    """Create a mock httpx client."""
    return MagicMock(spec=httpx.AsyncClient)


@pytest.mark.asyncio
class TestA2AToolkitInit:
    """Test A2AToolkit initialization."""

    async def test_init_with_defaults(self, mock_treasurer: MagicMock) -> None:
        """Test initialization with default parameters."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        assert toolkit.remote_agent_url == "http://test-agent.com"
        assert toolkit.treasurer == mock_treasurer
        assert toolkit._client is None
        assert toolkit._card is None
        assert toolkit._context_id is None

    async def test_init_with_custom_httpx_client(
        self, mock_treasurer: MagicMock, mock_httpx_client: MagicMock
    ) -> None:
        """Test initialization with custom httpx client."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
            httpx_client=mock_httpx_client,
        )

        assert toolkit.httpx_client == mock_httpx_client


@pytest.mark.asyncio
class TestA2AToolkitInitialize:
    """Test A2AToolkit.initialize()."""

    async def test_initialize_discovers_agent(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that initialize() discovers the remote agent."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        with patch(
            "langchain_ampersend.a2a.toolkit.A2ACardResolver"
        ) as mock_resolver_cls:
            mock_resolver = AsyncMock()
            mock_resolver.get_agent_card.return_value = mock_agent_card
            mock_resolver_cls.return_value = mock_resolver

            with patch(
                "langchain_ampersend.a2a.toolkit.X402ClientFactory"
            ) as mock_factory_cls:
                from ampersend_sdk.a2a.client.x402_client_composed import (
                    X402ClientComposed,
                )

                mock_client = MagicMock(spec=X402ClientComposed)
                mock_factory = MagicMock()
                mock_factory.create.return_value = mock_client
                mock_factory_cls.return_value = mock_factory

                await toolkit.initialize()

                assert toolkit._card == mock_agent_card
                assert toolkit._client == mock_client

    async def test_initialize_only_runs_once(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that initialize() only runs once."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        with patch(
            "langchain_ampersend.a2a.toolkit.A2ACardResolver"
        ) as mock_resolver_cls:
            mock_resolver = AsyncMock()
            mock_resolver.get_agent_card.return_value = mock_agent_card
            mock_resolver_cls.return_value = mock_resolver

            with patch(
                "langchain_ampersend.a2a.toolkit.X402ClientFactory"
            ) as mock_factory_cls:
                from ampersend_sdk.a2a.client.x402_client_composed import (
                    X402ClientComposed,
                )

                mock_client = MagicMock(spec=X402ClientComposed)
                mock_factory = MagicMock()
                mock_factory.create.return_value = mock_client
                mock_factory_cls.return_value = mock_factory

                await toolkit.initialize()
                await toolkit.initialize()  # Second call

                # Resolver should only be called once
                assert mock_resolver_cls.call_count == 1


@pytest.mark.asyncio
class TestGetTools:
    """Test A2AToolkit.get_tools()."""

    async def test_get_tools_returns_two_tools(self, mock_treasurer: MagicMock) -> None:
        """Test that get_tools() returns two tools."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        tools = toolkit.get_tools()

        assert len(tools) == 2
        assert any(isinstance(t, GetAgentDetailsTool) for t in tools)
        assert any(isinstance(t, SendMessageTool) for t in tools)

    async def test_tool_names(self, mock_treasurer: MagicMock) -> None:
        """Test that tools have correct names."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        tools = toolkit.get_tools()
        names = [t.name for t in tools]

        assert "a2a_get_agent_details" in names
        assert "a2a_send_message" in names


@pytest.mark.asyncio
class TestGetAgentDetailsTool:
    """Test GetAgentDetailsTool."""

    async def test_returns_agent_card_info(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that tool returns agent card info as JSON."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )
        toolkit._card = mock_agent_card

        tool = GetAgentDetailsTool(toolkit=toolkit)
        result = tool._run()

        data = json.loads(result)
        assert data["name"] == "test_agent"
        assert data["description"] == "A test agent for testing"
        assert "skills" in data

    async def test_returns_error_when_not_initialized(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that tool returns error when not initialized."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        tool = GetAgentDetailsTool(toolkit=toolkit)
        result = tool._run()

        data = json.loads(result)
        assert "error" in data


@pytest.mark.asyncio
class TestSendMessageTool:
    """Test SendMessageTool."""

    async def test_send_message_with_message_response(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test sending message that returns Message response."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )
        toolkit._card = mock_agent_card

        # Mock client
        mock_client = MagicMock()

        async def mock_send_message(*args: Any, **kwargs: Any) -> AsyncIterator[Any]:
            yield Message(
                message_id="msg-1",
                role=Role.agent,
                parts=[Part(root=TextPart(text="Hello from agent"))],
            )

        mock_client.send_message = mock_send_message
        toolkit._client = mock_client

        tool = SendMessageTool(toolkit=toolkit)
        result = await tool._arun(message="Hello")

        assert result == "Hello from agent"

    async def test_send_message_with_task_response(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test sending message that returns Task response."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )
        toolkit._card = mock_agent_card

        # Mock client
        mock_client = MagicMock()

        task = Task(
            id="task-1",
            context_id="ctx-1",
            status=TaskStatus(state=TaskState.completed),
            artifacts=[
                Artifact(
                    artifact_id="art-1",
                    parts=[Part(root=TextPart(text="Task result"))],
                )
            ],
        )

        async def mock_send_message(*args: Any, **kwargs: Any) -> AsyncIterator[Any]:
            yield (task, None)

        mock_client.send_message = mock_send_message
        toolkit._client = mock_client

        tool = SendMessageTool(toolkit=toolkit)
        result = await tool._arun(message="Hello")

        assert result == "Task result"
        assert toolkit._context_id == "ctx-1"

    async def test_send_message_preserves_context(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that context_id is preserved across calls."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )
        toolkit._card = mock_agent_card
        toolkit._context_id = "existing-context"

        # Mock client
        mock_client = MagicMock()
        captured_requests: list[Message] = []

        task = Task(
            id="task-1",
            context_id="new-context",
            status=TaskStatus(state=TaskState.completed),
            artifacts=[
                Artifact(
                    artifact_id="art-1",
                    parts=[Part(root=TextPart(text="Result"))],
                )
            ],
        )

        async def mock_send_message(
            request: Message, **kwargs: Any
        ) -> AsyncIterator[Any]:
            captured_requests.append(request)
            yield (task, None)

        mock_client.send_message = mock_send_message
        toolkit._client = mock_client

        tool = SendMessageTool(toolkit=toolkit)
        await tool._arun(message="Hello")

        # Verify request used existing context
        assert len(captured_requests) == 1
        assert captured_requests[0].context_id == "existing-context"

        # Verify context was updated
        assert toolkit._context_id == "new-context"

    async def test_sync_run_raises_not_implemented(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that sync _run raises NotImplementedError."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        tool = SendMessageTool(toolkit=toolkit)

        with pytest.raises(NotImplementedError):
            tool._run(message="Hello")


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling."""

    async def test_send_message_not_initialized(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that sending message before initialize raises error."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )

        with pytest.raises(RuntimeError, match="not initialized"):
            await toolkit._send_message("Hello")

    async def test_jsonrpc_error_raises(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that JSONRPCErrorResponse raises RuntimeError."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )
        toolkit._card = mock_agent_card

        # Mock client
        mock_client = MagicMock()

        error_response = JSONRPCErrorResponse(
            jsonrpc="2.0",
            id="1",
            error=JSONRPCError(message="Something went wrong", code=-32000),
        )

        async def mock_send_message(*args: Any, **kwargs: Any) -> AsyncIterator[Any]:
            yield error_response

        mock_client.send_message = mock_send_message
        toolkit._client = mock_client

        with pytest.raises(RuntimeError, match="Something went wrong"):
            await toolkit._send_message("Hello")

    async def test_no_response_raises(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that empty response raises RuntimeError."""
        toolkit = A2AToolkit(
            remote_agent_url="http://test-agent.com",
            treasurer=mock_treasurer,
        )
        toolkit._card = mock_agent_card

        # Mock client
        mock_client = MagicMock()

        async def mock_send_message(*args: Any, **kwargs: Any) -> AsyncIterator[Any]:
            return
            yield

        mock_client.send_message = mock_send_message
        toolkit._client = mock_client

        with pytest.raises(RuntimeError, match="No response received"):
            await toolkit._send_message("Hello")
