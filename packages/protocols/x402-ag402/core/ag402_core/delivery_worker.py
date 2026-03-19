"""Background delivery retry worker for stuck payments.

When an on-chain payment succeeds but the subsequent API retry fails
(e.g. upstream 502, timeout), the order is left in DELIVERING state.
This worker periodically polls for stale deliveries and retries them
with the original payment proof.

Exponential backoff: 30s → 60s → 120s → 240s → 480s (max 5 retries).
After retries are exhausted, the order transitions to FAILED for manual review.
"""

from __future__ import annotations

import asyncio
import json
import logging
from time import time as _now

import httpx
from open402.headers import build_authorization
from open402.spec import X402PaymentProof

from ag402_core.security.replay_guard import generate_replay_headers
from ag402_core.wallet.payment_order import OrderState, PaymentOrder, PaymentOrderStore

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_POLL_INTERVAL = 30.0  # seconds between polls
DEFAULT_MAX_RETRIES = 5
DEFAULT_BASE_BACKOFF = 30.0  # seconds
DEFAULT_STALE_AGE = 30.0  # seconds before a DELIVERING order is considered stale


class DeliveryWorker:
    """Background worker that retries stuck deliveries.

    Usage:
        worker = DeliveryWorker(order_store)
        task = asyncio.create_task(worker.run())
        # ... later ...
        worker.stop()
        await task
    """

    def __init__(
        self,
        order_store: PaymentOrderStore,
        *,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
        max_retries: int = DEFAULT_MAX_RETRIES,
        base_backoff: float = DEFAULT_BASE_BACKOFF,
        stale_age: float = DEFAULT_STALE_AGE,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._store = order_store
        self._poll_interval = poll_interval
        self._max_retries = max_retries
        self._base_backoff = base_backoff
        self._stale_age = stale_age
        self._client = http_client
        self._own_client = False
        self._running = False
        self._task: asyncio.Task | None = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
            self._own_client = True
        return self._client

    def stop(self) -> None:
        """Signal the worker to stop after the current poll cycle."""
        self._running = False

    async def run(self) -> None:
        """Main loop: poll for stale deliveries and retry them."""
        self._running = True
        logger.info("[DELIVERY-WORKER] Started (poll=%.0fs, max_retries=%d)", self._poll_interval, self._max_retries)

        try:
            while self._running:
                try:
                    await self._poll_and_retry()
                except Exception:
                    logger.exception("[DELIVERY-WORKER] Error in poll cycle")

                # Sleep in small increments so stop() is responsive
                for _ in range(int(self._poll_interval)):
                    if not self._running:
                        break
                    await asyncio.sleep(1.0)
        finally:
            if self._own_client and self._client:
                await self._client.aclose()
                self._client = None
            logger.info("[DELIVERY-WORKER] Stopped")

    async def _poll_and_retry(self) -> None:
        """Single poll cycle: find stale deliveries and retry each."""
        stale_orders = await self._store.get_stale_deliveries(max_age_seconds=self._stale_age)
        if not stale_orders:
            return

        logger.info("[DELIVERY-WORKER] Found %d stale deliveries to retry", len(stale_orders))
        for order in stale_orders:
            await self._retry_order(order)

    async def _retry_order(self, order: PaymentOrder) -> None:
        """Retry a single stuck delivery."""
        # Check if retries exhausted
        if order.retry_count >= self._max_retries:
            logger.warning(
                "[DELIVERY-WORKER] Order %s exhausted %d retries — marking FAILED",
                order.order_id[:8], self._max_retries,
            )
            order.transition_to(
                OrderState.FAILED,
                error_message=f"Delivery retries exhausted ({self._max_retries} attempts)",
            )
            await self._store.update(order)
            return

        # Exponential backoff: only retry if enough time has passed since last update
        backoff = self._base_backoff * (2 ** order.retry_count)
        time_since_update = _now() - order.updated_at
        if time_since_update < backoff:
            logger.debug(
                "[DELIVERY-WORKER] Order %s backoff not elapsed (%.0f < %.0f)",
                order.order_id[:8], time_since_update, backoff,
            )
            return

        # Build retry request with the original payment proof
        client = await self._ensure_client()
        try:
            headers = json.loads(order.request_headers) if order.request_headers else {}
        except (json.JSONDecodeError, TypeError):
            headers = {}

        # Rebuild the payment proof using the stored tx_hash
        if order.tx_hash:
            proof = X402PaymentProof(
                tx_hash=order.tx_hash,
                chain=order.chain,
            )
            headers["Authorization"] = build_authorization(proof)

        headers["Idempotency-Key"] = order.idempotency_key
        headers.update(generate_replay_headers())

        logger.info(
            "[DELIVERY-WORKER] Retrying order %s (attempt %d/%d): %s %s",
            order.order_id[:8], order.retry_count + 1, self._max_retries,
            order.request_method, order.request_url,
        )

        try:
            response = await client.request(
                method=order.request_method,
                url=order.request_url,
                headers=headers,
                content=order.request_body or None,
            )
        except Exception as exc:
            logger.error(
                "[DELIVERY-WORKER] Network error retrying order %s: %s",
                order.order_id[:8], exc,
            )
            order.retry_count += 1
            order.error_message = f"Network error: {exc}"
            order.updated_at = _now()
            await self._store.update(order)
            return

        if response.status_code < 400:
            # Success!
            order.transition_to(OrderState.SUCCESS)
            await self._store.update(order)
            logger.info(
                "[DELIVERY-WORKER] Order %s delivered successfully on retry %d",
                order.order_id[:8], order.retry_count + 1,
            )
        else:
            # Still failing — increment retry count
            order.retry_count += 1
            order.error_message = f"Retry {order.retry_count} failed with status {response.status_code}"
            order.updated_at = _now()
            # Re-enter DELIVERING state (idempotent transition)
            order.transition_to(OrderState.DELIVERING)
            await self._store.update(order)
            logger.warning(
                "[DELIVERY-WORKER] Order %s retry %d failed (status=%d), will retry later",
                order.order_id[:8], order.retry_count, response.status_code,
            )
