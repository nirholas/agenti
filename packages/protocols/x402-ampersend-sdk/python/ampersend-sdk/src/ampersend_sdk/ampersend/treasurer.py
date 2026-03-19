import logging
import uuid
from typing import Any

from x402_a2a.types import (
    PaymentStatus,
    x402PaymentRequiredResponse,
)

from ampersend_sdk.x402 import X402Authorization, X402Treasurer, X402Wallet

from .client import ApiClient
from .types import (
    PaymentEvent,
    PaymentEventAccepted,
    PaymentEventError,
    PaymentEventRejected,
    PaymentEventSending,
)

logger = logging.getLogger(__name__)


class AmpersendTreasurer(X402Treasurer):
    """
    Ampersend API treasurer with authorization checks and event reporting.

    Works with both EOA and smart account payment methods via the
    X402Wallet protocol.
    """

    def __init__(self, api_client: ApiClient, wallet: X402Wallet):
        """
        Initialize Ampersend treasurer.

        Args:
            api_client: ApiClient instance for authorization checks
            wallet: X402Wallet for creating payment payloads
        """
        self._api_client = api_client
        self._wallet = wallet

    async def onPaymentRequired(
        self,
        payment_required: x402PaymentRequiredResponse,
        context: dict[str, Any] | None = None,
    ) -> X402Authorization | None:
        result = await self._api_client.authorize_payment(
            payment_required.accepts, context
        )

        # Check if any requirements were authorized
        if not result.authorized.requirements:
            # Log rejection reasons for debugging
            reasons = ", ".join(
                [f"{r.requirement.resource}: {r.reason}" for r in result.rejected]
            )
            logger.info(
                "No requirements authorized. Reasons: %s",
                reasons,
            )
            return None

        # Use recommended requirement (or first if recommended is None)
        recommended_index = (
            result.authorized.recommended
            if result.authorized.recommended is not None
            else 0
        )

        # Validate recommended index is within bounds
        if recommended_index >= len(result.authorized.requirements):
            raise ValueError(
                f"Invalid recommended index {recommended_index}, "
                f"only {len(result.authorized.requirements)} requirements authorized"
            )

        authorized_req = result.authorized.requirements[recommended_index]

        # Create payment with wallet using the authorized requirement
        payment = self._wallet.create_payment(
            requirements=authorized_req.requirement,
        )
        authorization_id = uuid.uuid4().hex

        await self._api_client.report_payment_event(
            event_id=authorization_id,
            payment=payment,
            event=PaymentEventSending(),
        )

        return X402Authorization(
            authorization_id=authorization_id,
            payment=payment,
            selected_requirement=authorized_req.requirement,
        )

    async def onStatus(
        self,
        status: PaymentStatus,
        authorization: X402Authorization,
        context: dict[str, Any] | None = None,
    ) -> None:
        # Map status to appropriate event type
        event: PaymentEvent | None = None

        if status == PaymentStatus.PAYMENT_SUBMITTED:
            event = PaymentEventSending()
        elif status == PaymentStatus.PAYMENT_FAILED:
            # Extract reason from context if available, otherwise use default
            reason = "Payment processing failed"
            if context and isinstance(context, dict):
                reason = context.get("reason", reason)
            event = PaymentEventError(reason=reason)
        elif status == PaymentStatus.PAYMENT_REJECTED:
            # Extract reason from context if available, otherwise use default
            reason = "Payment rejected by server"
            if context and isinstance(context, dict):
                reason = context.get("reason", reason)
            event = PaymentEventRejected(reason=reason)
        elif status in (
            PaymentStatus.PAYMENT_VERIFIED,
            PaymentStatus.PAYMENT_COMPLETED,
        ):
            event = PaymentEventAccepted()

        # Only report events we care about
        if event is None:
            return

        await self._api_client.report_payment_event(
            event_id=authorization.authorization_id,
            payment=authorization.payment,
            event=event,
        )


DEFAULT_API_URL = "https://api.ampersend.ai"


def create_ampersend_treasurer(
    *,
    smart_account_address: str,
    session_key_private_key: str,
    api_url: str = DEFAULT_API_URL,
) -> AmpersendTreasurer:
    """
    Create an AmpersendTreasurer with minimal configuration.

    This is the recommended way to create a treasurer for most use cases.

    Args:
        smart_account_address: The smart account address (0x...)
        session_key_private_key: The session key private key (0x...)
        api_url: Ampersend API URL (defaults to production)

    Returns:
        Configured AmpersendTreasurer ready for use

    Example:
        treasurer = create_ampersend_treasurer(
            smart_account_address="0x1234...",
            session_key_private_key="0xabcd...",
        )
    """
    from ampersend_sdk.smart_account import SmartAccountConfig
    from ampersend_sdk.x402.wallets.smart_account import SmartAccountWallet

    from .types import ApiClientOptions

    wallet = SmartAccountWallet(
        config=SmartAccountConfig(
            session_key=session_key_private_key,
            smart_account_address=smart_account_address,
        )
    )

    api_client = ApiClient(
        options=ApiClientOptions(
            base_url=api_url,
            session_key_private_key=session_key_private_key,
            agent_address=smart_account_address,
        )
    )

    return AmpersendTreasurer(api_client=api_client, wallet=wallet)
