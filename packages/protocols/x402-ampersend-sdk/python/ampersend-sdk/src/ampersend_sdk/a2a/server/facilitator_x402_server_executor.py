from typing import Any

from x402_a2a import (
    FacilitatorClient,
    FacilitatorConfig,
    x402ExtensionConfig,
)
from x402_a2a.types import (
    AgentExecutor,
    PaymentPayload,
    PaymentRequirements,
    SettleResponse,
    VerifyResponse,
)

from .x402_server_executor import X402ServerExecutor, X402ServerExecutorFactory


class FacilitatorX402ServerExecutor(X402ServerExecutor):
    def __init__(
        self,
        *,
        delegate: AgentExecutor,
        config: x402ExtensionConfig,
        facilitator_config: FacilitatorConfig | None = None,
        **kwargs: Any,
    ):
        super().__init__(delegate=delegate, config=config, **kwargs)
        self._facilitator = FacilitatorClient(facilitator_config)

    async def verify_payment(
        self, payload: PaymentPayload, requirements: PaymentRequirements
    ) -> VerifyResponse:
        """Verifies the payment with the facilitator."""
        return await self._facilitator.verify(payload, requirements)

    async def settle_payment(
        self, payload: PaymentPayload, requirements: PaymentRequirements
    ) -> SettleResponse:
        """Settles the payment with the facilitator."""
        return await self._facilitator.settle(payload, requirements)


def create_facilitator_executor_factory(
    facilitator_config: FacilitatorConfig | None = None,
    **kwargs: Any,
) -> X402ServerExecutorFactory:
    """Create a factory for FacilitatorX402ServerExecutor instances.

    Args:
        facilitator_config: Optional facilitator configuration
        **kwargs: Additional kwargs to pass to FacilitatorX402ServerExecutor

    Returns:
        Factory function that creates FacilitatorX402ServerExecutor instances

    Example:
        >>> factory = create_facilitator_executor_factory(
        ...     facilitator_config=FacilitatorConfig(url="https://facilitator.example.com")
        ... )
        >>> executor = X402A2aAgentExecutor(
        ...     runner=runner,
        ...     x402_executor_factory=factory,
        ... )
    """

    def factory(
        *,
        delegate: AgentExecutor,
        config: x402ExtensionConfig,
    ) -> FacilitatorX402ServerExecutor:
        return FacilitatorX402ServerExecutor(
            delegate=delegate,
            config=config,
            facilitator_config=facilitator_config,
            **kwargs,
        )

    return factory
