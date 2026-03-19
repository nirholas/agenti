"""Standard LangChain unit tests for tools."""

from typing import Type
from unittest.mock import MagicMock

from a2a.types import AgentCapabilities, AgentCard
from langchain_ampersend.a2a.toolkit import (
    A2AToolkit,
    GetAgentDetailsTool,
    SendMessageTool,
)
from langchain_tests.unit_tests import ToolsUnitTests


def _make_mock_toolkit() -> A2AToolkit:
    """Create a mock toolkit with initialized card."""
    mock_treasurer = MagicMock()
    toolkit = A2AToolkit(
        remote_agent_url="http://test-agent.com",
        treasurer=mock_treasurer,
    )
    toolkit._card = AgentCard(
        name="test_agent",
        description="A test agent",
        url="http://test-agent.com",
        capabilities=AgentCapabilities(streaming=True),
        default_input_modes=[],
        default_output_modes=[],
        skills=[],
        version="1.0.0",
    )
    return toolkit


class TestGetAgentDetailsToolStandard(ToolsUnitTests):
    @property
    def tool_constructor(self) -> Type[GetAgentDetailsTool]:
        return GetAgentDetailsTool

    @property
    def tool_constructor_params(self) -> dict:
        return {"toolkit": _make_mock_toolkit()}

    @property
    def tool_invoke_params_example(self) -> dict:
        return {}  # GetAgentDetailsTool takes no parameters


class TestSendMessageToolStandard(ToolsUnitTests):
    @property
    def tool_constructor(self) -> Type[SendMessageTool]:
        return SendMessageTool

    @property
    def tool_constructor_params(self) -> dict:
        return {"toolkit": _make_mock_toolkit()}

    @property
    def tool_invoke_params_example(self) -> dict:
        return {"message": "Hello, agent!"}
