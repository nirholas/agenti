"""
CrewAI Integration Example — ag402 x402 Auto-Payment

Demonstrates how to equip a CrewAI crew with tools that call x402-protected
APIs. ag402 patches httpx/requests at process level — crew tools contain no
payment logic.

## Run this example in 3 steps

Step 1 — Install dependencies:
    pip install ag402-core ag402-mcp crewai httpx

Step 2 — Start local demo servers (in a separate terminal):
    python examples/start_local_demo.py

Step 3 — Run this file:
    OPENAI_API_KEY=sk-... python examples/crewai_integration.py

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

# CrewAI imports — install with: pip install crewai
try:
    from crewai import Agent, Crew, Process, Task
    from crewai.tools import tool
except ImportError as e:
    raise ImportError(
        "CrewAI not installed. Run: pip install crewai"
    ) from e


# ---------------------------------------------------------------------------
# Step 1: Enable ag402 auto-payment (one line — before any tool calls)
# ---------------------------------------------------------------------------

ag402_core.enable()

# ---------------------------------------------------------------------------
# Step 2: Define CrewAI tools that call x402-protected APIs
# ---------------------------------------------------------------------------


@tool("Weather Data Tool")
def get_weather(city: str) -> str:
    """Fetch current weather conditions for a given city.

    Returns temperature (°C) and weather conditions.
    Served by start_local_demo.py on :18001. For production:
    replace with any real x402-protected URL.
    """
    url = "http://localhost:18001/weather"
    resp = httpx.get(url, params={"city": city})
    resp.raise_for_status()
    data = resp.json()
    return f"{data['city']}: {data['temp']}°C, {data['condition']}"


@tool("Market Data Tool")
def get_market_data(symbol: str) -> str:
    """Fetch latest market data for a stock or crypto symbol."""
    url = "http://localhost:18001/market"
    resp = httpx.get(url, params={"symbol": symbol.upper()})
    resp.raise_for_status()
    return json.dumps(resp.json())


# ---------------------------------------------------------------------------
# Step 3: Define Agents and Tasks — no ag402-specific code needed
# ---------------------------------------------------------------------------


def build_crew() -> Crew:
    weather_researcher = Agent(
        role="Weather Researcher",
        goal="Gather accurate, real-time weather data for multiple cities",
        backstory=(
            "You are an expert meteorologist with access to real-time weather APIs. "
            "You retrieve precise weather data and present it clearly."
        ),
        tools=[get_weather],
        verbose=True,
    )

    market_analyst = Agent(
        role="Market Analyst",
        goal="Retrieve and summarize current market data for key assets",
        backstory=(
            "You are a financial analyst with access to live market data feeds. "
            "You retrieve prices and interpret market conditions."
        ),
        tools=[get_market_data],
        verbose=True,
    )

    reporter = Agent(
        role="Report Writer",
        goal="Synthesize weather and market data into a concise daily briefing",
        backstory=(
            "You are a professional analyst who turns raw data into "
            "clear, actionable briefings for decision makers."
        ),
        verbose=True,
    )

    # Tasks
    weather_task = Task(
        description="Fetch current weather for Tokyo, London, and New York.",
        expected_output="Weather summary for all three cities (temp + conditions).",
        agent=weather_researcher,
    )

    market_task = Task(
        description="Fetch current market data for BTC, ETH, and SOL.",
        expected_output="Price and 24h change for all three assets.",
        agent=market_analyst,
    )

    report_task = Task(
        description=(
            "Write a concise daily briefing combining the weather and market data. "
            "Highlight any notable conditions or market movements."
        ),
        expected_output="A 3–5 sentence daily briefing.",
        agent=reporter,
        context=[weather_task, market_task],
    )

    return Crew(
        agents=[weather_researcher, market_analyst, reporter],
        tasks=[weather_task, market_task, report_task],
        process=Process.sequential,
        verbose=True,
    )


# ---------------------------------------------------------------------------
# Step 4: Run the crew
# ---------------------------------------------------------------------------


def main() -> None:
    print("\n=== ag402 + CrewAI Demo ===\n")
    print("ag402 is active — HTTP 402 responses will be auto-paid.\n")

    crew = build_crew()
    result = crew.kickoff()

    print("\n--- Daily Briefing ---")
    print(result.raw)

    ag402_core.disable()


if __name__ == "__main__":
    main()
