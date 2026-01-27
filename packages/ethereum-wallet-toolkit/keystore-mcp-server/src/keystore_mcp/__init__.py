"""
Keystore MCP Server

MCP server for Ethereum keystore encryption, decryption, and management.
"""

__version__ = "0.1.0"

from .server import main, create_server

__all__ = ["main", "create_server", "__version__"]
