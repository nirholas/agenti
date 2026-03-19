from unittest.mock import MagicMock

import pytest
from ampersend_sdk.smart_account import (
    SmartAccountConfig,
)
from ampersend_sdk.x402.wallets.smart_account import (
    SmartAccountWallet,
)


@pytest.mark.asyncio
class TestSmartAccountWallet:
    async def test_create_payment(self) -> None:
        smart_account_address = "0x1234567890123456789012345678901234567890"
        wallet = SmartAccountWallet(
            config=SmartAccountConfig(
                smart_account_address=smart_account_address,
                session_key="0x" + "a" * 64,
                validator_address=smart_account_address,
            )
        )

        pay_to = "0x9876543210987654321098765432109876543210"
        requirements = MagicMock(
            scheme="exact",
            pay_to=pay_to,
            asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            max_amount_required="1000000",
            max_timeout_seconds=3600,
            network="base-sepolia",
            extra={"version": "2", "name": "USDC"},
        )

        payment = wallet.create_payment(requirements=requirements)

        # Check payment structure
        assert payment.scheme == "exact"
        assert payment.x402_version == 1
        assert hasattr(payment.payload, "signature")
        assert hasattr(payment.payload, "authorization")

        # Check authorization data
        auth = payment.payload.authorization
        assert auth.from_ == smart_account_address
        assert auth.to == pay_to
