"""
AutoGen Integration Example — ag402 x402 Auto-Payment

Demonstrates how to give an AutoGen agent the ability to call x402-protected
APIs. ag402 monkey-patches httpx and requests at the process level — AutoGen
tool functions require no payment logic.

## Run this example in 3 steps

Step 1 — Install dependencies:
    pip install ag402-core ag402-mcp pyautogen httpx

Step 2 — Start local demo servers (in a separate terminal):
    python examples/start_local_demo.py

Step 3 — Run this file:
    OPENAI_API_KEY=sk-... python examples/autogen_integration.py

The local demo server starts a mock weather API on :18000 and an x402 payment
gateway on :18001. ag402 intercepts any 402 from :18001, pays, and retries.

## Production use

Replace `http://localhost:18001/...` with any real x402-protected API URL.
"""

# ==============================================================
# PREREQUISITES — start the local demo server first
# ==============================================================
# This example connects to two local services that must be
# running BEFORE you execute this file.  If they are not
# running you will get a connection error immediately.
#
# In a separate terminal, run:
#
#     python examples/start_local_demo.py
#
# That command starts:
#   - http://127.0.0.1:18000  Mock weather API (upstream, no auth)
#   - http://127.0.0.1:18001  x402 payment gateway (requires $0.01 USDC)
#
# Leave start_local_demo.py running, then come back and run
# this file in a different terminal.
# ==============================================================

from __future__ import annotations

import json
import os

import ag402_core
import httpx

# AutoGen imports — install with: pip install pyautogen
try:
    from autogen import AssistantAgent, UserProxyAgent
except ImportError as e:
    raise ImportError(
        "AutoGen not installed. Run: pip install pyautogen"
    ) from e


# ---------------------------------------------------------------------------
# Step 1: Enable ag402 auto-payment
# ---------------------------------------------------------------------------

ag402_core.enable()

# ---------------------------------------------------------------------------
# Step 2: Register tools on the AutoGen agents
# ---------------------------------------------------------------------------

llm_config = {
    "config_list": [
        {
            "model": "gpt-4o-mini",
            "api_key": os.environ.get("OPENAI_API_KEY", ""),
        }
    ],
    "timeout": 60,
}

assistant = AssistantAgent(
    name="WeatherAssistant",
    llm_config=llm_config,
    system_message=(
        "You are a helpful assistant with access to real-time weather data. "
        "Use the get_weather tool to look up current conditions."
    ),
)

# UserProxyAgent executes tool calls — this is where httpx calls happen.
# ag402 intercepts any 402 response, pays, and retries transparently.
user_proxy = UserProxyAgent(
    name="User",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=3,
    code_execution_config=False,
)


@user_proxy.register_for_execution()
@assistant.register_for_llm(description="Get current weather for a city.")
def get_weather(city: str) -> str:
    """Fetch weather from :18001 (started by start_local_demo.py).

    The endpoint returns HTTP 402 without payment proof.
    ag402 handles the payment automatically.
    For production: replace with any real x402-protected URL.
    """
    url = "http://localhost:18001/weather"
    resp = httpx.get(url, params={"city": city})
    resp.raise_for_status()
    data = resp.json()
    return f"{data['city']}: {data['temp']}°C, {data['condition']}"


@user_proxy.register_for_execution()
@assistant.register_for_llm(description="Get market data for a symbol.")
def get_market_data(symbol: str) -> str:
    """Fetch market data from :18001 (started by start_local_demo.py)."""
    url = "http://localhost:18001/market"
    resp = httpx.get(url, params={"symbol": symbol.upper()})
    resp.raise_for_status()
    return json.dumps(resp.json())


# ---------------------------------------------------------------------------
# Step 3: Start the conversation — AutoGen handles the rest
# ---------------------------------------------------------------------------


def main() -> None:
    print("\n=== ag402 + AutoGen Demo ===\n")
    print("ag402 is active — HTTP 402 responses will be auto-paid.\n")

    user_proxy.initiate_chat(
        assistant,
        message="What's the weather in Tokyo, London, and Sydney right now?",
    )

    ag402_core.disable()


if __name__ == "__main__":
    main()
