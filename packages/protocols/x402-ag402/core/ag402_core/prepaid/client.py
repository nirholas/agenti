"""ag402 Prepaid Client — buyer-side credential storage and deduction.

Manages the local credential store at ~/.ag402/prepaid_credentials.json.

Concurrency note: callers must serialize check_and_deduct() calls externally
(e.g. under X402PaymentMiddleware._payment_lock) to prevent TOCTOU races
where two concurrent requests both pass the "has calls" check before either
deduction is written to disk.
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from ag402_core.prepaid.models import (
    PrepaidCredential,
    calculate_expiry,
    get_package_info,
)

logger = logging.getLogger(__name__)

_PREPAID_DIR = Path.home() / ".ag402"
_CREDENTIALS_FILE = _PREPAID_DIR / "prepaid_credentials.json"


# ---------------------------------------------------------------------------
# Internal storage helpers
# ---------------------------------------------------------------------------

def _ensure_dir() -> None:
    _PREPAID_DIR.mkdir(parents=True, exist_ok=True)
    # Restrict to owner only (Unix). No-op on Windows.
    with contextlib.suppress(OSError, NotImplementedError):
        os.chmod(_PREPAID_DIR, 0o700)


def _load() -> list[dict]:
    _ensure_dir()
    if not _CREDENTIALS_FILE.exists():
        return []
    try:
        with open(_CREDENTIALS_FILE) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        # Back up the corrupt file before treating as empty — prevents silent data loss
        backup = _CREDENTIALS_FILE.with_suffix(".json.bak")
        with contextlib.suppress(OSError):
            import shutil
            shutil.copy2(_CREDENTIALS_FILE, backup)
        logger.warning(
            "[PREPAID] Corrupt credentials file (%s) — backed up to %s, starting fresh",
            exc, backup,
        )
        return []


def _save(credentials: list[dict]) -> None:
    """Write credentials atomically via a temp file + rename.

    Prevents partial writes from corrupting the credential store if the
    process is killed mid-write. On POSIX, os.replace() is atomic at the
    filesystem level. On Windows, it is best-effort (not fully atomic, but
    still far safer than a direct truncating open).
    """
    _ensure_dir()
    tmp_fd, tmp_path = tempfile.mkstemp(dir=_PREPAID_DIR, prefix=".creds_tmp_", suffix=".json")
    try:
        with os.fdopen(tmp_fd, "w") as f:
            json.dump(credentials, f, indent=2, default=str)
        os.replace(tmp_path, _CREDENTIALS_FILE)
        # L-6 FIX: Set restrictive file permissions on credential file
        with contextlib.suppress(OSError, NotImplementedError):
            os.chmod(_CREDENTIALS_FILE, 0o600)
    except Exception:
        # Best-effort cleanup of temp file on failure
        with contextlib.suppress(OSError):
            os.unlink(tmp_path)
        raise


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_and_deduct(seller_address: str) -> tuple[bool, PrepaidCredential | None]:
    """Find a valid credential for seller and deduct one call.

    This is the hot path called before every API request. Callers must hold
    the payment lock to prevent concurrent double-deductions.

    Returns:
        (True, credential) — deduction succeeded; include credential in header
        (False, None)      — no valid credential; fall back to on-chain payment
    """
    raw_list = _load()
    for i, raw in enumerate(raw_list):
        try:
            cred = PrepaidCredential.from_dict(raw)
        except (KeyError, ValueError, TypeError):
            continue
        if cred.seller_address == seller_address and cred.is_valid():
            cred.remaining_calls -= 1
            raw_list[i] = cred.to_dict()
            _save(raw_list)
            logger.debug(
                "[PREPAID] Deducted call for seller %s — %d remaining",
                seller_address[:20], cred.remaining_calls,
            )
            return True, cred
    return False, None


def rollback_call(seller_address: str, credential: PrepaidCredential) -> bool:
    """Restore one call deducted by check_and_deduct().

    Called when the seller rejects our prepaid credential (returns 402),
    so the deducted call is not wasted.

    The restored count is capped at the original package's call limit to
    prevent a misbehaving seller from inflating credentials beyond their
    purchased value through repeated reject cycles.

    Returns True if a matching credential was found and restored.
    """
    pkg = get_package_info(credential.package_id)
    original_calls = pkg["calls"] if pkg else credential.remaining_calls + 1

    raw_list = _load()
    for i, raw in enumerate(raw_list):
        try:
            cred = PrepaidCredential.from_dict(raw)
        except (KeyError, ValueError, TypeError):
            continue
        if (
            cred.seller_address == seller_address
            and cred.buyer_address == credential.buyer_address
            and cred.package_id == credential.package_id
        ):
            # Cap at original package limit — prevents inflation via reject-loop
            cred.remaining_calls = min(cred.remaining_calls + 1, original_calls)
            raw_list[i] = cred.to_dict()
            _save(raw_list)
            logger.debug(
                "[PREPAID] Rolled back call for seller %s — %d remaining",
                seller_address[:20], cred.remaining_calls,
            )
            return True
    logger.warning("[PREPAID] Could not find credential to roll back for seller %s", seller_address[:20])
    return False


def add_credential(credential: PrepaidCredential) -> None:
    """Persist a newly purchased credential."""
    raw_list = _load()
    raw_list.append(credential.to_dict())
    _save(raw_list)


def get_all_credentials() -> list[PrepaidCredential]:
    """Return all stored credentials (including expired/depleted)."""
    result = []
    for raw in _load():
        with contextlib.suppress(KeyError, ValueError, TypeError):
            result.append(PrepaidCredential.from_dict(raw))
    return result


def get_valid_credential(seller_address: str) -> PrepaidCredential | None:
    """Return first valid credential for a seller (without deducting)."""
    for raw in _load():
        try:
            cred = PrepaidCredential.from_dict(raw)
        except (KeyError, ValueError, TypeError):
            continue
        if cred.seller_address == seller_address and cred.is_valid():
            return cred
    return None


def get_prepaid_status() -> dict:
    """Summary of all credentials for CLI display."""
    all_creds = get_all_credentials()
    valid = [c for c in all_creds if c.is_valid()]
    by_seller: dict[str, list[dict]] = {}
    for c in valid:
        key = c.seller_address
        if key not in by_seller:
            by_seller[key] = []
        by_seller[key].append({
            "package_id": c.package_id,
            "remaining_calls": c.remaining_calls,
            "expires_at": c.expires_at.isoformat(),
        })
    return {
        "total_credentials": len(all_creds),
        "valid_credentials": len(valid),
        "total_remaining_calls": sum(c.remaining_calls for c in valid),
        "by_seller": by_seller,
    }


def purge_invalid_credentials() -> int:
    """Remove expired and depleted credentials. Returns count removed."""
    raw_list = _load()
    original = len(raw_list)
    kept = []
    for raw in raw_list:
        try:
            cred = PrepaidCredential.from_dict(raw)
            if cred.is_valid():
                kept.append(raw)
        except (KeyError, ValueError, TypeError):
            pass  # drop malformed entries
    removed = original - len(kept)
    if removed > 0:
        _save(kept)
    return removed


# ---------------------------------------------------------------------------
# Credential creation (used by P0-3 purchase flow)
# ---------------------------------------------------------------------------

def _compute_hmac(signing_key: str, buyer_address: str, package_id: str, expires_at: datetime) -> str:
    """HMAC-SHA256 over buyer_address|package_id|expires_at (UTC ISO format).

    Excludes remaining_calls (it changes after each use).
    The signing_key must match the seller's AG402_PREPAID_SIGNING_KEY.
    """
    import hashlib
    import hmac as _hmac

    # Normalize to UTC ISO string so HMAC is timezone-invariant
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    utc_str = expires_at.astimezone(timezone.utc).isoformat()

    message = f"{buyer_address}|{package_id}|{utc_str}"
    return _hmac.new(
        signing_key.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()


def create_credential(
    buyer_address: str,
    package_id: str,
    seller_address: str,
    signing_key: str,
) -> PrepaidCredential:
    """Create and store a credential (called after purchase is verified).

    Args:
        signing_key: Seller's AG402_PREPAID_SIGNING_KEY (for HMAC generation)
    """
    pkg = get_package_info(package_id)
    if pkg is None:
        raise ValueError(f"Unknown package_id: {package_id!r}")

    expires_at = calculate_expiry(pkg["days"])
    signature = _compute_hmac(signing_key, buyer_address, package_id, expires_at)

    credential = PrepaidCredential(
        buyer_address=buyer_address,
        package_id=package_id,
        remaining_calls=pkg["calls"],
        expires_at=expires_at,
        signature=signature,
        seller_address=seller_address,
        created_at=datetime.now(timezone.utc),
    )
    add_credential(credential)
    return credential
