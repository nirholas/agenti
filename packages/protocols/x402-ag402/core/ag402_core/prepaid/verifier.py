"""ag402 Prepaid Verifier — seller-side credential validation.

Called by the gateway when a buyer presents an X-Prepaid-Credential header
instead of a standard Authorization: x402 proof.

Validation checks (in order):
  1. JSON parse — malformed header → reject
  2. seller_address match — credential not issued for this seller → reject
  3. Expiry — credential past expires_at → reject
  4. remaining_calls > 0 — credential depleted → reject
  5. HMAC-SHA256 signature — tampered or forged credential → reject

All checks return a (valid: bool, error: str) tuple.  On success error is "".
On failure, the gateway should return HTTP 402 with a standard x402 challenge
so the buyer automatically falls back to on-chain payment.

HMAC compatibility note:
  The signature covers ``buyer_address|package_id|expires_at`` (UTC ISO string).
  This is identical to the computation in prepaid/client._compute_hmac() —
  any change here MUST be mirrored there and vice-versa.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from dataclasses import dataclass
from datetime import timezone

from ag402_core.prepaid.models import PrepaidCredential

logger = logging.getLogger(__name__)


@dataclass
class VerifyResult:
    valid: bool
    error: str = ""


class PrepaidVerifier:
    """Seller-side verifier for X-Prepaid-Credential headers.

    Instantiate once per gateway with the seller's signing key and address.
    Thread/async-safe: all methods are stateless (no mutable instance state
    beyond the constructor arguments).
    """

    def __init__(self, signing_key: str, seller_address: str) -> None:
        """
        Args:
            signing_key: AG402_PREPAID_SIGNING_KEY — must match the key used
                         to issue credentials (client._compute_hmac).
            seller_address: Gateway's own Solana address.  Credentials issued
                            for a different seller are rejected outright.
        """
        self._signing_key = signing_key
        self._seller_address = seller_address

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify(self, header_value: str) -> VerifyResult:
        """Verify the raw X-Prepaid-Credential header value.

        Args:
            header_value: Raw string from the X-Prepaid-Credential header.

        Returns:
            VerifyResult(valid=True) on success.
            VerifyResult(valid=False, error=...) on any failure.
        """
        # 1. Parse
        try:
            cred = PrepaidCredential.from_header_value(header_value)
        except (json.JSONDecodeError, KeyError, ValueError, TypeError) as exc:
            logger.warning("[PREPAID-VERIFY] Malformed credential header: %s", exc)
            return VerifyResult(valid=False, error="malformed_credential")

        # 2. Seller address
        if cred.seller_address != self._seller_address:
            logger.warning(
                "[PREPAID-VERIFY] seller_address mismatch: got %s, expected %s",
                cred.seller_address[:24], self._seller_address[:24],
            )
            return VerifyResult(valid=False, error="seller_address_mismatch")

        # 3. Expiry
        if cred.is_expired():
            logger.info("[PREPAID-VERIFY] Credential expired for buyer %s", cred.buyer_address[:24])
            return VerifyResult(valid=False, error="credential_expired")

        # 4. Remaining calls
        if not cred.has_calls():
            logger.info("[PREPAID-VERIFY] No remaining calls for buyer %s", cred.buyer_address[:24])
            return VerifyResult(valid=False, error="no_remaining_calls")

        # 5. HMAC signature — constant-time comparison prevents timing attacks
        # Guard against null/non-string signature (e.g. "signature": null in JSON)
        if not isinstance(cred.signature, str) or not cred.signature:
            logger.warning(
                "[PREPAID-VERIFY] Missing or non-string signature for buyer %s", cred.buyer_address[:24]
            )
            return VerifyResult(valid=False, error="invalid_signature")
        expected = self._compute_hmac(
            cred.buyer_address, cred.package_id, cred.expires_at
        )
        if not hmac.compare_digest(expected, cred.signature):
            logger.warning(
                "[PREPAID-VERIFY] Invalid signature for buyer %s", cred.buyer_address[:24]
            )
            return VerifyResult(valid=False, error="invalid_signature")

        logger.info(
            "[PREPAID-VERIFY] Valid credential: buyer=%s package=%s remaining=%d",
            cred.buyer_address[:24], cred.package_id, cred.remaining_calls,
        )
        return VerifyResult(valid=True)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _compute_hmac(self, buyer_address: str, package_id: str, expires_at) -> str:
        """HMAC-SHA256 over buyer_address|package_id|expires_at (UTC ISO).

        Must stay byte-for-byte identical to client._compute_hmac().
        """
        from datetime import datetime

        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            utc_str = expires_at.astimezone(timezone.utc).isoformat()
        else:
            # Stored as string in edge cases — use as-is
            utc_str = str(expires_at)

        message = f"{buyer_address}|{package_id}|{utc_str}"
        return hmac.new(
            self._signing_key.encode(),
            message.encode(),
            hashlib.sha256,
        ).hexdigest()
