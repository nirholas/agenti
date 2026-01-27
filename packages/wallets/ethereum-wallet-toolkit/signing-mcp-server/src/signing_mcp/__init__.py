"""
Signing MCP Server

MCP Server providing Ethereum message signing capabilities:
- EIP-191 personal_sign message signing
- EIP-712 typed structured data signing
- Signature verification and recovery
- Signature composition and decomposition
"""

__version__ = "1.0.0"
__author__ = "nich"

from .server import main, create_server

__all__ = ["main", "create_server", "__version__"]
