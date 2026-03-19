from typing import Any, Dict, NamedTuple

from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils.conversions import to_bytes, to_hex

from .constants import OWNABLE_VALIDATOR


class SmartAccountConfig(NamedTuple):
    """Configuration for smart account operations."""

    session_key: str
    smart_account_address: str
    validator_address: str = OWNABLE_VALIDATOR


def encode_1271_signature(
    smart_account_address: str, validator_address: str, signature: bytes
) -> str:
    """
    Encode a signature for ERC-1271 validation.

    Packs the validator address with the signature. If account equals validator,
    adjusts the v value in the signature (adds 4 if v < 30).

    This matches the logic from @rhinestone/module-sdk's encode1271Signature.

    Args:
        smart_account_address: The smart account address (0x...)
        validator_address: The validator module address (0x...)
        signature: The raw signature bytes (65 bytes: r+s+v)

    Returns:
        Hex string of packed signature (validator_address + signature)
    """
    formatted_signature = signature

    # If account == validator: adjust v value
    if smart_account_address.lower() == validator_address.lower():
        # Extract v (last byte)
        v = signature[64]
        if v < 30:
            # Replace v with v + 4
            formatted_signature = signature[:64] + bytes([v + 4])

    # Pack: validator address (20 bytes) + signature
    # Using manual concatenation to avoid ABI encoding length prefixes
    validator_bytes = to_bytes(hexstr=validator_address)
    packed = validator_bytes + formatted_signature

    return to_hex(packed)


def smart_account_sign_typed_data(
    config: SmartAccountConfig,
    domain: Dict[str, Any],
    types: Dict[str, Any],
    message: Dict[str, Any],
    primary_type: str,
) -> str:
    """
    Sign typed data for a smart account using OwnableValidator.

    This function:
    1. Signs the typed data with the agent's private key (EOA signature)
    2. Encodes the signature for ERC-1271 validation by the smart account

    Args:
        session_key: Private key (0x...)
        smart_account_address: Smart account address (0x...)
        validator_address: OwnableValidator module address (0x...)
        domain: EIP-712 domain
        types: EIP-712 types (including EIP712Domain)
        message: EIP-712 message
        primary_type: Primary type name

    Returns:
        ERC-1271 encoded signature (hex string)
    """
    # 1. Create account from private key
    account = Account.from_key(config.session_key)

    # 2. Create typed data structure
    typed_data = {
        "types": types,
        "primaryType": primary_type,
        "domain": domain,
        "message": message,
    }

    # 3. Sign with EOA
    signable_message = encode_typed_data(full_message=typed_data)
    signed_message = account.sign_message(signable_message)

    # 4. Get raw signature bytes (r+s+v format, 65 bytes)
    signature_bytes = signed_message.signature

    # 5. Encode for ERC-1271 (OwnableValidator threshold=1, so no concatenation)
    return encode_1271_signature(
        smart_account_address=config.smart_account_address,
        validator_address=config.validator_address,
        signature=signature_bytes,
    )
