"""Unit tests for X402RemoteAgentToolset."""
# mypy: disable-error-code="no-untyped-def,arg-type,index"

from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
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
    TaskStatus,
    TaskStatusUpdateEvent,
    TextPart,
)
from ampersend_sdk.a2a.client.x402_remote_agent_toolset import (
    X402RemoteAgentToolset,
)
from ampersend_sdk.x402 import X402Treasurer
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools.function_tool import FunctionTool
from google.adk.tools.tool_context import ToolContext


@pytest.fixture
def mock_treasurer() -> MagicMock:
    """Create a mock treasurer."""
    return MagicMock(spec=X402Treasurer)


@pytest.fixture
def mock_agent_card() -> AgentCard:
    """Create a mock agent card with all required fields."""
    from a2a.types import AgentCapabilities

    return AgentCard(
        name="test_agent",
        description="A test agent",
        url="http://test-agent.com",
        capabilities=AgentCapabilities(
            streaming=True,
        ),
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
class TestInitialization:
    """Test X402RemoteAgentToolset initialization."""

    async def test_init_with_defaults(self, mock_treasurer: MagicMock) -> None:
        """Test initialization with default parameters."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://agent1.com"],
            treasurer=mock_treasurer,
        )

        assert toolset.remote_agent_urls == ["http://agent1.com"]
        assert toolset.treasurer == mock_treasurer
        assert toolset.state_key_prefix == "x402_agent_contexts"
        assert toolset.task_callback is None
        assert not toolset._initialized

    async def test_init_with_custom_params(
        self, mock_treasurer: MagicMock, mock_httpx_client: MagicMock
    ) -> None:
        """Test initialization with custom parameters."""
        callback = MagicMock()

        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://agent1.com", "http://agent2.com"],
            treasurer=mock_treasurer,
            state_key_prefix="custom_contexts",
            httpx_client=mock_httpx_client,
            task_callback=callback,
        )

        assert len(toolset.remote_agent_urls) == 2
        assert toolset.state_key_prefix == "custom_contexts"
        assert toolset.httpx_client == mock_httpx_client
        assert toolset.task_callback == callback

    async def test_get_before_agent_callback_returns_callable(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that get_before_agent_callback returns a callable."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://agent1.com"],
            treasurer=mock_treasurer,
        )

        callback = toolset.get_before_agent_callback()
        assert callable(callback)


@pytest.mark.asyncio
class TestAgentDiscovery:
    """Test agent discovery functionality."""

    async def test_before_agent_callback_discovers_agents(
        self, mock_treasurer, mock_agent_card
    ) -> None:
        """Test that before_agent_callback discovers and stores agents."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Mock A2ACardResolver
        with patch(
            "ampersend_sdk.a2a.client.x402_remote_agent_toolset.A2ACardResolver"
        ) as mock_resolver:
            mock_instance = AsyncMock()
            mock_instance.get_agent_card.return_value = mock_agent_card
            mock_resolver.return_value = mock_instance

            # Mock client factory - needs to return X402ClientComposed
            with patch.object(toolset._client_factory, "create") as mock_create:
                from ampersend_sdk.a2a.client.x402_client_composed import (
                    X402ClientComposed,
                )

                mock_client = MagicMock(spec=X402ClientComposed)
                mock_create.return_value = mock_client

                # Mock callback context
                mock_context = MagicMock(spec=CallbackContext)

                # Call discovery
                await toolset._before_agent_callback(mock_context)

                # Verify agent was discovered
                assert toolset._initialized
                assert "test_agent" in toolset._agent_cards
                assert toolset._agent_cards["test_agent"] == mock_agent_card
                assert "test_agent" in toolset._remote_clients

    async def test_duplicate_agent_names_raises_error(
        self, mock_treasurer, mock_agent_card
    ) -> None:
        """Test that duplicate agent names raise ValueError."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://agent1.com", "http://agent2.com"],
            treasurer=mock_treasurer,
        )

        # Both agents return same name
        with patch(
            "ampersend_sdk.a2a.client.x402_remote_agent_toolset.A2ACardResolver"
        ) as mock_resolver:
            mock_instance = AsyncMock()
            mock_instance.get_agent_card.return_value = mock_agent_card  # Same card
            mock_resolver.return_value = mock_instance

            mock_context = MagicMock(spec=CallbackContext)

            # Should raise ValueError on duplicate
            with pytest.raises(
                ValueError, match="Cannot add two agents with the same name"
            ):
                await toolset._before_agent_callback(mock_context)

    async def test_discovery_only_runs_once(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that discovery only runs once."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        with patch(
            "ampersend_sdk.a2a.client.x402_remote_agent_toolset.A2ACardResolver"
        ) as mock_resolver:
            mock_instance = AsyncMock()
            mock_instance.get_agent_card.return_value = mock_agent_card
            mock_resolver.return_value = mock_instance

            with patch.object(toolset._client_factory, "create") as mock_create:
                from ampersend_sdk.a2a.client.x402_client_composed import (
                    X402ClientComposed,
                )

                mock_client = MagicMock(spec=X402ClientComposed)
                mock_create.return_value = mock_client

                mock_context = MagicMock(spec=CallbackContext)

                # Call twice
                await toolset._before_agent_callback(mock_context)
                await toolset._before_agent_callback(mock_context)

                # Should only call resolver once
                assert mock_resolver.call_count == 1


@pytest.mark.asyncio
class TestToolRegistration:
    """Test tool registration and retrieval."""

    async def test_get_tools_returns_function_tools(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that get_tools returns FunctionTool instances."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        tools = await toolset.get_tools()

        assert isinstance(tools, list)
        assert len(tools) == 3
        assert all(isinstance(tool, FunctionTool) for tool in tools)

    async def test_tool_names_are_correct(self, mock_treasurer: MagicMock) -> None:
        """Test that tool names are correctly set."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        tools = await toolset.get_tools()
        tool_names = [tool.name for tool in tools]

        assert "x402_a2a_list_agents" in tool_names
        assert "x402_a2a_get_agent_details" in tool_names
        assert "x402_a2a_send_to_agent" in tool_names


@pytest.mark.asyncio
class TestListAgents:
    """Test x402_a2a_list_agents tool."""

    async def test_list_agents_empty_before_discovery(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that list_agents returns empty list before discovery."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        agents = toolset.x402_a2a_list_agents()
        assert agents == []

    async def test_list_agents_returns_card_info(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that list_agents returns agent info after discovery."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Manually populate (simulating discovery)
        toolset._agent_cards["test_agent"] = mock_agent_card

        agents = toolset.x402_a2a_list_agents()

        assert len(agents) == 1
        assert agents[0]["name"] == "test_agent"
        assert agents[0]["description"] == "A test agent"


@pytest.mark.asyncio
class TestGetAgentDetails:
    """Test x402_a2a_get_agent_details tool."""

    async def test_get_agent_details_returns_card_info(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that get_agent_details returns full agent card info."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Manually populate (simulating discovery)
        toolset._agent_cards["test_agent"] = mock_agent_card

        details = toolset.x402_a2a_get_agent_details("test_agent")

        assert details["name"] == "test_agent"
        assert details["description"] == "A test agent"
        assert details["url"] == "http://test-agent.com"
        assert details["version"] == "1.0.0"
        assert "capabilities" in details
        assert details["capabilities"]["streaming"] is True
        assert "skills" in details
        assert "documentation_url" in details

    async def test_get_agent_details_agent_not_found(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that getting details for unknown agent raises ValueError."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        with pytest.raises(ValueError, match="Agent 'unknown_agent' not found"):
            toolset.x402_a2a_get_agent_details("unknown_agent")


@pytest.mark.asyncio
class TestSendToAgent:
    """Test x402_a2a_send_to_agent tool."""

    async def test_send_message_agent_not_found(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test that sending to unknown agent raises ValueError."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        with pytest.raises(ValueError, match="Agent 'unknown_agent' not found"):
            await toolset.x402_a2a_send_to_agent(
                "unknown_agent", "test message", mock_tool_context
            )

    async def test_send_message_with_message_response(
        self, mock_treasurer, mock_agent_card
    ) -> None:
        """Test sending message that returns Message response."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client that returns Message
        mock_client = MagicMock()

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            """Mock async iterator returning Message."""
            yield Message(
                message_id="msg-1",
                role=Role.agent,
                parts=[Part(root=TextPart(text="Hello from agent"))],
            )

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        # Send message
        result = await toolset.x402_a2a_send_to_agent(
            "test_agent", "test message", mock_tool_context
        )

        assert result == "Hello from agent"

    async def test_send_message_with_task_response(
        self, mock_treasurer, mock_agent_card
    ) -> None:
        """Test sending message that returns Task response."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client that returns Task
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

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            """Mock async iterator returning Task."""
            yield (task, None)  # ClientEvent is (Task, Event | None)

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        # Send message
        result = await toolset.x402_a2a_send_to_agent(
            "test_agent", "test message", mock_tool_context
        )

        assert result == "Task result"
        # Verify context was updated
        assert mock_tool_context.state["x402_agent_contexts"]["test_agent"] == "ctx-1"

    async def test_send_message_updates_context(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that context_id is stored in state after response."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client
        mock_client = MagicMock()

        task = Task(
            id="task-1",
            context_id="new-context-id",
            status=TaskStatus(state=TaskState.completed),
            artifacts=[
                Artifact(
                    artifact_id="art-1", parts=[Part(root=TextPart(text="Result"))]
                )
            ],
        )

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            yield (task, None)

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context with existing state
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {"x402_agent_contexts": {"test_agent": "old-context"}}

        # Send message
        await toolset.x402_a2a_send_to_agent(
            "test_agent", "test message", mock_tool_context
        )

        # Verify context was updated
        assert (
            mock_tool_context.state["x402_agent_contexts"]["test_agent"]
            == "new-context-id"
        )


@pytest.mark.asyncio
class TestCallback:
    """Test task callback functionality."""

    async def test_task_callback_called_on_updates(
        self, mock_treasurer, mock_agent_card
    ) -> None:
        """Test that task callback is called for each update."""
        callback_calls = []

        def test_callback(task: Task) -> None:
            callback_calls.append(task.status.state)

        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
            task_callback=test_callback,
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client that yields multiple updates
        mock_client = MagicMock()

        task = Task(
            id="task-1",
            context_id="ctx-1",
            status=TaskStatus(state=TaskState.working),
            artifacts=[],
        )

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            # Yield working status
            yield (
                task,
                TaskStatusUpdateEvent(
                    task_id="task-1",
                    context_id="ctx-1",
                    status=TaskStatus(state=TaskState.working),
                    final=False,
                ),
            )

            # Yield completed status
            task.status = TaskStatus(state=TaskState.completed)
            task.artifacts = [
                Artifact(artifact_id="art-1", parts=[Part(root=TextPart(text="Done"))])
            ]
            yield (task, None)

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        # Send message
        await toolset.x402_a2a_send_to_agent(
            "test_agent", "test message", mock_tool_context
        )

        # Verify callback was called for both updates
        assert len(callback_calls) == 2
        assert callback_calls[0] == TaskState.working
        assert callback_calls[1] == TaskState.completed

    async def test_task_callback_not_called_when_none(
        self, mock_treasurer, mock_agent_card
    ) -> None:
        """Test that no error occurs when callback is None."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
            task_callback=None,  # Explicitly None
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client
        mock_client = MagicMock()

        task = Task(
            id="task-1",
            context_id="ctx-1",
            status=TaskStatus(state=TaskState.completed),
            artifacts=[
                Artifact(
                    artifact_id="art-1", parts=[Part(root=TextPart(text="Result"))]
                )
            ],
        )

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            yield (task, None)

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        # Should not raise error
        result = await toolset.x402_a2a_send_to_agent(
            "test_agent", "test message", mock_tool_context
        )
        assert result == "Result"


@pytest.mark.asyncio
class TestArtifactChunking:
    """Test artifact chunking functionality."""

    async def test_process_complete_artifact(self, mock_treasurer: MagicMock) -> None:
        """Test processing a complete artifact (no chunking)."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        task = Task(
            id="task-1",
            status=TaskStatus(state=TaskState.working),
            artifacts=[],
            context_id="ctx-1",
        )

        event = TaskArtifactUpdateEvent(
            task_id="task-1",
            context_id="ctx-1",
            artifact=Artifact(
                artifact_id="art-1",
                parts=[Part(root=TextPart(text="Complete artifact"))],
            ),
            append=False,
            last_chunk=True,
        )

        toolset._process_artifact_event(task, event)

        assert len(task.artifacts) == 1
        assert task.artifacts[0].artifact_id == "art-1"

    async def test_process_streaming_artifact_chunks(
        self, mock_treasurer: MagicMock
    ) -> None:
        """Test processing multiple streaming chunks."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        task = Task(
            id="task-1",
            status=TaskStatus(state=TaskState.working),
            artifacts=[],
            context_id="ctx-1",
        )

        # First chunk
        event1 = TaskArtifactUpdateEvent(
            task_id="task-1",
            context_id="ctx-1",
            artifact=Artifact(
                artifact_id="art-1",
                parts=[Part(root=TextPart(text="Hello "))],
            ),
            append=False,
            last_chunk=False,
        )
        toolset._process_artifact_event(task, event1)

        # Should be buffered, not in task yet
        assert len(task.artifacts) == 0
        assert "art-1" in toolset._artifact_chunks

        # Second chunk (append)
        event2 = TaskArtifactUpdateEvent(
            task_id="task-1",
            context_id="ctx-1",
            artifact=Artifact(
                artifact_id="art-1",
                parts=[Part(root=TextPart(text="world"))],
            ),
            append=True,
            last_chunk=False,
        )
        toolset._process_artifact_event(task, event2)

        # Still buffered
        assert len(task.artifacts) == 0
        buffered = toolset._artifact_chunks["art-1"][0]
        assert len(buffered.parts) == 2

        # Final chunk
        event3 = TaskArtifactUpdateEvent(
            task_id="task-1",
            context_id="ctx-1",
            artifact=Artifact(
                artifact_id="art-1",
                parts=[Part(root=TextPart(text="!"))],
            ),
            append=True,
            last_chunk=True,
        )
        toolset._process_artifact_event(task, event3)

        # Should now be in task, buffer cleaned up
        assert len(task.artifacts) == 1
        assert "art-1" not in toolset._artifact_chunks
        # Verify all chunks assembled
        assert len(task.artifacts[0].parts) == 3


@pytest.mark.asyncio
class TestErrorHandling:
    """Test error handling."""

    async def test_jsonrpc_error_response_raises(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that JSONRPCErrorResponse raises RuntimeError."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client that returns error
        mock_client = MagicMock()

        from a2a.types import JSONRPCError

        error_response = JSONRPCErrorResponse(
            jsonrpc="2.0",
            id="1",
            error=JSONRPCError(message="Something went wrong", code=-32000),
        )

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            yield error_response

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        # Should raise RuntimeError
        with pytest.raises(RuntimeError, match="returned error: Something went wrong"):
            await toolset.x402_a2a_send_to_agent(
                "test_agent", "test message", mock_tool_context
            )

    async def test_no_response_raises_error(
        self, mock_treasurer: MagicMock, mock_agent_card: AgentCard
    ) -> None:
        """Test that empty iteration raises RuntimeError."""
        toolset = X402RemoteAgentToolset(
            remote_agent_urls=["http://test-agent.com"],
            treasurer=mock_treasurer,
        )

        # Setup agent
        toolset._agent_cards["test_agent"] = mock_agent_card

        # Mock client that returns nothing
        mock_client = MagicMock()

        async def mock_send_message(*args, **kwargs) -> AsyncIterator[Any]:
            # Empty iterator
            return
            yield  # Make it a generator

        mock_client.send_message = mock_send_message
        toolset._remote_clients["test_agent"] = mock_client

        # Mock tool context
        mock_tool_context = MagicMock(spec=ToolContext)
        mock_tool_context.state = {}

        # Should raise RuntimeError
        with pytest.raises(RuntimeError, match="No response received"):
            await toolset.x402_a2a_send_to_agent(
                "test_agent", "test message", mock_tool_context
            )
