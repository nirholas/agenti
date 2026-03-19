"""Content request tools for the x402 payer agent."""

import base64
import json
import time
from typing import Any
import httpx
from strands import tool

from ..config import config
from ..tracing import get_tracer
from ..metrics import get_metrics_emitter


@tool
def request_content(url: str) -> dict[str, Any]:
    """
    Request content from the seller API.

    This may return a 402 Payment Required response with payment details.

    Args:
        url: The content URL path (e.g., "/api/premium-article")

    Returns:
        Dictionary with http_status, data (if 200), or payment_required (if 402)
    """
    tracer = get_tracer()
    metrics = get_metrics_emitter()
    start_time = time.time()
    
    with tracer.start_as_current_span("content.request") as span:
        full_url = f"{config.seller_api_url}{url}"
        span.set_attribute("http.url", full_url)
        span.set_attribute("http.method", "GET")
        span.set_attribute("content.path", url)

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(
                    full_url,
                    headers={"Accept": "application/json"},
                    follow_redirects=True,
                )
                
                span.set_attribute("http.status_code", response.status_code)
                latency_ms = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    span.set_attribute("content.delivered", True)
                    metrics.record_content_request(
                        status_code=200,
                        latency_ms=latency_ms,
                        content_path=url,
                    )
                    return {
                        "http_status": 200,
                        "data": response.json(),
                    }

                if response.status_code == 402:
                    span.set_attribute("payment.required", True)
                    # Parse payment requirements from header (x402 v2 uses x-payment-required)
                    payment_required_header = (
                        response.headers.get("x-payment-required") or
                        response.headers.get("X-PAYMENT-REQUIRED") or
                        response.headers.get("PAYMENT-REQUIRED")
                    )
                    if not payment_required_header:
                        span.set_attribute("error.type", "missing_header")
                        metrics.record_content_request(
                            status_code=402,
                            latency_ms=latency_ms,
                            content_path=url,
                            payment_required=True,
                            error="missing_header",
                        )
                        return {
                            "http_status": 402,
                            "error_message": "Missing x-payment-required header",
                        }

                    # Decode base64 payment requirements (x402 v2 format)
                    payment_data = json.loads(base64.b64decode(payment_required_header))
                    # x402 v2 uses "accepts" array, v1 used "requirements"
                    accepts = payment_data.get("accepts", payment_data.get("requirements", []))
                    requirement = accepts[0] if accepts else {}
                    
                    # x402 v2 uses "payTo" instead of "recipient"
                    recipient = requirement.get("payTo", requirement.get("recipient", ""))
                    # x402 v2 uses "asset" address, extra.name has currency name
                    extra = requirement.get("extra", {})
                    currency = extra.get("name", requirement.get("currency", "USDC"))
                    
                    span.set_attribute("payment.amount", requirement.get("amount", ""))
                    span.set_attribute("payment.currency", currency)
                    span.set_attribute("payment.network", requirement.get("network", ""))
                    
                    metrics.record_content_request(
                        status_code=402,
                        latency_ms=latency_ms,
                        content_path=url,
                        payment_required=True,
                    )

                    return {
                        "http_status": 402,
                        "payment_required": {
                            "scheme": requirement.get("scheme"),
                            "network": requirement.get("network"),
                            "amount": requirement.get("amount"),
                            "asset": requirement.get("asset"),
                            "currency": currency,
                            "recipient": recipient,
                            "description": payment_data.get("resource", {}).get("description", ""),
                            "maxTimeoutSeconds": requirement.get("maxTimeoutSeconds", 60),
                        },
                    }

                span.set_attribute("error.type", "unexpected_status")
                metrics.record_content_request(
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    content_path=url,
                    error=f"unexpected_status_{response.status_code}",
                )
                return {
                    "http_status": response.status_code,
                    "error_message": f"Unexpected status code: {response.status_code}",
                }

        except httpx.RequestError as e:
            span.set_attribute("error.type", "request_error")
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_content_request(
                status_code=0,
                latency_ms=latency_ms,
                content_path=url,
                error=str(e),
            )
            return {
                "http_status": 0,
                "error_message": f"Request failed: {str(e)}",
            }


@tool
def request_content_with_payment(
    url: str,
    payment_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Request content with a signed payment.

    Args:
        url: The content URL path (e.g., "/api/premium-article")
        payment_payload: The signed payment payload from sign_payment tool

    Returns:
        Dictionary with http_status, data, and settlement details
    """
    tracer = get_tracer()
    metrics = get_metrics_emitter()
    start_time = time.time()
    
    with tracer.start_as_current_span("content.request_with_payment") as span:
        full_url = f"{config.seller_api_url}{url}"
        span.set_attribute("http.url", full_url)
        span.set_attribute("http.method", "GET")
        span.set_attribute("content.path", url)
        span.set_attribute("payment.included", True)
        
        if "amount" in payment_payload:
            span.set_attribute("payment.amount", payment_payload["amount"])
        if "network" in payment_payload:
            span.set_attribute("payment.network", payment_payload["network"])

        # Encode payment payload as base64
        payment_signature = base64.b64encode(
            json.dumps(payment_payload).encode()
        ).decode()

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(
                    full_url,
                    headers={
                        "Accept": "application/json",
                        "x-payment-signature": payment_signature,  # x402 v2 header
                    },
                    follow_redirects=True,
                )
                
                span.set_attribute("http.status_code", response.status_code)
                latency_ms = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    span.set_attribute("content.delivered", True)
                    span.set_attribute("payment.accepted", True)
                    
                    # Parse settlement response from header (x402 v2 uses x-payment-response)
                    payment_response_header = (
                        response.headers.get("x-payment-response") or
                        response.headers.get("X-PAYMENT-RESPONSE") or
                        response.headers.get("PAYMENT-RESPONSE")
                    )
                    settlement = None
                    if payment_response_header:
                        settlement = json.loads(base64.b64decode(payment_response_header))
                        span.set_attribute("payment.settled", True)
                        if settlement and "transactionHash" in settlement:
                            span.set_attribute("payment.transaction_hash", settlement["transactionHash"])
                    
                    metrics.record_content_request(
                        status_code=200,
                        latency_ms=latency_ms,
                        content_path=url,
                    )

                    return {
                        "http_status": 200,
                        "data": response.json(),
                        "settlement": settlement,
                    }

                if response.status_code == 402:
                    span.set_attribute("payment.accepted", False)
                    span.set_attribute("error.type", "payment_rejected")
                    metrics.record_content_request(
                        status_code=402,
                        latency_ms=latency_ms,
                        content_path=url,
                        payment_required=True,
                        error="payment_rejected",
                    )
                    return {
                        "http_status": 402,
                        "error_message": "Payment was rejected by the server",
                    }

                span.set_attribute("error.type", "unexpected_status")
                metrics.record_content_request(
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    content_path=url,
                    error=f"unexpected_status_{response.status_code}",
                )
                return {
                    "http_status": response.status_code,
                    "error_message": f"Unexpected status code: {response.status_code}",
                }

        except httpx.RequestError as e:
            span.set_attribute("error.type", "request_error")
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_content_request(
                status_code=0,
                latency_ms=latency_ms,
                content_path=url,
                error=str(e),
            )
            return {
                "http_status": 0,
                "error_message": f"Request failed: {str(e)}",
            }
