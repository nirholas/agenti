from x402_a2a import PaymentPayload, PaymentRequirements

from ....smart_account.sign import SmartAccountConfig
from .exact import smart_account_create_payment


class SmartAccountWallet:
    def __init__(self, config: SmartAccountConfig) -> None:
        self._config = config

    def create_payment(
        self,
        requirements: PaymentRequirements,
    ) -> PaymentPayload:
        return smart_account_create_payment(
            config=self._config,
            requirements=requirements,
        )
