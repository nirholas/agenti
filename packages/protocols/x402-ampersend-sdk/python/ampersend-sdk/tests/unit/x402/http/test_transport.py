"""Unit tests for X402HttpTransport."""

import base64
import json
import uuid
from typing import Any, Dict
from unittest.mock import AsyncMock

import httpx
import pytest
from ampersend_sdk.x402.http.transport import (
    X402HttpTransport,
    _encode_v1_payment_header,
)
from ampersend_sdk.x402.treasurer import X402Authorization, X402Treasurer
from x402.types import (
    EIP3009Authorization,
    ExactPaymentPayload,
    PaymentPayload,
    PaymentRequirements,
    x402PaymentRequiredResponse,
)
from x402_a2a.types import PaymentStatus

PAYMENT_REQUIREMENTS = PaymentRequirements(
    scheme="exact",
    network="base-sepolia",
    max_amount_required="1000000",
    resource="https://api.example.com/resource",
    description="Test payment",
    mime_type="application/json",
    pay_to="0x1234567890123456789012345678901234567890",
    max_timeout_seconds=300,
    asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    extra={"name": "USDC", "version": "2"},
)

PAYMENT_REQUIRED_BODY = x402PaymentRequiredResponse(
    x402_version=1,
    accepts=[PAYMENT_REQUIREMENTS],
    error="Payment required",
)

MOCK_PAYMENT = PaymentPayload(
    x402_version=1,
    scheme="exact",
    network="base-sepolia",
    payload=ExactPaymentPayload(
        signature="0xdeadbeef",
        authorization=EIP3009Authorization(
            **{
                "from": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "to": "0x1234567890123456789012345678901234567890",
                "value": "1000000",
                "validAfter": "0",
                "validBefore": "999999999",
                "nonce": "0xabcdef",
            }
        ),
    ),
)


def _make_authorization() -> X402Authorization:
    return X402Authorization(
        payment=MOCK_PAYMENT,
        authorization_id=uuid.uuid4().hex,
        selected_requirement=PAYMENT_REQUIREMENTS,
    )


class FakeTransport(httpx.AsyncBaseTransport):
    """Transport that returns a fixed response, recording requests."""

    def __init__(self, responses: list[httpx.Response]) -> None:
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._responses.pop(0)

    async def aclose(self) -> None:
        pass


class FakeTreasurer(X402Treasurer):
    """Treasurer that records calls and returns a configurable result."""

    def __init__(self, authorization: X402Authorization | None) -> None:
        self._authorization = authorization
        self.payment_required_calls: list[
            tuple[x402PaymentRequiredResponse, Dict[str, Any] | None]
        ] = []
        self.status_calls: list[
            tuple[Any, X402Authorization, Dict[str, Any] | None]
        ] = []

    async def onPaymentRequired(
        self,
        payment_required: x402PaymentRequiredResponse,
        context: Dict[str, Any] | None = None,
    ) -> X402Authorization | None:
        self.payment_required_calls.append((payment_required, context))
        return self._authorization

    async def onStatus(
        self,
        status: Any,
        authorization: X402Authorization,
        context: Dict[str, Any] | None = None,
    ) -> None:
        self.status_calls.append((status, authorization, context))


