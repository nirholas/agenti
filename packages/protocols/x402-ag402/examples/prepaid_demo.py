"""
Prepaid Demo: Buy a credit pack once, pay per-call at 1ms latency.

Shows the full prepaid flow:
  Seller side:
    1. Gateway starts with --prepaid-signing-key
    2. Exposes GET /prepaid/packages (browse tiers)
    3. Exposes POST /prepaid/purchase (verify tx, issue credential)

  Buyer side:
    4. Agent queries available packages
    5. Agent purchases a pack (test mode: synthetic tx_hash)
    6. Credential stored at ~/.ag402/prepaid_credentials.json
    7. Each API call uses X-Prepaid-Credential header (~1ms)
    8. Credits decrement; auto-fallback to on-chain when exhausted

Usage:
    X402_MODE=test python examples/prepaid_demo.py

No external setup needed — uses mock payment in test mode.
"""

from __future__ import annotations

import asyncio
import logging
import sys
import time

import httpx
import uvicorn
from ag402_core.config import RunMode, X402Config
from ag402_core.gateway.auth import PaymentVerifier
from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
from ag402_core.payment.solana_adapter import MockSolanaAdapter
from ag402_core.prepaid import client as prepaid_client
from ag402_core.prepaid.models import PrepaidCredential
from ag402_core.wallet.agent_wallet import AgentWallet
from ag402_mcp.gateway import X402Gateway

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from mock_weather_server import app as weather_app  # noqa: E402

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SELLER_ADDRESS = "SellerWallet1111111111111111111111111111111"
BUYER_ADDRESS  = "BuyerWallet11111111111111111111111111111111"
SIGNING_KEY    = "demo-prepaid-signing-key-do-not-use-in-prod"
GATEWAY_PORT   = 9402
BACKEND_PORT   = 9403
PACKAGE_ID     = "p3d_100"   # Starter: 100 calls / 3 days / $1.50


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers = [handler]
    for noisy in ("uvicorn", "uvicorn.access", "uvicorn.error", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def log(tag: str, msg: str) -> None:
    print(f"  [{tag}] {msg}")


# ---------------------------------------------------------------------------
# Server helpers
# ---------------------------------------------------------------------------

async def _serve(app, port: int) -> None:
    config = uvicorn.Config(app, host="127.0.0.1", port=port, loop="asyncio", log_level="warning")
    server = uvicorn.Server(config)
    await server.serve()


async def wait_for_server(url: str, retries: int = 20) -> None:
    async with httpx.AsyncClient() as client:
        for _ in range(retries):
            try:
                await client.get(url)
                return
            except Exception:
                await asyncio.sleep(0.15)
    raise RuntimeError(f"Server at {url} did not start")


# ---------------------------------------------------------------------------
# Main demo
# ---------------------------------------------------------------------------

async def run_demo() -> None:
    setup_logging()

    print("\n" + "=" * 60)
    print("  ag402 Prepaid Demo — 1ms API calls")
    print("=" * 60 + "\n")

    # ---- Start backend ----
    print("  [setup] Starting mock weather backend …")
    backend_task = asyncio.create_task(_serve(weather_app, BACKEND_PORT))
    await wait_for_server(f"http://127.0.0.1:{BACKEND_PORT}/weather")
    log("setup", f"Backend ready on :{BACKEND_PORT}")

    # ---- Start gateway with prepaid signing key ----
    print("  [setup] Starting x402 gateway with prepaid support …")
    config = X402Config(
        mode=RunMode.TEST,
        solana_private_key="mock",
        prepaid_signing_key=SIGNING_KEY,
    )
    verifier = PaymentVerifier()
    gateway = X402Gateway(
        target_url=f"http://127.0.0.1:{BACKEND_PORT}",
        price=0.01,
        address=SELLER_ADDRESS,
        verifier=verifier,
        config=config,
        prepaid_signing_key=SIGNING_KEY,
    )
    gateway_app = gateway.create_app()
    gateway_task = asyncio.create_task(_serve(gateway_app, GATEWAY_PORT))
    await wait_for_server(f"http://127.0.0.1:{GATEWAY_PORT}/health")
    log("setup", f"Gateway  ready on :{GATEWAY_PORT}")

    gateway_url = f"http://127.0.0.1:{GATEWAY_PORT}"

    # ---- Step 1: Browse packages ----
    print("\n  ── STEP 1: Browse available prepaid packages ──")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{gateway_url}/prepaid/packages")
        packages = resp.json()

    for pkg_id, info in packages.items():
        log("packages", f"  {pkg_id:15s}  {info['name']:14s}  "
            f"{info['calls']} calls / {info['days']} days  ${info['price']:.2f}")

    # ---- Step 2: Purchase a pack ----
    print(f"\n  ── STEP 2: Purchase '{PACKAGE_ID}' (test mode — free) ──")
    tx_hash = f"prepaid_purchase_{int(time.time())}"   # synthetic in test mode

    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{gateway_url}/prepaid/purchase", json={
            "buyer_address": BUYER_ADDRESS,
            "package_id": PACKAGE_ID,
            "tx_hash": tx_hash,
        })

    if resp.status_code != 200:
        log("ERROR", f"Purchase failed: {resp.status_code} {resp.text}")
        return

    credential_json = resp.json()
    log("purchase", f"Credential issued — {credential_json['remaining_calls']} calls, "
        f"expires {credential_json['expires_at'][:10]}")

    # ---- Step 3: Store credential (buyer side) ----
    print("\n  ── STEP 3: Store credential locally ──")
    cred = PrepaidCredential.from_dict(credential_json)
    prepaid_client.add_credential(cred)
    all_creds = prepaid_client.get_all_credentials()
    log("store", f"Stored at ~/.ag402/prepaid_credentials.json  "
        f"({len(all_creds)} credential(s) total)")

    # ---- Step 4: Make API calls using the prepaid credential ----
    print("\n  ── STEP 4: Make API calls — prepaid path (~1ms) ──")

    provider = MockSolanaAdapter()
    wallet = AgentWallet(provider=provider)
    middleware = X402PaymentMiddleware(
        wallet=wallet,
        config=config,
    )

    call_times = []
    for i in range(1, 4):
        t0 = time.perf_counter()
        result = await middleware.handle_request(
            method="GET",
            url=f"{gateway_url}/weather",
            headers={},
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        call_times.append(elapsed_ms)

        payment_type = "prepaid" if result.tx_hash == "prepaid" else "on-chain"
        log("call", f"  Call {i}: HTTP {result.status_code}  "
            f"via {payment_type}  {elapsed_ms:.1f}ms")

    avg_ms = sum(call_times) / len(call_times)
    log("perf", f"Average latency: {avg_ms:.1f}ms across {len(call_times)} calls")

    # ---- Step 5: Check remaining calls ----
    print("\n  ── STEP 5: Credential status after use ──")
    for c in prepaid_client.get_all_credentials():
        if c.seller_address == SELLER_ADDRESS:
            log("status", f"  {c.package_id}: {c.remaining_calls} calls remaining  "
                f"expires {str(c.expires_at)[:10]}")

    # ---- CLI equivalent ----
    print("\n  ── CLI equivalent ──")
    print(f"  $ ag402 prepaid buy {gateway_url} {PACKAGE_ID}")
    print("  $ ag402 prepaid status")
    print("  $ ag402 prepaid purge   # clean up expired/depleted")

    print("\n" + "=" * 60)
    print("  Demo complete.")
    print("=" * 60 + "\n")

    backend_task.cancel()
    gateway_task.cancel()


if __name__ == "__main__":
    asyncio.run(run_demo())
