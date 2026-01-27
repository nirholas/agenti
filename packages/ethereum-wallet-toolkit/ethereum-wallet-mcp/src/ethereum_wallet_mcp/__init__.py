"""
Ethereum Wallet MCP Server

A Model Context Protocol server providing Ethereum wallet generation,
HD wallet operations, and related cryptographic functionality.
"""

__version__ = "0.1.0"
__author__ = "Ethereum Wallet MCP"

from .server import main, create_server

__all__ = ["main", "create_server", "__version__"]
