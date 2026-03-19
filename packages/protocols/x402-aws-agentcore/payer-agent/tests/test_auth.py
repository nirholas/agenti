"""Tests for the IAM SigV4 authentication module."""

import datetime
import hashlib
from unittest.mock import MagicMock, patch

import pytest

from agent.auth import SigV4Auth, AWSCredentials, get_aws_credentials, create_sigv4_headers


class TestAWSCredentials:
    """Tests for AWSCredentials dataclass."""

    def test_credentials_creation(self):
        """Test creating credentials with required fields."""
        creds = AWSCredentials(
            access_key="AKIAIOSFODNN7EXAMPLE",
            secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        )
        
        assert creds.access_key == "AKIAIOSFODNN7EXAMPLE"
        assert creds.secret_key == "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        assert creds.session_token is None

    def test_credentials_with_session_token(self):
        """Test creating credentials with session token."""
        creds = AWSCredentials(
            access_key="AKIAIOSFODNN7EXAMPLE",
            secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            session_token="FwoGZXIvYXdzEBYaDK...",
        )
        
        assert creds.session_token == "FwoGZXIvYXdzEBYaDK..."


class TestGetAWSCredentials:
    """Tests for get_aws_credentials function."""

    def test_get_credentials_from_session(self):
        """Test getting credentials from boto3 session."""
        mock_frozen_creds = MagicMock()
        mock_frozen_creds.access_key = "AKIAIOSFODNN7EXAMPLE"
        mock_frozen_creds.secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        mock_frozen_creds.token = None
        
        mock_creds = MagicMock()
        mock_creds.get_frozen_credentials.return_value = mock_frozen_creds
        
        mock_session = MagicMock()
        mock_session.get_credentials.return_value = mock_creds
        
        with patch("agent.auth.sigv4.boto3.Session", return_value=mock_session):
            creds = get_aws_credentials()
            
            assert creds.access_key == "AKIAIOSFODNN7EXAMPLE"
            assert creds.secret_key == "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            assert creds.session_token is None

    def test_get_credentials_with_profile(self):
        """Test getting credentials with a specific profile."""
        mock_frozen_creds = MagicMock()
        mock_frozen_creds.access_key = "AKIAPROFILE"
        mock_frozen_creds.secret_key = "secretkey"
        mock_frozen_creds.token = "sessiontoken"
        
        mock_creds = MagicMock()
        mock_creds.get_frozen_credentials.return_value = mock_frozen_creds
        
        mock_session = MagicMock()
        mock_session.get_credentials.return_value = mock_creds
        
        with patch("agent.auth.sigv4.boto3.Session", return_value=mock_session) as mock_session_class:
            creds = get_aws_credentials(profile_name="test-profile")
            
            mock_session_class.assert_called_once_with(profile_name="test-profile")
            assert creds.access_key == "AKIAPROFILE"
            assert creds.session_token == "sessiontoken"

    def test_get_credentials_no_credentials_found(self):
        """Test error when no credentials are found."""
        mock_session = MagicMock()
        mock_session.get_credentials.return_value = None
        
        with patch("agent.auth.sigv4.boto3.Session", return_value=mock_session):
            with pytest.raises(ValueError, match="No AWS credentials found"):
                get_aws_credentials()


