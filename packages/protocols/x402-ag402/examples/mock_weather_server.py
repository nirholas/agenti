"""
Mock Weather Server -- simple FastAPI service that returns weather data.

This is the "upstream service" that the x402 gateway protects.
No authentication -- the gateway handles that.

Usage:
    uvicorn examples.mock_weather_server:app --port 8000
    # or
    python examples/mock_weather_server.py
"""

from __future__ import annotations

import random

from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Mock Weather Service",
    description="Simple weather API for x402 demo -- no auth required",
)

# Pre-defined weather data for demo cities
WEATHER_DATA: dict[str, dict] = {
    "tokyo": {"city": "Tokyo", "temp": 22, "condition": "sunny"},
    "london": {"city": "London", "temp": 14, "condition": "cloudy"},
    "new york": {"city": "New York", "temp": 18, "condition": "partly cloudy"},
    "paris": {"city": "Paris", "temp": 16, "condition": "rainy"},
    "sydney": {"city": "Sydney", "temp": 26, "condition": "sunny"},
    "beijing": {"city": "Beijing", "temp": 20, "condition": "hazy"},
    "berlin": {"city": "Berlin", "temp": 12, "condition": "overcast"},
    "mumbai": {"city": "Mumbai", "temp": 32, "condition": "humid"},
    "san francisco": {"city": "San Francisco", "temp": 17, "condition": "foggy"},
    "singapore": {"city": "Singapore", "temp": 30, "condition": "thunderstorm"},
}

CONDITIONS = ["sunny", "cloudy", "rainy", "partly cloudy", "foggy", "windy"]


@app.get("/weather")
async def get_weather(city: str = "Tokyo") -> JSONResponse:
    """Return weather data for a given city."""
    key = city.lower().strip()
    if key in WEATHER_DATA:
        data = WEATHER_DATA[key]
    else:
        # Generate random weather for unknown cities
        data = {
            "city": city,
            "temp": random.randint(5, 35),
            "condition": random.choice(CONDITIONS),
        }
    return JSONResponse(content=data)


@app.get("/health")
async def health_check() -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse(content={"status": "ok", "service": "mock-weather"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
