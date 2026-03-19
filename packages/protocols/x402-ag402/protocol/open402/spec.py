"""
x402 Protocol Specification — JSON Schema and data models.

Defines the standard x402 payment challenge/response format,
compatible with Coinbase x402 standard fields, plus our extension fields.

Reference: https://github.com/coinbase/x402
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any

# Characters not allowed in header field values (prevent HTTP response splitting)
_HEADER_UNSAFE_RE = re.compile(r'[\r\n"]')


class PaymentStatus(Enum):
    """Status of a payment transaction."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    TIMEOUT = "timeout"


@dataclass
class X402PaymentChallenge:
    """
    Parsed from HTTP 402 response — what the server demands.

    Standard fields (Coinbase x402 compatible):
        chain, token, amount, address

    Extension fields (V1: parsed but not acted upon):
        service_hash, service_tier, refund_contract
    """

    # --- Standard x402 fields (REQUIRED) ---
    chain: str  # e.g. "solana", "base"
    token: str  # e.g. "USDC" or mint address
    amount: str  # e.g. "0.05" (string to preserve precision)
    address: str  # Recipient wallet address

    # --- Extension fields (OPTIONAL, V1 passthrough) ---
    service_hash: str = ""  # SHA256 hash of service description
    service_tier: str = ""  # e.g. "basic", "premium"
    refund_contract: str = ""  # Smart contract for dispute resolution

    @property
    def amount_float(self) -> float:
        """Parse amount as float for budget checks.

        Raises ValueError for non-numeric, NaN, Infinity, zero, or negative
        amounts to prevent downstream bypasses.
        """
        try:
            val = float(self.amount)
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid amount string: {self.amount!r}") from exc
        if math.isnan(val) or math.isinf(val):
            raise ValueError(f"Amount must be a finite number, got: {self.amount!r}")
        if val <= 0:
            raise ValueError(f"Amount must be positive, got: {self.amount!r}")
        return val

    def to_header_value(self) -> str:
        """Serialize to x402 WWW-Authenticate header value.

        Raises ValueError if any field contains characters unsafe for HTTP
        headers (CR, LF, double-quote) to prevent response splitting.
        """
        fields = {
            "chain": self.chain,
            "token": self.token,
            "amount": self.amount,
            "address": self.address,
        }
        if self.service_hash:
            fields["service_hash"] = self.service_hash
        if self.service_tier:
            fields["service_tier"] = self.service_tier
        if self.refund_contract:
            fields["refund_contract"] = self.refund_contract

        parts = []
        for key, value in fields.items():
            if _HEADER_UNSAFE_RE.search(value):
                raise ValueError(
                    f"Field {key!r} contains unsafe characters (CR/LF/quote): {value!r}"
                )
            parts.append(f'{key}="{value}"')
        return "x402 " + " ".join(parts)


@dataclass
class X402PaymentProof:
    """
    Sent by client to prove payment — injected into retry request.

    The Authorization header carries the tx_hash as proof.
    """

    tx_hash: str  # On-chain transaction hash
    chain: str = "solana"
    payer_address: str = ""  # Sender wallet address
    request_id: str = ""  # Idempotency key embedded in memo

    def to_auth_header(self) -> str:
        """Serialize to Authorization header value.

        Format: x402 tx_hash="<hash>" payer_address="<addr>" chain="<chain>" request_id="<id>"
        Falls back to simple format if only tx_hash is available.

        Raises ValueError if any field contains characters unsafe for HTTP
        headers (CR, LF, double-quote) to prevent header injection.
        """
        fields = {
            "tx_hash": self.tx_hash,
        }
        if self.payer_address:
            fields["payer_address"] = self.payer_address
        if self.chain:
            fields["chain"] = self.chain
        if self.request_id:
            fields["request_id"] = self.request_id

        parts = []
        for key, value in fields.items():
            if _HEADER_UNSAFE_RE.search(value):
                raise ValueError(
                    f"Field {key!r} contains unsafe characters (CR/LF/quote): {value!r}"
                )
            parts.append(f'{key}="{value}"')
        return "x402 " + " ".join(parts)


@dataclass
class X402ServiceDescriptor:
    """
    Describes a paid service endpoint (used by MCP gateway).

    This is what a service provider configures to enable x402 payments.
    """

    endpoint: str  # URL of the service
    price: str  # Price per call in token units (e.g. "0.02")
    chain: str = "solana"
    token: str = "USDC"
    address: str = ""  # Recipient wallet address
    description: str = ""
    service_hash: str = ""

    def to_challenge(self) -> X402PaymentChallenge:
        """Convert to a payment challenge for 402 response."""
        return X402PaymentChallenge(
            chain=self.chain,
            token=self.token,
            amount=self.price,
            address=self.address,
            service_hash=self.service_hash,
        )


# --- JSON Schema (for documentation and validation) ---

X402_CHALLENGE_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "x402 Payment Challenge",
    "description": (
        "Standard x402 payment challenge returned in HTTP 402 response body. "
        "Compatible with Coinbase x402, extended with optional fields."
    ),
    "type": "object",
    "required": ["chain", "token", "amount", "address"],
    "properties": {
        "chain": {
            "type": "string",
            "description": "Blockchain network identifier",
            "examples": ["solana", "base", "ethereum"],
        },
        "token": {
            "type": "string",
            "description": "Payment token symbol or mint address",
            "examples": ["USDC", "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"],
        },
        "amount": {
            "type": "string",
            "description": "Payment amount in token units (string for precision)",
            "examples": ["0.05", "1.00"],
        },
        "address": {
            "type": "string",
            "description": "Recipient wallet address on the specified chain",
        },
        # --- Extension fields ---
        "service_hash": {
            "type": "string",
            "description": "(Optional) SHA256 hash of the service description for dispute resolution",
            "default": "",
        },
        "service_tier": {
            "type": "string",
            "description": "(Optional) Service tier level",
            "enum": ["basic", "premium", "enterprise"],
            "default": "",
        },
        "refund_contract": {
            "type": "string",
            "description": "(Optional) Smart contract address for automated refund/dispute",
            "default": "",
        },
    },
}

X402_PROOF_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "x402 Payment Proof",
    "description": "Payment proof sent by client in Authorization header after on-chain payment.",
    "type": "object",
    "required": ["tx_hash"],
    "properties": {
        "tx_hash": {
            "type": "string",
            "description": "On-chain transaction hash proving payment",
        },
        "chain": {
            "type": "string",
            "description": "Blockchain where payment was made",
            "default": "solana",
        },
        "payer_address": {
            "type": "string",
            "description": "Sender wallet address",
            "default": "",
        },
        "request_id": {
            "type": "string",
            "description": "Idempotency key embedded in transaction memo for deduplication",
            "default": "",
        },
    },
}


def get_json_schema() -> dict[str, Any]:
    """Return the complete x402 protocol JSON schema."""
    return {
        "x402_challenge": X402_CHALLENGE_SCHEMA,
        "x402_proof": X402_PROOF_SCHEMA,
        "protocol_version": "v1.0",
    }
