"""OpenClaw bridge adapter for Ag402 x402 auto-payment.

Provides an HTTP proxy bridge that OpenClaw agents use to make paid API
calls. The bridge intercepts outbound requests, detects 402 Payment
Required responses, automatically pays via Solana USDC, and returns the
paid response to the calling agent.

Architecture:
    OpenClaw Agent → mcporter → ag402-openclaw (this bridge) → Paid API

Usage (standalone):
    ag402-openclaw --port 14022

Usage (via mcporter):
    mcporter config add ag402 --command python -m ag402_openclaw.bridge --scope home

The bridge exposes a single endpoint:
    POST /proxy
    Body: {"url": "...", "method": "GET", "headers": {...}, "body": "..."}
    Response: {"status_code": 200, "body": "...", "payment_made": true, ...}
"""

from __future__ import annotations

import argparse
import asyncio
import fcntl
import ipaddress
import json
import logging
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

logger = logging.getLogger("ag402_openclaw.bridge")

# API key authentication (set via AG402_API_KEY env var)
API_KEY: str = os.environ.get("AG402_API_KEY", "")

# ============================================================================
# Security Functions
# ============================================================================

# SSRF Protection: Blocked IP patterns and domains
BLOCKED_IPS = {
    "127.0.0.1", "::1", "0.0.0.0", "localhost",
}
BLOCKED_DOMAINS = {".local", ".internal", ".test", ".example"}
BLOCKED_PORTS = {22, 23, 25, 3306, 5432, 6379, 27017}


def _is_url_safe(url: str) -> tuple[bool, str]:
    """Validate URL to prevent SSRF attacks.

    Args:
        url: The URL to validate.

    Returns:
        (is_safe, error_message) tuple.
    """
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ""
        port = parsed.port or (443 if parsed.scheme == "https" else 80)

        # Check for empty host
        if not host:
            return False, "Invalid URL: no hostname"

        # Check blocked IPs
        if host in BLOCKED_IPS or host.startswith("127."):
            return False, f"Access to localhost/internal IPs blocked: {host}"

        # Check blocked domains
        lower_host = host.lower()
        for blocked in BLOCKED_DOMAINS:
            if lower_host.endswith(blocked):
                return False, f"Access to {blocked} domains blocked"

        # Check private IP ranges
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback:
                return False, f"Private/loopback IP blocked: {host}"
        except ValueError:
            pass  # Not an IP

        # Check blocked ports
        if port in BLOCKED_PORTS:
            return False, f"Port {port} is blocked for security"

        # Only allow http/https
        if parsed.scheme not in ("http", "https"):
            return False, f"Only http/https allowed, got {parsed.scheme}"

        return True, ""

    except Exception as e:
        return False, f"URL parsing error: {str(e)}"


# ============================================================================
# Payment confirmation threshold
# ============================================================================

PAYMENT_CONFIRM_THRESHOLD = 10.0


# ============================================================================
# Budget State Management
# ============================================================================

class BudgetState:
    """Track daily spending with automatic daily reset."""

    def __init__(self) -> None:
        self._daily_spend: float = 0.0
        self._last_reset_date: date | None = None

    def add_spend(self, amount: float) -> None:
        """Add spending amount, resetting daily total if new day."""
        today = datetime.now(timezone.utc).date()
        if self._last_reset_date is None or today > self._last_reset_date:
            # New day - reset daily spend
            self._daily_spend = 0.0
            self._last_reset_date = today
        self._daily_spend += amount

    def get_daily_spend(self) -> float:
        """Get current daily spend, resetting if needed."""
        today = datetime.now(timezone.utc).date()
        if self._last_reset_date is None or today > self._last_reset_date:
            self._daily_spend = 0.0
            self._last_reset_date = today
        return self._daily_spend


# ============================================================================
# Atomic Balance Operations
# ============================================================================

