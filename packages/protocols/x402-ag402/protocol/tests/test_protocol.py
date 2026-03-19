"""Tests for x402 protocol spec, headers, and negotiation."""

from open402.headers import (
    ParsedExtensionHeaders,
    build_authorization,
    build_www_authenticate,
    parse_authorization,
    parse_www_authenticate,
)
from open402.negotiation import (
    CURRENT_VERSION,
    negotiate_version,
)
from open402.spec import (
    X402PaymentChallenge,
    X402PaymentProof,
    get_json_schema,
)

# --- spec.py tests ---


class TestX402PaymentChallenge:
    def test_amount_float(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr1"
        )
        assert challenge.amount_float == 0.05

    def test_to_header_value_standard(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr1"
        )
        header = challenge.to_header_value()
        assert header.startswith("x402 ")
        assert 'chain="solana"' in header
        assert 'token="USDC"' in header
        assert 'amount="0.05"' in header
        assert 'address="addr1"' in header

    def test_to_header_value_with_extensions(self):
        challenge = X402PaymentChallenge(
            chain="solana",
            token="USDC",
            amount="1.00",
            address="addr1",
            service_hash="sha256:abc",
            service_tier="premium",
        )
        header = challenge.to_header_value()
        assert 'service_hash="sha256:abc"' in header
        assert 'service_tier="premium"' in header

    def test_to_header_value_omits_empty_extensions(self):
        challenge = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr1"
        )
        header = challenge.to_header_value()
        assert "service_hash" not in header
        assert "service_tier" not in header


class TestX402PaymentProof:
    def test_to_auth_header(self):
        proof = X402PaymentProof(tx_hash="abc123def456")
        header = proof.to_auth_header()
        assert header.startswith("x402 ")
        assert 'tx_hash="abc123def456"' in header

    def test_to_auth_header_with_payer(self):
        proof = X402PaymentProof(
            tx_hash="abc123def456",
            chain="solana",
            payer_address="BuyerAddr111",
        )
        header = proof.to_auth_header()
        assert 'tx_hash="abc123def456"' in header
        assert 'payer_address="BuyerAddr111"' in header
        assert 'chain="solana"' in header


class TestJsonSchema:
    def test_schema_has_required_sections(self):
        schema = get_json_schema()
        assert "x402_challenge" in schema
        assert "x402_proof" in schema
        assert schema["protocol_version"] == "v1.0"

    def test_challenge_schema_has_required_fields(self):
        schema = get_json_schema()
        challenge = schema["x402_challenge"]
        assert set(challenge["required"]) == {"chain", "token", "amount", "address"}


# --- headers.py tests ---


class TestParseWWWAuthenticate:
    def test_standard_x402_header(self):
        header = 'x402 chain="solana" token="USDC" amount="0.05" address="SolAddr123"'
        result = parse_www_authenticate(header)
        assert result is not None
        assert result.chain == "solana"
        assert result.token == "USDC"
        assert result.amount == "0.05"
        assert result.address == "SolAddr123"

    def test_with_extension_fields(self):
        header = (
            'x402 chain="solana" token="USDC" amount="1.00" address="addr1" '
            'service_hash="sha256:abc" service_tier="premium"'
        )
        result = parse_www_authenticate(header)
        assert result is not None
        assert result.service_hash == "sha256:abc"
        assert result.service_tier == "premium"

    def test_missing_required_field(self):
        header = 'x402 chain="solana" token="USDC" amount="0.05"'
        result = parse_www_authenticate(header)
        assert result is None

    def test_non_x402_scheme(self):
        header = 'Bearer token="abc"'
        result = parse_www_authenticate(header)
        assert result is None

    def test_empty_header(self):
        assert parse_www_authenticate("") is None
        assert parse_www_authenticate(None) is None  # type: ignore


