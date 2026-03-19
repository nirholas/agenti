from abc import ABC, abstractmethod
from typing import Any, NamedTuple

from x402.types import PaymentRequirements
from x402_a2a import (
    PaymentPayload,
    PaymentStatus,
    x402PaymentRequiredResponse,
)
from x402_a2a.types import PaymentStatus, x402PaymentRequiredResponse


class X402Authorization(NamedTuple):
    """Result of payment authorization containing payment details and ID."""

    payment: PaymentPayload
    authorization_id: str
    selected_requirement: PaymentRequirements


class X402Treasurer(ABC):
    @abstractmethod
    async def onPaymentRequired(
        self,
        payment_required: x402PaymentRequiredResponse,
        context: dict[str, Any] | None = None,
    ) -> X402Authorization | None:
        """Authorize or reject a payment."""

    @abstractmethod
    async def onStatus(
        self,
        status: PaymentStatus,
        authorization: X402Authorization,
        context: dict[str, Any] | None = None,
    ) -> None:
        """Handle payment status updates."""