class AtomicBalance:
    """Thread-safe balance operations using file locking."""

    def __init__(self, wallet_file: Path):
        self._wallet_file = wallet_file
        self._lock_file = wallet_file.with_suffix('.lock')

    def _acquire_lock(self, lock_fd) -> None:
        """Acquire exclusive file lock."""
        fcntl.flock(lock_fd, fcntl.LOCK_EX)

    def _release_lock(self, lock_fd) -> None:
        """Release file lock."""
        fcntl.flock(lock_fd, fcntl.LOCK_UN)

    def atomic_deduct(self, amount: float) -> tuple[bool, float, str]:
        """Atomically deduct amount from balance.

        Returns:
            (success, new_balance, error_message)
        """
        # Ensure directory exists
        self._wallet_file.parent.mkdir(parents=True, exist_ok=True)

        # Open lock file
        lock_fd = os.open(str(self._lock_file), os.O_RDWR | os.O_CREAT, 0o644)
        try:
            self._acquire_lock(lock_fd)

            # Read current balance
            if self._wallet_file.exists():
                with open(self._wallet_file) as f:
                    wallet = json.load(f)
            else:
                wallet = {"balance": 0.0}

            current_balance = wallet.get("balance", 0.0)

            # Check sufficient balance
            if current_balance < amount:
                return False, current_balance, "Insufficient balance"

            # Deduct amount
            new_balance = current_balance - amount
            wallet["balance"] = new_balance

            # Write back atomically (write to temp, then rename)
            temp_file = self._wallet_file.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(wallet, f)
            os.replace(temp_file, self._wallet_file)

            return True, new_balance, ""

        finally:
            self._release_lock(lock_fd)
            os.close(lock_fd)

    def atomic_add(self, amount: float) -> tuple[bool, float]:
        """Atomically add amount to balance.

        Returns:
            (success, new_balance)
        """
        self._wallet_file.parent.mkdir(parents=True, exist_ok=True)

        lock_fd = os.open(str(self._lock_file), os.O_RDWR | os.O_CREAT, 0o644)
        try:
            self._acquire_lock(lock_fd)

            # Read current balance
            if self._wallet_file.exists():
                with open(self._wallet_file) as f:
                    wallet = json.load(f)
            else:
                wallet = {"balance": 0.0}

            current_balance = wallet.get("balance", 0.0)
            new_balance = current_balance + amount
            wallet["balance"] = new_balance

            # Write back atomically
            temp_file = self._wallet_file.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump(wallet, f)
            os.replace(temp_file, self._wallet_file)

            return True, new_balance

        finally:
            self._release_lock(lock_fd)
            os.close(lock_fd)


def confirm_payment(amount: float) -> tuple[bool, str]:
    """Confirm if payment should proceed based on $10 threshold.

    Args:
        amount: Payment amount in USD.

    Returns:
        (confirmed, error_message) tuple.
    """
    if amount > PAYMENT_CONFIRM_THRESHOLD:
        logger.warning(
            "[PAYMENT] Amount $%.2f exceeds $%.2f threshold - requires confirmation",
            amount,
            PAYMENT_CONFIRM_THRESHOLD,
        )
        return False, f"Amount ${amount} exceeds ${PAYMENT_CONFIRM_THRESHOLD} threshold, confirmation required"
    return True, ""


class OpenClawBridge:
    """HTTP proxy bridge for OpenClaw agents with x402 auto-payment.

    Wraps ag402-core middleware and exposes a simple JSON-RPC interface
    that OpenClaw agents (via mcporter) can call to make paid HTTP requests.
    """

    def __init__(self) -> None:
        self._middleware: Any = None
        self._wallet: Any = None
        self._initialized = False
        self._lock: asyncio.Lock | None = None
        # Atomic balance operations
        wallet_path = Path.home() / ".ag402" / "wallet.json"
        self._atomic_balance = AtomicBalance(wallet_path)

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def ensure_initialized(self) -> None:
        """Lazily initialize ag402-core components."""
        if self._initialized:
            return

        async with self._get_lock():
            if self._initialized:
                return

            from ag402_core.config import load_config
            from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
            from ag402_core.payment.registry import PaymentProviderRegistry
            from ag402_core.wallet.agent_wallet import AgentWallet

            config = load_config()

            self._wallet = AgentWallet(db_path=config.wallet_db_path)
            await self._wallet.init_db()

            if config.is_test_mode:
                balance = await self._wallet.get_balance()
                if balance == 0:
                    await self._wallet.deposit(100.0, note="ag402-openclaw auto-fund (test mode)")
                    logger.info("[init] Test mode: auto-funded 100.0 virtual USD")

            provider = PaymentProviderRegistry.get_provider(config=config)
            self._middleware = X402PaymentMiddleware(
                wallet=self._wallet,
                provider=provider,
                config=config,
            )
            self._initialized = True

            mode_label = "TEST" if config.is_test_mode else "PRODUCTION"
            logger.info("[init] OpenClaw bridge initialized (mode=%s)", mode_label)

    async def proxy_request(
        self,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        body: str | None = None,
        max_amount: float | None = None,
    ) -> dict:
        """Proxy an HTTP request with automatic x402 payment.

        Args:
            url: Target API URL.
            method: HTTP method (GET, POST, etc.).
            headers: Optional request headers.
            body: Optional request body string.
            max_amount: Maximum amount willing to pay (USD).

        Returns:
            Dict with status_code, body, headers, payment_made, amount_paid,
            tx_hash, and error fields.
        """
        # P0 Security: SSRF protection - validate URL before making request
        is_safe, error_msg = _is_url_safe(url)
        if not is_safe:
            logger.warning("[proxy] URL validation failed: %s", error_msg)
            return {
                "status_code": 400,
                "body": "",
                "headers": {},
                "payment_made": False,
                "amount_paid": 0.0,
                "tx_hash": "",
                "error": f"URL validation failed: {error_msg}",
            }

        await self.ensure_initialized()

        # P1 Fix: API key authentication
        if API_KEY:
            request_api_key = headers.get("x-api-key") if headers else None
            if request_api_key != API_KEY:
                return {
                    "status_code": 401,
                    "body": "",
                    "headers": {},
                    "payment_made": False,
                    "amount_paid": 0.0,
                    "tx_hash": "",
                    "error": "Unauthorized: Invalid API key",
                }

        # P0 Fix: Check $10 confirmation threshold before payment
        if max_amount is not None:
            confirmed, error_msg = confirm_payment(max_amount)
            if not confirmed:
                return {
                    "status_code": 402,
                    "body": "",
                    "headers": {},
                    "payment_made": False,
                    "amount_paid": 0.0,
                    "tx_hash": "",
                    "error": error_msg,
                }

        method = method.upper()
        body_bytes = body.encode("utf-8") if body else None

        try:
            result = await self._middleware.handle_request(
                method=method,
                url=url,
                headers=headers,
                body=body_bytes,
                max_amount=max_amount,
            )

            body_text = ""
            if result.body:
                try:
                    body_text = result.body.decode("utf-8")
                except UnicodeDecodeError:
                    body_text = f"<binary data, {len(result.body)} bytes>"

            # P0 Security: Use atomic balance deduction for successful payments
            if result.payment_made and result.amount_paid > 0:
                success, new_balance, error = self._atomic_balance.atomic_deduct(result.amount_paid)
                if not success:
                    logger.warning("[proxy] Atomic balance deduction failed: %s", error)

            return {
                "status_code": result.status_code,
                "body": body_text,
                "headers": result.headers,
                "payment_made": result.payment_made,
                "amount_paid": result.amount_paid,
                "tx_hash": result.tx_hash,
                "error": result.error,
            }

        except Exception as exc:
            logger.exception("[proxy] Request failed")
            return {
                "status_code": 500,
                "body": "",
                "headers": {},
                "payment_made": False,
                "amount_paid": 0.0,
                "tx_hash": "",
                "error": f"{type(exc).__name__}: {exc}",
            }

    async def shutdown(self) -> None:
        """Cleanup resources."""
        if self._middleware is not None:
            await self._middleware.close()
            self._middleware = None
        if self._wallet is not None:
            await self._wallet.close()
            self._wallet = None
        self._initialized = False