class TestParseAuthorization:
    def test_valid_x402_auth_legacy(self):
        """Legacy format: x402 <tx_hash>"""
        result = parse_authorization("x402 abc123def456")
        assert result is not None
        assert result.tx_hash == "abc123def456"

    def test_valid_x402_auth_structured(self):
        """Structured format: x402 tx_hash="..." payer_address="..." """
        result = parse_authorization(
            'x402 tx_hash="abc123" payer_address="BuyerAddr" chain="solana"'
        )
        assert result is not None
        assert result.tx_hash == "abc123"
        assert result.payer_address == "BuyerAddr"
        assert result.chain == "solana"

    def test_non_x402_auth(self):
        result = parse_authorization("Bearer some_token")
        assert result is None

    def test_empty_tx_hash(self):
        result = parse_authorization("x402 ")
        assert result is None

    def test_empty_header(self):
        assert parse_authorization("") is None


class TestBuildHeaders:
    def test_round_trip_www_authenticate(self):
        original = X402PaymentChallenge(
            chain="solana", token="USDC", amount="0.05", address="addr1"
        )
        header = build_www_authenticate(original)
        parsed = parse_www_authenticate(header)
        assert parsed is not None
        assert parsed.chain == original.chain
        assert parsed.token == original.token
        assert parsed.amount == original.amount
        assert parsed.address == original.address

    def test_round_trip_authorization(self):
        original = X402PaymentProof(tx_hash="abc123", chain="solana", payer_address="BuyerAddr")
        header = build_authorization(original)
        parsed = parse_authorization(header)
        assert parsed is not None
        assert parsed.tx_hash == original.tx_hash
        assert parsed.payer_address == original.payer_address
        assert parsed.chain == original.chain

    def test_round_trip_authorization_no_payer(self):
        original = X402PaymentProof(tx_hash="abc123")
        header = build_authorization(original)
        parsed = parse_authorization(header)
        assert parsed is not None
        assert parsed.tx_hash == original.tx_hash


class TestParsedExtensionHeaders:
    def test_from_headers(self):
        headers = {
            "X-Service-Hash": "sha256:xyz",
            "X-Agent-ID": "agent-001",
            "Accept-x402-Version": "v1.0",
        }
        parsed = ParsedExtensionHeaders.from_headers(headers)
        assert parsed.service_hash == "sha256:xyz"
        assert parsed.agent_id == "agent-001"
        assert parsed.x402_version == "v1.0"

    def test_case_insensitive(self):
        headers = {"x-service-hash": "sha256:abc"}
        parsed = ParsedExtensionHeaders.from_headers(headers)
        assert parsed.service_hash == "sha256:abc"

    def test_missing_headers(self):
        parsed = ParsedExtensionHeaders.from_headers({})
        assert parsed.service_hash == ""

    def test_to_headers(self):
        ext = ParsedExtensionHeaders(
            service_hash="sha256:abc",
        )
        headers = ext.to_headers()
        assert headers["X-Service-Hash"] == "sha256:abc"
        assert "X-Agent-ID" not in headers  # empty values omitted

    def test_to_headers_empty(self):
        ext = ParsedExtensionHeaders()
        headers = ext.to_headers()
        assert headers == {}


# --- negotiation.py tests ---


class TestNegotiation:
    def test_exact_match(self):
        result = negotiate_version("v1.0")
        assert result.is_compatible
        assert result.agreed_version == "v1.0"
        assert not result.degraded

    def test_no_client_version(self):
        result = negotiate_version("")
        assert result.is_compatible
        assert result.agreed_version == CURRENT_VERSION
        assert not result.degraded

    def test_unknown_version_degrades(self):
        result = negotiate_version("v99.0")
        assert not result.is_compatible
        assert result.degraded
        assert result.agreed_version == CURRENT_VERSION

    def test_custom_server_versions(self):
        result = negotiate_version("v2.0", server_versions=["v1.0", "v2.0"])
        assert result.is_compatible
        assert result.agreed_version == "v2.0"
