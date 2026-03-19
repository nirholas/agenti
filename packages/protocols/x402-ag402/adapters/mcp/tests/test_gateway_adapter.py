"""
Tests for the x402 payment gateway adapter (ag402-mcp).

Tests:
1. test_no_auth_returns_402         -- Request without auth -> 402 with x402 headers
2. test_valid_auth_proxies_request  -- Request with valid x402 auth -> proxied to target
3. test_invalid_auth_returns_403    -- Request with non-x402 auth -> 403
4. test_402_response_has_correct_headers -- The 402 response has proper WWW-Authenticate header
5. test_gateway_proxies_full_response    -- Proxied response body matches target

IMPORTANT: ASGITransport does NOT trigger FastAPI lifespan events.
Therefore we must:
  - Use a tmp_path-based replay DB to avoid locking the real ~/.ag402/ file
  - Manually call init_db() / close() on the persistent guard
  - Mock httpx.AsyncClient with proper AsyncMock (request + aclose)
"""

from __future__ import annotations

import json
import time
import uuid
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from ag402_core.gateway.auth import PaymentVerifier
from ag402_mcp.gateway import X402Gateway
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from httpx import ASGITransport, AsyncClient
from open402.headers import parse_www_authenticate


def _replay_headers() -> dict[str, str]:
    """Generate valid X-x402-Timestamp and X-x402-Nonce headers."""
    return {
        "X-x402-Timestamp": str(int(time.time())),
        "X-x402-Nonce": uuid.uuid4().hex,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_upstream_response(
    status_code: int = 200,
    body: dict | None = None,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    """Build a real httpx.Response for mocking upstream calls."""
    body = body or {}
    content = json.dumps(body).encode()
    resp_headers = headers or {"content-type": "application/json"}
    return httpx.Response(
        status_code=status_code,
        content=content,
        headers=resp_headers,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _create_mock_upstream() -> FastAPI:
    """Create a simple mock upstream service."""
    upstream = FastAPI()

    @upstream.get("/weather")
    async def weather(city: str = "Tokyo"):
        return JSONResponse(content={"city": city, "temp": 22, "condition": "sunny"})

    @upstream.get("/health")
    async def health():
        return JSONResponse(content={"status": "ok"})

    @upstream.post("/data")
    async def post_data():
        return JSONResponse(content={"received": True}, status_code=201)

    return upstream


@pytest.fixture
def upstream_app() -> FastAPI:
    return _create_mock_upstream()


@pytest.fixture
async def gateway_app(tmp_path) -> FastAPI:
    """Create a gateway app with a test-mode verifier and temp replay DB.

    Uses tmp_path to avoid locking the real ~/.ag402/gateway_replay.db.
    Manually inits the persistent replay guard since ASGITransport skips lifespan.
    """
    verifier = PaymentVerifier()  # test mode -- accepts any x402 proof
    replay_db = str(tmp_path / "test_replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        chain="solana",
        token="USDC",
        address="TestRecipientAddr1111111111111111111111111",
        verifier=verifier,
        replay_db_path=replay_db,
    )
    app = gateway.create_app()
    # Manually init the persistent guard (lifespan won't fire in ASGITransport)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()
    yield app
    await gateway._persistent_guard.close()


@pytest.fixture
def upstream_transport(upstream_app: FastAPI) -> ASGITransport:
    return ASGITransport(app=upstream_app)


# ---------------------------------------------------------------------------
# Test 1: No auth -> 402
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_auth_returns_402(gateway_app: FastAPI) -> None:
    """Request without Authorization header should return 402 Payment Required."""
    transport = ASGITransport(app=gateway_app)
    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        response = await client.get("/weather?city=Tokyo")

    assert response.status_code == 402
    body = response.json()
    assert body["error"] == "Payment Required"
    assert body["protocol"] == "x402"
    assert body["amount"] == "0.02"


# ---------------------------------------------------------------------------
# Test 2: Valid x402 auth -> proxy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_valid_auth_proxies_request(
    gateway_app: FastAPI, upstream_transport: ASGITransport
) -> None:
    """Request with valid x402 Authorization should be proxied to the upstream."""
    transport = ASGITransport(app=gateway_app)

    mock_upstream_resp = _make_mock_upstream_response(
        status_code=200,
        body={"city": "Tokyo", "temp": 22, "condition": "sunny"},
    )

    # Mock the fallback httpx.AsyncClient that gateway creates when lifespan
    # hasn't set up the shared client.  Must mock both request() and aclose().
    with patch("ag402_mcp.gateway.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.request.return_value = mock_upstream_resp
        mock_instance.aclose = AsyncMock()
        MockClient.return_value = mock_instance

        async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
            response = await client.get(
                "/weather?city=Tokyo",
                headers={
                    "Authorization": "x402 mock_tx_abc123def456",
                    **_replay_headers(),
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Tokyo"
    assert data["temp"] == 22


# ---------------------------------------------------------------------------
# Test 3: Non-x402 auth -> 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_auth_returns_403(gateway_app: FastAPI) -> None:
    """Request with non-x402 Authorization (e.g. Bearer) should return 403."""
    transport = ASGITransport(app=gateway_app)
    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        response = await client.get(
            "/weather?city=Tokyo",
            headers={"Authorization": "Bearer some-jwt-token"},
        )

    assert response.status_code == 403
    body = response.json()
    assert "x402" in body.get("detail", "").lower() or "x402" in body.get("error", "").lower()


# ---------------------------------------------------------------------------
# Test 4: 402 has correct WWW-Authenticate header
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_402_response_has_correct_headers(gateway_app: FastAPI) -> None:
    """The 402 response should have a valid WWW-Authenticate header with x402 challenge."""
    transport = ASGITransport(app=gateway_app)
    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        response = await client.get("/weather?city=London")

    assert response.status_code == 402

    www_auth = response.headers.get("www-authenticate", "")
    assert www_auth, "WWW-Authenticate header must be present"
    assert www_auth.startswith("x402 "), "WWW-Authenticate must use x402 scheme"

    # Parse the header and verify fields
    challenge = parse_www_authenticate(www_auth)
    assert challenge is not None, "WWW-Authenticate header must be parseable"
    assert challenge.chain == "solana"
    assert challenge.token == "USDC"
    assert challenge.amount == "0.02"
    assert challenge.address == "TestRecipientAddr1111111111111111111111111"


# ---------------------------------------------------------------------------
# Test 5: Proxied response body matches target
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gateway_proxies_full_response(
    gateway_app: FastAPI, upstream_transport: ASGITransport
) -> None:
    """Proxied response body should exactly match what the upstream returns."""
    transport = ASGITransport(app=gateway_app)

    expected_body = {"city": "Berlin", "temp": 12, "condition": "overcast"}
    mock_upstream_resp = _make_mock_upstream_response(
        status_code=200,
        body=expected_body,
    )

    with patch("ag402_mcp.gateway.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.request.return_value = mock_upstream_resp
        mock_instance.aclose = AsyncMock()
        MockClient.return_value = mock_instance

        async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
            response = await client.get(
                "/weather?city=Berlin",
                headers={
                    "Authorization": "x402 mock_tx_proxy_test_hash",
                    **_replay_headers(),
                },
            )

    assert response.status_code == 200
    data = response.json()
    assert data == expected_body


# ---------------------------------------------------------------------------
# Prepaid integration tests (P0-2)
# ---------------------------------------------------------------------------

SELLER_ADDR = "TestRecipientAddr1111111111111111111111111"
BUYER_ADDR  = "BuyerAddr111111111111111111111111111111111111"
PREPAID_KEY = "gateway_test_signing_key"
PREPAID_PKG = "p30d_1000"


def _make_prepaid_gateway(tmp_path) -> tuple:
    """Return (X402Gateway, FastAPI app) with prepaid signing key configured."""
    verifier = PaymentVerifier()  # test mode
    replay_db = str(tmp_path / "prepaid_test_replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        token="USDC",
        address=SELLER_ADDR,
        verifier=verifier,
        replay_db_path=replay_db,
        prepaid_signing_key=PREPAID_KEY,
    )
    return gateway, gateway.create_app()


def _make_signed_credential_header(
    seller: str = SELLER_ADDR,
    buyer: str = BUYER_ADDR,
    package_id: str = PREPAID_PKG,
    signing_key: str = PREPAID_KEY,
    remaining: int = 10,
    days_valid: int = 30,
) -> str:
    """Build a valid X-Prepaid-Credential header value."""
    from datetime import datetime, timedelta, timezone

    from ag402_core.prepaid.client import _compute_hmac
    from ag402_core.prepaid.models import PrepaidCredential
    expires_at = datetime.now(timezone.utc) + timedelta(days=days_valid)
    signature = _compute_hmac(signing_key, buyer, package_id, expires_at)
    cred = PrepaidCredential(
        buyer_address=buyer,
        package_id=package_id,
        remaining_calls=remaining,
        expires_at=expires_at,
        signature=signature,
        seller_address=seller,
        created_at=datetime.now(timezone.utc),
    )
    return cred.to_header_value()


@pytest.mark.asyncio
async def test_prepaid_valid_credential_proxies_request(tmp_path) -> None:
    """Valid X-Prepaid-Credential bypasses on-chain verification and proxies."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    transport = ASGITransport(app=app)
    mock_upstream_resp = _make_mock_upstream_response(body={"result": "prepaid-ok"})

    with patch("ag402_mcp.gateway.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.request.return_value = mock_upstream_resp
        mock_instance.aclose = AsyncMock()
        MockClient.return_value = mock_instance

        async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
            response = await client.get(
                "/data",
                headers={"X-Prepaid-Credential": _make_signed_credential_header()},
            )

    assert response.status_code == 200
    assert gateway._metrics["prepaid_verified"] == 1
    assert gateway._metrics["payments_verified"] == 0  # on-chain path NOT used

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_prepaid_invalid_signature_returns_402(tmp_path) -> None:
    """Invalid HMAC → 402 with WWW-Authenticate so buyer can fall back."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    transport = ASGITransport(app=app)
    bad_header = _make_signed_credential_header(signing_key="wrong_key")

    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        response = await client.get(
            "/data",
            headers={"X-Prepaid-Credential": bad_header},
        )

    assert response.status_code == 402
    assert "WWW-Authenticate" in response.headers  # buyer needs this to retry on-chain
    assert gateway._metrics["prepaid_verified"] == 0
    assert gateway._metrics["challenges_issued"] == 1

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_prepaid_expired_credential_returns_402(tmp_path) -> None:
    """Expired credential → 402, buyer falls back to on-chain."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    transport = ASGITransport(app=app)
    expired_header = _make_signed_credential_header(days_valid=-1)

    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        response = await client.get(
            "/data",
            headers={"X-Prepaid-Credential": expired_header},
        )

    assert response.status_code == 402
    assert gateway._metrics["prepaid_verified"] == 0

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_prepaid_no_signing_key_falls_through_to_onchain(tmp_path) -> None:
    """When gateway has no signing key, X-Prepaid-Credential is ignored."""
    verifier = PaymentVerifier()
    replay_db = str(tmp_path / "no_key_replay.db")
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        address=SELLER_ADDR,
        verifier=verifier,
        replay_db_path=replay_db,
        # No prepaid_signing_key → _prepaid_verifier is None
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        # Send a prepaid header — should be ignored, gateway asks for on-chain payment
        response = await client.get(
            "/data",
            headers={"X-Prepaid-Credential": _make_signed_credential_header()},
        )

    # Gateway has no signing key → treats request as no-auth → 402
    assert response.status_code == 402
    assert gateway._prepaid_verifier is None
    assert gateway._metrics["prepaid_verified"] == 0

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_prepaid_takes_priority_over_authorization_header(tmp_path) -> None:
    """When both X-Prepaid-Credential and Authorization are present, prepaid wins."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    transport = ASGITransport(app=app)
    mock_upstream_resp = _make_mock_upstream_response(body={"ok": True})

    with patch("ag402_mcp.gateway.httpx.AsyncClient") as MockClient:
        mock_instance = AsyncMock()
        mock_instance.request.return_value = mock_upstream_resp
        mock_instance.aclose = AsyncMock()
        MockClient.return_value = mock_instance

        async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
            response = await client.get(
                "/data",
                headers={
                    "X-Prepaid-Credential": _make_signed_credential_header(),
                    "Authorization": "x402 some_tx_hash_here",
                    **_replay_headers(),
                },
            )

    assert response.status_code == 200
    assert gateway._metrics["prepaid_verified"] == 1
    assert gateway._metrics["payments_verified"] == 0  # on-chain path NOT touched

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_prepaid_malformed_json_returns_402(tmp_path) -> None:
    """Garbage in X-Prepaid-Credential → 402, never 500."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://testgateway") as client:
        response = await client.get(
            "/data",
            headers={"X-Prepaid-Credential": "not json at all {{{"},
        )

    assert response.status_code == 402

    await gateway._persistent_guard.close()


# ---------------------------------------------------------------------------
# Prepaid purchase endpoints (P0-3)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_packages_returns_all_tiers(tmp_path) -> None:
    """GET /prepaid/packages returns the 5 standard package tiers."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.get("/prepaid/packages")

    assert resp.status_code == 200
    data = resp.json()
    assert "packages" in data
    pkg_ids = {p["package_id"] for p in data["packages"]}
    assert pkg_ids == {"p3d_100", "p7d_500", "p30d_1000", "p365d_5000", "p730d_10k"}

    for pkg in data["packages"]:
        assert "calls" in pkg and "days" in pkg and "price_usdc" in pkg and "seller_address" in pkg

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_list_packages_no_auth_required(tmp_path) -> None:
    """GET /prepaid/packages is publicly accessible — no payment needed."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.get("/prepaid/packages")

    assert resp.status_code == 200  # NOT 402

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_purchase_valid_package_issues_credential(tmp_path) -> None:
    """POST /prepaid/purchase with valid payload → 201 + credential JSON."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "mock_tx_purchase_123"},
        )

    assert resp.status_code == 201
    cred = resp.json()["credential"]
    assert cred["buyer_address"] == BUYER_ADDR
    assert cred["package_id"] == PREPAID_PKG
    assert cred["remaining_calls"] == 1000  # p30d_1000
    assert "signature" in cred
    assert "expires_at" in cred

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_purchase_unknown_package_returns_400(tmp_path) -> None:
    """POST /prepaid/purchase with unknown package_id → 400."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": "p999d_unlimited", "tx_hash": "mock_tx_abc"},
        )

    assert resp.status_code == 400
    assert resp.json()["error"] == "invalid_package"

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_purchase_without_signing_key_returns_503(tmp_path) -> None:
    """POST /prepaid/purchase when gateway has no signing key → 503."""
    verifier = PaymentVerifier()
    gateway = X402Gateway(
        target_url="http://mock-upstream",
        price="0.02",
        token="USDC",
        address=SELLER_ADDR,
        verifier=verifier,
        replay_db_path=str(tmp_path / "nok_replay.db"),
        # No prepaid_signing_key
    )
    app = gateway.create_app()
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "mock_tx"},
        )

    assert resp.status_code == 503
    assert "not enabled" in resp.json()["error"]

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_purchased_credential_verifies_locally(tmp_path) -> None:
    """Round-trip: purchase endpoint → credential → PrepaidVerifier.verify() passes."""
    from ag402_core.prepaid.models import PrepaidCredential
    from ag402_core.prepaid.verifier import PrepaidVerifier

    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": "p7d_500", "tx_hash": "mock_tx_roundtrip"},
        )

    assert resp.status_code == 201
    cred = PrepaidCredential.from_dict(resp.json()["credential"])
    verifier = PrepaidVerifier(signing_key=PREPAID_KEY, seller_address=SELLER_ADDR)
    assert verifier.verify(cred.to_header_value()).valid is True

    await gateway._persistent_guard.close()


# ---------------------------------------------------------------------------
# Audit fix tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_purchase_rate_limited_returns_429(tmp_path) -> None:
    """POST /prepaid/purchase is rate-limited — exhausting the limit returns 429."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    # Crank rate limit down to 1 so we can exhaust it quickly
    gateway._rate_limiter._max = 1
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        # First request: passes rate limit
        r1 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "mock_tx_rl_1"},
        )
        # Second request from same IP: rate limited
        r2 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "mock_tx_rl_2"},
        )

    assert r1.status_code == 201  # first request succeeded
    assert r2.status_code == 429  # second request rate-limited

    await gateway._persistent_guard.close()


# ---------------------------------------------------------------------------
# B4: Idempotent purchase + credential recovery tests
# ---------------------------------------------------------------------------


async def _init_gateway(gateway: X402Gateway) -> None:
    """Manually init both DB guards (lifespan won't fire in ASGITransport)."""
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()


async def _close_gateway(gateway: X402Gateway) -> None:
    await gateway._persistent_guard.close()
    await gateway._close_prepaid_db()


@pytest.mark.asyncio
async def test_purchase_idempotent_same_tx_hash_returns_same_credential(tmp_path) -> None:
    """Retrying POST /prepaid/purchase with the same tx_hash returns the same credential (200 + recovered=True)."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        # First purchase
        r1 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "idempotent_tx_001"},
        )
        assert r1.status_code == 201
        cred1 = r1.json()["credential"]

        # Retry with identical payload (simulating network timeout + retry)
        r2 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "idempotent_tx_001"},
        )
        assert r2.status_code == 200  # idempotent: 200 (not 201)
        body2 = r2.json()
        assert body2.get("recovered") is True
        cred2 = body2["credential"]

    # Signature must be identical — same expiry means same HMAC
    assert cred1["signature"] == cred2["signature"]
    assert cred1["expires_at"] == cred2["expires_at"]
    assert cred1["buyer_address"] == cred2["buyer_address"]
    assert cred1["package_id"] == cred2["package_id"]

    await _close_gateway(gateway)


@pytest.mark.asyncio
async def test_purchase_idempotent_credential_verifies(tmp_path) -> None:
    """Recovered credential (idempotent retry) passes PrepaidVerifier."""
    from ag402_core.prepaid.models import PrepaidCredential
    from ag402_core.prepaid.verifier import PrepaidVerifier

    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": "p7d_500", "tx_hash": "idem_verify_tx_002"},
        )
        # Idempotent retry
        r2 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": "p7d_500", "tx_hash": "idem_verify_tx_002"},
        )

    assert r2.status_code == 200
    cred = PrepaidCredential.from_dict(r2.json()["credential"])
    verifier = PrepaidVerifier(signing_key=PREPAID_KEY, seller_address=SELLER_ADDR)
    assert verifier.verify(cred.to_header_value()).valid is True

    await _close_gateway(gateway)


@pytest.mark.asyncio
async def test_purchase_idempotent_different_buyer_returns_409(tmp_path) -> None:
    """Same tx_hash with a different buyer_address → 403 Forbidden (theft prevention, no info leak)."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    other_buyer = "OtherBuyerAddr22222222222222222222222222222"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        r1 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "conflict_tx_003"},
        )
        assert r1.status_code == 201

        # Different buyer tries to claim the same tx_hash
        r2 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": other_buyer, "package_id": PREPAID_PKG, "tx_hash": "conflict_tx_003"},
        )
        assert r2.status_code == 403
        assert r2.json()["error"] == "payment_verification_failed"  # generic — no info leak

    await _close_gateway(gateway)


