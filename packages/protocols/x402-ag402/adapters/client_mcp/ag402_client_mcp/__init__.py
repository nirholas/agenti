"""Ag402 MCP Client — x402 auto-payment exposed as MCP Tools.

Allows Claude Code, Cursor, OpenClaw and any MCP-compatible AI tool
to automatically pay for HTTP 402 APIs via the x402 protocol.
"""

__version__ = "0.1.20"

from ag402_client_mcp.server import Ag402MCPServer

__all__ = ["__version__", "Ag402MCPServer"]
