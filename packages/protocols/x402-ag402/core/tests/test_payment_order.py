"""Tests for PaymentOrder state machine -- P0-1 fix.

Ensures strict uni-directional state transitions:
CREATED -> LOCAL_DEDUCTED -> CHAIN_BROADCASTED -> DELIVERING -> SUCCESS
                                                -> REFUNDED (only on chain failure)
"""

from __future__ import annotations

import pytest
from ag402_core.wallet.payment_order import (
    InvalidStateTransition,
    OrderState,
    PaymentOrder,
    PaymentOrderStore,
)


@pytest.fixture
async def store(tmp_path):
    """Provide a fresh PaymentOrderStore."""
    db_path = str(tmp_path / "orders.db")
    s = PaymentOrderStore(db_path=db_path)
    await s.init_db()
    yield s
    await s.close()


# ── State enum tests ──

class TestOrderState:
    def test_all_states_exist(self):
        assert OrderState.CREATED.value == "CREATED"
        assert OrderState.LOCAL_DEDUCTED.value == "LOCAL_DEDUCTED"
        assert OrderState.CHAIN_BROADCASTED.value == "CHAIN_BROADCASTED"
        assert OrderState.DELIVERING.value == "DELIVERING"
        assert OrderState.SUCCESS.value == "SUCCESS"
        assert OrderState.REFUNDED.value == "REFUNDED"


# ── PaymentOrder model tests ──

class TestPaymentOrderModel:
    def test_default_state_is_created(self):
        order = PaymentOrder(
            amount=0.05,
            to_address="SomeAddr123",
            token="USDC",
            chain="solana",
            request_url="https://example.com/api",
            request_method="GET",
        )
        assert order.state == OrderState.CREATED
        assert order.order_id != ""
        assert order.tx_hash == ""
        assert order.idempotency_key != ""

    def test_idempotency_key_equals_order_id(self):
        order = PaymentOrder(
            amount=0.05,
            to_address="SomeAddr123",
            token="USDC",
            chain="solana",
            request_url="https://example.com/api",
            request_method="GET",
        )
        assert order.idempotency_key == order.order_id


# ── State transition tests ──

class TestStateTransitions:
    def test_created_to_local_deducted(self):
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        assert order.state == OrderState.LOCAL_DEDUCTED
        assert order.wallet_tx_id == "tx123"

    def test_local_deducted_to_chain_broadcasted(self):
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="solana_tx_abc")
        assert order.state == OrderState.CHAIN_BROADCASTED
        assert order.tx_hash == "solana_tx_abc"

    def test_chain_broadcasted_to_delivering(self):
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="solana_tx_abc")
        order.transition_to(OrderState.DELIVERING)
        assert order.state == OrderState.DELIVERING

    def test_delivering_to_success(self):
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="solana_tx_abc")
        order.transition_to(OrderState.DELIVERING)
        order.transition_to(OrderState.SUCCESS)
        assert order.state == OrderState.SUCCESS

    def test_chain_broadcasted_to_refunded(self):
        """Only from CHAIN_BROADCASTED when chain tx actually failed/reverted."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="solana_tx_abc")
        order.transition_to(OrderState.REFUNDED)
        assert order.state == OrderState.REFUNDED

    def test_local_deducted_to_refunded_on_pay_failure(self):
        """Chain payment fails before broadcasting -> can refund from LOCAL_DEDUCTED."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.REFUNDED)
        assert order.state == OrderState.REFUNDED

    # ── Invalid transitions ──

    def test_cannot_skip_local_deducted(self):
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx")

    def test_cannot_go_backwards(self):
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.CREATED)

    def test_cannot_rollback_after_chain_broadcasted(self):
        """After CHAIN_BROADCASTED, cannot go back to LOCAL_DEDUCTED (prohibit rollback)."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx_abc")
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.LOCAL_DEDUCTED)

    def test_cannot_transition_from_success(self):
        """SUCCESS is terminal."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx_abc")
        order.transition_to(OrderState.DELIVERING)
        order.transition_to(OrderState.SUCCESS)
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.DELIVERING)

    def test_cannot_transition_from_refunded(self):
        """REFUNDED is terminal."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.REFUNDED)
        with pytest.raises(InvalidStateTransition):
            order.transition_to(OrderState.SUCCESS)

    def test_delivering_to_delivering_is_idempotent(self):
        """Re-entering same state (DELIVERING) for retry is allowed."""
        order = PaymentOrder(
            amount=0.05, to_address="Addr", token="USDC",
            chain="solana", request_url="https://e.com", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="tx123")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx_abc")
        order.transition_to(OrderState.DELIVERING)
        # Retry — entering same state should not raise
        order.transition_to(OrderState.DELIVERING)
        assert order.state == OrderState.DELIVERING


# ── Store persistence tests ──

class TestPaymentOrderStore:
    async def test_save_and_load(self, store: PaymentOrderStore):
        order = PaymentOrder(
            amount=0.05, to_address="Addr123", token="USDC",
            chain="solana", request_url="https://e.com/api", request_method="GET",
        )
        await store.save(order)
        loaded = await store.get(order.order_id)
        assert loaded is not None
        assert loaded.order_id == order.order_id
        assert loaded.amount == order.amount
        assert loaded.state == OrderState.CREATED

    async def test_update_state(self, store: PaymentOrderStore):
        order = PaymentOrder(
            amount=0.05, to_address="Addr123", token="USDC",
            chain="solana", request_url="https://e.com/api", request_method="GET",
        )
        await store.save(order)
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="wtx1")
        await store.update(order)

        loaded = await store.get(order.order_id)
        assert loaded.state == OrderState.LOCAL_DEDUCTED
        assert loaded.wallet_tx_id == "wtx1"

    async def test_get_nonexistent_returns_none(self, store: PaymentOrderStore):
        loaded = await store.get("nonexistent-id")
        assert loaded is None

    async def test_get_pending_deliveries(self, store: PaymentOrderStore):
        """Orders in DELIVERING state should be returned for background worker."""
        order1 = PaymentOrder(
            amount=0.05, to_address="Addr1", token="USDC",
            chain="solana", request_url="https://e.com/1", request_method="GET",
        )
        order1.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="w1")
        order1.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx1")
        order1.transition_to(OrderState.DELIVERING)
        await store.save(order1)

        order2 = PaymentOrder(
            amount=0.10, to_address="Addr2", token="USDC",
            chain="solana", request_url="https://e.com/2", request_method="POST",
        )
        await store.save(order2)  # stays in CREATED

        pending = await store.get_by_state(OrderState.DELIVERING)
        assert len(pending) == 1
        assert pending[0].order_id == order1.order_id

    async def test_get_stale_deliveries(self, store: PaymentOrderStore):
        """Orders stuck in DELIVERING longer than threshold."""
        import time

        order = PaymentOrder(
            amount=0.05, to_address="Addr1", token="USDC",
            chain="solana", request_url="https://e.com/1", request_method="GET",
        )
        order.transition_to(OrderState.LOCAL_DEDUCTED, wallet_tx_id="w1")
        order.transition_to(OrderState.CHAIN_BROADCASTED, tx_hash="tx1")
        order.transition_to(OrderState.DELIVERING)
        # Manually backdate the updated_at
        order.updated_at = time.time() - 120  # 2 minutes ago
        await store.save(order)

        stale = await store.get_stale_deliveries(max_age_seconds=60)
        assert len(stale) == 1
        assert stale[0].order_id == order.order_id
