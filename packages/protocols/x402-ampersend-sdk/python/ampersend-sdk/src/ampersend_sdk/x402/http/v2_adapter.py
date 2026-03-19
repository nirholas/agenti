"""HTTP-specific base64 wrappers around the transport-agnostic v2 adapter."""

from __future__ import annotations

import base64
import json

from x402.encoding import safe_base64_encode
from x402.types import PaymentPayload, PaymentRequirements, x402PaymentRequiredResponse

from ampersend_sdk.x402.v2_adapter import (
    V2PaymentContext,
    v1_to_v2_payment_payload,
    v2_to_v1_payment_required,
)

# Re-export so existing imports from this module keep working.
__all__ = [
    "V2PaymentContext",
    "encode_v2_payment_signature",
    "parse_v2_payment_required",
]


def parse_v2_payment_required(
    header_value: str,
) -> tuple[x402PaymentRequiredResponse, V2PaymentContext]:
    """Decode a base64-encoded ``X-Payment-Required`` header into v1 types."""
    decoded = json.loads(base64.b64decode(header_value))
    return v2_to_v1_payment_required(decoded)


def encode_v2_payment_signature(
    payment: PaymentPayload,
    v2_context: V2PaymentContext,
    selected_requirement: PaymentRequirements,
) -> str:
    """Build a base64-encoded ``Payment-Signature`` header value."""
    return safe_base64_encode(
        json.dumps(v1_to_v2_payment_payload(payment, v2_context, selected_requirement))
    )
