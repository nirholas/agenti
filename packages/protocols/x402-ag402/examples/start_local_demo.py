"""
Local Demo Server — starts a mock weather API and x402 payment gateway.

Run this in a terminal BEFORE running any framework integration example:

    python examples/start_local_demo.py

It starts two servers:
  - :18000  Mock weather API (upstream, no auth)
  - :18001  x402 payment gateway (requires $0.01 USDC payment proof)

Leave this running, then in another terminal:

    python examples/langchain_integration.py
    python examples/autogen_integration.py
    python examples/crewai_integration.py

Press Ctrl+C to stop.
"""

from __future__ import annotations

import asyncio
import sys

import uvicorn
from ag402_core.gateway.auth import PaymentVerifier

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from mock_weather_server import app as weather_app  # noqa: E402

try:
    from ag402_mcp.gateway import X402Gateway
except ImportError as e:
    raise ImportError(
        "ag402-mcp not installed. Run: pip install ag402-mcp"
    ) from e

WEATHER_PORT = 18000
GATEWAY_PORT = 18001
RECIPIENT_ADDRESS = "DemoRecipient1111111111111111111111111111111"


class BackgroundServer:
    def __init__(self, app, port: int):
        self.app = app
        self.port = port
        self._server: uvicorn.Server | None = None
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        config = uvicorn.Config(
            self.app,
            host="127.0.0.1",
            port=self.port,
            log_level="error",
            lifespan="off",
        )
        self._server = uvicorn.Server(config)
        self._server.install_signal_handlers = lambda: None
        self._task = asyncio.create_task(self._server.serve())
        for _ in range(50):
            await asyncio.sleep(0.1)
            if self._server.started:
                break

    async def stop(self) -> None:
        if self._server:
            self._server.should_exit = True
        if self._task:
            try:
                await asyncio.wait_for(self._task, timeout=3.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass


async def main() -> None:
    print()
    print("  Starting local x402 demo environment...")
    print()

    weather_server = BackgroundServer(weather_app, port=WEATHER_PORT)
    await weather_server.start()
    print(f"  ✓  Mock weather API  → http://127.0.0.1:{WEATHER_PORT}/weather?city=Tokyo")

    verifier = PaymentVerifier()
    gateway = X402Gateway(
        target_url=f"http://127.0.0.1:{WEATHER_PORT}",
        price="0.01",
        chain="solana",
        token="USDC",
        address=RECIPIENT_ADDRESS,
        verifier=verifier,
    )
    gateway_app = gateway.create_app()
    gateway_server = BackgroundServer(gateway_app, port=GATEWAY_PORT)
    await gateway_server.start()
    print(f"  ✓  x402 gateway      → http://127.0.0.1:{GATEWAY_PORT}  (requires $0.01 USDC)")

    print()
    print("  Ready. In another terminal, run:")
    print("    python examples/langchain_integration.py")
    print("    python examples/autogen_integration.py")
    print("    python examples/crewai_integration.py")
    print()
    print("  Press Ctrl+C to stop.")
    print()

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\n  Stopping servers...")
        await weather_server.stop()
        await gateway_server.stop()
        print("  Done.")


if __name__ == "__main__":
    asyncio.run(main())