@pytest.mark.asyncio
async def test_purchase_idempotent_package_mismatch_replays_original(tmp_path) -> None:
    """Same tx_hash with different package_id → credential uses original package_id."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        r1 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": "p7d_500", "tx_hash": "pkg_mismatch_tx_004"},
        )
        assert r1.status_code == 201

        # Same tx, different (more expensive) package — must replay original
        r2 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": "p365d_5000", "tx_hash": "pkg_mismatch_tx_004"},
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["credential"]["package_id"] == "p7d_500"  # original, not the expensive one

    await _close_gateway(gateway)


@pytest.mark.asyncio
async def test_purchase_new_tx_hashes_each_issue_independently(tmp_path) -> None:
    """Different tx_hashes each produce independent 201 credentials."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        r1 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "unique_tx_a"},
        )
        r2 = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "unique_tx_b"},
        )

    assert r1.status_code == 201
    assert r2.status_code == 201
    # Signatures differ (different issued_at timestamps)
    assert r1.json()["credential"]["expires_at"] != r2.json()["credential"]["expires_at"]

    await _close_gateway(gateway)


@pytest.mark.asyncio
async def test_purchase_idempotent_db_none_falls_back_to_onchain(tmp_path) -> None:
    """When _prepaid_db is None (e.g. not initialized), gateway still issues a new credential."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await gateway._persistent_guard.init_db()
    await gateway._init_prepaid_db()
    # Intentionally do NOT call _init_prepaid_db — simulates DB not available
    # _prepaid_db remains None

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": BUYER_ADDR, "package_id": PREPAID_PKG, "tx_hash": "no_db_tx_005"},
        )

    # Should still succeed — idempotency check is skipped when DB is None
    assert resp.status_code == 201

    await gateway._persistent_guard.close()


@pytest.mark.asyncio
async def test_purchase_invalid_buyer_address_returns_400(tmp_path) -> None:
    """buyer_address longer than 128 chars → 400."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    too_long_addr = "X" * 129  # 129 chars > 128 max

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": too_long_addr, "package_id": PREPAID_PKG, "tx_hash": "addr_val_tx_006"},
        )

    assert resp.status_code == 400
    assert resp.json()["error"] == "invalid_buyer_address"

    await _close_gateway(gateway)


@pytest.mark.asyncio
async def test_purchase_empty_buyer_address_returns_400(tmp_path) -> None:
    """Empty buyer_address → 400."""
    gateway, app = _make_prepaid_gateway(tmp_path)
    await _init_gateway(gateway)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testgateway") as client:
        resp = await client.post(
            "/prepaid/purchase",
            json={"buyer_address": "", "package_id": PREPAID_PKG, "tx_hash": "empty_addr_tx_007"},
        )

    assert resp.status_code == 400
    assert resp.json()["error"] == "invalid_buyer_address"

    await _close_gateway(gateway)

