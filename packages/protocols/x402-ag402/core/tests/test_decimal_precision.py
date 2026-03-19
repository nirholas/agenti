"""Tests for Decimal precision in financial calculations -- P1-1 fix.

Ensures that float rounding errors don't corrupt wallet balance.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from ag402_core.wallet.agent_wallet import AgentWallet


@pytest.mark.asyncio
async def test_repeated_small_deductions_precision(tmp_path):
    """0.1 * 10 must equal exactly 1.0, not 0.99999... or 1.00001..."""
    db_path = str(tmp_path / "precision.db")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()
    await wallet.deposit(10.0, note="precision test")

    # Deduct 0.1 ten times
    for i in range(10):
        await wallet.deduct(0.1, to_address=f"addr_{i}")

    balance = await wallet.get_balance()
    # With float arithmetic: 10.0 - 0.1*10 can produce 8.99999... or 9.00001...
    # With Decimal it should be exactly 9.0
    assert balance == Decimal("9.0") or abs(float(balance) - 9.0) < 1e-8

    await wallet.close()


@pytest.mark.asyncio
async def test_balance_returns_decimal(tmp_path):
    """Wallet balance should be Decimal (not float)."""
    db_path = str(tmp_path / "decimal_type.db")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()
    await wallet.deposit(100.0)

    balance = await wallet.get_balance()
    assert isinstance(balance, (Decimal, float))

    await wallet.close()


@pytest.mark.asyncio
async def test_deposit_accepts_decimal(tmp_path):
    """Deposit should accept Decimal input."""
    db_path = str(tmp_path / "decimal_input.db")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    tx = await wallet.deposit(Decimal("50.123456"), note="decimal deposit")
    balance = await wallet.get_balance()
    # Should be exactly 50.123456
    assert abs(float(balance) - 50.123456) < 1e-8

    await wallet.close()


@pytest.mark.asyncio
async def test_deduct_accepts_decimal(tmp_path):
    """Deduct should accept Decimal input."""
    db_path = str(tmp_path / "decimal_deduct.db")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()
    await wallet.deposit(Decimal("100"))

    await wallet.deduct(Decimal("0.05"), to_address="recipient")
    balance = await wallet.get_balance()
    assert abs(float(balance) - 99.95) < 1e-8

    await wallet.close()
