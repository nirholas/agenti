"""Transport-agnostic v2 ↔ v1 protocol adapter.

The x402 v2 protocol uses CAIP-2 network identifiers, a different field
layout (``amount`` vs ``maxAmountRequired``, ``resource``/``accepted``
envelope), and the same underlying ERC-3009 signatures.  Internally the
SDK speaks v1 everywhere (treasurer, wallet, types), so this module
converts at the protocol boundary — independent of any particular
transport (HTTP, A2A, MCP, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, cast

from x402.chains import NETWORK_TO_ID, get_token_name, get_token_version
from x402.networks import SupportedNetworks
from x402.types import PaymentPayload, PaymentRequirements, x402PaymentRequiredResponse

# Inverse lookup: chain-id string → v1 network name.
_CHAIN_ID_TO_NETWORK: dict[str, str] = {v: k for k, v in NETWORK_TO_ID.items()}
assert len(_CHAIN_ID_TO_NETWORK) == len(NETWORK_TO_ID), (
    "duplicate chain IDs in NETWORK_TO_ID"
)

_DEFAULT_MAX_TIMEOUT_SECONDS = 300


# -- helpers -----------------------------------------------------------------


def _parse_caip2_chain_id(network: str) -> str:
    """Extract a numeric chain-id from a CAIP-2 identifier or passthrough.

    ``"eip155:8453"`` → ``"8453"``
    ``"8453"``        → ``"8453"``
    """
    if ":" in network:
        return network.split(":")[1]
    return network


def _chain_id_to_v1_network(chain_id: str) -> str:
    """``"8453"`` → ``"base"``, ``"84532"`` → ``"base-sepolia"``."""
    name = _CHAIN_ID_TO_NETWORK.get(chain_id)
    if name is None:
        raise ValueError(f"Unknown chain ID: {chain_id}")
    return name


# -- public types ------------------------------------------------------------


@dataclass
class V2PaymentContext:
    """Original v2 data preserved for building the outbound payment."""

    resource: dict[str, Any] = field(default_factory=dict)


# -- inbound: v2 dict → v1 types --------------------------------------------


def v2_to_v1_payment_required(
    decoded: dict[str, Any],
) -> tuple[x402PaymentRequiredResponse, V2PaymentContext]:
    """Convert a decoded v2 payment-required payload into v1 types.

    *decoded* is the already-parsed JSON object (a ``dict``).  The
    caller is responsible for deserializing from whatever wire format
    the transport uses (base64 header, JSON body, etc.).

    Returns a ``(v1_response, v2_context)`` tuple.  The *v2_context*
    must be kept around so :func:`v1_to_v2_payment_payload` can embed
    the original v2 fields in the outbound payment.
    """
    resource: dict[str, Any] = decoded.get("resource", {})
    v2_accepts: list[dict[str, Any]] = decoded.get("accepts", [])

    v1_requirements: list[PaymentRequirements] = []
    for req in v2_accepts:
        chain_id = _parse_caip2_chain_id(req["network"])
        network_name = _chain_id_to_v1_network(chain_id)
        asset: str = req["asset"]

        extra: dict[str, str] = {
            "name": get_token_name(chain_id, asset),
            "version": get_token_version(chain_id, asset),
        }

        v1_requirements.append(
            PaymentRequirements(
                scheme=req["scheme"],
                network=cast(SupportedNetworks, network_name),
                max_amount_required=req["amount"],
                resource=resource.get("url", ""),
                description=req.get("description", resource.get("url", "Payment")),
                mime_type=resource.get("mimeType", ""),
                pay_to=req["payTo"],
                max_timeout_seconds=req.get(
                    "maxTimeoutSeconds", _DEFAULT_MAX_TIMEOUT_SECONDS
                ),
                asset=asset,
                extra=extra,
            )
        )

    v1_response = x402PaymentRequiredResponse(
        x402_version=decoded.get("x402Version", 2),
        accepts=v1_requirements,
        error="Payment required",
    )

    return v1_response, V2PaymentContext(resource=resource)


# -- outbound: v1 payment → v2 dict -----------------------------------------


def _v1_requirement_to_v2_accepted(req: PaymentRequirements) -> dict[str, Any]:
    """Reconstruct a v2 ``accepted`` dict from a v1 PaymentRequirements."""
    chain_id = NETWORK_TO_ID[req.network]
    return {
        "scheme": req.scheme,
        "network": f"eip155:{chain_id}",
        "amount": req.max_amount_required,
        "asset": req.asset,
        "payTo": req.pay_to,
        "maxTimeoutSeconds": req.max_timeout_seconds,
    }


def v1_to_v2_payment_payload(
    payment: PaymentPayload,
    v2_context: V2PaymentContext,
    selected_requirement: PaymentRequirements,
) -> dict[str, Any]:
    """Build a v2 payment envelope dict from a v1 payment payload.

    The ``accepted`` field is reconstructed from *selected_requirement*.
    The caller is responsible for serializing the returned dict into
    whatever wire format the transport requires.
    """
    return {
        "x402Version": 2,
        "resource": v2_context.resource,
        "accepted": _v1_requirement_to_v2_accepted(selected_requirement),
        "payload": payment.model_dump(by_alias=True)["payload"],
    }
