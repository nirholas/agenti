"""
x402 Payment Middleware — the core of ag402-core.

Intercepts HTTP requests, detects 402 Payment Required responses,
auto-pays via the configured payment provider, and retries with proof.

State machine integration (P0-2):
- Uses PaymentOrder + PaymentOrderStore to track payment lifecycle.
- After chain broadcast succeeds, retry failures do NOT rollback local wallet.
- Failed deliveries are retried by the DeliveryWorker background task.
- After max retries, orders transition to FAILED for manual review.
- Idempotency-Key header is injected into all retry requests.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import uuid
from dataclasses import dataclass, field

import httpx
from open402.headers import (
    ParsedExtensionHeaders,
    build_authorization,
    parse_www_authenticate,
)
from open402.negotiation import get_version_header
from open402.spec import X402PaymentProof

from ag402_core.config import X402Config
from ag402_core.middleware.budget_guard import BudgetGuard
from ag402_core.payment.base import BasePaymentProvider
from ag402_core.security.challenge_validator import validate_challenge
from ag402_core.security.replay_guard import generate_replay_headers
from ag402_core.wallet.agent_wallet import AgentWallet
from ag402_core.wallet.payment_order import OrderState, PaymentOrder, PaymentOrderStore

logger = logging.getLogger(__name__)

# Default max delivery retries before marking order as FAILED
DEFAULT_DELIVERY_MAX_RETRIES = 5


@dataclass
class MiddlewareResult:
    """Result of processing a request through the x402 middleware."""

    status_code: int
    headers: dict[str, str] = field(default_factory=dict)
    body: bytes = b""
    payment_made: bool = False
    tx_hash: str = ""
    amount_paid: float = 0.0
    error: str = ""


class X402PaymentMiddleware:
    """Intercepts HTTP requests, handles 402 payment challenges, auto-pays and retries.

    When an ``order_store`` is provided, the middleware tracks each payment
    through a strict state machine.  After the chain transaction is
    broadcasted (tx_hash obtained), **the local wallet deduction is never
    rolled back** — even if the subsequent retry request to the service
    returns an error.  Instead the order is placed into ``DELIVERING``
    state for asynchronous background retry.
    """

    def __init__(
        self,
        wallet: AgentWallet,
        provider: BasePaymentProvider,
        config: X402Config,
        http_client: httpx.AsyncClient | None = None,
        order_store: PaymentOrderStore | None = None,
        delivery_max_retries: int = DEFAULT_DELIVERY_MAX_RETRIES,
        enable_delivery_worker: bool = True,
    ):
        self.wallet = wallet
        self.provider = provider
        self.config = config
        self.budget_guard = BudgetGuard(wallet, config)
        self._client = http_client or httpx.AsyncClient(timeout=30.0)
        self._order_store = order_store
        self._delivery_max_retries = delivery_max_retries
        self._enable_delivery_worker = enable_delivery_worker
        self._delivery_worker_task: asyncio.Task | None = None
        self._delivery_worker = None
        # P1-2.5: Serialize budget-check + deduct to prevent TOCTOU race
        self._payment_lock = asyncio.Lock()

    async def start_delivery_worker(self) -> None:
        """Start the background delivery retry worker (if order_store available)."""
        if not self._order_store or not self._enable_delivery_worker:
            return
        if self._delivery_worker_task is not None:
            return  # Already running

        from ag402_core.delivery_worker import DeliveryWorker

        self._delivery_worker = DeliveryWorker(
            self._order_store,
            max_retries=self._delivery_max_retries,
            http_client=self._client,
        )
        self._delivery_worker_task = asyncio.create_task(self._delivery_worker.run())
        logger.info("[MIDDLEWARE] Delivery retry worker started")

    async def stop_delivery_worker(self) -> None:
        """Stop the background delivery retry worker."""
        if self._delivery_worker:
            self._delivery_worker.stop()
        if self._delivery_worker_task:
            self._delivery_worker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._delivery_worker_task
            self._delivery_worker_task = None
        self._delivery_worker = None

    async def close(self) -> None:
        await self.stop_delivery_worker()
        await self._client.aclose()

    async def handle_request(
        self,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        body: bytes | None = None,
        max_amount: float | None = None,
    ) -> MiddlewareResult:
        """
        Process an outbound HTTP request through the x402 middleware.

        Flow:
        1. Forward request to target (with version + extension headers)
        2. If 402 with x402 headers -> budget check -> pay -> retry
        3. If 402 without x402 -> pass through
        4. If non-402 -> pass through

        State machine (when order_store is available):
            CREATED -> LOCAL_DEDUCTED -> CHAIN_BROADCASTED -> DELIVERING -> SUCCESS
                                          (or REFUNDED if chain fails)
        """
        req_headers = dict(headers or {})
        # Inject protocol version header
        req_headers.update(get_version_header())
        # Inject replay protection headers (timestamp + nonce)
        req_headers.update(generate_replay_headers())
        # Inject extension headers (V1: passthrough only)
        ext = ParsedExtensionHeaders(
            x402_version=self.config.protocol_version,
        )
        req_headers.update(ext.to_headers())

        # 1. Forward request
        logger.info("[REQUEST] %s %s", method, url)
        response = await self._send(method, url, req_headers, body)

        # 2. Non-402 -> pass through
        if response.status_code != 402:
            return self._wrap_response(response)

        # 3. Parse x402 challenge
        logger.info("[INTERCEPT] Received HTTP 402 Payment Required")
        www_auth = response.headers.get("www-authenticate", "")
        challenge = parse_www_authenticate(www_auth)

        if challenge is None:
            # Not an x402 402 — try fallback API key if configured
            if self.config.fallback_api_key:
                logger.info("[FALLBACK] Non-x402 402 detected, retrying with fallback API key")
                fallback_headers = dict(req_headers)
                fallback_headers["Authorization"] = f"Bearer {self.config.fallback_api_key}"
                fallback_response = await self._send(method, url, fallback_headers, body)
                return self._wrap_response(fallback_response)
            logger.info("[INTERCEPT] Not an x402 challenge, passing through")
            return self._wrap_response(response)

        logger.info(
            "[QUOTE] Price: $%s %s -> %s (chain: %s)",
            challenge.amount, challenge.token, challenge.address, challenge.chain,
        )

        # 4. Validate challenge before paying
        amount = challenge.amount_float
        validation = validate_challenge(url, amount, challenge.address, challenge.token, self.config)
        if not validation.valid:
            logger.warning("[VALIDATE] Challenge rejected: %s", validation.error)
            return MiddlewareResult(
                status_code=402,
                headers=self._decoded_headers(response),
                body=response.content,
                error=f"Challenge validation failed: {validation.error}",
            )

        # 4.5. Try prepaid path first (1ms local verify, skips on-chain payment)
        prepaid_result = await self._try_prepaid(
            challenge.address, method, url, req_headers, body
        )
        if prepaid_result is not None:
            return prepaid_result

        # 5-6. Budget check + deduct under lock to prevent TOCTOU race
        # (multiple concurrent requests could otherwise all pass budget check
        # before any deduction is recorded, exceeding the budget)
        async with self._payment_lock:
            budget_result = await self.budget_guard.check(amount, max_amount=max_amount)
            if not budget_result.allowed:
                logger.warning("[BUDGET] Payment blocked: %s", budget_result.reason)
                return MiddlewareResult(
                    status_code=402,
                    headers=self._decoded_headers(response),
                    body=response.content,
                    error=f"Budget denied: {budget_result.reason}",
                )

            # --- State Machine: create order ---
            order = await self._create_order(
                amount=amount,
                to_address=challenge.address,
                token=challenge.token,
                chain=challenge.chain,
                request_url=url,
                request_method=method,
                request_headers=json.dumps(dict(req_headers)),
                request_body=body or b"",
            )

            # 6. Deduct from local wallet (pre-payment reservation)
            deduction_tx = await self.wallet.deduct(
                amount=amount,
                to_address=challenge.address,
            )
            logger.info("[DEDUCT] Reserved $%.4f from wallet (tx: %s)", amount, deduction_tx.id)
            await self._transition_order(order, OrderState.LOCAL_DEDUCTED, wallet_tx_id=deduction_tx.id)

        # 7. Pay on-chain (with request_id for idempotency)
        request_id = uuid.uuid4().hex
        logger.info("[PAY] Sending $%.4f %s to %s (request_id=%s)...",
                     amount, challenge.token, challenge.address, request_id[:12])
        payment_result = await self.provider.pay(
            to_address=challenge.address,
            amount=amount,
            token=challenge.token,
            request_id=request_id,
        )

        if not payment_result.success:
            # Payment failed (before broadcast) -> rollback wallet deduction
            logger.error("[PAY] Payment failed: %s -- rolling back", payment_result.error)
            await self.wallet.rollback(deduction_tx.id)
            logger.info("[ROLLBACK] Wallet deduction reversed")
            await self._transition_order(
                order, OrderState.REFUNDED, error_message=payment_result.error,
            )
            return MiddlewareResult(
                status_code=402,
                headers=self._decoded_headers(response),
                body=response.content,
                error=f"Payment failed: {payment_result.error}",
            )

        logger.info("[PAY] Success -- tx: %s", payment_result.tx_hash)
        await self._transition_order(
            order, OrderState.CHAIN_BROADCASTED, tx_hash=payment_result.tx_hash,
        )

        # === POINT OF NO RETURN ===
        # After this point, the chain transaction is real.
        # We MUST NOT rollback the local wallet deduction,
        # even if the retry request fails.

        # 8. Retry with payment proof + Idempotency-Key + request_id
        proof = X402PaymentProof(
            tx_hash=payment_result.tx_hash,
            chain=challenge.chain,
            payer_address=self.provider.get_address(),
            request_id=request_id,
        )
        retry_headers = dict(req_headers)
        retry_headers["Authorization"] = build_authorization(proof)
        retry_headers["Idempotency-Key"] = order.idempotency_key if order else ""

        # Transition to DELIVERING before making the retry request
        await self._transition_order(order, OrderState.DELIVERING)

        logger.info("[RETRY] Retrying request with payment proof...")
        retry_response = await self._send(method, url, retry_headers, body)

        if retry_response.status_code >= 400:
            # Retry failed — DO NOT rollback (chain payment is real).
            # Leave order in DELIVERING state for the background DeliveryWorker
            # to retry with exponential backoff. After max retries, the worker
            # transitions the order to FAILED for manual review.
            logger.error(
                "[RETRY] Failed with status %d -- order stays in DELIVERING for async retry",
                retry_response.status_code,
            )
            if order:
                order.retry_count += 1
                order.error_message = f"Retry failed with status {retry_response.status_code}"
                await self._save_order(order)
            return MiddlewareResult(
                status_code=retry_response.status_code,
                headers=self._decoded_headers(retry_response),
                body=retry_response.content,
                payment_made=True,
                tx_hash=payment_result.tx_hash,
                amount_paid=amount,
                error=f"Retry failed with status {retry_response.status_code}",
            )

        # Success — mark order as complete
        await self._transition_order(order, OrderState.SUCCESS)
        logger.info("[SUCCESS] Request completed after payment ($%.4f)", amount)
        return MiddlewareResult(
            status_code=retry_response.status_code,
            headers=self._decoded_headers(retry_response),
            body=retry_response.content,
            payment_made=True,
            tx_hash=payment_result.tx_hash,
            amount_paid=amount,
        )

    # --- State machine helpers ---

    async def _create_order(
        self,
        amount: float,
        to_address: str,
        token: str,
        chain: str,
        request_url: str,
        request_method: str,
        request_headers: str = "",
        request_body: bytes = b"",
    ) -> PaymentOrder | None:
        """Create a new PaymentOrder and persist it (if store available)."""
        order = PaymentOrder(
            amount=amount,
            to_address=to_address,
            token=token,
            chain=chain,
            request_url=request_url,
            request_method=request_method,
            request_headers=request_headers,
            request_body=request_body,
        )
        if self._order_store:
            await self._order_store.save(order)
        return order if self._order_store else None

    async def _transition_order(
        self,
        order: PaymentOrder | None,
        new_state: OrderState,
        *,
        wallet_tx_id: str = "",
        tx_hash: str = "",
        error_message: str = "",
    ) -> None:
        """Transition the order state and persist (if store available)."""
        if order is None:
            return
        order.transition_to(
            new_state,
            wallet_tx_id=wallet_tx_id,
            tx_hash=tx_hash,
            error_message=error_message,
        )
        if self._order_store:
            await self._order_store.update(order)

    async def _save_order(self, order: PaymentOrder | None) -> None:
        """Save order updates (retry_count, error, etc.)."""
        if order is None or self._order_store is None:
            return
        await self._order_store.update(order)

    # --- HTTP helpers ---

    async def _send(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        body: bytes | None,
    ) -> httpx.Response:
        """Send an HTTP request via httpx."""
        return await self._client.request(
            method=method,
            url=url,
            headers=headers,
            content=body,
        )

    async def _try_prepaid(
        self,
        seller_address: str,
        method: str,
        url: str,
        headers: dict[str, str],
        body: bytes | None,
    ) -> MiddlewareResult | None:
        """Attempt payment via local Prepaid Credential (1ms, no chain call).

        Flow:
        1. check_and_deduct under _payment_lock (prevents concurrent over-deduction)
        2. Send request with X-Prepaid-Credential header
        3. Seller accepts (non-402) → return result
        4. Seller rejects (402) → rollback deduction, return None to fall back on-chain

        Returns MiddlewareResult on success, None to fall back to on-chain x402.
        """
        import time

        try:
            from ag402_core.prepaid.client import check_and_deduct, rollback_call
        except ImportError:
            return None  # prepaid module unavailable — silent no-op

        # Deduct under lock to prevent TOCTOU with concurrent requests
        async with self._payment_lock:
            success, cred = check_and_deduct(seller_address)

        if not success or cred is None:
            logger.info(
                "[FALLBACK] No prepaid credential for %s — using on-chain x402",
                seller_address[:24],
            )
            return None

        # Send request with credential header (outside lock — network I/O)
        prepaid_headers = dict(headers)
        try:
            prepaid_headers["X-Prepaid-Credential"] = cred.to_header_value()
        except Exception:
            # Malformed stored credential — rollback deduction and fall through to on-chain
            async with self._payment_lock:
                rollback_call(seller_address, cred)
            logger.warning(
                "[PREPAID] Failed to serialize credential for %s — "
                "rolled back, falling through to on-chain x402",
                seller_address[:24],
            )
            return None

        t0 = time.monotonic()
        try:
            response = await self._send(method, url, prepaid_headers, body)
        except Exception:
            # Network error (timeout, DNS failure, connection reset, etc.) —
            # roll back the deducted call under the lock to prevent concurrent
            # rollbacks from clobbering each other, then re-raise.
            async with self._payment_lock:
                rollback_call(seller_address, cred)
            logger.warning(
                "[PREPAID] Network error sending prepaid request — "
                "rolled back deducted call for %s",
                seller_address[:24],
            )
            raise
        elapsed_ms = (time.monotonic() - t0) * 1000

        if response.status_code == 402:
            # Seller rejected our credential — roll back the deduction under lock
            # to prevent concurrent rollbacks from clobbering each other, then
            # fall through to standard on-chain x402 payment.
            async with self._payment_lock:
                rollback_call(seller_address, cred)
            logger.warning(
                "[PREPAID] Credential rejected by seller (402) — "
                "rolling back, falling back to on-chain x402",
            )
            return None

        if response.status_code >= 500 or response.status_code == 429:
            # Upstream error (5xx) or rate limit (429) — the request was not
            # served. Roll back the deducted call so the buyer doesn't lose it,
            # then return the error response as-is (no on-chain fallback).
            async with self._payment_lock:
                rollback_call(seller_address, cred)
            logger.warning(
                "[PREPAID] Upstream returned %d — rolled back deducted call for %s",
                response.status_code, seller_address[:24],
            )
            return MiddlewareResult(
                status_code=response.status_code,
                headers=self._decoded_headers(response),
                body=response.content,
            )

        logger.info(
            "[PREPAID] \u2713 %.1fms local verify (seller: %s, remaining: %d)",
            elapsed_ms, seller_address[:24], cred.remaining_calls,
        )
        return MiddlewareResult(
            status_code=response.status_code,
            headers=self._decoded_headers(response),
            body=response.content,
            payment_made=True,
            tx_hash="prepaid",
            amount_paid=0.0,
        )

    @staticmethod
    def _decoded_headers(response: httpx.Response) -> dict[str, str]:
        """Return response headers with encoding/length headers stripped.

        ``httpx.Response.content`` is already decoded (gzip/deflate/br
        transparent decompression).  We must strip:

        - ``content-encoding``: body is already decompressed; keeping it
          causes the reconstructed response to double-decompress
          (``zlib error: incorrect header check``).
        - ``transfer-encoding``: no longer applicable to the buffered body.
        - ``content-length``: reflects the *compressed* wire size, not the
          decoded body size.  Keeping it causes silent truncation when the
          consumer reads only ``content-length`` bytes from a larger
          decompressed body.  httpx/Starlette will recalculate it from
          the actual ``content`` parameter.
        """
        return {
            k: v for k, v in response.headers.items()
            if k.lower() not in (
                "content-encoding", "transfer-encoding", "content-length",
            )
        }

    def _wrap_response(self, response: httpx.Response) -> MiddlewareResult:
        """Wrap an httpx Response into a MiddlewareResult."""
        return MiddlewareResult(
            status_code=response.status_code,
            headers=self._decoded_headers(response),
            body=response.content,
        )
