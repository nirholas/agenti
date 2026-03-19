"""Validate 402 payment challenges before paying."""

from __future__ import annotations

import ipaddress
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from ag402_core.config import X402Config

# Solana base58 alphabet: excludes 0, O, I, l
_BASE58_RE = re.compile(r"^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$")

# V1: only USDC is allowed
_ALLOWED_TOKENS = {"USDC"}

# Hostnames that are always considered local
_LOCAL_HOSTNAMES = {"localhost"}


def _is_local_address(hostname: str) -> bool:
    """Check if a hostname resolves to a loopback or private address.

    Handles:
    - "localhost"
    - "127.0.0.1" through "127.255.255.255" (IPv4 loopback)
    - "::1" and "[::1]" (IPv6 loopback)
    - "0.0.0.0" (unspecified / local bind)
    """
    if hostname in _LOCAL_HOSTNAMES:
        return True
    # Strip IPv6 bracket notation
    bare = hostname.strip("[]")
    try:
        addr = ipaddress.ip_address(bare)
        return addr.is_loopback or addr == ipaddress.ip_address("0.0.0.0")
    except ValueError:
        return False


def _is_private_address(hostname: str) -> bool:
    """Check if a hostname is a private/reserved IP (SSRF protection).

    Blocks private, reserved, loopback, and link-local addresses.
    Link-local (169.254.x.x / fe80::/10) includes cloud metadata endpoints
    such as the AWS/GCP instance metadata service at 169.254.169.254.
    """
    bare = hostname.strip("[]")
    try:
        addr = ipaddress.ip_address(bare)
        return addr.is_private or addr.is_reserved or addr.is_loopback or addr.is_link_local
    except ValueError:
        return False


@dataclass
class ChallengeValidation:
    valid: bool
    error: str = ""


def validate_url_safety(url: str, *, allow_localhost: bool = False) -> ChallengeValidation:
    """Validate a URL for SSRF safety before making outbound requests.

    Blocks:
    - Non-HTTP(S) schemes (ftp://, file://, etc.)
    - HTTP without TLS (unless allow_localhost=True and target is loopback)
    - Private/reserved IPs (10.x, 172.16-31.x, 192.168.x, etc.)
    - Localhost (unless allow_localhost=True)
    - Hostnames that DNS-resolve to private/loopback IPs (DNS rebinding)

    This is the single entry point for all outbound URL validation in ag402.
    """
    import socket

    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    hostname = (parsed.hostname or "").lower()

    if scheme not in ("http", "https"):
        return ChallengeValidation(
            valid=False,
            error=f"Blocked scheme '{scheme}' — only HTTP(S) allowed",
        )

    if not hostname:
        return ChallengeValidation(valid=False, error="Missing hostname")

    is_local = _is_local_address(hostname)
    is_private = _is_private_address(hostname)

    # Block private/internal IPs (unless it's localhost and we allow it)
    if is_private and not (allow_localhost and is_local):
        return ChallengeValidation(
            valid=False,
            error=f"Blocked private/reserved address '{hostname}' — SSRF protection",
        )

    # Require HTTPS for non-local targets
    if scheme != "https" and not (allow_localhost and is_local):
        return ChallengeValidation(
            valid=False,
            error=f"HTTPS required for remote targets (got '{scheme}')",
        )

    # DNS rebinding protection: resolve hostname and check resolved IP.
    # Skip for literal IPs (already checked above) and allowed localhost.
    if not is_local and not is_private:
        bare = hostname.strip("[]")
        is_literal_ip = False
        try:
            ipaddress.ip_address(bare)
            is_literal_ip = True
        except ValueError:
            pass

        if not is_literal_ip:
            port = parsed.port or (443 if scheme == "https" else 80)
            try:
                addrs = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
            except socket.gaierror as exc:
                return ChallengeValidation(
                    valid=False,
                    error=f"DNS resolution failed for '{hostname}': {exc}",
                )
            for _family, _, _, _, sockaddr in addrs:
                resolved_ip = sockaddr[0]
                try:
                    addr = ipaddress.ip_address(resolved_ip)
                    if addr.is_private or addr.is_reserved or addr.is_loopback or addr.is_link_local:
                        return ChallengeValidation(
                            valid=False,
                            error=f"DNS rebinding blocked — '{hostname}' resolved to private address {resolved_ip}",
                        )
                except ValueError:
                    continue

    return ChallengeValidation(valid=True)


def validate_challenge(
    url: str,
    amount: float,
    address: str,
    token: str,
    config: X402Config,
) -> ChallengeValidation:
    """Validate a 402 payment challenge before executing payment.

    Checks:
    - URL scheme is HTTPS (HTTP allowed only for localhost / 127.0.0.1)
    - Amount is in valid range: 0 < amount <= config.single_tx_limit
    - Address looks like a valid Solana base58 address (32-44 chars, no 0/O/I/l)
    - Token is in the allowed list (V1: only "USDC")
    - If config.trusted_addresses is non-empty, address must be whitelisted
    """
    # 1. URL scheme check
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()

    if scheme != "https":
        # Allow http for local addresses only (loopback, 0.0.0.0)
        is_local = _is_local_address(hostname)
        if scheme != "http" or not is_local:
            return ChallengeValidation(
                valid=False,
                error=f"Insecure URL scheme '{scheme}' — HTTPS required (HTTP allowed for localhost only)",
            )

    # 2. Amount range check
    if amount <= 0:
        return ChallengeValidation(
            valid=False,
            error=f"Invalid amount {amount} — must be > 0",
        )
    if amount > config.single_tx_limit:
        return ChallengeValidation(
            valid=False,
            error=f"Amount {amount} exceeds single-tx limit {config.single_tx_limit}",
        )

    # 3. Address validation (Solana base58: 32-44 chars, no 0/O/I/l)
    if not (32 <= len(address) <= 44):
        return ChallengeValidation(
            valid=False,
            error=f"Invalid address length {len(address)} — expected 32-44 characters",
        )
    if not _BASE58_RE.match(address):
        return ChallengeValidation(
            valid=False,
            error="Invalid address — contains characters not in Solana base58 alphabet",
        )

    # 4. Token whitelist
    if token not in _ALLOWED_TOKENS:
        return ChallengeValidation(
            valid=False,
            error=f"Token '{token}' not allowed — accepted: {_ALLOWED_TOKENS}",
        )

    # 5. Trusted addresses whitelist
    if config.trusted_addresses and address not in config.trusted_addresses:
        return ChallengeValidation(
            valid=False,
            error=f"Address '{address}' not in trusted addresses whitelist",
        )

    return ChallengeValidation(valid=True)
