from typing import Any, AsyncIterator, override

from a2a.client import ClientCallContext, ClientEvent
from a2a.client.base_client import BaseClient
from a2a.client.client import (
    ClientConfig,
    ClientEvent,
    Consumer,
)
from a2a.client.middleware import ClientCallInterceptor
from a2a.client.transports.base import ClientTransport
from a2a.types import (
    AgentCard,
    Message,
)
from x402_a2a.core.utils import x402Utils

from ...x402.treasurer import X402Treasurer
from .a2a_client_extensions_interceptor import x402_extension_interceptor
from .x402_middleware import x402_middleware


class X402Client(BaseClient):
    def __init__(
        self,
        *,
        treasurer: X402Treasurer,
        card: AgentCard,
        config: ClientConfig,
        transport: ClientTransport,
        consumers: list[Consumer],
        middleware: list[ClientCallInterceptor],
        **kwargs: Any,
    ):
        middleware = middleware or []
        if x402_extension_interceptor not in middleware:
            middleware.append(x402_extension_interceptor)

        super().__init__(
            card=card,
            config=config,
            transport=transport,
            consumers=consumers,
            middleware=middleware,
            **kwargs,
        )
        self.manual_init(treasurer=treasurer)

    def manual_init(self, treasurer: X402Treasurer) -> None:
        self._treasurer = treasurer
        self._x402Utils = x402Utils()

    @override
    async def send_message(
        self,
        request: Message,
        *,
        context: ClientCallContext | None = None,
    ) -> AsyncIterator[ClientEvent | Message]:
        async for i in x402_middleware(
            treasurer=self._treasurer,
            context=context,
            request=request,
            send_message=super().send_message,
            utils=self._x402Utils,
        ):
            yield i
