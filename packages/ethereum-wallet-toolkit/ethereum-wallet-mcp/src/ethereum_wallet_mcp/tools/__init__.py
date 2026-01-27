"""
Tools package for Ethereum Wallet MCP Server.

This package contains all MCP tool implementations for wallet operations.
"""

from .wallet_generation import register_wallet_tools
from .signing import register_signing_tools
from .typed_data import register_typed_data_tools

__all__ = [
    "register_wallet_tools",
    "register_signing_tools",
    "register_typed_data_tools",
]
