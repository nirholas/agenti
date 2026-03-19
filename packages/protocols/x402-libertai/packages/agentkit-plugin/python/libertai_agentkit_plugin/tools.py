from __future__ import annotations

import json
from typing import Any, Awaitable, Callable, Protocol, runtime_checkable


@runtime_checkable
class ActionLike(Protocol):
    name: str
    description: str
    args_schema: type | None
    invoke: Callable[..., Any]


def actions_to_tools(
    actions: list[Any],
) -> tuple[list[dict[str, Any]], Callable[[str, str], Awaitable[str]]]:
    """Convert AgentKit actions to OpenAI function-calling tools + async executor."""
    action_map: dict[str, Callable[..., Any]] = {}
    tools: list[dict[str, Any]] = []

    for action in actions:
        action_map[action.name] = action.invoke

        parameters: dict[str, Any] = {"type": "object", "properties": {}}
        if action.args_schema is not None:
            parameters = action.args_schema.model_json_schema()

        tools.append({
            "type": "function",
            "function": {
                "name": action.name,
                "description": action.description,
                "parameters": parameters,
            },
        })

    async def execute_tool(name: str, args_json: str) -> str:
        handler = action_map.get(name)
        if handler is None:
            return f'Error: unknown tool "{name}"'
        try:
            args = json.loads(args_json)
            result = handler(args)
            if hasattr(result, "__await__"):
                result = await result
            return str(result)
        except Exception as e:
            return f"Error executing {name}: {e}"

    return tools, execute_tool
