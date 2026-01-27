"""
Transaction MCP Server

MCP Server providing Ethereum transaction capabilities:
- Transaction building and signing
- Transaction decoding and analysis
- Gas estimation and conversion
- Support for Legacy and EIP-1559 transactions
"""

__version__ = "1.0.0"
__author__ = "nich"

from .server import main, create_server

__all__ = ["main", "create_server", "__version__"]
