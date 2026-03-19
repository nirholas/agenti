"""
Authentication utilities for x402 Payer Agent.

This module provides IAM SigV4 authentication for AgentCore Gateway invocations.
"""

from .sigv4 import (
    AWSCredentials,
    SigV4Auth,
    create_sigv4_headers,
    get_aws_credentials,
    sign_request,
)

__all__ = [
    "AWSCredentials",
    "SigV4Auth",
    "create_sigv4_headers",
    "get_aws_credentials",
    "sign_request",
]