@pytest.mark.asyncio
class TestX402HttpTransport:
    async def test_non_402_passes_through(self) -> None:
        inner = FakeTransport([httpx.Response(200, content=b"ok")])
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 200
        assert len(treasurer.payment_required_calls) == 0

    async def test_402_with_payment_approved(self) -> None:
        body_402 = PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True).encode()
        inner = FakeTransport(
            [
                httpx.Response(402, content=body_402),
                httpx.Response(200, content=b"paid content"),
            ]
        )
        authorization = _make_authorization()
        treasurer = FakeTreasurer(authorization=authorization)
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 200
        assert len(inner.requests) == 2

        # Verify treasurer was consulted
        assert len(treasurer.payment_required_calls) == 1
        pr, ctx = treasurer.payment_required_calls[0]
        assert pr.x402_version == 1
        assert len(pr.accepts) == 1
        assert ctx == {
            "method": "http",
            "params": {"resource": "https://api.example.com/resource"},
        }

        # Verify retry has X-Payment header
        retry_request = inner.requests[1]
        assert "x-payment" in retry_request.headers

        # Verify onStatus was called with PAYMENT_COMPLETED
        assert len(treasurer.status_calls) == 1
        status, auth, ctx = treasurer.status_calls[0]
        assert status == PaymentStatus.PAYMENT_COMPLETED
        assert auth is authorization
        assert ctx == {
            "method": "http",
            "params": {"resource": "https://api.example.com/resource"},
        }

    async def test_402_treasurer_declines(self) -> None:
        body_402 = PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True).encode()
        inner = FakeTransport([httpx.Response(402, content=body_402)])
        treasurer = FakeTreasurer(authorization=None)
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        # Returns the original 402
        assert response.status_code == 402
        assert json.loads(response.content) == json.loads(
            PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True)
        )
        # Only one request made (no retry)
        assert len(inner.requests) == 1

    async def test_402_invalid_body_passes_through(self) -> None:
        inner = FakeTransport(
            [
                httpx.Response(402, content=b"not json"),
            ]
        )
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 402
        assert response.content == b"not json"
        assert len(treasurer.payment_required_calls) == 0

    async def test_402_non_x402_json_passes_through(self) -> None:
        inner = FakeTransport(
            [
                httpx.Response(402, content=b'{"error": "billing issue"}'),
            ]
        )
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 402
        assert len(treasurer.payment_required_calls) == 0

    async def test_post_request_body_preserved_on_retry(self) -> None:
        body_402 = PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True).encode()
        inner = FakeTransport(
            [
                httpx.Response(402, content=body_402),
                httpx.Response(200, content=b"ok"),
            ]
        )
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request_body = b'{"prompt": "hello"}'
        request = httpx.Request(
            "POST",
            "https://api.example.com/v1/chat",
            content=request_body,
            headers={"content-type": "application/json"},
        )
        response = await transport.handle_async_request(request)

        assert response.status_code == 200
        retry_request = inner.requests[1]
        assert retry_request.content == request_body
        assert retry_request.headers["content-type"] == "application/json"

    async def test_402_after_payment_does_not_retry_again(self) -> None:
        """If the server returns 402 even after we paid, don't loop."""
        body_402 = PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True).encode()
        inner = FakeTransport(
            [
                httpx.Response(402, content=body_402),
                # Server rejects payment — still 402.
                httpx.Response(402, content=b"still unpaid"),
            ]
        )
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        # Returns the second 402 without attempting a third request.
        assert response.status_code == 402
        assert len(inner.requests) == 2

        # Verify onStatus was called with PAYMENT_REJECTED
        assert len(treasurer.status_calls) == 1
        status, _, _ = treasurer.status_calls[0]
        assert status == PaymentStatus.PAYMENT_REJECTED

    async def test_non_200_with_payment_response_header_reports_completed(self) -> None:
        """Server error but payment-response header present → payment was accepted."""
        body_402 = PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True).encode()
        authorization = _make_authorization()
        inner = FakeTransport(
            [
                httpx.Response(402, content=body_402),
                httpx.Response(
                    500,
                    content=b"internal error",
                    headers={"payment-response": "receipt-data"},
                ),
            ]
        )
        treasurer = FakeTreasurer(authorization=authorization)
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 500
        assert len(treasurer.status_calls) == 1
        status, auth, _ = treasurer.status_calls[0]
        assert status == PaymentStatus.PAYMENT_COMPLETED
        assert auth is authorization

    async def test_non_200_without_payment_response_header_reports_failed(self) -> None:
        """Server error without payment-response header → ambiguous, report failed."""
        body_402 = PAYMENT_REQUIRED_BODY.model_dump_json(by_alias=True).encode()
        authorization = _make_authorization()
        inner = FakeTransport(
            [
                httpx.Response(402, content=body_402),
                httpx.Response(500, content=b"internal error"),
            ]
        )
        treasurer = FakeTreasurer(authorization=authorization)
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 500
        assert len(treasurer.status_calls) == 1
        status, auth, _ = treasurer.status_calls[0]
        assert status == PaymentStatus.PAYMENT_FAILED
        assert auth is authorization

    async def test_aclose_delegates(self) -> None:
        inner = AsyncMock(spec=httpx.AsyncBaseTransport)
        treasurer = FakeTreasurer(authorization=None)
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        await transport.aclose()
        inner.aclose.assert_awaited_once()