class TestSigV4Auth:
    """Tests for SigV4Auth class."""

    @pytest.fixture
    def mock_credentials(self):
        """Create mock credentials for testing."""
        return AWSCredentials(
            access_key="AKIAIOSFODNN7EXAMPLE",
            secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        )

    @pytest.fixture
    def sigv4_auth(self, mock_credentials):
        """Create SigV4Auth instance with mock credentials."""
        return SigV4Auth(
            region="us-west-2",
            service="bedrock-agent-runtime",
            credentials=mock_credentials,
        )

    def test_sigv4_auth_initialization(self, sigv4_auth):
        """Test SigV4Auth initialization."""
        assert sigv4_auth.region == "us-west-2"
        assert sigv4_auth.service == "bedrock-agent-runtime"
        assert sigv4_auth.credentials.access_key == "AKIAIOSFODNN7EXAMPLE"

    def test_hash_payload(self, sigv4_auth):
        """Test payload hashing."""
        payload = '{"inputText": "Hello"}'
        expected_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        
        result = sigv4_auth._hash_payload(payload)
        
        assert result == expected_hash

    def test_hash_empty_payload(self, sigv4_auth):
        """Test hashing empty payload."""
        empty_hash = hashlib.sha256(b"").hexdigest()
        
        result = sigv4_auth._hash_payload("")
        
        assert result == empty_hash

    def test_sign_request_includes_required_headers(self, sigv4_auth):
        """Test that sign_request includes all required headers."""
        with patch("agent.auth.sigv4.datetime") as mock_datetime:
            mock_datetime.datetime.utcnow.return_value = datetime.datetime(2024, 1, 15, 12, 0, 0)
            
            headers = sigv4_auth.sign_request(
                method="POST",
                url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/agents/test/invoke",
                body='{"inputText": "Hello"}',
            )
            
            assert "host" in headers
            assert "x-amz-date" in headers
            assert "x-amz-content-sha256" in headers
            assert "authorization" in headers

    def test_sign_request_authorization_format(self, sigv4_auth):
        """Test that authorization header has correct format."""
        with patch("agent.auth.sigv4.datetime") as mock_datetime:
            mock_datetime.datetime.utcnow.return_value = datetime.datetime(2024, 1, 15, 12, 0, 0)
            
            headers = sigv4_auth.sign_request(
                method="POST",
                url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/agents/test/invoke",
            )
            
            auth_header = headers["authorization"]
            
            assert auth_header.startswith("AWS4-HMAC-SHA256")
            assert "Credential=" in auth_header
            assert "SignedHeaders=" in auth_header
            assert "Signature=" in auth_header

    def test_sign_request_with_session_token(self):
        """Test signing with temporary credentials (session token)."""
        creds = AWSCredentials(
            access_key="AKIAIOSFODNN7EXAMPLE",
            secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            session_token="FwoGZXIvYXdzEBYaDK...",
        )
        
        auth = SigV4Auth(
            region="us-west-2",
            service="bedrock-agent-runtime",
            credentials=creds,
        )
        
        with patch("agent.auth.sigv4.datetime") as mock_datetime:
            mock_datetime.datetime.utcnow.return_value = datetime.datetime(2024, 1, 15, 12, 0, 0)
            
            headers = auth.sign_request(
                method="POST",
                url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/agents/test/invoke",
            )
            
            assert "x-amz-security-token" in headers
            assert headers["x-amz-security-token"] == "FwoGZXIvYXdzEBYaDK..."

    def test_sign_request_preserves_existing_headers(self, sigv4_auth):
        """Test that existing headers are preserved."""
        existing_headers = {
            "content-type": "application/json",
            "x-custom-header": "custom-value",
        }
        
        with patch("agent.auth.sigv4.datetime") as mock_datetime:
            mock_datetime.datetime.utcnow.return_value = datetime.datetime(2024, 1, 15, 12, 0, 0)
            
            headers = sigv4_auth.sign_request(
                method="POST",
                url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/agents/test/invoke",
                headers=existing_headers,
            )
            
            assert headers["content-type"] == "application/json"
            assert headers["x-custom-header"] == "custom-value"


class TestCreateSigV4Headers:
    """Tests for create_sigv4_headers convenience function."""

    def test_create_headers_basic(self):
        """Test creating headers with basic parameters."""
        mock_frozen_creds = MagicMock()
        mock_frozen_creds.access_key = "AKIAIOSFODNN7EXAMPLE"
        mock_frozen_creds.secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        mock_frozen_creds.token = None
        
        mock_creds = MagicMock()
        mock_creds.get_frozen_credentials.return_value = mock_frozen_creds
        
        mock_session = MagicMock()
        mock_session.get_credentials.return_value = mock_creds
        
        with patch("agent.auth.sigv4.boto3.Session", return_value=mock_session):
            with patch("agent.auth.sigv4.datetime") as mock_datetime:
                mock_datetime.datetime.utcnow.return_value = datetime.datetime(2024, 1, 15, 12, 0, 0)
                
                headers = create_sigv4_headers(
                    method="POST",
                    url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/agents/test/invoke",
                    region="us-west-2",
                    body='{"inputText": "Hello"}',
                )
                
                assert "authorization" in headers
                assert "x-amz-date" in headers


class TestSignRequestFunction:
    """Tests for sign_request convenience function."""

    def test_sign_request_function(self):
        """Test the sign_request convenience function."""
        from agent.auth import sign_request
        
        mock_frozen_creds = MagicMock()
        mock_frozen_creds.access_key = "AKIAIOSFODNN7EXAMPLE"
        mock_frozen_creds.secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        mock_frozen_creds.token = None
        
        mock_creds = MagicMock()
        mock_creds.get_frozen_credentials.return_value = mock_frozen_creds
        
        mock_session = MagicMock()
        mock_session.get_credentials.return_value = mock_creds
        
        with patch("agent.auth.sigv4.boto3.Session", return_value=mock_session):
            with patch("agent.auth.sigv4.datetime") as mock_datetime:
                mock_datetime.datetime.utcnow.return_value = datetime.datetime(2024, 1, 15, 12, 0, 0)
                
                headers = sign_request(
                    method="POST",
                    url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/agents/test/invoke",
                    region="us-west-2",
                )
                
                assert "authorization" in headers
