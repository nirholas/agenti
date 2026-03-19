"""
E2E Demo: AI Agent auto-pays for weather data via x402 protocol.

Demonstrates the full x402 payment flow:
  1. Agent sends request to a gateway-protected API
  2. Gateway returns 402 Payment Required with x402 challenge
  3. Middleware intercepts, parses challenge, checks budget
  4. Middleware pays on-chain (mock), gets tx_hash
  5. Middleware retries with payment proof
  6. Gateway verifies proof and proxies to upstream service
  7. Agent receives the weather data

Usage:
    python examples/demo_e2e.py

    The script starts its own mock weather server and x402 gateway
    in the background -- no external setup needed.
"""

from __future__ import annotations

import asyncio
import logging
import sys
import time

import uvicorn
from ag402_core.config import RunMode, X402Config
from ag402_core.gateway.auth import PaymentVerifier
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.wallet.agent_wallet import AgentWallet
from ag402_mcp.gateway import X402Gateway

# Import the mock weather app
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from mock_weather_server import app as weather_app  # noqa: E402

# ---------------------------------------------------------------------------
# Logging setup -- cyberpunk-style output
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    """Configure logging with clean format for demo output."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]
    # Silence noisy libraries
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def log(tag: str, message: str) -> None:
    """Print a styled log line."""
    print(f"  [{tag}] {message}")


# ---------------------------------------------------------------------------
# Server runners (background tasks)
# ---------------------------------------------------------------------------

class BackgroundServer:
    """Run a uvicorn server in a background asyncio task."""

    def __init__(self, app, host: str = "127.0.0.1", port: int = 0):
        self.app = app
        self.host = host
        self.port = port
        self._server: uvicorn.Server | None = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level="error",
            lifespan="off",
        )
        self._server = uvicorn.Server(config)
        # Prevent uvicorn from installing signal handlers (avoids threading errors on exit)
        self._server.install_signal_handlers = lambda: None
        self._task = asyncio.create_task(self._server.serve())
        # Wait for server to start
        for _ in range(50):
            await asyncio.sleep(0.1)
            if self._server.started:
                break

    async def stop(self) -> None:
        if self._server:
            self._server.should_exit = True
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=3.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass


# ---------------------------------------------------------------------------
# Main demo
# ---------------------------------------------------------------------------

RECIPIENT_ADDRESS = "DemoRecipientWa11et11111111111111111111"
GATEWAY_PORT = 18001
WEATHER_PORT = 18000


async def main() -> None:
    setup_logging()

    print()
    print("=" * 64)
    print("  x402 Protocol -- End-to-End Payment Demo")
    print("=" * 64)
    print()

    # --- Start background servers ---
    log("BOOT", "Starting mock weather server on port %d..." % WEATHER_PORT)
    weather_server = BackgroundServer(weather_app, port=WEATHER_PORT)
    await weather_server.start()
    log("BOOT", "Weather server ready.")

    log("BOOT", "Starting x402 payment gateway on port %d..." % GATEWAY_PORT)
    verifier = PaymentVerifier()  # test mode -- no on-chain check
    gateway = X402Gateway(
        target_url=f"http://127.0.0.1:{WEATHER_PORT}",
        price="0.02",
        chain="solana",
        token="USDC",
        address=RECIPIENT_ADDRESS,
        verifier=verifier,
    )
    gateway_app = gateway.create_app()
    gateway_server = BackgroundServer(gateway_app, port=GATEWAY_PORT)
    await gateway_server.start()
    log("BOOT", "Gateway ready. All requests to port %d require x402 payment." % GATEWAY_PORT)
    print()

    try:
        # --- Initialize agent components ---
        log("INIT", "Initializing AI Agent wallet (test mode)...")

        wallet = AgentWallet(db_path=":memory:")
        await wallet.init_db()
        await wallet.deposit(1000.00, note="Test mode faucet")
        balance = await wallet.get_balance()
        log("INIT", f"AgentWallet balance: ${balance:.2f} (testnet)")

        provider = MockSolanaAdapter(balance=1000.0, address="Ag402Pa11etAddr1111111111111111111111111111")
        log("INIT", f"MockSolanaAdapter ready (address: {provider.get_address()})")

        config = X402Config(mode=RunMode.TEST, single_tx_limit=1.0)

        middleware = X402PaymentMiddleware(
            wallet=wallet,
            provider=provider,
            config=config,
        )
        log("INIT", "x402 middleware initialized.")
        print()

        # --- Make a payment-gated request ---
        city = "Tokyo"
        url = f"http://127.0.0.1:{GATEWAY_PORT}/weather?city={city}"

        print("-" * 64)
        log("REQUEST", f"GET {url}")
        print("-" * 64)

        t0 = time.monotonic()
        result = await middleware.handle_request("GET", url)
        elapsed = time.monotonic() - t0

        print()
        if result.payment_made:
            log("CONFIRM", f"Payment confirmed ({elapsed:.1f}s)")

        if result.status_code == 200:
            import json
            data = json.loads(result.body)
            log("SUCCESS", "Weather data: %s, %d C, %s" % (data["city"], data["temp"], data["condition"]))
        else:
            log("ERROR", "Request failed with status %d" % result.status_code)
            if result.error:
                log("ERROR", f"Detail: {result.error}")

        if result.payment_made:
            log("TX", f"tx_hash: {result.tx_hash}")
            log("TX", "Amount paid: ${:.2f} {}".format(result.amount_paid, "USDC"))

        final_balance = await wallet.get_balance()
        log("BALANCE", f"Remaining: ${final_balance:.2f}")

        print()
        print("=" * 64)
        log("DONE", f"Demo complete. The AI agent auto-paid ${result.amount_paid:.2f} for weather data.")
        print("=" * 64)
        print()

        await middleware.close()

    finally:
        await weather_server.stop()
        await gateway_server.stop()


if __name__ == "__main__":
    asyncio.run(main())