V2_HEADER_DECODED = {
    "x402Version": 2,
    "accepts": [
        {
            "scheme": "exact",
            "network": "eip155:84532",
            "amount": "1000000",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "payTo": "0x1234567890123456789012345678901234567890",
        }
    ],
    "resource": {
        "url": "https://api.example.com/resource",
        "mimeType": "application/json",
    },
}

V2_HEADER_VALUE = base64.b64encode(json.dumps(V2_HEADER_DECODED).encode()).decode()


@pytest.mark.asyncio
class TestX402HttpTransportV2:
    async def test_v2_402_with_payment_approved(self) -> None:
        inner = FakeTransport(
            [
                httpx.Response(
                    402,
                    content=b'{"error": "Payment Required"}',
                    headers={"x-payment-required": V2_HEADER_VALUE},
                ),
                httpx.Response(200, content=b"paid content"),
            ]
        )
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 200
        assert len(inner.requests) == 2

        # Treasurer received v1-converted requirements
        pr, _ = treasurer.payment_required_calls[0]
        assert pr.accepts[0].network == "base-sepolia"
        assert pr.accepts[0].max_amount_required == "1000000"

        # Retry uses Payment-Signature header (v2), not X-Payment (v1)
        retry_request = inner.requests[1]
        assert "payment-signature" in retry_request.headers
        assert "x-payment" not in retry_request.headers

        # Verify onStatus was called with PAYMENT_COMPLETED
        assert len(treasurer.status_calls) == 1
        status, _, _ = treasurer.status_calls[0]
        assert status == PaymentStatus.PAYMENT_COMPLETED

    async def test_v2_treasurer_declines(self) -> None:
        inner = FakeTransport(
            [
                httpx.Response(
                    402,
                    content=b'{"error": "Payment Required"}',
                    headers={"x-payment-required": V2_HEADER_VALUE},
                ),
            ]
        )
        treasurer = FakeTreasurer(authorization=None)
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        response = await transport.handle_async_request(request)

        assert response.status_code == 402
        assert len(inner.requests) == 1

    async def test_v2_payment_signature_is_valid_v2_envelope(self) -> None:
        inner = FakeTransport(
            [
                httpx.Response(
                    402,
                    content=b"{}",
                    headers={"x-payment-required": V2_HEADER_VALUE},
                ),
                httpx.Response(200, content=b"ok"),
            ]
        )
        treasurer = FakeTreasurer(authorization=_make_authorization())
        transport = X402HttpTransport(wrapped=inner, treasurer=treasurer)

        request = httpx.Request("GET", "https://api.example.com/resource")
        await transport.handle_async_request(request)

        sig_header = inner.requests[1].headers["payment-signature"]
        decoded = json.loads(base64.b64decode(sig_header))
        assert decoded["x402Version"] == 2
        assert decoded["accepted"]["network"] == "eip155:84532"
        assert decoded["resource"]["url"] == "https://api.example.com/resource"
        assert decoded["payload"]["signature"] == "0xdeadbeef"


class TestEncodePaymentHeader:
    def test_encodes_to_base64_json(self) -> None:
        header = _encode_v1_payment_header(MOCK_PAYMENT)

        decoded = json.loads(base64.b64decode(header))
        assert decoded["x402Version"] == 1
        assert decoded["scheme"] == "exact"
        assert decoded["network"] == "base-sepolia"
        assert decoded["payload"]["signature"] == "0xdeadbeef"
