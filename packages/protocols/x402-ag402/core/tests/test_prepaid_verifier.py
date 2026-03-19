"""Tests for ag402_core.prepaid.verifier (seller-side credential validation).

Tests are pure-Python — no FastAPI/gateway dependencies needed.
Each test creates a real HMAC-signed credential via create_credential()
so the signing path and verification path are tested end-to-end.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from ag402_core.prepaid.client import _compute_hmac, create_credential
from ag402_core.prepaid.models import PrepaidCredential
from ag402_core.prepaid.verifier import PrepaidVerifier

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

SELLER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
BUYER  = "BuyerAddr111111111111111111111111111111111111"
KEY    = "test_signing_key_verifier_tests"
PKG    = "p30d_1000"


@pytest.fixture
def verifier():
    return PrepaidVerifier(signing_key=KEY, seller_address=SELLER)


def _make_signed_cred(
    seller: str = SELLER,
    buyer: str = BUYER,
    package_id: str = PKG,
    signing_key: str = KEY,
    remaining: int = 10,
    days_valid: int = 30,
) -> PrepaidCredential:
    """Create a real HMAC-signed credential without touching disk."""
    from ag402_core.prepaid.models import calculate_expiry
    expires_at = calculate_expiry(days_valid) if days_valid >= 0 \
        else datetime.now(timezone.utc) + timedelta(days=days_valid)
    signature = _compute_hmac(signing_key, buyer, package_id, expires_at)
    return PrepaidCredential(
        buyer_address=buyer,
        package_id=package_id,
        remaining_calls=remaining,
        expires_at=expires_at,
        signature=signature,
        seller_address=seller,
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestVerifierHappyPath:

    def test_valid_credential_accepted(self, verifier):
        """Well-formed, unexpired, signed credential passes all checks."""
        cred = _make_signed_cred()
        result = verifier.verify(cred.to_header_value())
        assert result.valid is True
        assert result.error == ""

    def test_valid_credential_with_one_remaining_call(self, verifier):
        """Edge: exactly 1 remaining call is still valid."""
        cred = _make_signed_cred(remaining=1)
        result = verifier.verify(cred.to_header_value())
        assert result.valid is True

    def test_valid_credential_different_package(self, verifier):
        """Different package tier validates correctly."""
        cred = _make_signed_cred(package_id="p7d_500")
        result = verifier.verify(cred.to_header_value())
        assert result.valid is True


# ---------------------------------------------------------------------------
# Rejection paths
# ---------------------------------------------------------------------------

class TestVerifierRejections:

    def test_malformed_json_rejected(self, verifier):
        """Raw garbage in header returns malformed_credential."""
        result = verifier.verify("this is not json {{{")
        assert result.valid is False
        assert result.error == "malformed_credential"

    def test_empty_header_rejected(self, verifier):
        result = verifier.verify("")
        assert result.valid is False
        assert result.error == "malformed_credential"

    def test_missing_field_rejected(self, verifier):
        """JSON missing required field triggers malformed_credential."""
        bad = {"buyer_address": BUYER}  # missing many fields
        result = verifier.verify(json.dumps(bad))
        assert result.valid is False
        assert result.error == "malformed_credential"

    def test_seller_address_mismatch_rejected(self, verifier):
        """Credential issued for a different seller is rejected."""
        other_seller = "OtherSellerAddr111111111111111111111111111"
        cred = _make_signed_cred(seller=other_seller)
        result = verifier.verify(cred.to_header_value())
        assert result.valid is False
        assert result.error == "seller_address_mismatch"

    def test_expired_credential_rejected(self, verifier):
        """Credential past expires_at is rejected."""
        cred = _make_signed_cred(days_valid=-1)
        result = verifier.verify(cred.to_header_value())
        assert result.valid is False
        assert result.error == "credential_expired"

    def test_depleted_credential_rejected(self, verifier):
        """Credential with remaining_calls=0 is rejected."""
        cred = _make_signed_cred(remaining=0)
        result = verifier.verify(cred.to_header_value())
        assert result.valid is False
        assert result.error == "no_remaining_calls"

    def test_wrong_signing_key_rejected(self, verifier):
        """Credential signed with a different key fails HMAC check."""
        cred = _make_signed_cred(signing_key="wrong_key_entirely")
        result = verifier.verify(cred.to_header_value())
        assert result.valid is False
        assert result.error == "invalid_signature"

    def test_tampered_buyer_address_rejected(self, verifier):
        """Modifying buyer_address after signing invalidates the HMAC."""
        cred = _make_signed_cred()
        data = json.loads(cred.to_header_value())
        data["buyer_address"] = "TamperedBuyer1111111111111111111111111111"
        result = verifier.verify(json.dumps(data))
        assert result.valid is False
        assert result.error == "invalid_signature"

    def test_tampered_package_id_rejected(self, verifier):
        """Modifying package_id after signing invalidates the HMAC."""
        cred = _make_signed_cred()
        data = json.loads(cred.to_header_value())
        data["package_id"] = "p730d_10k"  # upgrade attempt
        result = verifier.verify(json.dumps(data))
        assert result.valid is False
        assert result.error == "invalid_signature"

    def test_tampered_expires_at_rejected(self, verifier):
        """Extending expires_at after signing invalidates the HMAC."""
        cred = _make_signed_cred()
        data = json.loads(cred.to_header_value())
        far_future = (datetime.now(timezone.utc) + timedelta(days=9999)).isoformat()
        data["expires_at"] = far_future
        result = verifier.verify(json.dumps(data))
        assert result.valid is False
        assert result.error == "invalid_signature"

    def test_inflated_remaining_calls_still_passes_hmac(self, verifier):
        """Inflating remaining_calls doesn't break HMAC (not covered by sig).

        remaining_calls is intentionally excluded from the HMAC because it
        decrements on the buyer side. The verifier's job is to check > 0,
        not to pin the exact count.
        """
        cred = _make_signed_cred(remaining=10)
        data = json.loads(cred.to_header_value())
        data["remaining_calls"] = 999  # buyer trying to inflate
        # HMAC still valid — remaining_calls not in signature
        result = verifier.verify(json.dumps(data))
        # Should STILL pass (seller can't know the exact original count)
        assert result.valid is True


# ---------------------------------------------------------------------------
# Security: timing attack resistance
# ---------------------------------------------------------------------------

class TestTimingAttackProtection:

    def test_compare_digest_used(self, verifier):
        """Signature comparison uses hmac.compare_digest (constant-time)."""
        import hmac
        cred = _make_signed_cred(signing_key="wrong_key")
        calls = []

        original = hmac.compare_digest

        def spy(*args, **kwargs):
            calls.append(args)
            return original(*args, **kwargs)

        with patch("ag402_core.prepaid.verifier.hmac.compare_digest", side_effect=spy):
            result = verifier.verify(cred.to_header_value())

        assert result.valid is False
        assert len(calls) == 1, "compare_digest must be called exactly once for signature check"


# ---------------------------------------------------------------------------
# HMAC compatibility: verifier and client must agree
# ---------------------------------------------------------------------------

class TestHmacCompatibility:

    def test_verifier_accepts_credential_from_create_credential(self, tmp_path):
        """create_credential() → verifier.verify() round-trip succeeds."""
        with patch("ag402_core.prepaid.client._CREDENTIALS_FILE", tmp_path / "creds.json"), \
             patch("ag402_core.prepaid.client._PREPAID_DIR", tmp_path):
            cred = create_credential(
                buyer_address=BUYER,
                package_id=PKG,
                seller_address=SELLER,
                signing_key=KEY,
            )

        v = PrepaidVerifier(signing_key=KEY, seller_address=SELLER)
        result = v.verify(cred.to_header_value())
        assert result.valid is True

    def test_utc_naive_datetime_in_file_still_verifies(self, verifier):
        """Credential serialized without timezone (legacy) verifies correctly.

        The _utc() helper in models normalizes naive datetimes to UTC on load,
        and the verifier's _compute_hmac also normalizes — so they must agree.
        """
        cred = _make_signed_cred()
        data = json.loads(cred.to_header_value())
        # Strip timezone suffix to simulate legacy storage
        data["expires_at"] = data["expires_at"].replace("+00:00", "")
        result = verifier.verify(json.dumps(data))
        # Should still pass: both sides treat naive as UTC
        assert result.valid is True

    def test_different_signing_keys_produce_different_signatures(self):
        """Two verifiers with different keys cannot cross-verify credentials."""
        cred_a = _make_signed_cred(signing_key="key_for_seller_a")
        cred_b = _make_signed_cred(signing_key="key_for_seller_b")

        verifier_a = PrepaidVerifier(signing_key="key_for_seller_a", seller_address=SELLER)
        verifier_b = PrepaidVerifier(signing_key="key_for_seller_b", seller_address=SELLER)

        assert verifier_a.verify(cred_a.to_header_value()).valid is True
        assert verifier_b.verify(cred_b.to_header_value()).valid is True
        # Cross-verify must fail
        assert verifier_a.verify(cred_b.to_header_value()).valid is False
        assert verifier_b.verify(cred_a.to_header_value()).valid is False


# ---------------------------------------------------------------------------
# Security: null / malformed signature field (Fix: audit finding)
# ---------------------------------------------------------------------------

class TestNullSignatureRejected:

    def test_null_signature_returns_invalid_signature(self, verifier):
        """JSON with 'signature': null must not crash — returns invalid_signature."""
        import json as _json
        cred = _make_signed_cred()
        data = _json.loads(cred.to_header_value())
        data["signature"] = None
        result = verifier.verify(_json.dumps(data))
        assert result.valid is False
        assert result.error == "invalid_signature"

    def test_empty_string_signature_returns_invalid_signature(self, verifier):
        """Empty signature string is rejected without TypeError."""
        import json as _json
        cred = _make_signed_cred()
        data = _json.loads(cred.to_header_value())
        data["signature"] = ""
        result = verifier.verify(_json.dumps(data))
        assert result.valid is False
        assert result.error == "invalid_signature"

    def test_integer_signature_returns_invalid_signature(self, verifier):
        """Non-string signature type (e.g. integer) is rejected without TypeError."""
        import json as _json
        cred = _make_signed_cred()
        data = _json.loads(cred.to_header_value())
        data["signature"] = 12345
        result = verifier.verify(_json.dumps(data))
        assert result.valid is False
        assert result.error == "invalid_signature"
