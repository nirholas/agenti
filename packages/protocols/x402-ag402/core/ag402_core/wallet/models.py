"""Wallet transaction data model."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from time import time
from uuid import uuid4


def _to_decimal(value: float | Decimal | str) -> Decimal:
    """Convert any numeric value to Decimal safely."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


@dataclass
class Transaction:
    id: str = field(default_factory=lambda: str(uuid4()))
    type: str = ""
    amount: Decimal = Decimal("0")
    to_address: str = ""
    tx_hash: str = ""
    status: str = "pending"
    timestamp: float = field(default_factory=time)
    note: str = ""

    def __post_init__(self) -> None:
        # Normalize amount to Decimal
        if not isinstance(self.amount, Decimal):
            self.amount = _to_decimal(self.amount)
