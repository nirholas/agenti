from contextvars import ContextVar
from typing import Any, Optional

import google.adk.a2a.executor.a2a_agent_executor
from google.adk.a2a.converters.part_converter import (
    A2APartToGenAIPartConverter,
    convert_a2a_part_to_genai_part,
)
from google.adk.a2a.converters.request_converter import (
    convert_a2a_request_to_adk_run_args,
)
from google.adk.agents import RunConfig
from x402_a2a.types import RequestContext

# Context variable to pass max_llm_calls configuration to the monkey-patched function
_max_llm_calls_var: ContextVar[Optional[int]] = ContextVar(
    "max_llm_calls", default=None
)


def set_max_llm_calls(value: Optional[int]) -> None:
    """Set the max_llm_calls value for the current context."""
    _max_llm_calls_var.set(value)


def override_convert_a2a_request_to_adk_run_args(
    request: RequestContext,
    part_converter: A2APartToGenAIPartConverter = convert_a2a_part_to_genai_part,
) -> dict[str, Any]:
    og = convert_a2a_request_to_adk_run_args(request, part_converter)
    if request.current_task and request.current_task.metadata:
        og["state_delta"] = {}
        for key, value in request.current_task.metadata.items():
            og["state_delta"][key] = value

    # Apply max_llm_calls from context if set
    max_llm_calls = _max_llm_calls_var.get()
    if max_llm_calls is not None:
        og["run_config"] = RunConfig(max_llm_calls=max_llm_calls)

    return og  # type: ignore[no-any-return]


# Monkey patch
google.adk.a2a.executor.a2a_agent_executor.convert_a2a_request_to_adk_run_args = (  # type: ignore[attr-defined]
    override_convert_a2a_request_to_adk_run_args
)

# IMPORTANT: Apply monkey patch BEFORE importing A2aAgentExecutor
from google.adk.a2a.executor.a2a_agent_executor import A2aAgentExecutor  # noqa: E402

MonkeyA2aAgentExecutor = A2aAgentExecutor
