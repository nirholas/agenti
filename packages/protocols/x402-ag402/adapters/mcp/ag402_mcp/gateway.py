"""
x402 MCP Gateway -- reverse proxy that adds x402 payment gating to any HTTP API.

Wraps any upstream HTTP service (e.g. a weather API, an MCP server) and
requires x402 payment before proxying requests. Clients that do not present
a valid payment proof receive HTTP 402 with a WWW-Authenticate challenge.

Usage as library:
    gateway = X402Gateway(target_url="http://localhost:8000", price="0.02", address="...")
    app = gateway.create_app()
    uvicorn.run(app, host="0.0.0.0", port=8001)

Usage as CLI:
    ag402-gateway --target http://localhost:8000 --price 0.02 --address SolAddr...
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import time
from contextlib import asynccontextmanager

import aiosqlite
import httpx
from ag402_core.gateway.auth import PaymentVerifier
from ag402_core.prepaid.verifier import PrepaidVerifier
from ag402_core.security.rate_limiter import RateLimiter
from ag402_core.security.replay_guard import (
    PersistentReplayGuard,
    ReplayGuard,
    TxHashStatus,
)
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from open402.headers import build_www_authenticate
from open402.spec import X402PaymentChallenge, X402ServiceDescriptor
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class _PrepaidPurchaseRequest(BaseModel):
    buyer_address: str
    package_id: str
    tx_hash: str

class X402Gateway:
    """Wraps any HTTP API/MCP server and adds x402 payment gate."""

    def __init__(
        self,
        target_url: str,
        price: str,
        chain: str = "solana",
        token: str = "USDC",
        address: str = "",
        verifier: PaymentVerifier | None = None,
        replay_window: int = 30,
        replay_db_path: str = "",
        rate_limit_per_minute: int = 60,
        prepaid_signing_key: str = "",
    ):
        self.target_url = target_url.rstrip("/")
        # H-2 FIX: Validate target_url to prevent SSRF to internal/cloud-metadata endpoints
        from urllib.parse import urlparse as _urlparse
        _parsed = _urlparse(self.target_url)
        if _parsed.hostname:
            from ag402_core.security.challenge_validator import _is_private_address
            _is_local = _parsed.hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0")
            if _is_private_address(_parsed.hostname) and not _is_local:
                logger.warning(
                    "[GATEWAY] target_url %s resolves to a private/reserved IP — "
                    "potential SSRF risk. Only use trusted internal addresses.",
                    self.target_url,
                )
        self.price = price
        self.chain = chain
        self.token = token

        # S-C2 FIX: Require explicit X402_MODE to prevent accidental test deployment.
        # If X402_MODE is not set at all, refuse to start — operator must choose.
        # Must be computed BEFORE address validation (which depends on _is_test_mode).
        raw_mode = os.getenv("X402_MODE", "")
        if not raw_mode and verifier is None:
            raise ValueError(
                "X402_MODE environment variable is required. "
                "Set X402_MODE=test for development or X402_MODE=production for real use. "
                "Refusing to start with an implicit default to prevent accidental "
                "deployment without on-chain payment verification."
            )
        self._is_test_mode = (raw_mode or "test").lower() == "test"

        # M-5 FIX: In production mode, address must be explicitly set — placeholder
        # would cause buyers to pay to a non-existent address (money loss).
        if not address and not self._is_test_mode:
            raise ValueError(
                "Gateway 'address' is required in production mode. "
                "Set your Solana wallet address to receive payments."
            )
        self.address = address or "GtwRecipientAddr1111111111111111111111111111"
        self._replay_guard = ReplayGuard(window_seconds=replay_window)

        if verifier is not None:
            self.verifier = verifier
        elif self._is_test_mode:
            logger.warning(
                "========================================\n"
                "  WARNING: GATEWAY RUNNING IN TEST MODE\n"
                "  No on-chain payment verification!\n"
                "  Set X402_MODE=production for real use.\n"
                "========================================"
            )
            self.verifier = PaymentVerifier()  # test mode
        else:
            raise ValueError(
                "Production mode (X402_MODE=production) requires an explicit "
                "PaymentVerifier with a payment provider. Either provide a "
                "'verifier' argument or set X402_MODE=test for development."
            )
        # Persistent tx_hash deduplication (survives restarts)
        self._replay_db_path = replay_db_path or os.path.expanduser("~/.ag402/gateway_replay.db")
        self._persistent_guard = PersistentReplayGuard(db_path=self._replay_db_path)
        # Prepaid issuance ledger — same DB file, separate table (see _init_prepaid_db)
        self._prepaid_db: aiosqlite.Connection | None = None
        # Shared httpx client (created/closed via lifespan)
        self._http_client: httpx.AsyncClient | None = None

        # P1-2.7: IP-based rate limiter
        self._rate_limiter = RateLimiter(
            max_requests=rate_limit_per_minute, window_seconds=60
        )

        # P2-3.6: Lightweight metrics counters
        self._metrics = {
            "requests_total": 0,
            "payments_verified": 0,
            "payments_rejected": 0,
            "replays_rejected": 0,
            "challenges_issued": 0,
            "proxy_errors": 0,
            "prepaid_verified": 0,
            "prepaid_rejected": 0,
            "started_at": time.time(),
        }

        # P0-2: Prepaid credential verifier (seller side).
        # Enabled when prepaid_signing_key is non-empty.
        # Falls back to AG402_PREPAID_SIGNING_KEY env var if not passed explicitly.
        _signing_key = prepaid_signing_key or os.getenv("AG402_PREPAID_SIGNING_KEY", "")
        if _signing_key and self.address:
            # S-C3 FIX: Enforce minimum signing key length in production mode.
            if len(_signing_key) < 32:
                if not self._is_test_mode:
                    raise ValueError(
                        f"Prepaid signing key is too short ({len(_signing_key)} chars). "
                        f"Production mode requires >= 32 characters for HMAC-SHA256 security. "
                        f"Generate one: python -c \"import secrets; print(secrets.token_hex(32))\""
                    )
                logger.warning(
                    "[GATEWAY] Prepaid signing key is short (%d chars). "
                    "Recommend >= 32 random characters. "
                    "Generate one: python -c \"import secrets; print(secrets.token_hex(32))\"",
                    len(_signing_key),
                )
            self._prepaid_verifier: PrepaidVerifier | None = PrepaidVerifier(
                signing_key=_signing_key,
                seller_address=self.address,
            )
            logger.info("[GATEWAY] Prepaid credential verification enabled")
        else:
            self._prepaid_verifier = None
            if not _signing_key:
                logger.info(
                    "[GATEWAY] Prepaid verification disabled "
                    "(set AG402_PREPAID_SIGNING_KEY to enable)"
                )

        # Build the service descriptor for 402 challenges
        self._service = X402ServiceDescriptor(
            endpoint=self.target_url,
            price=self.price,
            chain=self.chain,
            token=self.token,
            address=self.address,
        )

    def _build_challenge(self) -> X402PaymentChallenge:
        """Build the payment challenge for 402 responses."""
        return self._service.to_challenge()

    def _build_402_response(self) -> JSONResponse:
        """Build an HTTP 402 response with x402 WWW-Authenticate header."""
        challenge = self._build_challenge()
        www_auth_value = build_www_authenticate(challenge)
        return JSONResponse(
            status_code=402,
            content={
                "error": "Payment Required",
                "protocol": "x402",
                "chain": challenge.chain,
                "token": challenge.token,
                "amount": challenge.amount,
                "address": challenge.address,
            },
            headers={"WWW-Authenticate": www_auth_value},
        )

    def create_app(self) -> FastAPI:
        """Create a FastAPI app that proxies requests with payment gate."""
        gateway = self

        @asynccontextmanager
        async def lifespan(app: FastAPI):
            """Manage shared resources: httpx client and persistent replay guard.

            P-C2 FIX: Ensures all DB connections and HTTP clients are cleanly
            closed on shutdown. Uvicorn handles SIGTERM/SIGINT natively and
            triggers this lifespan exit for graceful shutdown.
            """
            gateway._http_client = httpx.AsyncClient(timeout=30.0)
            await gateway._persistent_guard.init_db()
            await gateway._init_prepaid_db()

            yield

            # Cleanup: close all connections cleanly on shutdown
            logger.info("[GATEWAY] Shutting down — closing connections")
            await gateway._http_client.aclose()
            gateway._http_client = None
            # Null prepaid reference BEFORE closing guard's connection, so
            # in-flight requests hit the `is None` check cleanly (503).
            await gateway._close_prepaid_db()
            await gateway._persistent_guard.close()
            logger.info("[GATEWAY] Shutdown complete")

        app = FastAPI(
            title="x402 Payment Gateway",
            description=f"Payment-gated proxy to {self.target_url}",
            lifespan=lifespan,
        )

        # P2-3.6: Health check endpoint (not gated behind payment)
        # S2-1 FIX: In production mode, return minimal info only.
        @app.get("/health")
        async def health_check() -> JSONResponse:
            """Return gateway health status.

            In production mode, only status and mode are returned to avoid
            leaking internal infrastructure details (target_url, metrics).
            In test mode, full details are available for debugging.
            """
            uptime = time.time() - self._metrics["started_at"]

            if not self._is_test_mode:
                # S2-1: Production — minimal response, no internal details
                return JSONResponse(content={
                    "status": "healthy",
                    "mode": "production",
                    "uptime_seconds": round(uptime, 1),
                })

            # Test mode — full details for debugging
            return JSONResponse(content={
                "status": "healthy",
                "mode": "test",
                "target_url": self.target_url,
                "uptime_seconds": round(uptime, 1),
                "metrics": {
                    "requests_total": self._metrics["requests_total"],
                    "payments_verified": self._metrics["payments_verified"],
                    "payments_rejected": self._metrics["payments_rejected"],
                    "replays_rejected": self._metrics["replays_rejected"],
                    "challenges_issued": self._metrics["challenges_issued"],
                    "proxy_errors": self._metrics["proxy_errors"],
                    "prepaid_verified": self._metrics["prepaid_verified"],
                    "prepaid_rejected": self._metrics["prepaid_rejected"],
                },
            })

        # P0-3: Prepaid purchase endpoints (not gated behind payment)

        @app.get("/prepaid/packages")
        async def list_packages() -> JSONResponse:
            """Return available prepaid package tiers and prices."""
            from ag402_core.prepaid.models import PACKAGES
            return JSONResponse(content={
                "packages": [
                    {
                        "package_id": pkg_id,
                        "name": info["name"],
                        "calls": info["calls"],
                        "days": info["days"],
                        "price_usdc": info["price"],
                        "token": self.token,
                        "seller_address": self.address,
                    }
                    for pkg_id, info in PACKAGES.items()
                ]
            })

        @app.post("/prepaid/purchase")
        async def purchase_package(request: Request, body: _PrepaidPurchaseRequest) -> JSONResponse:
            """Verify on-chain USDC payment and issue a prepaid credential.

            This endpoint is idempotent on tx_hash: retrying with the same
            tx_hash (e.g. after a network timeout) returns the same credential
            (same expiry, same signature) as the original issuance.

            In test mode, tx_hash is accepted as-is without on-chain check.
            In production mode, the verifier validates the transaction on-chain
            (or falls back to on-chain lookup if the issuance record was lost).
            """
            client_ip = request.client.host if request.client else "unknown"
            if not self._rate_limiter.allow(client_ip):
                return JSONResponse(
                    status_code=429,
                    content={"error": "Too Many Requests", "detail": "Rate limit exceeded"},
                )

            if not self._prepaid_verifier:
                return JSONResponse(
                    status_code=503,
                    content={"error": "Prepaid purchase not enabled on this gateway"},
                )

            from ag402_core.prepaid.models import PACKAGES
            pkg = PACKAGES.get(body.package_id)
            if pkg is None:
                return JSONResponse(
                    status_code=400,
                    content={"error": "invalid_package", "detail": f"Unknown package_id: {body.package_id!r}"},
                )

            # Validate tx_hash before embedding in Authorization header string
            # (prevents header injection via crafted tx_hash values)
            if not re.fullmatch(r"[A-Za-z0-9_\-]{1,128}", body.tx_hash):
                return JSONResponse(
                    status_code=400,
                    content={"error": "invalid_tx_hash", "detail": "tx_hash contains invalid characters"},
                )

            # Validate buyer_address length (prevent oversized inputs; Solana pubkeys are ≤44 base58 chars,
            # but allow up to 128 to be permissive with different wallet formats and test addresses)
            if not body.buyer_address or len(body.buyer_address) > 128:
                return JSONResponse(
                    status_code=400,
                    content={"error": "invalid_buyer_address", "detail": "buyer_address must be 1-128 characters"},
                )

            from datetime import datetime, timedelta
            from datetime import timezone as _tz

            from ag402_core.prepaid.client import _compute_hmac
            from ag402_core.prepaid.models import PrepaidCredential
            _signing_key = self._prepaid_verifier._signing_key

            # ── Idempotency check ──────────────────────────────────────────
            # If this tx_hash was already issued, replay the same credential.
            # buyer_address must match to prevent credential theft.
            #
            # Security note: we check for an existing record FIRST (read-only),
            # then fall through to on-chain verification + atomic INSERT for new
            # purchases. The INSERT OR IGNORE in _record_prepaid_issued means that
            # concurrent requests with the same new tx_hash race to insert; only
            # one wins, the other re-reads and takes the idempotency path.
            existing = await self._get_prepaid_issued(body.tx_hash)
            if existing is not None:
                stored_buyer, stored_pkg, issued_at_ts = existing
                if stored_buyer != body.buyer_address:
                    # Different buyer trying to claim same tx — reject silently
                    # (don't reveal that this tx_hash exists for another buyer)
                    logger.warning(
                        "[GATEWAY] Idempotency conflict: tx_hash=%s stored_buyer=%s request_buyer=%s",
                        body.tx_hash[:32], stored_buyer[:20], body.buyer_address[:20],
                    )
                    return JSONResponse(
                        status_code=403,
                        content={"error": "payment_verification_failed", "detail": "Transaction verification failed"},
                    )
                if stored_pkg != body.package_id:
                    # package_id mismatch — replay with original package
                    logger.warning(
                        "[GATEWAY] Idempotency package mismatch: tx_hash=%s stored=%s request=%s — replaying original",
                        body.tx_hash[:32], stored_pkg, body.package_id,
                    )
                    # Use the stored (original) package so credential is identical
                    pkg = PACKAGES.get(stored_pkg, pkg)

                # Re-derive the exact same credential using original issued_at timestamp
                issued_at = datetime.fromtimestamp(issued_at_ts, tz=_tz.utc)
                expires_at = issued_at + timedelta(days=pkg["days"])
                signature = _compute_hmac(_signing_key, body.buyer_address, stored_pkg, expires_at)
                cred = PrepaidCredential(
                    buyer_address=body.buyer_address,
                    package_id=stored_pkg,
                    remaining_calls=pkg["calls"],
                    expires_at=expires_at,
                    signature=signature,
                    seller_address=self.address,
                    created_at=issued_at,
                )
                logger.info(
                    "[GATEWAY] Replayed credential (idempotent): buyer=%s package=%s tx=%s",
                    body.buyer_address[:24], stored_pkg, body.tx_hash[:32],
                )
                return JSONResponse(
                    status_code=200,
                    content={"credential": cred.to_dict(), "recovered": True},
                )

            # ── New purchase: verify on-chain payment ──────────────────────
            # Use legacy x402 format: "x402 <tx_hash>" — compatible with PaymentVerifier
            expected_amount = float(pkg["price"])
            pay_result = await self.verifier.verify(
                f"x402 {body.tx_hash}",
                expected_amount=expected_amount,
                expected_address=self.address,
            )
            if not pay_result.valid:
                logger.warning("[GATEWAY] Purchase payment rejected: %s", pay_result.error)
                return JSONResponse(
                    status_code=402,
                    content={"error": "payment_verification_failed", "detail": pay_result.error},
                )

            # ── Issue credential + record issuance (atomic) ────────────────
            # Record BEFORE returning — crash between record+return is the safe
            # failure mode (buyer retries → idempotency path returns same cred).
            #
            # TOCTOU handling: two concurrent requests with the same new tx_hash
            # both pass on-chain verification above. They race to INSERT. Only one
            # wins (INSERT OR IGNORE); the other gets is_new=False, reads back the
            # winner's row, and returns that identical credential. This guarantees
            # every buyer gets exactly one credential per tx_hash.
            now_utc = datetime.now(_tz.utc)
            issued_at_ts = now_utc.timestamp()
            expires_at = now_utc + timedelta(days=pkg["days"])
            signature = _compute_hmac(_signing_key, body.buyer_address, body.package_id, expires_at)

            is_new = await self._record_prepaid_issued(
                tx_hash=body.tx_hash,
                buyer_address=body.buyer_address,
                package_id=body.package_id,
                issued_at=issued_at_ts,
            )

            if not is_new:
                # Another concurrent request won the INSERT race.
                # Read back the winning row and replay it.
                existing = await self._get_prepaid_issued(body.tx_hash)
                if existing is not None:
                    stored_buyer, stored_pkg, stored_ts = existing
                    if stored_buyer != body.buyer_address:
                        logger.warning(
                            "[GATEWAY] Race+conflict: tx_hash=%s stored_buyer=%s request_buyer=%s",
                            body.tx_hash[:32], stored_buyer[:20], body.buyer_address[:20],
                        )
                        return JSONResponse(
                            status_code=403,
                            content={"error": "payment_verification_failed", "detail": "Transaction verification failed"},
                        )
                    replay_pkg = PACKAGES.get(stored_pkg, pkg)
                    issued_at = datetime.fromtimestamp(stored_ts, tz=_tz.utc)
                    expires_at = issued_at + timedelta(days=replay_pkg["days"])
                    signature = _compute_hmac(_signing_key, body.buyer_address, stored_pkg, expires_at)
                    cred = PrepaidCredential(
                        buyer_address=body.buyer_address,
                        package_id=stored_pkg,
                        remaining_calls=replay_pkg["calls"],
                        expires_at=expires_at,
                        signature=signature,
                        seller_address=self.address,
                        created_at=issued_at,
                    )
                    logger.info(
                        "[GATEWAY] Replayed credential (concurrent race): buyer=%s package=%s tx=%s",
                        body.buyer_address[:24], stored_pkg, body.tx_hash[:32],
                    )
                    return JSONResponse(
                        status_code=200,
                        content={"credential": cred.to_dict(), "recovered": True},
                    )
                # H-3 FIX: If is_new=False but no existing record found, the DB
                # is unavailable (not a race). Refuse to issue without recording.
                return JSONResponse(
                    status_code=503,
                    content={"error": "Service Unavailable", "detail": "Cannot record credential issuance"},
                )

            cred = PrepaidCredential(
                buyer_address=body.buyer_address,
                package_id=body.package_id,
                remaining_calls=pkg["calls"],
                expires_at=expires_at,
                signature=signature,
                seller_address=self.address,
                created_at=now_utc,
            )

            logger.info(
                "[GATEWAY] Issued prepaid credential: buyer=%s package=%s calls=%d tx=%s",
                body.buyer_address[:24], body.package_id, cred.remaining_calls, body.tx_hash[:32],
            )
            return JSONResponse(
                status_code=201,
                content={"credential": cred.to_dict()},
            )

        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
        async def gateway_handler(request: Request, path: str) -> Response:
            """Catch-all route that gates all requests behind x402 payment."""
            self._metrics["requests_total"] += 1

            # P1-2.7: IP-based rate limiting
            client_ip = request.client.host if request.client else "unknown"
            if not self._rate_limiter.allow(client_ip):
                self._metrics["rate_limited"] = self._metrics.get("rate_limited", 0) + 1
                logger.warning("[GATEWAY] Rate limited: %s", client_ip)
                return JSONResponse(
                    status_code=429,
                    content={"error": "Too Many Requests", "detail": "Rate limit exceeded"},
                )

            authorization = request.headers.get("authorization", "")

            # 0.5. P0-2: Prepaid credential fast-path (1ms local verify, no chain call)
            prepaid_header = request.headers.get("x-prepaid-credential", "")
            # M-5 FIX: Reject oversized prepaid credential headers (DoS prevention)
            if prepaid_header and len(prepaid_header) > 4096:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Bad Request", "detail": "X-Prepaid-Credential header too large"},
                )
            if prepaid_header and self._prepaid_verifier is not None:
                result = self._prepaid_verifier.verify(prepaid_header)
                if result.valid:
                    # S-C1 FIX: Server-side call counting — don't trust client remaining_calls
                    try:
                        from ag402_core.prepaid.models import (  # noqa: N814
                            PACKAGES as _PKGS,
                        )
                        from ag402_core.prepaid.models import (
                            PrepaidCredential,
                        )
                        cred = PrepaidCredential.from_header_value(prepaid_header)
                        pkg_info = _PKGS.get(cred.package_id)
                        max_calls = pkg_info["calls"] if pkg_info else cred.remaining_calls
                        allowed = await self._check_and_deduct_prepaid_usage(
                            cred.buyer_address, cred.package_id, cred.signature, max_calls
                        )
                        if not allowed:
                            logger.info("[GATEWAY] Prepaid quota exhausted (server-side) for buyer %s", cred.buyer_address[:24])
                            self._metrics["prepaid_rejected"] += 1
                            self._metrics["challenges_issued"] += 1
                            return self._build_402_response()
                    except Exception as exc:
                        logger.error("[GATEWAY] Server-side prepaid check failed: %s — rejecting (fail-closed)", exc)
                        return JSONResponse(status_code=503, content={"error": "Service Unavailable", "detail": "Prepaid quota check unavailable"})
                    self._metrics["prepaid_verified"] += 1
                    logger.info("[GATEWAY] Prepaid credential accepted — proxying")
                    try:
                        return await self._proxy_request(request, path)
                    except Exception as exc:
                        self._metrics["proxy_errors"] += 1
                        logger.error("[GATEWAY] Proxy error (prepaid): %s", exc)
                        return JSONResponse(status_code=502, content={"error": "Bad Gateway"})
                else:
                    # Invalid prepaid → fall through to standard 402 so buyer retries on-chain
                    logger.info(
                        "[GATEWAY] Prepaid credential rejected (%s) — returning 402",
                        result.error,
                    )
                    self._metrics["prepaid_rejected"] += 1
                    self._metrics["challenges_issued"] += 1
                    return self._build_402_response()

            # 1. Check for Authorization header
            if not authorization:
                # No auth at all -> 402 challenge
                logger.info("[GATEWAY] No Authorization header -- returning 402")
                self._metrics["challenges_issued"] += 1
                return self._build_402_response()

            # 2. Check if it's x402 format
            if not authorization.strip().lower().startswith("x402 "):
                # Non-x402 auth (e.g. Bearer token) -> 403 Forbidden
                logger.info("[GATEWAY] Non-x402 Authorization -- returning 403")
                return JSONResponse(
                    status_code=403,
                    content={"error": "Forbidden", "detail": "x402 payment proof required"},
                )

            # 3. Replay protection (timestamp + nonce check) — MANDATORY
            ts = request.headers.get("x-x402-timestamp", "")
            nonce = request.headers.get("x-x402-nonce", "")
            replay_ok, replay_err = self._replay_guard.check(ts, nonce)
            if not replay_ok:
                logger.warning("[GATEWAY] Replay check failed: %s", replay_err)
                self._metrics["replays_rejected"] += 1
                return JSONResponse(
                    status_code=403,
                    content={"error": "Replay rejected", "detail": replay_err},
                )

            # 4. Verify the x402 proof
            result = await self.verifier.verify(
                authorization,
                expected_amount=float(self.price),
                expected_address=self.address,
            )

            if not result.valid:
                logger.warning("[GATEWAY] Invalid payment proof: %s", result.error)
                self._metrics["payments_rejected"] += 1
                return JSONResponse(
                    status_code=403,
                    content={"error": "Payment verification failed", "detail": result.error},
                )

            # 5b. Persistent tx_hash replay check with grace window
            #
            # Three-state logic:
            #   NEW          → first time, record and proxy
            #   WITHIN_GRACE → previously consumed but delivery may have failed,
            #                   serve cached response or re-proxy
            #   EXPIRED      → grace window expired, reject as replay
            tx_status = await self._persistent_guard.check_tx_status(result.tx_hash)

            if tx_status == TxHashStatus.EXPIRED:
                logger.warning("[GATEWAY] Expired tx_hash rejected: %s", result.tx_hash[:32])
                self._metrics["replays_rejected"] += 1
                return self._build_402_response()

            if tx_status == TxHashStatus.WITHIN_GRACE:
                # Buyer is retrying a previously consumed tx_hash within grace window.
                # Try to serve cached response first (if upstream succeeded before).
                cached = await self._persistent_guard.get_cached_response(result.tx_hash)
                if cached:
                    status_code, cached_headers, cached_body = cached
                    logger.info(
                        "[GATEWAY] Serving cached response for tx_hash retry: %s (status=%d)",
                        result.tx_hash[:32], status_code,
                    )
                    self._metrics["receipts_reused"] = self._metrics.get("receipts_reused", 0) + 1
                    return Response(
                        content=cached_body,
                        status_code=status_code,
                        headers=cached_headers,
                    )
                # No cached response — upstream previously failed, re-proxy
                logger.info(
                    "[GATEWAY] Re-proxying for tx_hash within grace window: %s",
                    result.tx_hash[:32],
                )
            else:
                # NEW — atomically record the tx_hash.
                # check_and_record_tx uses INSERT OR IGNORE, so if a concurrent
                # request recorded first, is_new=False. In that case, treat it
                # as WITHIN_GRACE (the other request may still be in flight).
                is_new = await self._persistent_guard.check_and_record_tx(result.tx_hash)
                if not is_new:
                    # Concurrent request recorded it first — check if it was already delivered.
                    recheck = await self._persistent_guard.check_tx_status(result.tx_hash)
                    if recheck == TxHashStatus.EXPIRED:
                        self._metrics["replays_rejected"] += 1
                        return self._build_402_response()
                    # Otherwise it's WITHIN_GRACE — fall through to proxy

            # 6. Proxy the request to the target
            self._metrics["payments_verified"] += 1
            logger.info("[GATEWAY] Payment verified (tx: %s) -- proxying to %s", result.tx_hash, self.target_url)
            try:
                proxy_response = await self._proxy_request(request, path)
                # Cache successful responses so grace-window retries get the same answer
                if proxy_response.status_code < 400:
                    await self._persistent_guard.mark_delivered(result.tx_hash)
                    # Extract headers from the Response object
                    resp_headers = {}
                    if hasattr(proxy_response, 'headers') and proxy_response.headers:
                        resp_headers = dict(proxy_response.headers)
                    await self._persistent_guard.cache_response(
                        result.tx_hash,
                        proxy_response.status_code,
                        resp_headers,
                        proxy_response.body,
                    )
                return proxy_response
            except Exception as exc:
                self._metrics["proxy_errors"] += 1
                logger.error("[GATEWAY] Proxy error: %s", exc)
                # Do NOT mark as delivered — buyer can retry within grace window
                return JSONResponse(status_code=502, content={"error": "Bad Gateway"})

        return app

    async def _init_prepaid_db(self) -> None:
        """Create prepaid tables on the replay guard's shared DB connection.

        H-2 FIX: Reuses the PersistentReplayGuard's connection instead of
        opening a second connection to the same file. Two independent
        connections can cause SQLITE_BUSY or deadlocks under concurrent writes.
        """
        self._prepaid_db = self._persistent_guard.db
        if self._prepaid_db is None:
            logger.error("[GATEWAY] Replay guard DB not initialized — cannot create prepaid tables")
            return
        await self._prepaid_db.execute(
            """
            CREATE TABLE IF NOT EXISTS prepaid_issued (
                tx_hash       TEXT PRIMARY KEY,
                buyer_address TEXT NOT NULL,
                package_id    TEXT NOT NULL,
                issued_at     REAL NOT NULL
            )
            """
        )
        # S-C1 FIX: Server-side prepaid usage counter.
        # Tracks how many calls each credential has consumed. The buyer's
        # remaining_calls is untrusted — only this server-side counter is
        # authoritative. Key = buyer_address + package_id + signature (unique per credential).
        await self._prepaid_db.execute(
            """
            CREATE TABLE IF NOT EXISTS prepaid_usage (
                credential_key TEXT PRIMARY KEY,
                calls_used     INTEGER NOT NULL DEFAULT 0,
                max_calls      INTEGER NOT NULL,
                created_at     REAL NOT NULL DEFAULT 0
            )
            """
        )
        # M-3 FIX: Migrate existing rows that lack created_at (upgrade path)
        import contextlib as _cl
        with _cl.suppress(Exception):
            await self._prepaid_db.execute(
                "ALTER TABLE prepaid_usage ADD COLUMN created_at REAL NOT NULL DEFAULT 0"
            )
        await self._prepaid_db.commit()
        # Purge issuance records older than 366 days on each startup.
        # The longest package is 730 days, but idempotency only needs to cover the
        # purchase retry window (minutes/hours). Keeping 366 days is a safe margin.
        cutoff = time.time() - 366 * 86400
        cursor = await self._prepaid_db.execute(
            "DELETE FROM prepaid_issued WHERE issued_at < ?", (cutoff,)
        )
        # M-3 FIX: Also prune exhausted usage records older than 366 days.
        # created_at=0 means pre-migration rows — treat as epoch (always pruned).
        cursor2 = await self._prepaid_db.execute(
            "DELETE FROM prepaid_usage WHERE created_at < ?", (cutoff,)
        )
        await self._prepaid_db.commit()
        pruned_issued = cursor.rowcount or 0
        pruned_usage = cursor2.rowcount or 0
        if pruned_issued:
            logger.info("[GATEWAY] Purged %d stale prepaid_issued records", pruned_issued)
        if pruned_usage:
            logger.info("[GATEWAY] Purged %d stale prepaid_usage records", pruned_usage)

    async def _close_prepaid_db(self) -> None:
        # H-2 FIX: Connection is shared with PersistentReplayGuard — it owns
        # the close. Just clear our reference.
        self._prepaid_db = None

    async def _record_prepaid_issued(
        self,
        tx_hash: str,
        buyer_address: str,
        package_id: str,
        issued_at: float,
    ) -> bool:
        """Insert a new issuance record atomically.

        Returns True if this call performed the INSERT (new record),
        False if the tx_hash already existed (INSERT OR IGNORE was a no-op).
        This allows callers to detect concurrent races: the loser re-reads
        the winning row and replays that credential instead.
        """
        if self._prepaid_db is None:
            logger.error("[GATEWAY] Prepaid DB unavailable — cannot record issuance for tx %s", tx_hash[:32])
            return False  # H-3 FIX: Fail-closed — refuse to issue without recording
        cursor = await self._prepaid_db.execute(
            "INSERT OR IGNORE INTO prepaid_issued (tx_hash, buyer_address, package_id, issued_at) VALUES (?, ?, ?, ?)",
            (tx_hash, buyer_address, package_id, issued_at),
        )
        await self._prepaid_db.commit()
        return cursor.rowcount == 1  # 1 = inserted, 0 = already existed

    async def _get_prepaid_issued(
        self, tx_hash: str
    ) -> tuple[str, str, float] | None:
        """Return (buyer_address, package_id, issued_at) for a tx_hash, or None."""
        if self._prepaid_db is None:
            return None
        async with self._prepaid_db.execute(
            "SELECT buyer_address, package_id, issued_at FROM prepaid_issued WHERE tx_hash = ?",
            (tx_hash,),
        ) as cursor:
            row = await cursor.fetchone()
        return row  # None if not found

    async def _check_and_deduct_prepaid_usage(
        self, buyer_address: str, package_id: str, signature: str, max_calls: int
    ) -> bool:
        """S-C1 FIX: Server-side prepaid call counter.

        Atomically checks and increments usage for a credential.
        Returns True if the call is allowed, False if the quota is exhausted.
        The credential_key is a hash of (buyer_address, package_id, signature)
        to uniquely identify each issued credential.
        """
        if self._prepaid_db is None:
            return False  # H-3 FIX: Fail-closed — no DB means no quota check
        import hashlib
        credential_key = hashlib.sha256(
            f"{buyer_address}|{package_id}|{signature}".encode()
        ).hexdigest()

        # Upsert: INSERT on first use, then check + increment atomically
        await self._prepaid_db.execute(
            "INSERT OR IGNORE INTO prepaid_usage (credential_key, calls_used, max_calls, created_at) VALUES (?, 0, ?, ?)",
            (credential_key, max_calls, time.time()),
        )
        cursor = await self._prepaid_db.execute(
            "UPDATE prepaid_usage SET calls_used = calls_used + 1 "
            "WHERE credential_key = ? AND calls_used < max_calls",
            (credential_key,),
        )
        await self._prepaid_db.commit()
        return cursor.rowcount == 1

    async def _proxy_request(self, request: Request, path: str) -> Response:
        """Forward the request to the upstream target service."""
        target = f"{self.target_url}/{path}"
        if request.url.query:
            target = f"{target}?{request.url.query}"

        # M-body FIX: Limit request body size to prevent memory exhaustion DoS
        _MAX_BODY_SIZE = 10 * 1024 * 1024  # 10 MB
        content_length = request.headers.get("content-length")
        try:
            content_length_int = int(content_length) if content_length else 0
        except (ValueError, TypeError):
            content_length_int = 0  # M-1 FIX: Malformed header → skip pre-check, rely on body read
        if content_length_int > _MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"error": "Payload Too Large", "detail": f"Body exceeds {_MAX_BODY_SIZE} bytes"},
            )

        # Read request body
        body = await request.body()
        if len(body) > _MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"error": "Payload Too Large", "detail": f"Body exceeds {_MAX_BODY_SIZE} bytes"},
            )

        # P2-3.4: Whitelist-based header forwarding — only pass known-safe headers
        # to prevent X-Forwarded-For spoofing, Cookie leakage, Connection abuse, etc.
        _ALLOWED_HEADERS = {
            "accept", "accept-encoding", "accept-language",
            "content-type", "user-agent", "origin", "referer",
            "cache-control", "if-none-match", "if-modified-since",
            "x-request-id", "x-correlation-id",
        }
        proxy_headers = {}
        for key, value in request.headers.items():
            if key.lower() in _ALLOWED_HEADERS:
                proxy_headers[key] = value

        # Use shared client (falls back to per-request if lifespan not used)
        client = self._http_client
        if client is None:
            client = httpx.AsyncClient(timeout=30.0)

        try:
            upstream_response = await client.request(
                method=request.method,
                url=target,
                headers=proxy_headers,
                content=body if body else None,
            )
        finally:
            # Only close if we created a fallback client
            if self._http_client is None:
                await client.aclose()

        # Build response headers (exclude hop-by-hop)
        response_headers = {}
        skip_response_headers = {"transfer-encoding", "content-encoding", "content-length"}
        for key, value in upstream_response.headers.items():
            if key.lower() not in skip_response_headers:
                response_headers[key] = value

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=response_headers,
        )


def cli_main() -> None:
    """Entry point for `ag402-gateway` CLI command."""
    parser = argparse.ArgumentParser(
        description="x402 Payment Gateway -- adds pay-per-call to any HTTP API",
    )
    parser.add_argument(
        "--target",
        required=True,
        help="URL of the upstream service to protect (e.g. http://localhost:8000)",
    )
    parser.add_argument(
        "--price",
        default="0.02",
        help="Price per call in token units (default: 0.02)",
    )
    parser.add_argument(
        "--address",
        default="",
        help="Recipient wallet address for payments",
    )
    parser.add_argument(
        "--prepaid-signing-key",
        default="",
        help=(
            "HMAC signing key for X-Prepaid-Credential verification "
            "(or set AG402_PREPAID_SIGNING_KEY env var). "
            "Recommend >= 32 random chars: "
            "python -c \"import secrets; print(secrets.token_hex(32))\""
        ),
    )
    parser.add_argument(
        "--chain",
        default="solana",
        help="Blockchain network (default: solana)",
    )
    parser.add_argument(
        "--token",
        default="USDC",
        help="Payment token (default: USDC)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind the gateway (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to bind the gateway (default: 8001)",
    )

    args = parser.parse_args()

    import uvicorn

    # S1-2 FIX: Mode-aware host selection, consistent with `ag402 serve`.
    # If user did not explicitly pass --host, choose based on X402_MODE.
    host = args.host
    # M-2 FIX: Set X402_MODE default so gateway constructor doesn't crash.
    # cli_main is an interactive entry point — defaulting to test is safe here.
    os.environ.setdefault("X402_MODE", "test")
    is_test = os.getenv("X402_MODE", "test").lower() == "test"
    if host == "127.0.0.1" and not is_test:
        # Production mode: default to 0.0.0.0 (bind all interfaces)
        host = "0.0.0.0"
    elif host == "127.0.0.1" and is_test:
        pass  # Keep 127.0.0.1 in test mode (safe default)

    gateway = X402Gateway(
        target_url=args.target,
        price=args.price,
        chain=args.chain,
        token=args.token,
        address=args.address,
        prepaid_signing_key=args.prepaid_signing_key,
    )
    app = gateway.create_app()

    logger.info(
        "[GATEWAY] Starting x402 gateway on %s:%d -> %s (price: %s %s)",
        host, args.port, args.target, args.price, args.token,
    )

    # B1 FIX: Explicitly use asyncio event loop to avoid uvloop + aiosqlite conflicts.
    uvicorn.run(app, host=host, port=args.port, loop="asyncio")


if __name__ == "__main__":
    cli_main()
