"""ag402 Prepaid Client - Buyer side budget pool management.

Manages prepaid credentials: storage, retrieval, deduction, and fallback.
"""

import json
from datetime import datetime
from pathlib import Path

from prepaid_models import PrepaidCredential, calculate_expiry

# Storage path
PREPAID_DIR = Path.home() / ".ag402"
CREDENTIALS_FILE = PREPAID_DIR / "prepaid_credentials.json"


def _ensure_prepaid_dir() -> None:
    """Ensure prepaid directory exists."""
    PREPAID_DIR.mkdir(parents=True, exist_ok=True)


def _load_credentials() -> list[dict]:
    """Load credentials from storage."""
    _ensure_prepaid_dir()
    if not CREDENTIALS_FILE.exists():
        return []
    try:
        with open(CREDENTIALS_FILE) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return []


def _save_credentials(credentials: list[dict]) -> None:
    """Save credentials to storage."""
    _ensure_prepaid_dir()
    # Convert any datetime objects to ISO strings
    from datetime import datetime as dt
    def convert(obj):
        if isinstance(obj, dt):
            return obj.isoformat()
        elif isinstance(obj, dict):
            return {k: convert(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert(i) for i in obj]
        return obj
    credentials = convert(credentials)
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(credentials, f, indent=2)


def add_credential(credential: PrepaidCredential) -> bool:
    """Add a new credential to local storage.

    Args:
        credential: PrepaidCredential to store

    Returns:
        True if added successfully
    """
    credentials = _load_credentials()
    credentials.append(credential.to_dict())
    _save_credentials(credentials)
    return True


def get_valid_credential(seller_address: str) -> PrepaidCredential | None:
    """Find a valid credential for a seller.

    Args:
        seller_address: Seller's address to find credential for

    Returns:
        Valid PrepaidCredential or None if not found/valid
    """
    credentials = _load_credentials()
    for cred_dict in credentials:
        cred = PrepaidCredential.from_dict(cred_dict)
        if cred.seller_address == seller_address and cred.is_valid():
            return cred
    return None


def deduct_call(seller_address: str) -> tuple[bool, PrepaidCredential | None]:
    """Deduct one call from valid credential.

    Args:
        seller_address: Seller's address to deduct from

    Returns:
        Tuple of (success, updated_credential). If success is False,
        no valid credential was found.
    """
    credentials = _load_credentials()
    for i, cred_dict in enumerate(credentials):
        cred = PrepaidCredential.from_dict(cred_dict)
        if cred.seller_address == seller_address and cred.is_valid():
            # Deduct call
            cred.remaining_calls -= 1
            credentials[i] = cred.to_dict()
            _save_credentials(credentials)
            return True, cred
    return False, None


def get_all_credentials() -> list[PrepaidCredential]:
    """Get all credentials (including expired/invalid).

    Returns:
        List of all PrepaidCredential objects
    """
    credentials = _load_credentials()
    return [PrepaidCredential.from_dict(c) for c in credentials]


def get_credentials_by_seller(seller_address: str) -> list[PrepaidCredential]:
    """Get all credentials for a specific seller.

    Args:
        seller_address: Seller's address

    Returns:
        List of PrepaidCredential for that seller
    """
    credentials = _load_credentials()
    result = []
    for cred_dict in credentials:
        cred = PrepaidCredential.from_dict(cred_dict)
        if cred.seller_address == seller_address:
            result.append(cred)
    return result


def remove_credential(buyer_address: str, seller_address: str) -> bool:
    """Remove credential for a buyer-seller pair.

    Args:
        buyer_address: Buyer's address
        seller_address: Seller's address

    Returns:
        True if credential was removed
    """
    credentials = _load_credentials()
    new_creds = [c for c in credentials
                 if not (c['buyer_address'] == buyer_address and
                         c['seller_address'] == seller_address)]
    if len(new_creds) < len(credentials):
        _save_credentials(new_creds)
        return True
    return False


def remove_invalid_credentials() -> int:
    """Remove all expired or depleted credentials.

    Returns:
        Number of credentials removed
    """
    credentials = _load_credentials()
    original_count = len(credentials)
    new_creds = []
    for cred_dict in credentials:
        cred = PrepaidCredential.from_dict(cred_dict)
        # Keep if valid (not expired, has calls)
        if cred.is_valid():
            new_creds.append(cred_dict)
    removed = original_count - len(new_creds)
    if removed > 0:
        _save_credentials(new_creds)
    return removed


def check_and_deduct(seller_address: str) -> tuple[bool, PrepaidCredential | None]:
    """Check if valid credential exists and deduct call.

    This is the main function to call before making API calls.
    Returns credential info for including in request header.

    Args:
        seller_address: Seller's address

    Returns:
        Tuple of (success, credential). If success is True,
        include credential in X-Prepaid-Credential header.
    """
    return deduct_call(seller_address)


def fallback_to_standard_payment(seller_address: str) -> dict:
    """Return info needed for standard 402 payment when prepaid unavailable.

    Args:
        seller_address: Seller's address

    Returns:
        Dict with fallback information
    """
    return {
        "fallback": True,
        "reason": "no_valid_prepaid_credential",
        "seller_address": seller_address,
    }


def get_prepaid_status() -> dict:
    """Get overall prepaid status for all credentials.

    Returns:
        Dict with credential counts and total remaining calls
    """
    credentials = get_all_credentials()
    valid_creds = [c for c in credentials if c.is_valid()]
    total_calls = sum(c.remaining_calls for c in valid_creds)

    # Group by seller
    by_seller = {}
    for cred in valid_creds:
        if cred.seller_address not in by_seller:
            by_seller[cred.seller_address] = []
        by_seller[cred.seller_address].append({
            "package_id": cred.package_id,
            "remaining_calls": cred.remaining_calls,
            "expires_at": cred.expires_at.isoformat(),
        })

    return {
        "total_credentials": len(credentials),
        "valid_credentials": len(valid_creds),
        "total_remaining_calls": total_calls,
        "by_seller": by_seller,
    }


def _compute_signature(buyer_address: str, package_id: str,
                           expires_at) -> str:
    """Compute HMAC-SHA256 signature for credential.

    Note: Does NOT include calls count as it changes after each use.
    """
    import hashlib
    import hmac
    # In production, use seller's private key
    signing_key = "ag402_default_key_change_in_production"
    message = f"{buyer_address}|{package_id}|{expires_at.isoformat()}"
    return hmac.new(
        signing_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()


def create_credential_for_purchase(
    buyer_address: str,
    package_id: str,
    seller_address: str,
    signature: str | None = None,  # Make optional
) -> PrepaidCredential:
    """Create a new credential after purchase.

    Args:
        buyer_address: Buyer's wallet address
        package_id: Package ID purchased
        seller_address: Seller's address
        signature: Seller's signature on the credential

    Returns:
        New PrepaidCredential
    """
    from prepaid_models import get_package_info

    pkg_info = get_package_info(package_id)
    if not pkg_info:
        raise ValueError(f"Unknown package: {package_id}")

    expires_at = calculate_expiry(pkg_info["days"])

    # Auto-generate signature if not provided
    if signature is None:
        signature = _compute_signature(
            buyer_address,
            package_id,
            expires_at
        )

    credential = PrepaidCredential(
        buyer_address=buyer_address,
        package_id=package_id,
        remaining_calls=pkg_info["calls"],
        expires_at=expires_at,
        signature=signature,
        seller_address=seller_address,
        created_at=datetime.now(),
    )

    add_credential(credential)
    return credential
