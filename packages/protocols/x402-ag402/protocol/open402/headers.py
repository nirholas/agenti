"""
x402 HTTP Header parsing and generation.

Handles both standard x402 headers (Coinbase compatible) and
extension headers (X-Service-Hash, X-Agent-ID, etc.).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from open402.spec import X402PaymentChallenge, X402PaymentProof

# --- Extension Header Definitions ---

EXTENSION_HEADERS = {
    "X-Service-Hash": {
        "description": "SHA256 hash of service content for dispute arbitration",
        "v1_action": "parse_and_passthrough",
        "v2_action": "verify_and_store",
    },
    "X-Agent-ID": {
        "description": "Client agent fingerprint for traffic tracing",
        "v1_action": "parse_and_passthrough",
        "v2_action": "inject_auto",
    },
    "Accept-x402-Version": {
        "description": "Protocol version negotiation",
        "v1_action": "active",
        "v2_action": "active",
    },
}


@dataclass
class ParsedExtensionHeaders:
    """Parsed extension headers from an HTTP request/response."""

    service_hash: str = ""
    agent_id: str = ""
    x402_version: str = ""

    @classmethod
    def from_headers(cls, headers: dict[str, str]) -> ParsedExtensionHeaders:
        """Extract extension headers from an HTTP header dict (case-insensitive)."""
        normalized = {k.lower(): v for k, v in headers.items()}
        return cls(
            service_hash=normalized.get("x-service-hash", ""),
            agent_id=normalized.get("x-agent-id", ""),
            x402_version=normalized.get("accept-x402-version", ""),
        )

    def to_headers(self) -> dict[str, str]:
        """Convert to HTTP header dict for injection into requests."""
        headers: dict[str, str] = {}
        if self.service_hash:
            headers["X-Service-Hash"] = self.service_hash
        if self.agent_id:
            headers["X-Agent-ID"] = self.agent_id
        if self.x402_version:
            headers["Accept-x402-Version"] = self.x402_version
        return headers


# --- x402 WWW-Authenticate Header Parsing ---

_X402_FIELD_RE = re.compile(r'(\w+)="([^"]*)"')


def parse_www_authenticate(header_value: str) -> X402PaymentChallenge | None:
    """
    Parse a WWW-Authenticate header with x402 scheme.

    Expected format:
        x402 chain="solana" token="USDC" amount="0.05" address="SolAddr..."

    Returns None if the header is not x402 or is malformed.
    """
    if not header_value:
        return None

    # Strip scheme prefix
    value = header_value.strip()
    if value.lower().startswith("x402 "):
        value = value[5:]
    elif value.lower().startswith("x402"):
        value = value[4:]
    else:
        return None

    # Parse key="value" pairs
    fields: dict[str, str] = {}
    for match in _X402_FIELD_RE.finditer(value):
        fields[match.group(1)] = match.group(2)

    # Validate required fields
    required = {"chain", "token", "amount", "address"}
    if not required.issubset(fields.keys()):
        return None

    return X402PaymentChallenge(
        chain=fields["chain"],
        token=fields["token"],
        amount=fields["amount"],
        address=fields["address"],
        service_hash=fields.get("service_hash", ""),
        service_tier=fields.get("service_tier", ""),
        refund_contract=fields.get("refund_contract", ""),
    )


def parse_authorization(header_value: str) -> X402PaymentProof | None:
    """
    Parse an Authorization header with x402 scheme.

    Supports two formats:
        Legacy:     x402 <tx_hash>
        Structured: x402 tx_hash="<hash>" payer_address="<addr>" chain="<chain>"

    Returns None if the header is not x402 or is malformed.
    """
    if not header_value:
        return None

    value = header_value.strip()
    if not value.lower().startswith("x402 "):
        return None

    payload = value[5:].strip()
    if not payload:
        return None

    # Try structured format first: tx_hash="..." payer_address="..." chain="..."
    fields: dict[str, str] = {}
    for match in _X402_FIELD_RE.finditer(payload):
        fields[match.group(1)] = match.group(2)

    if "tx_hash" in fields:
        return X402PaymentProof(
            tx_hash=fields["tx_hash"],
            chain=fields.get("chain", "solana"),
            payer_address=fields.get("payer_address", ""),
            request_id=fields.get("request_id", ""),
        )

    # Legacy format: x402 <tx_hash> (no key=value pairs)
    if "=" not in payload:
        return X402PaymentProof(tx_hash=payload)

    return None


def build_www_authenticate(challenge: X402PaymentChallenge) -> str:
    """Build a WWW-Authenticate header value from a payment challenge."""
    return challenge.to_header_value()


def build_authorization(proof: X402PaymentProof) -> str:
    """Build an Authorization header value from a payment proof."""
    return proof.to_auth_header()
