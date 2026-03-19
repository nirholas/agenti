"""Unit tests for smart account signing utilities."""

from ampersend_sdk.smart_account import SmartAccountConfig
from ampersend_sdk.x402.wallets.smart_account.exact import sign_erc3009_authorization
from eth_account import Account
from eth_utils.conversions import to_hex
from x402_a2a.types import EIP3009Authorization


class TestSignERC3009Authorization:
    """Test ERC-3009 authorization signing."""

    def test_sign_authorization(self) -> None:
        """Test signing an ERC-3009 authorization."""
        # Generate test private key
        private_key = "0x" + "a" * 64
        account = Account.from_key(private_key)

        smart_account = "0x1234567890123456789012345678901234567890"
        validator = "0x000000000013fdB5234E4E3162a810F54d9f7E98"
        token = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

        authorization = EIP3009Authorization.model_validate(
            {
                "from": smart_account,
                "to": "0x9876543210987654321098765432109876543210",
                "value": "1000000",  # 1 USDC (6 decimals)
                "validAfter": "0",
                "validBefore": "9999999999",
                "nonce": "0x" + "00" * 32,
            }
        )

        signature = sign_erc3009_authorization(
            config=SmartAccountConfig(
                smart_account_address=smart_account,
                session_key=private_key,
                validator_address=validator,
            ),
            authorization=authorization,
            domain_name="USDC",
            domain_version="2",
            domain_verifying_contract=token,
            domain_chain_id=84532,  # Base Sepolia
        )

        # Should return a hex string
        assert signature.startswith("0x")

        # Should be validator (20 bytes) + signature (65 bytes)
        sig_bytes = bytes.fromhex(signature[2:])
        assert len(sig_bytes) == 85

        # First 20 bytes should be validator
        assert to_hex(sig_bytes[:20]) == validator.lower()

    def test_signature_structure(self) -> None:
        """Test that the signature has the correct structure."""
        private_key = "0x" + "b" * 64
        smart_account = "0x1234567890123456789012345678901234567890"
        validator = "0x000000000013fdB5234E4E3162a810F54d9f7E98"
        token = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

        authorization = EIP3009Authorization.model_validate(
            {
                "from": smart_account,
                "to": "0x9876543210987654321098765432109876543210",
                "value": "1000000",
                "validAfter": "100",
                "validBefore": "200",
                "nonce": "0x" + "01" * 32,
            }
        )

        signature = sign_erc3009_authorization(
            config=SmartAccountConfig(
                smart_account_address=smart_account,
                session_key=private_key,
                validator_address=validator,
            ),
            authorization=authorization,
            domain_name="USDC",
            domain_version="2",
            domain_verifying_contract=token,
            domain_chain_id=84532,  # Base Sepolia
        )

        # Verify structure
        assert signature.startswith("0x")
        sig_bytes = bytes.fromhex(signature[2:])

        # Should be validator (20 bytes) + signature (65 bytes) = 85 bytes
        assert len(sig_bytes) == 85

        # First 20 bytes should be validator address
        assert to_hex(sig_bytes[:20]) == validator.lower()

        # Remaining 65 bytes should be signature (r + s + v)
        signature_part = sig_bytes[20:]
        assert len(signature_part) == 65
