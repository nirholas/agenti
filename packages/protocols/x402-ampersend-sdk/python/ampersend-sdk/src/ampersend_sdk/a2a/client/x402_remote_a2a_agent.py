from typing import Any, Union, override

from a2a.client.client_factory import ClientFactory as A2AClientFactory
from a2a.types import AgentCard
from google.adk.a2a.converters.part_converter import (
    A2APartToGenAIPartConverter,
    GenAIPartToA2APartConverter,
    convert_a2a_part_to_genai_part,
    convert_genai_part_to_a2a_part,
)
from google.adk.agents.remote_a2a_agent import DEFAULT_TIMEOUT, RemoteA2aAgent
from httpx import AsyncClient

from ...x402.treasurer import X402Treasurer
from .x402_client_factory import X402ClientFactory


class X402RemoteA2aAgent(RemoteA2aAgent):
    def __init__(
        self,
        *,
        treasurer: X402Treasurer,
        name: str,
        agent_card: Union[AgentCard, str],
        description: str = "",
        httpx_client: AsyncClient | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        genai_part_converter: GenAIPartToA2APartConverter = convert_genai_part_to_a2a_part,
        a2a_part_converter: A2APartToGenAIPartConverter = convert_a2a_part_to_genai_part,
        a2a_client_factory: A2AClientFactory | None = None,
        **kwargs: Any,
    ):
        super().__init__(
            name=name,
            agent_card=agent_card,
            description=description,
            httpx_client=httpx_client,
            timeout=timeout,
            genai_part_converter=genai_part_converter,
            a2a_part_converter=a2a_part_converter,
            a2a_client_factory=a2a_client_factory,
            **kwargs,
        )
        self._treasurer = treasurer

    @override
    async def _ensure_httpx_client(self) -> AsyncClient:
        httpx_client = await super()._ensure_httpx_client()

        assert self._a2a_client_factory is not None
        self._a2a_client_factory = X402ClientFactory(
            treasurer=self._treasurer,
            config=self._a2a_client_factory._config,
        )

        return httpx_client
