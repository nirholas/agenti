"""open402: Reference implementation of the x402 payment protocol."""
__version__ = "0.1.20"

from open402.headers import (
    ParsedExtensionHeaders,
    build_authorization,
    build_www_authenticate,
    parse_authorization,
    parse_www_authenticate,
)
from open402.negotiation import get_version_header, negotiate_version
from open402.spec import (
    X402PaymentChallenge,
    X402PaymentProof,
    X402ServiceDescriptor,
    get_json_schema,
)

__all__ = [
    "X402PaymentChallenge",
    "X402PaymentProof",
    "X402ServiceDescriptor",
    "get_json_schema",
    "parse_www_authenticate",
    "parse_authorization",
    "build_www_authenticate",
    "build_authorization",
    "ParsedExtensionHeaders",
    "negotiate_version",
    "get_version_header",
]
