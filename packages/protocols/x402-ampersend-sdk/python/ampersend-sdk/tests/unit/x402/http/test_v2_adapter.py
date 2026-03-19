"""Tests for the HTTP-specific base64 wrappers around the v2 adapter."""

import base64
import json
from typing import Any, Dict

from ampersend_sdk.x402.http.v2_adapter import (
    encode_v2_payment_signature,
    parse_v2_payment_required,
)
from x402.types import (
    EIP3009Authorization,
    ExactPaymentPayload,
    PaymentPayload,
)

V2_DECODED: Dict[str, Any] = {
    "x402Version": 2,
    "accepts": [
        {
            "scheme": "exact",
            "network": "eip155:8453",
            "amount": "1000",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "payTo": "0xRecipient",
        }
    ],
    "resource": {
        "url": "https://api.example.com/chat",
        "mimeType": "application/json",
    },
}

V2_HEADER = base64.b64encode(json.dumps(V2_DECODED).encode()).decode()

MOCK_PAYMENT = PaymentPayload(
    x402_version=1,
    scheme="exact",
    network="base",
    payload=ExactPaymentPayload(
        signature="0xdeadbeef",
        authorization=EIP3009Authorization(
            **{
                "from": "0xSender",
                "to": "0xRecipient",
                "value": "1000",
                "validAfter": "0",
                "validBefore": "999999999",
                "nonce": "0xabcdef",
            }
        ),
    ),
)


class TestParseV2PaymentRequiredHTTP:
    def test_base64_round_trip(self) -> None:
        """parse decodes base64, delegates to protocol adapter."""
        v1_resp, v2_ctx = parse_v2_payment_required(V2_HEADER)

        assert v1_resp.x402_version == 2
        assert v1_resp.accepts[0].network == "base"
        assert v2_ctx.resource["url"] == "https://api.example.com/chat"


class TestEncodeV2PaymentSignatureHTTP:
    def test_base64_round_trip(self) -> None:
        """encode produces a base64 string decodable to the v2 envelope."""
        v1_resp, v2_ctx = parse_v2_payment_required(V2_HEADER)
        selected = v1_resp.accepts[0]

        result = encode_v2_payment_signature(MOCK_PAYMENT, v2_ctx, selected)

        decoded = json.loads(base64.b64decode(result))
        assert decoded["x402Version"] == 2
        assert decoded["accepted"]["network"] == "eip155:8453"
        assert decoded["payload"]["signature"] == "0xdeadbeef"
