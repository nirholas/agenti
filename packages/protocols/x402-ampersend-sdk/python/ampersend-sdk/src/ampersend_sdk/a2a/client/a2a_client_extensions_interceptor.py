from typing import Any

from a2a.client import ClientCallContext, ClientCallInterceptor
from a2a.extensions.common import HTTP_EXTENSION_HEADER
from a2a.types import AgentCard
from x402_a2a import X402_EXTENSION_URI


class ExtensionsInterceptor(ClientCallInterceptor):
    """Interceptor that adds X-A2A-Extensions header to all requests."""

    def __init__(self, extensions: list[str]):
        """
        Args:
            extensions: List of extension URIs to signal support for.
        """
        self.extensions = extensions

    async def intercept(
        self,
        method_name: str,
        request_payload: dict[str, Any],
        http_kwargs: dict[str, Any],
        agent_card: AgentCard | None,
        context: ClientCallContext | None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Add extension header to HTTP request."""
        if self.extensions:
            headers = http_kwargs.get("headers", {})
            existing_extensions = headers.get(HTTP_EXTENSION_HEADER, "")
            split = existing_extensions.split(", ") if existing_extensions else []
            headers[HTTP_EXTENSION_HEADER] = ", ".join(self.extensions + split)
            http_kwargs["headers"] = headers

        return request_payload, http_kwargs


x402_extension_interceptor = ExtensionsInterceptor(
    extensions=[
        X402_EXTENSION_URI,
    ]
)
