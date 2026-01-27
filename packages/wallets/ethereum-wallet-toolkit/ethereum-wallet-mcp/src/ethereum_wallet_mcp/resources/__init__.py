"""
Resources package for Ethereum Wallet MCP Server.

This package contains MCP resource implementations for documentation and data.
"""

from .documentation import register_documentation_resources
from .signing_resources import register_signing_resources

__all__ = [
    "register_documentation_resources",
    "register_signing_resources",
]
