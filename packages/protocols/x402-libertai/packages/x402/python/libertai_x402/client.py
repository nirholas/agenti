from __future__ import annotations

from functools import partial
from typing import Any

import anyio
import httpx

from libertai_x402.sign import create_payment_header
from libertai_x402.types import PaymentRequirements


class _PaymentTransport(httpx.AsyncBaseTransport):
    def __init__(self, private_key: str, transport: httpx.AsyncBaseTransport) -> None:
        self._private_key = private_key
        self._transport = transport

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if request.headers.get("authorization") == "Bearer x402":
            request.headers.pop("authorization")

        response = await self._transport.handle_async_request(request)

        if response.status_code != 402:
            return response

        await response.aread()
        body = response.json()
        accepts = body.get("accepts")
        if not accepts:
            raise ValueError("x402: 402 response missing accepts[0]")

        requirements = PaymentRequirements.from_dict(accepts[0])
        payment_header = await anyio.to_thread.run_sync(
            partial(create_payment_header, self._private_key, requirements)
        )

        headers = request.headers.copy()
        headers["x-payment"] = payment_header
        if headers.get("authorization") == "Bearer x402":
            headers.pop("authorization")

        retry_request = httpx.Request(
            method=request.method,
            url=request.url,
            headers=headers,
            content=request.content,
            extensions=request.extensions,
        )
        return await self._transport.handle_async_request(retry_request)


def create_payment_client(private_key: str, **kwargs: Any) -> httpx.AsyncClient:
    """Create an httpx.AsyncClient that handles x402 payments transparently."""
    transport = httpx.AsyncHTTPTransport()
    payment_transport = _PaymentTransport(private_key, transport)
    return httpx.AsyncClient(transport=payment_transport, **kwargs)
