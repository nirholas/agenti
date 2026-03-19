"""Abstract base class for payment providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PaymentResult:
    """Result of a payment operation."""

    tx_hash: str
    success: bool
    error: str = ""
    chain: str = ""
    memo: str = ""
    confirmation_status: str = ""
    """Confirmation status of the transaction.

    Possible values:
    - ``"confirmed"`` or ``"finalized"`` — transaction confirmed at requested level
    - ``"unconfirmed"`` — transaction broadcast but confirmation timed out or failed;
      money may be at risk; caller should log CRITICAL and verify manually
    - ``"sent"`` — legacy alias, same semantics as ``"unconfirmed"``
    - ``"failed"`` — transaction confirmed but failed on-chain (e.g. insufficient balance)
    - ``""`` — not applicable (mock, or failed before send)
    """
    request_id: str = ""
    """Unique request identifier embedded in memo for idempotency.

    Format in memo: ``Ag402-v1|<request_id>``
    Used by the gateway to deduplicate payment proofs.
    """


class BasePaymentProvider(ABC):
    """Abstract payment provider -- all adapters must implement these."""

    @abstractmethod
    async def pay(
        self, to_address: str, amount: float, token: str = "USDC",
        *, request_id: str = "",
    ) -> PaymentResult:
        """Execute a payment on-chain. Returns tx_hash on success.

        Args:
            request_id: Optional unique identifier embedded in the transaction
                memo for idempotency (format: ``Ag402-v1|<request_id>``).
        """
        ...

    @abstractmethod
    async def check_balance(self) -> float:
        """Check available balance in the payment account."""
        ...

    @abstractmethod
    async def verify_payment(
        self,
        tx_hash: str,
        expected_amount: float = 0,
        expected_address: str = "",
        expected_sender: str = "",
    ) -> bool:
        """Verify a payment transaction exists and is confirmed on-chain.

        When ``expected_amount > 0`` the implementation SHOULD also check that
        the on-chain transfer amount is >= expected_amount and that the
        recipient matches ``expected_address``.

        When ``expected_sender`` is provided, the implementation MUST verify
        that the transaction was sent by the claimed payer address.  This
        prevents attackers from re-using third-party tx_hashes as payment
        proofs.

        Subclasses that cannot inspect on-chain data (e.g. MockSolanaAdapter)
        may accept any well-formed tx_hash.
        """
        ...

    @abstractmethod
    def get_address(self) -> str:
        """Return this wallet's public address."""
        ...
