"""
Prompts package for Ethereum Wallet MCP Server.

This package contains MCP prompt templates for guided wallet operations.
"""

from .wallet_prompts import register_wallet_prompts
from .signing_prompts import register_signing_prompts

__all__ = [
    "register_wallet_prompts",
    "register_signing_prompts",
]
