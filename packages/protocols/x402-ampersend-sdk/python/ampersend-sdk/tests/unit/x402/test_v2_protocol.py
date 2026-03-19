"""Unit tests for the transport-agnostic v2 ↔ v1 adapter."""

from typing import Any, Dict

import pytest
from ampersend_sdk.x402.v2_adapter import (
    v1_to_v2_payment_payload,
    v2_to_v1_payment_required,
)
from x402.types import (
    EIP3009Authorization,
    ExactPaymentPayload,
    PaymentPayload,
)

# -- fixtures ----------------------------------------------------------------

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


# -- v2_to_v1_payment_required ----------------------------------------------


class TestV2ToV1PaymentRequired:
    def test_converts_to_v1_requirements(self) -> None:
        v1_resp, v2_ctx = v2_to_v1_payment_required(V2_DECODED)

        assert v1_resp.x402_version == 2
        assert len(v1_resp.accepts) == 1

        req = v1_resp.accepts[0]
        assert req.scheme == "exact"
        assert req.network == "base"
        assert req.max_amount_required == "1000"
        assert req.asset == "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        assert req.pay_to == "0xRecipient"
        assert req.resource == "https://api.example.com/chat"
        assert req.mime_type == "application/json"
        assert req.max_timeout_seconds == 300

    def test_populates_extra_from_known_tokens(self) -> None:
        v1_resp, _ = v2_to_v1_payment_required(V2_DECODED)

        req = v1_resp.accepts[0]
        assert req.extra is not None
        assert req.extra["name"] == "USD Coin"
        assert req.extra["version"] == "2"

    def test_preserves_v2_context(self) -> None:
        _, v2_ctx = v2_to_v1_payment_required(V2_DECODED)

        assert v2_ctx.resource["url"] == "https://api.example.com/chat"

    def test_base_sepolia_network(self) -> None:
        decoded = {
            **V2_DECODED,
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "eip155:84532",
                    "amount": "500",
                    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    "payTo": "0xRecipient",
                }
            ],
        }

        v1_resp, _ = v2_to_v1_payment_required(decoded)

        req = v1_resp.accepts[0]
        assert req.network == "base-sepolia"
        assert req.extra is not None
        assert req.extra["name"] == "USDC"

    def test_unknown_chain_id_raises(self) -> None:
        decoded = {
            **V2_DECODED,
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "eip155:99999",
                    "amount": "1000",
                    "asset": "0xUnknown",
                    "payTo": "0xRecipient",
                }
            ],
        }

        with pytest.raises(ValueError, match="Unknown chain ID"):
            v2_to_v1_payment_required(decoded)

    def test_description_from_resource_url(self) -> None:
        v1_resp, _ = v2_to_v1_payment_required(V2_DECODED)
        assert v1_resp.accepts[0].description == "https://api.example.com/chat"

    def test_description_from_v2_field(self) -> None:
        decoded = {
            **V2_DECODED,
            "accepts": [
                {**V2_DECODED["accepts"][0], "description": "Custom desc"},
            ],
        }
        v1_resp, _ = v2_to_v1_payment_required(decoded)
        assert v1_resp.accepts[0].description == "Custom desc"


# -- v1_to_v2_payment_payload -----------------------------------------------


class TestV1ToV2PaymentPayload:
    def test_produces_valid_v2_envelope(self) -> None:
        v1_resp, v2_ctx = v2_to_v1_payment_required(V2_DECODED)
        selected = v1_resp.accepts[0]

        result = v1_to_v2_payment_payload(MOCK_PAYMENT, v2_ctx, selected)

        assert result["x402Version"] == 2
        assert result["resource"]["url"] == "https://api.example.com/chat"
        assert result["accepted"]["network"] == "eip155:8453"
        assert (
            result["accepted"]["asset"] == "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        )
        assert result["accepted"]["payTo"] == "0xRecipient"
        assert result["accepted"]["amount"] == "1000"
        assert result["payload"]["signature"] == "0xdeadbeef"
        assert "authorization" in result["payload"]
