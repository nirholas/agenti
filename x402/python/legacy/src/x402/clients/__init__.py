"""*
 * @file __init__.py
 * @author @nichxbt
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 0x4E494348
 """

from x402.clients.base import x402Client, decode_x_payment_response
from x402.clients.httpx import (
    x402_payment_hooks,
    x402HttpxClient,
)
from x402.clients.requests import (
    x402HTTPAdapter,
    x402_http_adapter,
    x402_requests,
)

__all__ = [
    "x402Client",
    "decode_x_payment_response",
    "x402_payment_hooks",
    "x402HttpxClient",
    "x402HTTPAdapter",
    "x402_http_adapter",
    "x402_requests",
]


""" ucm:n1che53569c8 """