"""Simplified factory for creating an httpx client with x402 payment handling."""

from __future__ import annotations

from typing import Any

import httpx

from .transport import X402HttpTransport


def create_ampersend_http_client(
    *,
    smart_account_address: str,
    session_key_private_key: str,
    api_url: str | None = None,
    **httpx_kwargs: Any,
) -> httpx.AsyncClient:
    """Create an ``httpx.AsyncClient`` with automatic x402 payment handling.

    This is the recommended way to make paid HTTP requests.  The returned
    client intercepts 402 responses, authorises payment through the
    Ampersend API, signs via the session-key wallet, and retries — all
    transparently.

    Args:
        smart_account_address: The smart account address (0x...).
        session_key_private_key: The session key private key (0x...).
        api_url: Ampersend API URL (defaults to production if ``None``).
        **httpx_kwargs: Extra keyword arguments forwarded to
            ``httpx.AsyncClient`` (e.g. ``timeout``, ``headers``).

    Returns:
        A configured ``httpx.AsyncClient`` ready for use.

    Example::

        from ampersend_sdk import create_ampersend_http_client

        async with create_ampersend_http_client(
            smart_account_address="0x1234...",
            session_key_private_key="0xabcd...",
        ) as client:
            resp = await client.post(
                "https://testnet.blockrun.ai/api/v1/chat/completions",
                json={"model": "openai/gpt-oss-20b", ...},
            )
    """
    from ampersend_sdk.ampersend import create_ampersend_treasurer

    treasurer_kwargs: dict[str, Any] = {
        "smart_account_address": smart_account_address,
        "session_key_private_key": session_key_private_key,
    }
    if api_url is not None:
        treasurer_kwargs["api_url"] = api_url

    treasurer = create_ampersend_treasurer(**treasurer_kwargs)

    transport = X402HttpTransport(
        wrapped=httpx.AsyncHTTPTransport(),
        treasurer=treasurer,
    )

    return httpx.AsyncClient(transport=transport, **httpx_kwargs)
