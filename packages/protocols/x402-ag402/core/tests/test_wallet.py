"""Tests for wallet layer."""

from __future__ import annotations

import asyncio

import pytest
from ag402_core.wallet.agent_wallet import (
    AgentWallet,
    DailyLimitExceeded,
    InsufficientBalance,
)
from ag402_core.wallet.faucet import init_testnet_faucet


@pytest.fixture
async def wallet(tmp_path):
    """Provide a fresh AgentWallet with a generous daily limit for general tests."""
    db_path = str(tmp_path / "test_wallet.db")
    w = AgentWallet(db_path=db_path, max_daily_spend=10_000.0)
    await w.init_db()
    yield w
    await w.close()


@pytest.fixture
async def strict_wallet(tmp_path):
    """Wallet with a low daily limit for budget-guard tests."""
    db_path = str(tmp_path / "strict_wallet.db")
    w = AgentWallet(db_path=db_path, max_daily_spend=10.0)
    await w.init_db()
    yield w
    await w.close()


async def test_deposit_and_balance(wallet: AgentWallet):
    await wallet.deposit(100.0)
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(100.0)


async def test_deduct_reduces_balance(wallet: AgentWallet):
    await wallet.deposit(100.0)
    await wallet.deduct(30.0, to_address="recipient_addr")
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(70.0)


async def test_deduct_insufficient_balance(wallet: AgentWallet):
    await wallet.deposit(10.0)
    with pytest.raises(InsufficientBalance):
        await wallet.deduct(20.0, to_address="recipient_addr")


async def test_rollback_restores_balance(wallet: AgentWallet):
    await wallet.deposit(100.0)
    tx = await wallet.deduct(30.0, to_address="recipient_addr")
    await wallet.rollback(tx.id)
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(100.0)


async def test_daily_spend_tracking(wallet: AgentWallet):
    await wallet.deposit(100.0)
    await wallet.deduct(3.0, to_address="a")
    await wallet.deduct(2.0, to_address="b")
    await wallet.deduct(1.5, to_address="c")
    daily = await wallet.get_daily_spend()
    assert float(daily) == pytest.approx(6.5)


async def test_daily_limit_exceeded(strict_wallet: AgentWallet):
    """strict_wallet has max_daily_spend=10.0"""
    await strict_wallet.deposit(100.0)
    with pytest.raises(DailyLimitExceeded):
        await strict_wallet.deduct(10.01, to_address="recipient_addr")


async def test_concurrent_deductions(wallet: AgentWallet):
    await wallet.deposit(100.0)

    results = []

    async def try_deduct():
        try:
            await wallet.deduct(10.0, to_address="concurrent_addr")
            results.append("ok")
        except InsufficientBalance:
            results.append("fail")

    tasks = [asyncio.create_task(try_deduct()) for _ in range(10)]
    await asyncio.gather(*tasks)

    assert results.count("ok") == 10
    assert results.count("fail") == 0
    balance = await wallet.get_balance()
    assert float(balance) == pytest.approx(0.0)


async def test_faucet_test_mode(tmp_path, monkeypatch):
    monkeypatch.setenv("X402_MODE", "test")
    db_path = str(tmp_path / "faucet_test.db")
    w = AgentWallet(db_path=db_path, max_daily_spend=10_000.0)
    await w.init_db()
    try:
        await init_testnet_faucet(w)
        balance = await w.get_balance()
        assert float(balance) == pytest.approx(100.0)
    finally:
        await w.close()


async def test_faucet_production_mode(tmp_path, monkeypatch):
    monkeypatch.setenv("X402_MODE", "production")
    db_path = str(tmp_path / "faucet_prod.db")
    w = AgentWallet(db_path=db_path)
    await w.init_db()
    try:
        await init_testnet_faucet(w)
        balance = await w.get_balance()
        assert float(balance) == pytest.approx(0.0)
    finally:
        await w.close()


async def test_get_transactions(wallet: AgentWallet):
    await wallet.deposit(100.0, note="initial deposit")
    await wallet.deduct(25.0, to_address="some_addr")
    txns = await wallet.get_transactions()
    assert len(txns) == 2
    types = {t.type for t in txns}
    assert types == {"deposit", "deduction"}