async def _run_stdio_bridge(bridge: OpenClawBridge) -> None:
    """Run the bridge in stdio mode (for mcporter).

    Reads JSON-RPC-style requests from stdin, one per line.
    Writes JSON responses to stdout, one per line.
    """
    logger.info("[bridge] Running in stdio mode")
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

    try:
        while True:
            line = await reader.readline()
            if not line:
                break

            try:
                request = json.loads(line.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                response = {"error": "Invalid JSON input"}
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
                continue

            result = await bridge.proxy_request(
                url=request.get("url", ""),
                method=request.get("method", "GET"),
                headers=request.get("headers"),
                body=request.get("body"),
                max_amount=request.get("max_amount"),
            )

            sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
            sys.stdout.flush()
    finally:
        await bridge.shutdown()


def main() -> None:
    """CLI entry point for ag402-openclaw bridge."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        stream=sys.stderr,
    )

    parser = argparse.ArgumentParser(
        description="Ag402 OpenClaw bridge — x402 auto-payment proxy for OpenClaw agents",
    )
    parser.add_argument(
        "--mode",
        choices=["stdio", "http"],
        default="stdio",
        help="Transport mode: stdio (for mcporter, default) or http (standalone proxy)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=14022,
        help="HTTP server port (only used in http mode, default: 14022)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="HTTP server host (only used in http mode, default: 127.0.0.1)",
    )
    args = parser.parse_args()

    bridge = OpenClawBridge()

    if args.mode == "stdio":
        asyncio.run(_run_stdio_bridge(bridge))
    else:
        _run_http_bridge(bridge, host=args.host, port=args.port)


def _run_http_bridge(bridge: OpenClawBridge, host: str, port: int) -> None:
    """Run the bridge as a standalone HTTP proxy server."""
    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
    except ImportError:
        logger.error("HTTP mode requires fastapi: pip install fastapi uvicorn")
        sys.exit(1)

    app = FastAPI(
        title="Ag402 OpenClaw Bridge",
        description="HTTP proxy with automatic x402 payment for OpenClaw agents",
    )

    @app.on_event("startup")
    async def startup() -> None:
        await bridge.ensure_initialized()

    @app.on_event("shutdown")
    async def shutdown() -> None:
        await bridge.shutdown()

    @app.post("/proxy")
    async def proxy(request: dict) -> JSONResponse:
        result = await bridge.proxy_request(
            url=request.get("url", ""),
            method=request.get("method", "GET"),
            headers=request.get("headers"),
            body=request.get("body"),
            max_amount=request.get("max_amount"),
        )
        return JSONResponse(content=result)

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse(content={
            "status": "healthy",
            "adapter": "ag402-openclaw",
            "initialized": bridge._initialized,
        })

    import uvicorn
    logger.info("[bridge] Starting HTTP mode on %s:%d", host, port)
    uvicorn.run(app, host=host, port=port, loop="asyncio")


if __name__ == "__main__":
    main()
