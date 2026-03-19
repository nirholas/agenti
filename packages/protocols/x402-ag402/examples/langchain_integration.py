"""
LangChain Integration Example — ag402 x402 Auto-Payment

Demonstrates how to give a LangChain agent the ability to call x402-protected
APIs without any manual payment code. ag402 intercepts HTTP 402 responses,
auto-pays, and retries — the tool function sees only the final 200 response.

## Run this example in 3 steps

Step 1 — Install dependencies:
    pip install ag402-core ag402-mcp langchain langchain-openai httpx

Step 2 — Start local demo servers (in a separate terminal):
    python examples/start_local_demo.py

Step 3 — Run this file:
    OPENAI_API_KEY=sk-... python examples/langchain_integration.py

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

import ag402_core
import httpx

# LangChain imports — install with: pip install langchain langchain-openai
try:
    from langchain.agents import AgentExecutor, create_tool_calling_agent
    from langchain.tools import tool
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI
except ImportError as e:
    raise ImportError(
        "LangChain not installed. Run: pip install langchain langchain-openai"
    ) from e


# ---------------------------------------------------------------------------
# Step 1: Enable ag402 auto-payment (one line — before any HTTP calls)
# ---------------------------------------------------------------------------

ag402_core.enable()

# ---------------------------------------------------------------------------
# Step 2: Define tools that call x402-protected APIs
#         No payment code needed — ag402 handles 402 transparently
# ---------------------------------------------------------------------------


@tool
def get_weather(city: str) -> str:
    """Get current weather for a city. Returns temperature and conditions."""
    # This URL is served by start_local_demo.py (port 18001).
    # ag402 intercepts the 402, pays $0.01 USDC (test mode), and retries.
    # For production: replace with any real x402-protected URL.
    url = "http://localhost:18001/weather"
    resp = httpx.get(url, params={"city": city})
    resp.raise_for_status()
    data = resp.json()
    return f"{data['city']}: {data['temp']}°C, {data['condition']}"


@tool
def get_market_data(symbol: str) -> str:
    """Get latest market data for a stock/crypto symbol."""
    # Replace with your own x402-protected market data API.
    url = "http://localhost:18001/market"
    resp = httpx.get(url, params={"symbol": symbol.upper()})
    resp.raise_for_status()
    return json.dumps(resp.json())


# ---------------------------------------------------------------------------
# Step 3: Build a standard LangChain agent — no ag402-specific code needed
# ---------------------------------------------------------------------------


def build_agent() -> AgentExecutor:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. Use tools to answer questions."),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])

    tools = [get_weather, get_market_data]
    agent = create_tool_calling_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=True)


def main() -> None:
    print("\n=== ag402 + LangChain Demo ===\n")
    print("ag402 is active — HTTP 402 responses will be auto-paid.\n")

    agent_executor = build_agent()

    # The agent will call get_weather() → httpx.get() → 402 → ag402 pays → 200
    result = agent_executor.invoke({
        "input": "What's the weather like in Tokyo and London right now?"
    })

    print("\n--- Agent Response ---")
    print(result["output"])

    # Disable when done (optional — process exit cleans up automatically)
    ag402_core.disable()


# ---------------------------------------------------------------------------
# Async variant — use with async LangChain chains
# ---------------------------------------------------------------------------


async def async_main() -> None:
    """Same demo using ainvoke() for async LangChain pipelines."""
    print("\n=== ag402 + LangChain (async) Demo ===\n")

    agent_executor = build_agent()
    result = await agent_executor.ainvoke({
        "input": "What's the weather like in Tokyo?"
    })
    print(result["output"])


if __name__ == "__main__":
    main()
    # Or for async: asyncio.run(async_main())
