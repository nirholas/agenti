"""Unit tests for smart account signing utilities."""

from ampersend_sdk.smart_account.sign import encode_1271_signature
from eth_utils.conversions import to_hex


class TestEncode1271Signature:
    """Test ERC-1271 signature encoding."""

    def test_encode_with_different_addresses(self) -> None:
        """Test encoding when account != validator."""
        smart_account = "0x1234567890123456789012345678901234567890"
        validator = "0x000000000013fdB5234E4E3162a810F54d9f7E98"

        # Mock signature (65 bytes: r+s+v)
        signature = bytes([0] * 64 + [27])  # v = 27

        result = encode_1271_signature(
            smart_account_address=smart_account,
            validator_address=validator,
            signature=signature,
        )

        # Should pack validator (20 bytes) + signature (65 bytes)
        assert result.startswith("0x")
        result_bytes = bytes.fromhex(result[2:])
        assert len(result_bytes) == 20 + 65  # 85 bytes

        # First 20 bytes should be validator address
        assert to_hex(result_bytes[:20]) == validator.lower()

    def test_encode_with_same_addresses_v_adjustment(self) -> None:
        """Test v value adjustment when account == validator."""
        address = "0x1234567890123456789012345678901234567890"

        # Signature with v < 30
        signature = bytes([0] * 64 + [27])  # v = 27

        result = encode_1271_signature(
            smart_account_address=address,
            validator_address=address,
            signature=signature,
        )

        result_bytes = bytes.fromhex(result[2:])

        # v should be adjusted: 27 + 4 = 31
        assert result_bytes[-1] == 31

    def test_encode_with_same_addresses_no_adjustment(self) -> None:
        """Test no v adjustment when v >= 30."""
        address = "0x1234567890123456789012345678901234567890"

        # Signature with v >= 30
        signature = bytes([0] * 64 + [35])  # v = 35

        result = encode_1271_signature(
            smart_account_address=address,
            validator_address=address,
            signature=signature,
        )

        result_bytes = bytes.fromhex(result[2:])

        # v should not be adjusted
        assert result_bytes[-1] == 35
