"""
AWS SigV4 Authentication for AgentCore Gateway.

This module provides utilities for signing requests to AWS services using
IAM Signature Version 4 (SigV4) authentication. This is required for
secure access to the AgentCore Gateway.

Usage:
    from agent.auth import SigV4Auth, create_sigv4_headers
    
    # Using the SigV4Auth class
    auth = SigV4Auth(region="us-west-2", service="bedrock-agent-runtime")
    signed_headers = auth.sign_request(
        method="POST",
        url="https://bedrock-agent-runtime.us-west-2.amazonaws.com/...",
        headers={"Content-Type": "application/json"},
        body=json.dumps({"inputText": "Hello"})
    )
    
    # Using the convenience function
    headers = create_sigv4_headers(
        method="POST",
        url="https://...",
        region="us-west-2",
        body=request_body
    )
"""

import datetime
import hashlib
import hmac
import os
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse, quote

import boto3
from botocore.credentials import Credentials


@dataclass
class AWSCredentials:
    """AWS credentials for SigV4 signing."""
    access_key: str
    secret_key: str
    session_token: Optional[str] = None


def get_aws_credentials(profile_name: Optional[str] = None) -> AWSCredentials:
    """
    Get AWS credentials from the environment or profile.
    
    Args:
        profile_name: Optional AWS profile name to use
        
    Returns:
        AWSCredentials object with access key, secret key, and optional session token
        
    Raises:
        ValueError: If credentials cannot be obtained
    """
    try:
        if profile_name:
            session = boto3.Session(profile_name=profile_name)
        else:
            session = boto3.Session()
        
        credentials = session.get_credentials()
        if credentials is None:
            raise ValueError("No AWS credentials found")
        
        frozen_credentials = credentials.get_frozen_credentials()
        
        return AWSCredentials(
            access_key=frozen_credentials.access_key,
            secret_key=frozen_credentials.secret_key,
            session_token=frozen_credentials.token,
        )
    except Exception as e:
        raise ValueError(f"Failed to get AWS credentials: {e}") from e


