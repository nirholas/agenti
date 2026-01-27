"""
x402 Payment Integration for Ethereum Wallet MCP

This module provides x402 payment protocol integration for monetizing
MCP tools with HTTP 402 Payment Required responses.
"""

from .middleware import (
    X402Config,
    X402Middleware,
    with_x402,
    create_payment_required_response,
    verify_payment,
)

__all__ = [
    "X402Config",
    "X402Middleware", 
    "with_x402",
    "create_payment_required_response",
    "verify_payment",
]
