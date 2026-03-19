import json

import pytest

from libertai_agentkit_plugin.tools import actions_to_tools
from pydantic import BaseModel


class EchoArgs(BaseModel):
    message: str


class MockAction:
    def __init__(self, name, description, args_schema, invoke):
        self.name = name
        self.description = description
        self.args_schema = args_schema
        self.invoke = invoke


def make_echo_action():
    async def invoke(args):
        return f"echo: {args['message']}"
    return MockAction("echo", "Echoes input", EchoArgs, invoke)


def make_fail_action():
    async def invoke(args):
        raise RuntimeError("boom")
    return MockAction("fail", "Always fails", None, invoke)


def test_converts_to_openai_format():
    tools, _ = actions_to_tools([make_echo_action()])
    assert len(tools) == 1
    assert tools[0]["type"] == "function"
    assert tools[0]["function"]["name"] == "echo"
    assert tools[0]["function"]["description"] == "Echoes input"
    assert "properties" in tools[0]["function"]["parameters"]


def test_multiple_actions():
    tools, _ = actions_to_tools([make_echo_action(), make_fail_action()])
    assert len(tools) == 2
    assert [t["function"]["name"] for t in tools] == ["echo", "fail"]


def test_empty_actions():
    tools, _ = actions_to_tools([])
    assert tools == []


@pytest.mark.asyncio
async def test_execute_tool_dispatches():
    _, execute = actions_to_tools([make_echo_action()])
    result = await execute("echo", json.dumps({"message": "hello"}))
    assert result == "echo: hello"


@pytest.mark.asyncio
async def test_execute_tool_unknown():
    _, execute = actions_to_tools([make_echo_action()])
    result = await execute("nope", "{}")
    assert 'unknown tool "nope"' in result


@pytest.mark.asyncio
async def test_execute_tool_error():
    _, execute = actions_to_tools([make_fail_action()])
    result = await execute("fail", "{}")
    assert "Error executing fail" in result
    assert "boom" in result


@pytest.mark.asyncio
async def test_execute_tool_invalid_json():
    _, execute = actions_to_tools([make_echo_action()])
    result = await execute("echo", "not-json")
    assert "Error executing echo" in result
