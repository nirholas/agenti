"""Payment order state machine with strict uni-directional state transitions.

States:
    CREATED           -> initial
    LOCAL_DEDUCTED    -> local wallet deducted (reservation)
    CHAIN_BROADCASTED -> tx broadcasted to chain (tx_hash obtained; NO local rollback allowed)
    DELIVERING        -> chain confirmed, retrying service API
    SUCCESS           -> service API returned 200, order complete
    REFUNDED          -> chain tx failed/reverted, local wallet refunded
    FAILED            -> delivery retries exhausted, needs manual review

Allowed transitions:
    CREATED           -> LOCAL_DEDUCTED
    LOCAL_DEDUCTED    -> CHAIN_BROADCASTED | REFUNDED (pay failure before broadcast)
    CHAIN_BROADCASTED -> DELIVERING | REFUNDED (chain reverted)
    DELIVERING        -> SUCCESS | DELIVERING (retry idempotent) | FAILED (retries exhausted)
    SUCCESS           -> (terminal)
    REFUNDED          -> (terminal)
    FAILED            -> (terminal)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from time import time
from uuid import uuid4

import aiosqlite

logger = logging.getLogger(__name__)


class OrderState(Enum):
    CREATED = "CREATED"
    LOCAL_DEDUCTED = "LOCAL_DEDUCTED"
    CHAIN_BROADCASTED = "CHAIN_BROADCASTED"
    DELIVERING = "DELIVERING"
    SUCCESS = "SUCCESS"
    REFUNDED = "REFUNDED"
    FAILED = "FAILED"


# Valid state transitions: {from_state: {allowed_target_states}}
_ALLOWED_TRANSITIONS: dict[OrderState, set[OrderState]] = {
    OrderState.CREATED: {OrderState.LOCAL_DEDUCTED},
    OrderState.LOCAL_DEDUCTED: {OrderState.CHAIN_BROADCASTED, OrderState.REFUNDED},
    OrderState.CHAIN_BROADCASTED: {OrderState.DELIVERING, OrderState.REFUNDED},
    OrderState.DELIVERING: {OrderState.SUCCESS, OrderState.DELIVERING, OrderState.FAILED},
    OrderState.SUCCESS: set(),      # terminal
    OrderState.REFUNDED: set(),     # terminal
    OrderState.FAILED: set(),       # terminal — delivery retries exhausted
}


class InvalidStateTransition(Exception):
    """Raised when attempting an invalid state transition."""


@dataclass
class PaymentOrder:
    """Represents a single payment order with strict state machine."""

    amount: float
    to_address: str
    token: str
    chain: str
    request_url: str
    request_method: str

    order_id: str = field(default_factory=lambda: str(uuid4()))
    state: OrderState = OrderState.CREATED
    wallet_tx_id: str = ""
    tx_hash: str = ""
    idempotency_key: str = ""
    retry_count: int = 0
    error_message: str = ""
    created_at: float = field(default_factory=time)
    updated_at: float = field(default_factory=time)
    request_headers: str = ""
    request_body: bytes = b""

    def __post_init__(self) -> None:
        if not self.idempotency_key:
            self.idempotency_key = self.order_id

    def transition_to(
        self,
        new_state: OrderState,
        *,
        wallet_tx_id: str = "",
        tx_hash: str = "",
        error_message: str = "",
    ) -> None:
        """Transition to a new state, enforcing the state machine rules.

        Raises:
            InvalidStateTransition: if the transition is not allowed.
        """
        allowed = _ALLOWED_TRANSITIONS.get(self.state, set())
        if new_state not in allowed:
            raise InvalidStateTransition(
                f"Cannot transition from {self.state.value} to {new_state.value}. "
                f"Allowed: {sorted(s.value for s in allowed)}"
            )

        # Update fields based on transition
        if wallet_tx_id:
            self.wallet_tx_id = wallet_tx_id
        if tx_hash:
            self.tx_hash = tx_hash
        if error_message:
            self.error_message = error_message

        old_state = self.state
        self.state = new_state
        self.updated_at = time()

        logger.info(
            "[ORDER] %s: %s -> %s (tx_hash=%s)",
            self.order_id[:8], old_state.value, new_state.value,
            self.tx_hash[:16] if self.tx_hash else "n/a",
        )


class PaymentOrderStore:
    """SQLite-backed persistent store for payment orders."""

    def __init__(self, db_path: str = "x402_orders.db") -> None:
        self.db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def init_db(self) -> None:
        import os

        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

        self._db = await aiosqlite.connect(self.db_path, timeout=10.0)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("PRAGMA busy_timeout=5000")
        await self._db.execute("PRAGMA synchronous=FULL")  # H-4 FIX: match all other SQLite stores
        await self._db.execute(
            """
            CREATE TABLE IF NOT EXISTS payment_orders (
                order_id TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                amount REAL NOT NULL,
                to_address TEXT NOT NULL,
                token TEXT NOT NULL,
                chain TEXT NOT NULL,
                request_url TEXT NOT NULL,
                request_method TEXT NOT NULL,
                wallet_tx_id TEXT DEFAULT '',
                tx_hash TEXT DEFAULT '',
                idempotency_key TEXT NOT NULL,
                retry_count INTEGER DEFAULT 0,
                error_message TEXT DEFAULT '',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                request_headers TEXT DEFAULT '',
                request_body BLOB DEFAULT x''
            )
            """
        )
        await self._db.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_state ON payment_orders(state)"
        )
        await self._db.execute(
            "CREATE INDEX IF NOT EXISTS idx_orders_updated ON payment_orders(updated_at)"
        )
        await self._db.commit()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def save(self, order: PaymentOrder) -> None:
        """Insert or replace a payment order."""
        await self._db.execute(
            """
            INSERT OR REPLACE INTO payment_orders
            (order_id, state, amount, to_address, token, chain,
             request_url, request_method, wallet_tx_id, tx_hash,
             idempotency_key, retry_count, error_message,
             created_at, updated_at, request_headers, request_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                order.order_id,
                order.state.value,
                order.amount,
                order.to_address,
                order.token,
                order.chain,
                order.request_url,
                order.request_method,
                order.wallet_tx_id,
                order.tx_hash,
                order.idempotency_key,
                order.retry_count,
                order.error_message,
                order.created_at,
                order.updated_at,
                order.request_headers,
                order.request_body,
            ),
        )
        await self._db.commit()

    async def update(self, order: PaymentOrder) -> None:
        """Update an existing order's mutable fields."""
        await self._db.execute(
            """
            UPDATE payment_orders SET
                state = ?, wallet_tx_id = ?, tx_hash = ?,
                retry_count = ?, error_message = ?, updated_at = ?
            WHERE order_id = ?
            """,
            (
                order.state.value,
                order.wallet_tx_id,
                order.tx_hash,
                order.retry_count,
                order.error_message,
                order.updated_at,
                order.order_id,
            ),
        )
        await self._db.commit()

    async def get(self, order_id: str) -> PaymentOrder | None:
        """Load a single order by ID."""
        cursor = await self._db.execute(
            """
            SELECT order_id, state, amount, to_address, token, chain,
                   request_url, request_method, wallet_tx_id, tx_hash,
                   idempotency_key, retry_count, error_message,
                   created_at, updated_at, request_headers, request_body
            FROM payment_orders WHERE order_id = ?
            """,
            (order_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_order(row)

    async def get_by_state(self, state: OrderState) -> list[PaymentOrder]:
        """Get all orders in a given state."""
        cursor = await self._db.execute(
            """
            SELECT order_id, state, amount, to_address, token, chain,
                   request_url, request_method, wallet_tx_id, tx_hash,
                   idempotency_key, retry_count, error_message,
                   created_at, updated_at, request_headers, request_body
            FROM payment_orders WHERE state = ?
            ORDER BY created_at ASC
            """,
            (state.value,),
        )
        rows = await cursor.fetchall()
        return [self._row_to_order(r) for r in rows]

    async def get_stale_deliveries(self, max_age_seconds: float = 60.0) -> list[PaymentOrder]:
        """Get orders in DELIVERING state older than max_age_seconds.

        Used by the delivery retry worker to find stuck orders that need
        to be retried (payment succeeded on-chain, but the API response
        was never received by the buyer).
        """
        cutoff = time() - max_age_seconds
        cursor = await self._db.execute(
            """
            SELECT order_id, state, amount, to_address, token, chain,
                   request_url, request_method, wallet_tx_id, tx_hash,
                   idempotency_key, retry_count, error_message,
                   created_at, updated_at, request_headers, request_body
            FROM payment_orders
            WHERE state = ? AND updated_at < ?
            ORDER BY updated_at ASC
            """,
            (OrderState.DELIVERING.value, cutoff),
        )
        rows = await cursor.fetchall()
        return [self._row_to_order(r) for r in rows]

    @staticmethod
    def _row_to_order(row: tuple) -> PaymentOrder:
        """Convert a database row to a PaymentOrder."""
        return PaymentOrder(
            order_id=row[0],
            state=OrderState(row[1]),
            amount=row[2],
            to_address=row[3],
            token=row[4],
            chain=row[5],
            request_url=row[6],
            request_method=row[7],
            wallet_tx_id=row[8],
            tx_hash=row[9],
            idempotency_key=row[10],
            retry_count=row[11],
            error_message=row[12],
            created_at=row[13],
            updated_at=row[14],
            request_headers=row[15],
            request_body=row[16] if row[16] else b"",
        )
