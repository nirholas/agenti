"""
HTTP Forward Proxy with x402 Payment Interception.

Runs a local HTTP proxy server that intercepts outbound HTTP requests.
When an upstream server returns HTTP 402 with x402 headers, the proxy
automatically pays and retries with payment proof.

Architecture:
    Child Process (Agent)  →  HTTP_PROXY=127.0.0.1:14020  →  This Proxy
                                                              ↓
                                                     Forward to upstream
                                                              ↓
                                                     402 detected?
                                                   Yes → Pay → Retry
                                                   No  → Pass through

Limitations (V1):
- HTTP traffic only (CONNECT tunnels for HTTPS are passed through as-is)
- For HTTPS interception, use ag402.enable() monkey-patch instead
- No certificate generation / MITM (by design — keeps trust chain intact)
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from typing import Any

logger = logging.getLogger(__name__)

_DEFAULT_PORT = 14020
_DEFAULT_HOST = "127.0.0.1"

# Ports allowed for CONNECT tunnels
_ALLOWED_CONNECT_PORTS = {80, 443, 8080, 8443}


def _is_private_or_loopback(host: str) -> bool:
    """Check if a host resolves to a private, loopback, or link-local address.

    Blocks RFC 1918, loopback (127.x), link-local (169.254.x), and IPv6 equivalents.
    """
    try:
        addr = ipaddress.ip_address(host)
        return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved
    except ValueError:
        # Not an IP — could be a hostname like "localhost"
        return host.lower() in ("localhost", "metadata.google.internal", "metadata")


class X402ForwardProxy:
    """HTTP forward proxy that intercepts 402 responses and auto-pays.

    Usage::

        proxy = X402ForwardProxy(port=14020)
        await proxy.start()
        # ... child process uses HTTP_PROXY=http://127.0.0.1:14020
        await proxy.stop()
    """

    def __init__(
        self,
        host: str = _DEFAULT_HOST,
        port: int = _DEFAULT_PORT,
        wallet_db: str | None = None,
        config: Any = None,
    ):
        self.host = host
        self.port = port
        self._wallet_db = wallet_db
        self._config = config
        self._server: HTTPServer | None = None
        self._thread: Thread | None = None
        self._middleware: Any = None
        self._running = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._loop_thread: Thread | None = None

    async def start(self) -> None:
        """Start the proxy server in a background thread."""
        if self._running:
            return

        # Initialize middleware
        await self._init_middleware()

        # Create a shared event loop in a background thread for async operations
        self._loop = asyncio.new_event_loop()
        self._loop_thread = Thread(
            target=self._loop.run_forever, daemon=True, name="proxy-async-loop"
        )
        self._loop_thread.start()

        # Create HTTP server with our handler
        proxy_self = self

        class ProxyHandler(BaseHTTPRequestHandler):
            """HTTP request handler that forwards requests and intercepts 402."""

            def do_GET(self):
                self._handle_request("GET")

            def do_POST(self):
                self._handle_request("POST")

            def do_PUT(self):
                self._handle_request("PUT")

            def do_DELETE(self):
                self._handle_request("DELETE")

            def do_PATCH(self):
                self._handle_request("PATCH")

            def do_HEAD(self):
                self._handle_request("HEAD")

            def do_OPTIONS(self):
                self._handle_request("OPTIONS")

            def do_CONNECT(self):
                """HTTPS CONNECT tunnel — pass through without interception.

                P2: SSRF protection — blocks tunnels to private/loopback addresses
                and restricts to standard HTTPS/HTTP ports.
                """
                # Parse host:port
                host_port = self.path
                if ":" in host_port:
                    host, port_str = host_port.rsplit(":", 1)
                    try:
                        port = int(port_str)
                    except ValueError:
                        self.send_error(400, f"Invalid port: {port_str}")
                        return
                else:
                    host = host_port
                    port = 443

                # SSRF protection: block private/loopback addresses
                if _is_private_or_loopback(host):
                    logger.warning("[PROXY] CONNECT to private/loopback address blocked: %s", host_port)
                    self.send_error(403, "CONNECT to private/loopback addresses is not allowed")
                    return

                # Port restriction: only allow standard web ports
                if port not in _ALLOWED_CONNECT_PORTS:
                    logger.warning("[PROXY] CONNECT to non-standard port blocked: %s:%d", host, port)
                    self.send_error(403, f"CONNECT to port {port} is not allowed")
                    return

                try:
                    import socket
                    upstream = socket.create_connection((host, port), timeout=10)
                    self.send_response(200, "Connection Established")
                    self.end_headers()

                    # Bi-directional tunnel
                    conn = self.connection
                    conn.setblocking(False)
                    upstream.setblocking(False)

                    while True:
                        import select
                        readable, _, _ = select.select([conn, upstream], [], [], 1.0)
                        if not readable:
                            continue
                        for sock in readable:
                            try:
                                data = sock.recv(8192)
                                if not data:
                                    return
                                if sock is conn:
                                    upstream.sendall(data)
                                else:
                                    conn.sendall(data)
                            except (ConnectionError, OSError):
                                return
                except Exception as exc:
                    logger.debug("CONNECT tunnel failed: %s", exc)
                    self.send_error(502, f"Tunnel failed: {exc}")

            def _handle_request(self, method: str):
                """Forward HTTP request and intercept 402."""
                url = self.path

                # Read request body if present
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length) if content_length > 0 else None

                # Build headers (exclude hop-by-hop)
                headers = {}
                for key, value in self.headers.items():
                    lower = key.lower()
                    if lower not in ("host", "proxy-connection", "proxy-authorization",
                                     "connection", "keep-alive", "transfer-encoding"):
                        headers[key] = value

                try:
                    # Use the shared event loop running in a background thread
                    future = asyncio.run_coroutine_threadsafe(
                        proxy_self._handle_proxied_request(method, url, headers, body),
                        proxy_self._loop,
                    )
                    result = future.result(timeout=60)

                    # Send response back to client
                    self.send_response(result.status_code)
                    for key, value in result.headers.items():
                        lower = key.lower()
                        if lower not in ("transfer-encoding", "connection", "content-length", "content-encoding"):
                            self.send_header(key, value)

                    response_body = result.body if isinstance(result.body, bytes) else b""
                    self.send_header("Content-Length", str(len(response_body)))
                    self.end_headers()
                    self.wfile.write(response_body)

                    if result.payment_made:
                        logger.info(
                            "Paid $%.4f for %s %s (tx: %s)",
                            result.amount_paid, method, url[:60], result.tx_hash[:16],
                        )

                except Exception as exc:
                    logger.error("Proxy error for %s %s: %s", method, url, exc)
                    self.send_error(502, f"Proxy error: {exc}")

            def log_message(self, format, *args):
                """Suppress default access logs — we use our own logger."""
                logger.debug(format, *args)

        self._server = HTTPServer((self.host, self.port), ProxyHandler)
        self._thread = Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        self._running = True
        logger.info("x402 forward proxy started on %s:%d", self.host, self.port)

    async def stop(self) -> None:
        """Stop the proxy server."""
        if self._server:
            self._server.shutdown()
            self._server = None
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
            if self._loop_thread:
                self._loop_thread.join(timeout=5)
            self._loop.close()
            self._loop = None
            self._loop_thread = None
        if self._middleware:
            await self._middleware.close()
            self._middleware = None
        self._running = False
        logger.info("x402 forward proxy stopped")

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def proxy_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    async def _init_middleware(self) -> None:
        """Initialize the x402 payment middleware."""
        import os

        from ag402_core.config import load_config
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.registry import PaymentProviderRegistry
        from ag402_core.wallet.agent_wallet import AgentWallet

        config = self._config
        if config is None:
            config = load_config()

        db_path = self._wallet_db or config.wallet_db_path or os.path.expanduser(
            "~/.ag402/wallet.db"
        )

        wallet = AgentWallet(db_path=db_path)
        await wallet.init_db()

        # Auto-fund in test mode
        if config.is_test_mode:
            balance = await wallet.get_balance()
            if balance == 0:
                await wallet.deposit(100.0, note="Proxy auto-fund (test mode)")

        provider = PaymentProviderRegistry.get_provider(config=config)
        self._middleware = X402PaymentMiddleware(
            wallet=wallet, provider=provider, config=config,
        )

    async def _handle_proxied_request(
        self, method: str, url: str, headers: dict, body: bytes | None,
    ):
        """Forward request through middleware (handles 402 auto-payment)."""

        return await self._middleware.handle_request(
            method=method, url=url, headers=headers, body=body,
        )


async def start_proxy(
    host: str = _DEFAULT_HOST,
    port: int = _DEFAULT_PORT,
    **kwargs,
) -> X402ForwardProxy:
    """Start a forward proxy and return the instance."""
    proxy = X402ForwardProxy(host=host, port=port, **kwargs)
    await proxy.start()
    return proxy
