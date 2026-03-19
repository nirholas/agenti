from __future__ import annotations

import json
import os
import time

import httpx
from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_utils import to_checksum_address

from libertai_x402.types import PaymentRequirements

BASE_CHAIN_ID = 8453
BASE_RPC_URL = "https://mainnet.base.org"

# keccak256("nonces(address)")[:4]
_NONCES_SELECTOR = "0x7ecebe00"


def _format_signature(signed: object) -> str:
    sig = getattr(signed, "signature")
    raw = sig.hex() if isinstance(sig, bytes) else hex(sig)
    return raw if raw.startswith("0x") else f"0x{raw}"


def _get_permit_nonce(asset: str, owner: str) -> int:
    """Fetch ERC-2612 nonce for owner on the asset contract via eth_call."""
    padded_owner = owner.lower().removeprefix("0x").zfill(64)
    data = _NONCES_SELECTOR + padded_owner

    resp = httpx.post(
        BASE_RPC_URL,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_call",
            "params": [{"to": to_checksum_address(asset), "data": data}, "latest"],
        },
        timeout=10.0,
    )
    resp.raise_for_status()
    payload = resp.json()
    if "error" in payload and payload["error"] is not None:
        raise RuntimeError(
            f"JSON-RPC error fetching permit nonce: {payload['error']}"
        )
    result = payload.get("result")
    if not isinstance(result, str):
        raise ValueError("Missing 'result' in JSON-RPC response for permit nonce")
    return int(result, 16)


def create_payment_header(
    private_key: str,
    requirements: PaymentRequirements,
) -> str:
    """Create x402 payment header with EIP-712 signature."""
    account: LocalAccount = Account.from_key(private_key)
    now = int(time.time())
    primary_type = requirements.primary_type

    if requirements.network != "eip155:8453":
        raise ValueError(
            f"Unsupported network '{requirements.network}', expected 'eip155:8453' (Base)"
        )

    domain = {
        "name": requirements.name,
        "version": requirements.version,
        "chainId": BASE_CHAIN_ID,
        "verifyingContract": to_checksum_address(requirements.asset),
    }

    if primary_type == "Permit":
        nonce = _get_permit_nonce(requirements.asset, account.address)
        deadline = now + requirements.maxTimeoutSeconds

        message = {
            "owner": to_checksum_address(account.address),
            "spender": to_checksum_address(requirements.payTo),
            "value": int(requirements.maxAmountRequired),
            "nonce": nonce,
            "deadline": deadline,
        }

        types = {
            "Permit": [
                {"name": "owner", "type": "address"},
                {"name": "spender", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "nonce", "type": "uint256"},
                {"name": "deadline", "type": "uint256"},
            ],
        }

        signed = account.sign_typed_data(
            domain_data=domain,
            message_types=types,
            message_data=message,
        )

        nonce_hex = "0x" + nonce.to_bytes(32, "big").hex()

        return json.dumps({
            "x402Version": 2,
            "scheme": requirements.scheme,
            "network": requirements.network,
            "payload": {
                "signature": _format_signature(signed),
                "authorization": {
                    "from": account.address,
                    "to": requirements.payTo,
                    "value": requirements.maxAmountRequired,
                    "validAfter": "0",
                    "validBefore": str(deadline),
                    "nonce": nonce_hex,
                },
            },
        })

    # TransferWithAuthorization (default)
    nonce_bytes = os.urandom(32)
    nonce_hex = "0x" + nonce_bytes.hex()

    valid_after = now - 600
    valid_before = now + requirements.maxTimeoutSeconds

    message = {
        "from": to_checksum_address(account.address),
        "to": to_checksum_address(requirements.payTo),
        "value": int(requirements.maxAmountRequired),
        "validAfter": valid_after,
        "validBefore": valid_before,
        "nonce": nonce_bytes,
    }

    types = {
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    }

    signed = account.sign_typed_data(
        domain_data=domain,
        message_types=types,
        message_data=message,
    )

    return json.dumps({
        "x402Version": 2,
        "scheme": requirements.scheme,
        "network": requirements.network,
        "payload": {
            "signature": _format_signature(signed),
            "authorization": {
                "from": account.address,
                "to": requirements.payTo,
                "value": requirements.maxAmountRequired,
                "validAfter": str(valid_after),
                "validBefore": str(valid_before),
                "nonce": nonce_hex,
            },
        },
    })
