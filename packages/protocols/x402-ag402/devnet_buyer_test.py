"""
Devnet E2E buyer test: real USDC payment on Solana devnet through ag402 gateway.

This script:
  1. Connects to the ag402 gateway
  2. Sends a request (gets 402 Payment Required)
  3. Pays 0.05 devnet USDC on-chain
  4. Retries with payment proof
  5. Receives the audit report

Requires:
  pip install "ag402-core[crypto]" httpx

Environment variables (set in ~/.ag402/.env or export):
  SOLANA_PRIVATE_KEY  — buyer's base58-encoded full secret key
  SOLANA_RPC_URL      — devnet RPC endpoint (default: https://api.devnet.solana.com)
  GATEWAY_URL         — gateway address (default: http://localhost:8001)
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time

import httpx


def _require_env(name: str) -> str:
    """Get a required environment variable, exit with clear message if missing."""
    val = os.getenv(name, "")
    if not val:
        print(
            f"  [FATAL] Required environment variable {name} is not set.\n"
            f"  Set it via:  export {name}=<value>\n"
            f"  Or add it to ~/.ag402/.env",
            file=sys.stderr,
        )
        sys.exit(1)
    return val


# Force production + devnet environment for the buyer side
os.environ["X402_MODE"] = "production"
os.environ["X402_NETWORK"] = "devnet"
os.environ.setdefault("SOLANA_RPC_URL", "https://api.devnet.solana.com")

# Validate required key is present (do NOT hardcode!)
_require_env("SOLANA_PRIVATE_KEY")


def log(tag: str, msg: str) -> None:
    print(f"  [{tag}] {msg}", flush=True)


# Well-known tokens to test
BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8001")


async def main() -> None:
    print()
    print("=" * 64)
    print("  Devnet E2E Buyer Test — Real USDC Payment")
    print("=" * 64)
    print()

    errors = 0

    # --- Step 1: Health checks ---
    log("STEP 1", "Health checks...")
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(f"{GATEWAY_URL}/health")
            log("HEALTH", f"Gateway: {resp.status_code} — {resp.json()}")
        except Exception as e:
            log("ERROR", f"Gateway health check failed: {e}")
            errors += 1

    # --- Step 2: Test 402 response ---
    log("STEP 2", "Testing 402 Payment Required response...")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp_402 = await client.get(f"{GATEWAY_URL}/audit/{BONK_MINT}")
        log("402", f"Status: {resp_402.status_code}")
        if resp_402.status_code == 402:
            challenge = resp_402.json()
            log("402", f"Protocol: {challenge.get('protocol')}")
            log("402", f"Chain: {challenge.get('chain')}")
            log("402", f"Token: {challenge.get('token')}")
            log("402", f"Amount: {challenge.get('amount')} USDC")
            log("402", f"Address: {challenge.get('address')}")
            log("PASS", "402 Payment Required received correctly")
        else:
            log("FAIL", f"Expected 402, got {resp_402.status_code}")
            errors += 1

    # --- Step 3: Check buyer wallet balance ---
    log("STEP 3", "Checking buyer wallet balance on devnet...")
    from ag402_core.config import load_config as load_x402_config
    from ag402_core.payment.registry import PaymentProviderRegistry

    x402_cfg = load_x402_config()
    provider = PaymentProviderRegistry.get_provider(config=x402_cfg)

    balance = await provider.check_balance()
    log("BALANCE", f"Buyer USDC balance: {balance}")
    if balance < 0.05:
        log("FATAL", "Insufficient USDC balance for payment!")
        sys.exit(1)

    # --- Step 4: Full payment flow via X402PaymentMiddleware ---
    log("STEP 4", "Executing full payment flow (real devnet USDC)...")

    from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
    from ag402_core.wallet.agent_wallet import AgentWallet

    wallet = AgentWallet(db_path=os.path.expanduser("~/.ag402/devnet_buyer_test.db"))
    await wallet.init_db()

    # Deposit budget into local wallet ledger
    ledger_balance = await wallet.get_balance()
    if ledger_balance < 1.0:
        await wallet.deposit(100.0, note="Devnet test budget")
        log("WALLET", "Deposited $100 test budget to local ledger")

    mw = X402PaymentMiddleware(
        wallet=wallet,
        provider=provider,
        config=x402_cfg,
    )

    t0 = time.monotonic()
    result = await asyncio.wait_for(
        mw.handle_request(
            method="GET",
            url=f"{GATEWAY_URL}/audit/{BONK_MINT}",
        ),
        timeout=120,
    )
    elapsed = time.monotonic() - t0

    if result.status_code == 200 and result.payment_made:
        report = json.loads(result.body)
        log("PASS", f"Audit report received! (status {result.status_code}, {elapsed:.1f}s)")
        log("PAY", f"Amount paid: ${result.amount_paid} USDC")
        log("PAY", f"TX hash: {result.tx_hash}")
        log("PAY", f"Solscan: https://solscan.io/tx/{result.tx_hash}?cluster=devnet")
        print()
        log("REPORT", f"Token: {report['evidence'].get('token_name')} ({report['evidence'].get('token_symbol')})")
        log("REPORT", f"Risk Level: {report['action']['risk_level']}")
        log("REPORT", f"Risk Score: {report['action']['risk_score']}/100")
        log("REPORT", f"Safe: {report['action']['is_safe']}")
        log("REPORT", f"Sources: {', '.join(report['metadata']['data_sources'])}")
        log("REPORT", f"Completeness: {report['metadata']['data_completeness']}")
        log("REPORT", f"Response Time: {report['metadata']['response_time_ms']}ms")
    else:
        body_text = result.body.decode() if isinstance(result.body, bytes) else str(result.body)
        log("FAIL", f"Expected 200+payment, got status={result.status_code} paid={result.payment_made}")
        log("FAIL", f"Body: {body_text[:500]}")
        if result.error:
            log("FAIL", f"Error: {result.error}")
        errors += 1

    # --- Step 5: Verify balances after payment ---
    log("STEP 5", "Checking post-payment balances...")
    post_balance = await provider.check_balance()
    log("BALANCE", f"Buyer USDC after: {post_balance} (was {balance})")
    log("BALANCE", f"Spent: {balance - post_balance} USDC")

    # --- Summary ---
    print()
    print("=" * 64)
    if errors == 0:
        print("  ALL TESTS PASSED — Devnet payment flow verified!")
    else:
        print(f"  {errors} TEST(S) FAILED")
    print("=" * 64)
    print()

    sys.exit(errors)


if __name__ == "__main__":
    asyncio.run(main())
