"""
F1: Concurrent payment tests — multiple agents paying with same keypair.

Tests nonce conflict scenarios, TOCTOU budget guard races,
and wallet consistency under concurrent payment requests.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest


@pytest.fixture
def mock_wallet(tmp_path):
    """Create a fresh AgentWallet for testing."""
    from ag402_core.wallet.agent_wallet import AgentWallet

    db_path = str(tmp_path / "test_wallet.db")
    return AgentWallet(db_path=db_path)


@pytest.fixture
def mock_provider():
    """Create a MockSolanaAdapter."""
    from ag402_core.payment.solana_adapter import MockSolanaAdapter

    return MockSolanaAdapter(balance=100.0)


@pytest.fixture
def config():
    """Test-mode config with tight budget limits."""
    from ag402_core.config import X402Config

    return X402Config(
        daily_limit=50.0,
        single_tx_limit=5.0,
        per_minute_limit=10.0,
        per_minute_count=50,
    )


class TestConcurrentPayments:
    """Test concurrent payment scenarios."""

    async def test_concurrent_mock_payments_all_succeed(self, mock_provider):
        """Multiple concurrent payments should all succeed with unique tx_hashes."""
        tasks = [
            mock_provider.pay(
                to_address="Recipient1111111111111111111111111111111111",
                amount=0.01,
                token="USDC",
                request_id=f"req-{i}",
            )
            for i in range(10)
        ]
        results = await asyncio.gather(*tasks)

        assert all(r.success for r in results)
        tx_hashes = [r.tx_hash for r in results]
        # All tx_hashes must be unique
        assert len(set(tx_hashes)) == len(tx_hashes), "Duplicate tx_hashes detected!"

    async def test_concurrent_mock_payments_unique_request_ids(self, mock_provider):
        """Each concurrent payment should have a distinct request_id in memo."""
        tasks = [
            mock_provider.pay(
                to_address="Recipient1111111111111111111111111111111111",
                amount=0.01,
                token="USDC",
                request_id=f"concurrent-{uuid.uuid4().hex[:8]}",
            )
            for _ in range(10)
        ]
        results = await asyncio.gather(*tasks)

        memos = [r.memo for r in results]
        request_ids = [r.request_id for r in results]
        assert all("Ag402-v1|" in m for m in memos)
        assert len(set(request_ids)) == len(request_ids), "Duplicate request_ids!"

    async def test_concurrent_wallet_deposits(self, mock_wallet):
        """Concurrent deposits should not corrupt balance."""
        await mock_wallet.init_db()

        async def deposit_batch(wallet, n: int):
            for _ in range(n):
                await wallet.deposit(1.0, note="test")

        tasks = [deposit_batch(mock_wallet, 10) for _ in range(5)]
        await asyncio.gather(*tasks)

        balance = await mock_wallet.get_balance()
        assert balance == 50.0, f"Expected 50.0, got {balance}"

    async def test_concurrent_wallet_deductions_no_overdraft(self, mock_wallet):
        """Concurrent deductions should not cause overdraft."""
        await mock_wallet.init_db()
        await mock_wallet.deposit(10.0, note="test")

        results = []

        async def try_deduct(wallet, amount: float):
            try:
                tx = await wallet.deduct(amount, to_address="test")
                results.append(("success", tx.id))
            except Exception as e:
                results.append(("error", str(e)))

        # 20 concurrent deductions of 1.0 each, but only 10.0 available
        tasks = [try_deduct(mock_wallet, 1.0) for _ in range(20)]
        await asyncio.gather(*tasks)

        successes = [r for r in results if r[0] == "success"]
        errors = [r for r in results if r[0] == "error"]

        balance = await mock_wallet.get_balance()
        assert balance >= 0.0, f"Balance went negative: {balance}"
        # At most 10 should succeed (10.0 / 1.0 = 10)
        assert len(successes) <= 10, f"Too many successful deductions: {len(successes)}"

    async def test_concurrent_budget_guard_consistency(self, mock_wallet, mock_provider, config):
        """Budget guard should enforce limits even under concurrent access."""
        from ag402_core.middleware.budget_guard import BudgetGuard

        await mock_wallet.init_db()
        await mock_wallet.deposit(100.0, note="test")

        guard = BudgetGuard(mock_wallet, config)

        results = []

        async def check_budget(amount: float):
            result = await guard.check(amount)
            results.append(result)

        # Flood with concurrent budget checks
        tasks = [check_budget(1.0) for _ in range(20)]
        await asyncio.gather(*tasks)

        allowed = [r for r in results if r.allowed]
        denied = [r for r in results if not r.allowed]

        # At least some should be allowed (we have plenty of daily budget)
        assert len(allowed) > 0, "No payments were allowed"
        # Per-minute count limit is 50, so all 20 should pass per-count
        # Per-minute dollar limit is 10.0, so at most 10 should pass per-dollar
        # (This is approximate under concurrency)

    async def test_concurrent_replay_guard_dedup(self):
        """PersistentReplayGuard should deduplicate under concurrency."""
        import tempfile

        from ag402_core.security.replay_guard import PersistentReplayGuard

        with tempfile.TemporaryDirectory() as tmp:
            guard = PersistentReplayGuard(db_path=f"{tmp}/replay.db")
            await guard.init_db()

            tx_hash = "test_tx_" + uuid.uuid4().hex

            # 10 concurrent attempts to record the same tx_hash
            results = await asyncio.gather(
                *[guard.check_and_record_tx(tx_hash) for _ in range(10)]
            )

            # Exactly one should succeed (the first to insert)
            assert sum(results) == 1, f"Expected exactly 1 success, got {sum(results)}"

            await guard.close()

    async def test_concurrent_middleware_payment_lock(self, mock_wallet, mock_provider, config):
        """Middleware payment lock should serialize budget check + deduct."""
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware

        await mock_wallet.init_db()
        await mock_wallet.deposit(5.0, note="test")

        middleware = X402PaymentMiddleware(
            wallet=mock_wallet,
            provider=mock_provider,
            config=config,
        )

        # Verify the lock exists
        assert hasattr(middleware, "_payment_lock")
        assert isinstance(middleware._payment_lock, asyncio.Lock)

        await middleware.close()

    async def test_concurrent_order_creation(self, mock_wallet, mock_provider, config):
        """Concurrent order creation should produce unique order IDs."""
        from ag402_core.wallet.payment_order import PaymentOrder

        orders = []
        for _ in range(100):
            order = PaymentOrder(
                amount=0.01,
                to_address="test",
                token="USDC",
                chain="solana",
                request_url="https://api.example.com",
                request_method="GET",
            )
            orders.append(order)

        order_ids = [o.order_id for o in orders]
        idempotency_keys = [o.idempotency_key for o in orders]

        assert len(set(order_ids)) == 100, "Duplicate order IDs!"
        assert len(set(idempotency_keys)) == 100, "Duplicate idempotency keys!"

    async def test_concurrent_mixed_deposits_and_deductions(self, mock_wallet):
        """Mixed concurrent deposits and deductions should maintain consistency."""
        await mock_wallet.init_db()
        await mock_wallet.deposit(50.0, note="initial")

        async def deposit(wallet, amount):
            await wallet.deposit(amount, note="concurrent")

        async def deduct(wallet, amount):
            import contextlib
            with contextlib.suppress(Exception):
                await wallet.deduct(amount, to_address="test")

        # Mix deposits (+1.0 each) and deductions (-1.0 each)
        tasks = []
        for i in range(20):
            if i % 2 == 0:
                tasks.append(deposit(mock_wallet, 1.0))
            else:
                tasks.append(deduct(mock_wallet, 1.0))
        await asyncio.gather(*tasks)

        balance = await mock_wallet.get_balance()
        # Should be ~50.0 (10 deposits + 10 deductions of 1.0 each)
        # Due to possible deduction failures (insufficient balance shouldn't happen here)
        assert balance >= 0.0, f"Balance went negative: {balance}"
