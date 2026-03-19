"""
x402 Protocol Version Negotiation.

Implements Accept-x402-Version header processing for forward/backward compatibility.
Clients advertise supported versions; servers respond with the version used.

V1 supports only version "v1.0". Graceful degradation when peer version is unknown.
"""

from __future__ import annotations

from dataclasses import dataclass

# Supported protocol versions (ordered newest first)
SUPPORTED_VERSIONS = ["v1.0"]
CURRENT_VERSION = "v1.0"


@dataclass
class NegotiationResult:
    """Result of version negotiation between client and server."""

    agreed_version: str
    client_version: str
    server_version: str
    is_compatible: bool
    degraded: bool = False  # True if we fell back to a lower version

    @property
    def version(self) -> str:
        return self.agreed_version


def negotiate_version(
    client_version: str,
    server_versions: list[str] | None = None,
) -> NegotiationResult:
    """
    Negotiate the protocol version between client and server.

    Strategy:
    1. If client version matches a supported server version → use it
    2. If not → fall back to the highest mutually supported version
    3. If no overlap → mark as degraded, use server's current version anyway
       (best-effort compatibility with standard x402)

    Args:
        client_version: Version string from Accept-x402-Version header
        server_versions: Server's supported versions (defaults to SUPPORTED_VERSIONS)

    Returns:
        NegotiationResult with the agreed version and compatibility info
    """
    if server_versions is None:
        server_versions = SUPPORTED_VERSIONS

    # Exact match
    if client_version in server_versions:
        return NegotiationResult(
            agreed_version=client_version,
            client_version=client_version,
            server_version=CURRENT_VERSION,
            is_compatible=True,
        )

    # No client version specified — assume baseline compatibility
    if not client_version:
        return NegotiationResult(
            agreed_version=CURRENT_VERSION,
            client_version="",
            server_version=CURRENT_VERSION,
            is_compatible=True,
            degraded=False,
        )

    # Version mismatch — degrade gracefully
    # Use base x402 standard (no extensions), still process standard fields
    return NegotiationResult(
        agreed_version=CURRENT_VERSION,
        client_version=client_version,
        server_version=CURRENT_VERSION,
        is_compatible=False,
        degraded=True,
    )


def get_version_header() -> dict[str, str]:
    """Return the Accept-x402-Version header for outgoing requests."""
    return {"Accept-x402-Version": CURRENT_VERSION}
