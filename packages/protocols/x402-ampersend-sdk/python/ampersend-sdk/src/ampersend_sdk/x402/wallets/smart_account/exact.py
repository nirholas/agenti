"""
Smart account signing utilities for ERC-1271 signatures.

This module provides functions to sign typed data and ERC-3009 authorizations
using smart accounts (Safe + OwnableValidator) instead of plain EOA accounts.

The signatures are compatible with ERC-1271 validation and can be verified
on-chain by smart contract wallets.
"""

from x402.chains import get_chain_id
from x402.common import x402_VERSION
from x402.exact import prepare_payment_header
from x402_a2a import PaymentPayload, PaymentRequirements
from x402_a2a.types import (
    EIP3009Authorization,
    ExactPaymentPayload,
)

from ....smart_account.sign import SmartAccountConfig, smart_account_sign_typed_data


def sign_erc3009_authorization(
    config: SmartAccountConfig,
    authorization: EIP3009Authorization,
    domain_verifying_contract: str,
    domain_chain_id: int,
    domain_name: str,
    domain_version: str,
) -> str:
    """
    Sign an ERC-3009 transferWithAuthorization for a smart account.

    ERC-3009 is used by USDC and other tokens to allow gasless transfers
    via signed authorizations. This function creates a signature that
    can be used with the token's transferWithAuthorization function.

    Args:
        session_key: Agent's private key
        smart_account_address: Smart account address
        authorization: Authorization data
        domain_verifying_contract: Verifying contract address
        domain_chain_id: Chain ID (e.g., 84532 for Base Sepolia)
        validator_address: OwnableValidator address (default: deployed address)

    Returns:
        ERC-1271 encoded signature
    """
    # ERC-3009 domain
    domain = {
        "name": domain_name,
        "version": domain_version,
        "chainId": domain_chain_id,
        "verifyingContract": domain_verifying_contract,
    }

    types = {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"},
        ],
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    }

    return smart_account_sign_typed_data(
        config=config,
        domain=domain,
        types=types,
        message=authorization.model_dump(by_alias=True),
        primary_type="TransferWithAuthorization",
    )


def smart_account_create_payment(
    requirements: PaymentRequirements,
    config: SmartAccountConfig,
) -> PaymentPayload:
    """
    Create a payment payload with smart account signature.

    This function constructs a complete x402 PaymentPayload for the exact scheme
    using a smart account signature. It handles nonce generation, timestamp
    calculation, authorization data creation, signing, and payload construction.

    Used internally by smart_account_create_payment factory and can be called
    directly for advanced use cases.

    Args:
        requirements: Single PaymentRequirements from x402 server
        smart_account_address: Smart account address
        agent_private_key: Agent key private key (owner of smart account)
        chain_id: Chain ID (e.g., 84532 for Base Sepolia)
        validator_address: OwnableValidator address (default: deployed address)

    Returns:
        PaymentPayload ready to submit to x402 service

    Raises:
        ValueError: If unsupported payment scheme
    """

    if requirements.scheme != "exact":
        raise ValueError(f"Unsupported payment scheme: {requirements.scheme}")

    # TODO: clean this up once x402 lib improves
    # Handle nonce conversion for x402.exact compatibility
    unsigned_payload = prepare_payment_header(
        sender_address=config.smart_account_address,
        x402_version=x402_VERSION,
        payment_requirements=requirements,
    )
    nonce_raw = unsigned_payload["payload"]["authorization"]["nonce"]
    if isinstance(nonce_raw, bytes):
        unsigned_payload["payload"]["authorization"]["nonce"] = "0x" + nonce_raw.hex()

    # Construct authorization
    authorization = EIP3009Authorization.model_validate(
        unsigned_payload["payload"]["authorization"], by_alias=True
    )

    assert requirements.extra is not None
    signature = sign_erc3009_authorization(
        config=config,
        authorization=authorization,
        domain_verifying_contract=requirements.asset,
        domain_chain_id=int(get_chain_id(requirements.network)),
        domain_name=requirements.extra["name"],
        domain_version=requirements.extra["version"],
    )

    exact_payload = ExactPaymentPayload(
        signature=signature,
        authorization=authorization,
    )

    return PaymentPayload(
        x402_version=1,
        scheme="exact",
        network=requirements.network,
        payload=exact_payload,
    )
