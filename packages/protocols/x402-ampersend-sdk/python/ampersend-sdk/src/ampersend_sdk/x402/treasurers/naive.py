import uuid
from typing import Any, Dict

from x402_a2a import (
    PaymentStatus,
    x402PaymentRequiredResponse,
)
from x402_a2a.types import PaymentStatus, x402PaymentRequiredResponse

from ..treasurer import X402Authorization, X402Treasurer
from ..wallet import X402Wallet


class NaiveTreasurer(X402Treasurer):
    def __init__(self, wallet: X402Wallet):
        self._wallet = wallet

    async def onPaymentRequired(
        self,
        payment_required: x402PaymentRequiredResponse,
        context: Dict[str, Any] | None = None,
    ) -> X402Authorization | None:
        requirement = payment_required.accepts[0]
        payment = self._wallet.create_payment(requirements=requirement)
        return X402Authorization(
            payment=payment,
            authorization_id=uuid.uuid4().hex,
            selected_requirement=requirement,
        )

    async def onStatus(
        self,
        status: PaymentStatus,
        authorization: X402Authorization,
        context: Dict[str, Any] | None = None,
    ) -> None:
        pass
