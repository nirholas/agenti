"""Minimal test to diagnose gateway hang in pytest."""
from __future__ import annotations

import asyncio
import time
import uuid
from unittest.mock import AsyncMock

import httpx
import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_asgi_transport_basic():
    """Simplest possible ASGITransport test — no gateway involved."""
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    app = FastAPI()

    @app.get("/ping")
    async def ping():
        return JSONResponse(content={"pong": True})

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/ping")

    assert resp.status_code == 200
    assert resp.json() == {"pong": True}


@pytest.mark.asyncio
async def test_gateway_handler_minimal(tmp_path):
    """Gateway test — minimal, same as debug script that works standalone."""
    from ag402_core.gateway.auth import PaymentVerifier
    from ag402_mcp.gateway import X402Gateway

    replay_db = str(tmp_path / "replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        address="TestAddr111",
        verifier=PaymentVerifier(),
        replay_db_path=replay_db,
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()

    mock_resp = httpx.Response(
        200, content=b'{"ok":true}',
        headers={"content-type": "application/json"},
    )
    mock_client = AsyncMock()
    mock_client.request.return_value = mock_resp
    mock_client.aclose = AsyncMock()
    gateway._http_client = mock_client

    tx = f"tx_{uuid.uuid4().hex[:8]}"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testgw") as client:
        resp = await asyncio.wait_for(
            client.get(
                "/weather",
                headers={
                    "Authorization": f"x402 {tx}",
                    "X-x402-Timestamp": str(int(time.time())),
                    "X-x402-Nonce": uuid.uuid4().hex,
                },
            ),
            timeout=5.0,
        )

    assert resp.status_code == 200
    await gateway._persistent_guard.close()
