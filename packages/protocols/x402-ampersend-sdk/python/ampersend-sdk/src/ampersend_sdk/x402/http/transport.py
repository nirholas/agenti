"""httpx async transport with automatic x402 payment handling (v1 + v2)."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from x402.encoding import safe_base64_encode
from x402.types import PaymentPayload, x402PaymentRequiredResponse
from x402_a2a.types import PaymentStatus

from ampersend_sdk.x402.treasurer import X402Authorization, X402Treasurer

from .v2_adapter import encode_v2_payment_signature, parse_v2_payment_required

logger = logging.getLogger(__name__)


def _encode_v1_payment_header(payment: PaymentPayload) -> str:
    """Encode a PaymentPayload as a base64 v1 X-Payment header value."""
    return safe_base64_encode(json.dumps(payment.model_dump(by_alias=True)))


def _get_v2_header(response: httpx.Response) -> str | None:
    """Return the v2 payment-required header value, or None."""
    value: str | None = response.headers.get(
        "x-payment-required"
    ) or response.headers.get("payment-required")
    return value


def _has_payment_response(response: httpx.Response) -> bool:
    """Check whether the response carries an x402 payment-response header."""
    return (
        response.headers.get("payment-response") is not None
        or response.headers.get("x-payment-response") is not None
    )


class X402HttpTransport(httpx.AsyncBaseTransport):
    """httpx transport that intercepts 402 responses and handles x402 payments.

    Supports both v1 (requirements in body, payment in ``X-Payment`` header)
    and v2 (requirements in ``X-Payment-Required`` header, payment in
    ``Payment-Signature`` header).  Protocol version is auto-detected from the
    402 response.

    Example::

        from ampersend_sdk import create_ampersend_treasurer
        from ampersend_sdk.x402.http import X402HttpTransport

        treasurer = create_ampersend_treasurer(
            smart_account_address="0x...",
            session_key_private_key="0x...",
        )
        transport = X402HttpTransport(
            wrapped=httpx.AsyncHTTPTransport(),
            treasurer=treasurer,
        )
        async with httpx.AsyncClient(transport=transport) as client:
            response = await client.get("https://paid-api.example.com/resource")
    """

    _RETRY_KEY = "_x402_is_retry"

    def __init__(
        self,
        wrapped: httpx.AsyncBaseTransport,
        treasurer: X402Treasurer,
    ) -> None:
        self._wrapped = wrapped
        self._treasurer = treasurer

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        response = await self._wrapped.handle_async_request(request)

        if response.status_code != 402:
            return response

        # Don't retry if we already paid — prevents infinite 402 loops.
        if request.extensions.get(self._RETRY_KEY):
            return response

        # Read and close the 402 response to release the connection.
        await response.aread()
        body = response.content
        await response.aclose()

        # Detect protocol version: v2 uses a header, v1 uses the body.
        v2_header = _get_v2_header(response)
        if v2_header is not None:
            return await self._handle_v2(request, response, body, v2_header)
        return await self._handle_v1(request, response, body)

    # -- v1 ------------------------------------------------------------------

    async def _handle_v1(
        self,
        request: httpx.Request,
        response: httpx.Response,
        body: bytes,
    ) -> httpx.Response:
        try:
            payment_required = x402PaymentRequiredResponse(**json.loads(body))
        except Exception:
            logger.debug(
                "402 response body is not a valid x402 payload, passing through"
            )
            return httpx.Response(
                status_code=402, headers=response.headers, content=body
            )

        authorization = await self._authorize(payment_required, request)
        if authorization is None:
            return httpx.Response(
                status_code=402, headers=response.headers, content=body
            )

        header_value = _encode_v1_payment_header(authorization.payment)
        retry_response = await self._retry(request, "x-payment", header_value)
        await self._report_status(retry_response, authorization, request)
        return retry_response

    # -- v2 ------------------------------------------------------------------

    async def _handle_v2(
        self,
        request: httpx.Request,
        response: httpx.Response,
        body: bytes,
        header_value: str,
    ) -> httpx.Response:
        try:
            payment_required, v2_ctx = parse_v2_payment_required(header_value)
        except Exception:
            logger.debug("402 v2 header is not a valid x402 payload, passing through")
            return httpx.Response(
                status_code=402, headers=response.headers, content=body
            )

        authorization = await self._authorize(payment_required, request)
        if authorization is None:
            return httpx.Response(
                status_code=402, headers=response.headers, content=body
            )

        sig = encode_v2_payment_signature(
            authorization.payment, v2_ctx, authorization.selected_requirement
        )
        retry_response = await self._retry(request, "payment-signature", sig)
        await self._report_status(retry_response, authorization, request)
        return retry_response

    # -- shared helpers ------------------------------------------------------

    async def _authorize(
        self,
        payment_required: x402PaymentRequiredResponse,
        request: httpx.Request,
    ) -> X402Authorization | None:
        context: dict[str, Any] = {
            "method": "http",
            "params": {"resource": str(request.url)},
        }
        return await self._treasurer.onPaymentRequired(payment_required, context)

    async def _report_status(
        self,
        response: httpx.Response,
        authorization: X402Authorization,
        request: httpx.Request,
    ) -> None:
        if response.status_code == 402:
            status = PaymentStatus.PAYMENT_REJECTED
        elif response.status_code == 200 or _has_payment_response(response):
            status = PaymentStatus.PAYMENT_COMPLETED
        else:
            status = PaymentStatus.PAYMENT_FAILED
        context: dict[str, Any] = {
            "method": "http",
            "params": {"resource": str(request.url)},
        }
        try:
            await self._treasurer.onStatus(status, authorization, context)
        except Exception as e:
            logger.error('treasurer.onStatus failed with "%s"', e)

    async def _retry(
        self,
        original: httpx.Request,
        header_name: str,
        header_value: str,
    ) -> httpx.Response:
        headers = httpx.Headers(original.headers)
        headers[header_name] = header_value
        retry_request = httpx.Request(
            method=original.method,
            url=original.url,
            headers=headers,
            content=original.content,
            extensions={**dict(original.extensions), self._RETRY_KEY: True},
        )
        return await self._wrapped.handle_async_request(retry_request)

    async def aclose(self) -> None:
        await self._wrapped.aclose()
