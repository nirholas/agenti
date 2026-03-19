from typing import override

from a2a.client import Client, ClientFactory
from a2a.client.base_client import BaseClient
from a2a.client.client import ClientConfig, Consumer
from a2a.client.middleware import ClientCallInterceptor
from a2a.types import (
    AgentCard,
)

from ...x402.treasurer import X402Treasurer
from .x402_client_composed import X402ClientComposed


class X402ClientFactory(ClientFactory):
    def __init__(
        self,
        *,
        treasurer: X402Treasurer,
        config: ClientConfig,
        consumers: list[Consumer] | None = None,
    ):
        super().__init__(config=config, consumers=consumers)
        self._treasurer = treasurer

    @override
    def create(
        self,
        card: AgentCard,
        consumers: list[Consumer] | None = None,
        interceptors: list[ClientCallInterceptor] | None = None,
    ) -> Client:
        base_client = super().create(
            card=card, consumers=consumers, interceptors=interceptors
        )
        assert isinstance(base_client, BaseClient)
        x402_client = X402ClientComposed(client=base_client, treasurer=self._treasurer)
        return x402_client  # type: ignore[return-value]