class SigV4Auth:
    """
    AWS Signature Version 4 authentication handler.
    
    This class implements the AWS SigV4 signing process for authenticating
    requests to AWS services like AgentCore Gateway.
    
    Attributes:
        region: AWS region (e.g., "us-west-2")
        service: AWS service name (e.g., "bedrock-agent-runtime")
        credentials: AWS credentials for signing
    """
    
    ALGORITHM = "AWS4-HMAC-SHA256"
    
    def __init__(
        self,
        region: str,
        service: str = "bedrock-agent-runtime",
        credentials: Optional[AWSCredentials] = None,
        profile_name: Optional[str] = None,
    ):
        """
        Initialize SigV4Auth.
        
        Args:
            region: AWS region
            service: AWS service name
            credentials: Optional pre-configured credentials
            profile_name: Optional AWS profile name
        """
        self.region = region
        self.service = service
        self.credentials = credentials or get_aws_credentials(profile_name)
    
    def _sign(self, key: bytes, msg: str) -> bytes:
        """Create HMAC-SHA256 signature."""
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()
    
    def _get_signature_key(self, date_stamp: str) -> bytes:
        """
        Derive the signing key for SigV4.
        
        Args:
            date_stamp: Date in YYYYMMDD format
            
        Returns:
            Derived signing key
        """
        k_date = self._sign(
            f"AWS4{self.credentials.secret_key}".encode("utf-8"),
            date_stamp
        )
        k_region = self._sign(k_date, self.region)
        k_service = self._sign(k_region, self.service)
        k_signing = self._sign(k_service, "aws4_request")
        return k_signing
    
    def _hash_payload(self, payload: str) -> str:
        """Create SHA256 hash of the payload."""
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
    
    def _create_canonical_request(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        signed_headers: str,
        payload_hash: str,
    ) -> str:
        """
        Create the canonical request string for SigV4.
        
        Args:
            method: HTTP method
            url: Request URL
            headers: Request headers
            signed_headers: Semicolon-separated list of signed header names
            payload_hash: SHA256 hash of the request payload
            
        Returns:
            Canonical request string
        """
        parsed = urlparse(url)
        
        # Canonical URI (URL-encoded path)
        canonical_uri = quote(parsed.path or "/", safe="/-_.~")
        
        # Canonical query string (sorted parameters)
        query_params = parsed.query
        if query_params:
            params = sorted(query_params.split("&"))
            canonical_querystring = "&".join(params)
        else:
            canonical_querystring = ""
        
        # Canonical headers (lowercase, sorted)
        canonical_headers = ""
        for header in sorted(signed_headers.split(";")):
            canonical_headers += f"{header}:{headers.get(header, '')}\n"
        
        canonical_request = "\n".join([
            method,
            canonical_uri,
            canonical_querystring,
            canonical_headers,
            signed_headers,
            payload_hash,
        ])
        
        return canonical_request
    
    def _create_string_to_sign(
        self,
        amz_date: str,
        date_stamp: str,
        canonical_request: str,
    ) -> str:
        """
        Create the string to sign for SigV4.
        
        Args:
            amz_date: Timestamp in ISO 8601 format
            date_stamp: Date in YYYYMMDD format
            canonical_request: The canonical request string
            
        Returns:
            String to sign
        """
        credential_scope = f"{date_stamp}/{self.region}/{self.service}/aws4_request"
        
        string_to_sign = "\n".join([
            self.ALGORITHM,
            amz_date,
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ])
        
        return string_to_sign
    
    def sign_request(
        self,
        method: str,
        url: str,
        headers: Optional[dict[str, str]] = None,
        body: str = "",
    ) -> dict[str, str]:
        """
        Sign an HTTP request using AWS SigV4.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: Full request URL
            headers: Optional existing headers to include
            body: Request body (empty string for GET requests)
            
        Returns:
            Dictionary of headers including the Authorization header
        """
        headers = dict(headers) if headers else {}
        
        # Get current timestamp
        t = datetime.datetime.utcnow()
        amz_date = t.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = t.strftime("%Y%m%d")
        
        # Parse URL for host header
        parsed = urlparse(url)
        host = parsed.netloc
        
        # Add required headers
        headers["host"] = host
        headers["x-amz-date"] = amz_date
        
        # Add security token if using temporary credentials
        if self.credentials.session_token:
            headers["x-amz-security-token"] = self.credentials.session_token
        
        # Calculate payload hash
        payload_hash = self._hash_payload(body)
        headers["x-amz-content-sha256"] = payload_hash
        
        # Determine signed headers
        signed_headers = ";".join(sorted(headers.keys()))
        
        # Create canonical request
        canonical_request = self._create_canonical_request(
            method=method,
            url=url,
            headers=headers,
            signed_headers=signed_headers,
            payload_hash=payload_hash,
        )
        
        # Create string to sign
        string_to_sign = self._create_string_to_sign(
            amz_date=amz_date,
            date_stamp=date_stamp,
            canonical_request=canonical_request,
        )
        
        # Calculate signature
        signing_key = self._get_signature_key(date_stamp)
        signature = hmac.new(
            signing_key,
            string_to_sign.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        # Create authorization header
        credential_scope = f"{date_stamp}/{self.region}/{self.service}/aws4_request"
        authorization_header = (
            f"{self.ALGORITHM} "
            f"Credential={self.credentials.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, "
            f"Signature={signature}"
        )
        
        headers["authorization"] = authorization_header
        
        return headers


def create_sigv4_headers(
    method: str,
    url: str,
    region: str,
    body: str = "",
    service: str = "bedrock-agent-runtime",
    headers: Optional[dict[str, str]] = None,
    profile_name: Optional[str] = None,
) -> dict[str, str]:
    """
    Convenience function to create SigV4-signed headers.
    
    Args:
        method: HTTP method
        url: Request URL
        region: AWS region
        body: Request body
        service: AWS service name
        headers: Optional existing headers
        profile_name: Optional AWS profile name
        
    Returns:
        Dictionary of signed headers
    """
    auth = SigV4Auth(
        region=region,
        service=service,
        profile_name=profile_name,
    )
    return auth.sign_request(
        method=method,
        url=url,
        headers=headers,
        body=body,
    )


def sign_request(
    method: str,
    url: str,
    region: str,
    body: str = "",
    headers: Optional[dict[str, str]] = None,
) -> dict[str, str]:
    """
    Sign an HTTP request for AWS services.
    
    This is a simplified wrapper around create_sigv4_headers for common use cases.
    
    Args:
        method: HTTP method
        url: Request URL
        region: AWS region
        body: Request body
        headers: Optional existing headers
        
    Returns:
        Dictionary of signed headers
    """
    return create_sigv4_headers(
        method=method,
        url=url,
        region=region,
        body=body,
        headers=headers,
    )
