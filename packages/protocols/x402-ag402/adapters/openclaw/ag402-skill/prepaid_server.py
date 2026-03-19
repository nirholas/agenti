"""ag402 Prepaid Server - Seller side credential verification.

Verifies prepaid credentials from buyers and processes API calls.
"""

import json
import time
from dataclasses import dataclass
from datetime import datetime

from prepaid_models import PrepaidCredential


@dataclass
class CachedCredential:
    """Cached credential with timestamp."""
    credential: PrepaidCredential
    verified_at: float  # Unix timestamp


class PrepaidServer:
    """Server-side prepaid credential verification."""

    def __init__(self, cache_ttl: int = 300, signing_key: str = ""):
        """Initialize server.

        Args:
            cache_ttl: Cache time-to-live in seconds (default 5 min)
            signing_key: Secret key for HMAC signature verification
        """
        self._cache: dict[str, CachedCredential] = {}
        self.cache_ttl = cache_ttl
        self.seller_address: str | None = None
        # Use provided key or generate a default for testing
        self._signing_key = signing_key or "ag402_default_key_change_in_production"

    def set_seller_address(self, address: str) -> None:
        """Set the seller address for verification."""
        self.seller_address = address

    def _get_cache_key(self, credential: PrepaidCredential) -> str:
        """Generate cache key for credential."""
        return f"{credential.buyer_address}:{credential.package_id}"

    def _is_cache_valid(self, cached: CachedCredential) -> bool:
        """Check if cached credential is still valid."""
        return time.time() - cached.verified_at < self.cache_ttl

    def _compute_signature(self, buyer_address: str, package_id: str,
                           expires_at: datetime) -> str:
        """Compute HMAC-SHA256 signature for credential data.

        Note: Does NOT include remaining_calls as it changes after each use.
        The signature proves the seller authorized this credential.
        """
        import hashlib
        import hmac
        message = f"{buyer_address}|{package_id}|{expires_at.isoformat()}"
        return hmac.new(
            self._signing_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

    def verify_signature(self, credential: PrepaidCredential) -> bool:
        """Verify credential HMAC signature.

        Args:
            credential: Credential to verify

        Returns:
            True if HMAC signature is valid
        """
        import hmac

        # Compute expected signature (remaining_calls not included as it changes)
        expected_sig = self._compute_signature(
            credential.buyer_address,
            credential.package_id,
            credential.expires_at
        )

        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(expected_sig, credential.signature)

    def verify_credential(
        self,
        credential: PrepaidCredential,
        check_seller: bool = True,
    ) -> tuple[bool, str]:
        """Verify credential validity.

        Args:
            credential: Credential to verify
            check_seller: Whether to verify seller address matches

        Returns:
            Tuple of (is_valid, reason)
        """
        # Check seller address
        if check_seller and self.seller_address and credential.seller_address != self.seller_address:
            return False, "seller_address_mismatch"

        # Check expiry
        if credential.is_expired():
            return False, "credential_expired"

        # Check remaining calls
        if not credential.has_calls():
            return False, "no_remaining_calls"

        # Verify signature
        if not self.verify_signature(credential):
            return False, "invalid_signature"

        return True, "valid"

    def get_from_cache(self, credential: PrepaidCredential) -> PrepaidCredential | None:
        """Get credential from cache if valid."""
        cache_key = self._get_cache_key(credential)
        cached = self._cache.get(cache_key)

        if cached and self._is_cache_valid(cached):
            return cached.credential

        return None

    def add_to_cache(self, credential: PrepaidCredential) -> None:
        """Add credential to cache."""
        cache_key = self._get_cache_key(credential)
        self._cache[cache_key] = CachedCredential(
            credential=credential,
            verified_at=time.time(),
        )

    def clear_cache(self) -> None:
        """Clear all cached credentials."""
        self._cache.clear()

    def verify_and_process(
        self,
        credential_header: str | None,
        check_seller: bool = True,
    ) -> tuple[int, dict]:
        """Verify credential and process request."""
        # No credential provided
        if not credential_header:
            return 402, {
                "error": "payment_required",
                "message": "No prepaid credential provided",
                "x402-payment": json.dumps({
                    "scheme": "prepaid",
                    "message": "Prepaid credential required",
                }),
            }

        # Parse credential
        try:
            credential = PrepaidCredential.from_header_value(credential_header)
        except (json.JSONDecodeError, ValueError) as e:
            return 402, {
                "error": "invalid_credential",
                "message": f"Failed to parse credential: {str(e)}",
            }

        # Always verify credential
        is_valid, reason = self.verify_credential(credential, check_seller)
        if not is_valid:
            return 402, {
                "error": reason,
                "message": f"Credential verification failed: {reason}",
            }

        # Update cache
        self.add_to_cache(credential)

        # Note: Do NOT decrement here - buyer already deducted locally
        # Seller just verifies the credential is still valid

        return 200, {
            "status": "success",
            "remaining_calls": credential.remaining_calls,
            "expires_at": credential.expires_at.isoformat(),
        }

    def get_cache_stats(self) -> dict:
        """Get cache statistics."""
        valid_count = sum(
            1 for c in self._cache.values()
            if self._is_cache_valid(c)
        )
        return {
            "total_cached": len(self._cache),
            "valid_cached": valid_count,
            "cache_ttl": self.cache_ttl,
        }


# Global server instance
_server: PrepaidServer | None = None


def get_server() -> PrepaidServer:
    """Get or create global server instance."""
    global _server
    if _server is None:
        _server = PrepaidServer()
    return _server


def process_prepaid_request(
    credential_header: str | None,
    seller_address: str | None = None,
) -> tuple[int, dict]:
    """Process prepaid request (convenience function)."""
    server = get_server()
    if seller_address:
        server.set_seller_address(seller_address)

    return server.verify_and_process(credential_header)
