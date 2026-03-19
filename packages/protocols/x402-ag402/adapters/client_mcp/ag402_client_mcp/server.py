"""Ag402 MCP Server — exposes x402 auto-payment as MCP Tools.

Designed to be used with Claude Code, Cursor, OpenClaw, and any
MCP-compatible AI tool. Communicates via stdio (default) or SSE.

Usage:
    # stdio mode (for Claude Code / Cursor / OpenClaw)
    ag402-mcp-client

    # SSE mode (for web/remote scenarios)
    ag402-mcp-client --sse --port 14021
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import signal
import sys
from typing import Any

from mcp.server.fastmcp import FastMCP

from ag402_client_mcp.tools import (
    handle_fetch_with_autopay,
    handle_transaction_history,
    handle_wallet_status,
)

logger = logging.getLogger("ag402_client_mcp.server")

# ─── MCP Server Instance ─────────────────────────────────────────────

mcp = FastMCP(
    "Ag402",
    instructions=(
        "Ag402 is an automatic payment engine for AI Agents. "
        "When you need to access a paid API that requires x402 payment, "
        "use the fetch_with_autopay tool instead of regular HTTP requests. "
        "It will automatically handle payment negotiation, budget checks, "
        "and on-chain USDC payment. Use wallet_status to check your balance "
        "and transaction_history to review past payments."
    ),
)

# ─── Runtime State (encapsulated) ────────────────────────────────────


class _Runtime:
    """Encapsulates lazily-initialized ag402-core components.

    All mutable state lives here instead of module-level globals,
    making it safe for testing and avoiding accidental cross-contamination.
    """

    __slots__ = ("middleware", "wallet", "initialized", "_init_lock")

    def __init__(self) -> None:
        self.middleware: Any = None
        self.wallet: Any = None
        self.initialized: bool = False
        self._init_lock: asyncio.Lock | None = None

    def _get_lock(self) -> asyncio.Lock:
        if self._init_lock is None:
            self._init_lock = asyncio.Lock()
        return self._init_lock

    async def ensure_initialized(self) -> None:
        """Lazily initialize ag402-core components on first tool call.

        Uses asyncio.Lock to prevent concurrent initialization in SSE mode.
        """
        if self.initialized:
            return

        async with self._get_lock():
            if self.initialized:
                return

            wallet = None
            try:
                from ag402_core.config import load_config
                from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
                from ag402_core.payment.registry import PaymentProviderRegistry
                from ag402_core.wallet.agent_wallet import AgentWallet

                config = load_config()

                db_path = config.wallet_db_path
                wallet = AgentWallet(db_path=db_path)
                await wallet.init_db()

                # Auto-fund in test mode
                if config.is_test_mode:
                    balance = await wallet.get_balance()
                    if balance == 0:
                        await wallet.deposit(100.0, note="ag402-mcp-client auto-fund (test mode)")
                        logger.info("[init] Test mode: auto-funded 100.0 virtual USD")

                provider = PaymentProviderRegistry.get_provider(config=config)

                middleware = X402PaymentMiddleware(
                    wallet=wallet,
                    provider=provider,
                    config=config,
                )

                self.wallet = wallet
                self.middleware = middleware
                self.initialized = True

                # First-run guidance (stderr — never interferes with MCP stdio)
                mode_label = "TEST (virtual funds)" if config.is_test_mode else "PRODUCTION"
                _log_guidance(mode_label, config.is_test_mode, db_path)

                logger.info("[init] Ag402 MCP Server initialized (mode=%s)", config.mode.value)

            except Exception:
                if wallet is not None:
                    with contextlib.suppress(Exception):
                        await wallet.close()
                raise

    async def shutdown(self) -> None:
        """Cleanup resources."""
        if self.middleware is not None:
            await self.middleware.close()
            self.middleware = None
        if self.wallet is not None:
            await self.wallet.close()
            self.wallet = None
        self.initialized = False
        logger.info("[shutdown] Ag402 MCP Server shutdown complete")


# Singleton runtime
_runtime = _Runtime()


def _log_guidance(mode: str, is_test: bool, db_path: str) -> None:
    """Print first-run guidance to stderr so both humans and AI can orient."""
    print(
        f"\n  Ag402 MCP Server ready  [{mode}]"
        f"\n  Wallet: {db_path}",
        file=sys.stderr,
    )
    if is_test:
        print(
            "  Tip: You are using virtual funds. To switch to real payments:"
            "\n       ag402 upgrade",
            file=sys.stderr,
        )
    print(file=sys.stderr)


# ─── MCP Tools ────────────────────────────────────────────────────────


@mcp.tool()
async def fetch_with_autopay(
    url: str,
    method: str = "GET",
    headers: str = "{}",
    body: str = "",
    max_amount: float = 5.0,
) -> str:
    """Make an HTTP request with automatic x402 payment.

    When the target API returns HTTP 402 (Payment Required), this tool
    automatically negotiates and completes payment using USDC, then
    retries the request with payment proof to get the actual response.

    The entire payment process is protected by 6-layer budget guards:
    single transaction limit, per-minute rate limit, daily spending cap,
    circuit breaker, balance check, and automatic rollback on failure.

    Args:
        url: The target API URL (must start with http:// or https://).
        method: HTTP method. One of GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.
        headers: JSON string of request headers, e.g. '{"Content-Type": "application/json"}'.
        body: Request body string (for POST/PUT/PATCH requests).
        max_amount: Maximum amount (in USD) willing to pay for this request. Default 5.0.

    Returns:
        JSON string containing:
        - status_code: HTTP response status code
        - body: Response body text
        - headers: Response headers
        - payment_made: Whether a payment was made (true/false)
        - amount_paid: Amount paid in USD (0.0 if no payment)
        - tx_hash: On-chain transaction hash (empty if no payment)
        - error: Error message (empty if successful)
    """
    await _runtime.ensure_initialized()

    parsed_headers: dict[str, str] | None = None
    if headers and headers != "{}":
        try:
            parsed_headers = json.loads(headers)
            if not isinstance(parsed_headers, dict):
                return json.dumps({"error": "headers must be a JSON object (dict)"})
        except json.JSONDecodeError as e:
            return json.dumps({"error": f"Invalid headers JSON: {e}"})

    body_str: str | None = body if body else None

    return await handle_fetch_with_autopay(
        middleware=_runtime.middleware,
        url=url,
        method=method,
        headers=parsed_headers,
        body=body_str,
        max_amount=max_amount,
    )


@mcp.tool()
async def wallet_status() -> str:
    """Check your Ag402 wallet balance and spending summary.

    Returns the current wallet status including:
    - balance: Current available balance in USD
    - today_spend: Total amount spent today (UTC)
    - total_spend: Total amount spent all-time
    - transaction_count: Total number of transactions
    - minute_spend: Amount spent in the last 60 seconds
    - minute_transaction_count: Number of transactions in the last 60 seconds

    Use this to check if you have sufficient funds before making
    expensive API calls, or to monitor your spending patterns.
    """
    await _runtime.ensure_initialized()
    return await handle_wallet_status(wallet=_runtime.wallet)


@mcp.tool()
async def transaction_history(limit: int = 20) -> str:
    """View recent payment transaction history.

    Shows a list of recent transactions including deposits, deductions,
    and rollbacks, ordered by most recent first.

    Args:
        limit: Maximum number of transactions to return (1-100, default 20).

    Returns:
        JSON string containing:
        - count: Number of transactions returned
        - limit: The limit that was applied
        - transactions: List of transaction objects, each with:
          - id: Transaction ID
          - type: "deposit", "deduction", or "rollback"
          - amount: Transaction amount in USD
          - to_address: Recipient address (for deductions)
          - tx_hash: On-chain transaction hash
          - status: "pending", "confirmed", or "rolled_back"
          - timestamp: Unix timestamp
          - note: Optional note
    """
    await _runtime.ensure_initialized()
    return await handle_transaction_history(wallet=_runtime.wallet, limit=limit)


# ─── Server Lifecycle ─────────────────────────────────────────────────


class Ag402MCPServer:
    """High-level wrapper for managing the MCP server lifecycle.

    Provides programmatic access to start/stop the server.
    For CLI usage, use the `main()` entry point instead.
    """

    def __init__(self) -> None:
        self._server = mcp

    async def initialize(self) -> None:
        """Pre-initialize ag402-core components."""
        await _runtime.ensure_initialized()

    async def shutdown(self) -> None:
        """Cleanup resources."""
        await _runtime.shutdown()

    def run_stdio(self) -> None:
        """Start the MCP server in stdio transport mode."""
        self._server.run(transport="stdio")

    def run_sse(self, host: str = "127.0.0.1", port: int = 14021) -> None:
        """Start the MCP server in SSE transport mode."""
        self._server.settings.host = host
        self._server.settings.port = port
        self._server.run(transport="sse")


# ─── CLI Entry Point ──────────────────────────────────────────────────


def main() -> None:
    """CLI entry point for ag402-mcp-client."""
    # Configure logging to stderr (stdout is used for MCP stdio protocol)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser(
        description="Ag402 MCP Client — x402 auto-payment as MCP Tools",
    )
    parser.add_argument(
        "--sse",
        action="store_true",
        help="Use SSE transport instead of stdio",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=14021,
        help="SSE server port (default: 14021)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="SSE server host (default: 127.0.0.1)",
    )

    args = parser.parse_args()

    # Register graceful shutdown for SIGINT/SIGTERM
    def _handle_signal(sig: int, frame: Any) -> None:
        logger.info("Received signal %s, shutting down...", sig)
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_runtime.shutdown())
        sys.exit(0)

    with contextlib.suppress(Exception):
        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)

    if args.sse:
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        logger.info("Starting Ag402 MCP Server (SSE mode, %s:%d)", args.host, args.port)
        mcp.run(transport="sse")
    else:
        logger.info("Starting Ag402 MCP Server (stdio mode)")
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
