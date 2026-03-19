"""Tests for enhanced budget guard — per-minute limits, circuit breaker, MAX_SINGLE_TX."""

from __future__ import annotations

import time

import pytest
from ag402_core.config import MAX_SINGLE_TX, RunMode, X402Config
from ag402_core.middleware.budget_guard import BudgetGuard
from ag402_core.wallet.agent_wallet import AgentWallet

# =====================================================================
# Helper
# =====================================================================


def _cfg(**overrides) -> X402Config:
    defaults = {
        "mode": RunMode.TEST,
        "single_tx_limit": 5.0,
        "per_minute_limit": 2.0,
        "per_minute_count": 5,
        "circuit_breaker_threshold": 3,
        "circuit_breaker_cooldown": 60,
    }
    defaults.update(overrides)
    return X402Config(**defaults)


async def _make_wallet(tmp_path, balance: float = 100.0) -> AgentWallet:
    db_path = str(tmp_path / "budget_test.db")
    wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
    await wallet.init_db()
    if balance > 0:
        await wallet.deposit(balance, note="test setup")
    return wallet


# =====================================================================
# Per-minute Spend Limit
# =====================================================================


class TestPerMinuteSpendLimit:
    @pytest.mark.asyncio
    async def test_per_minute_spend_blocks(self, tmp_path):
        """Spending over per_minute_limit within a minute is blocked."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(per_minute_limit=1.0, per_minute_count=100)
        guard = BudgetGuard(wallet, config)

        # Deduct $0.80 directly via wallet
        await wallet.deduct(0.80, "addr1")

        # Budget guard should still allow $0.15 (total = $0.95 < $1.0)
        result = await guard.check(0.15)
        assert result.allowed

        # But $0.30 would push over the minute limit (0.80 + 0.30 = 1.10 > 1.0)
        result = await guard.check(0.30)
        assert not result.allowed
        assert "per-minute" in result.reason.lower() or "Per-minute" in result.reason

        await wallet.close()

    @pytest.mark.asyncio
    async def test_per_minute_spend_allows_below_limit(self, tmp_path):
        """Spending below per_minute_limit is allowed."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(per_minute_limit=5.0, per_minute_count=100)
        guard = BudgetGuard(wallet, config)

        result = await guard.check(1.0)
        assert result.allowed

        await wallet.close()


# =====================================================================
# Per-minute Count Limit
# =====================================================================


class TestPerMinuteCountLimit:
    @pytest.mark.asyncio
    async def test_per_minute_count_blocks(self, tmp_path):
        """Exceeding per_minute_count within a minute is blocked."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(per_minute_limit=100.0, per_minute_count=3)
        guard = BudgetGuard(wallet, config)

        # Perform 3 deductions (= the count limit)
        for i in range(3):
            await wallet.deduct(0.01, f"addr_{i}")

        # 4th request should be blocked by count
        result = await guard.check(0.01)
        assert not result.allowed
        assert "count" in result.reason.lower()

        await wallet.close()

    @pytest.mark.asyncio
    async def test_per_minute_count_allows_below_limit(self, tmp_path):
        """Below count limit is allowed."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(per_minute_limit=100.0, per_minute_count=10)
        guard = BudgetGuard(wallet, config)

        # 2 deductions, limit is 10
        await wallet.deduct(0.01, "addr1")
        await wallet.deduct(0.01, "addr2")

        result = await guard.check(0.01)
        assert result.allowed

        await wallet.close()


# =====================================================================
# Circuit Breaker
# =====================================================================


class TestCircuitBreaker:
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_failures(self, tmp_path):
        """3 consecutive failures should open the circuit breaker."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(circuit_breaker_threshold=3, circuit_breaker_cooldown=60)
        guard = BudgetGuard(wallet, config)

        # Record 3 failures via instance
        guard.record_failure()
        guard.record_failure()
        guard.record_failure()

        # Circuit should be open — deny even valid requests
        result = await guard.check(0.01)
        assert not result.allowed
        assert "circuit breaker" in result.reason.lower()

        await wallet.close()

    @pytest.mark.asyncio
    async def test_circuit_breaker_allows_before_threshold(self, tmp_path):
        """Fewer failures than threshold should not open circuit."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(circuit_breaker_threshold=3, circuit_breaker_cooldown=60)
        guard = BudgetGuard(wallet, config)

        guard.record_failure()
        guard.record_failure()

        result = await guard.check(0.01)
        assert result.allowed

        await wallet.close()

    @pytest.mark.asyncio
    async def test_circuit_breaker_cooldown_resets(self, tmp_path):
        """After cooldown, circuit breaker resets and allows requests."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        # Very short cooldown for testing
        config = _cfg(circuit_breaker_threshold=3, circuit_breaker_cooldown=1)
        guard = BudgetGuard(wallet, config)

        # Open the circuit
        guard.record_failure()
        guard.record_failure()
        guard.record_failure()

        # Should be blocked
        result = await guard.check(0.01)
        assert not result.allowed

        # Wait for cooldown
        time.sleep(1.1)

        # Should be allowed again
        result = await guard.check(0.01)
        assert result.allowed

        await wallet.close()

    @pytest.mark.asyncio
    async def test_success_resets_failure_counter(self, tmp_path):
        """A success should reset the consecutive failure count."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(circuit_breaker_threshold=3, circuit_breaker_cooldown=60)
        guard = BudgetGuard(wallet, config)

        guard.record_failure()
        guard.record_failure()
        guard.record_success()

        # Should not have tripped
        result = await guard.check(0.01)
        assert result.allowed

        # Another failure after success — only 1 failure now
        guard.record_failure()
        result = await guard.check(0.01)
        assert result.allowed

        await wallet.close()


# =====================================================================
# MAX_SINGLE_TX Enforcement
# =====================================================================


class TestMaxSingleTx:
    def test_max_single_tx_constant(self):
        """MAX_SINGLE_TX should be 5.0."""
        assert MAX_SINGLE_TX == 5.0

    @pytest.mark.asyncio
    async def test_amount_exceeding_hardcoded_max_blocked(self, tmp_path):
        """Amount > MAX_SINGLE_TX (5.0) is always blocked, even if config allows it."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        # Config allows up to 10, but hardcoded max is 5
        config = _cfg(single_tx_limit=10.0, per_minute_limit=100.0, per_minute_count=1000)
        guard = BudgetGuard(wallet, config)

        result = await guard.check(6.0)
        assert not result.allowed
        assert "ceiling" in result.reason.lower() or "hardcoded" in result.reason.lower()

        await wallet.close()

    @pytest.mark.asyncio
    async def test_amount_at_max_allowed(self, tmp_path):
        """Amount exactly at MAX_SINGLE_TX should be allowed."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(single_tx_limit=5.0, per_minute_limit=100.0, per_minute_count=1000)
        guard = BudgetGuard(wallet, config)

        result = await guard.check(5.0)
        assert result.allowed

        await wallet.close()

    @pytest.mark.asyncio
    async def test_config_limit_capped_by_max(self, tmp_path):
        """If config single_tx_limit > MAX_SINGLE_TX, it's capped."""
        wallet = await _make_wallet(tmp_path, balance=100.0)
        config = _cfg(single_tx_limit=100.0, per_minute_limit=100.0, per_minute_count=1000)
        guard = BudgetGuard(wallet, config)

        # $5.01 should be blocked by the hardcoded ceiling
        result = await guard.check(5.01)
        assert not result.allowed

        await wallet.close()
