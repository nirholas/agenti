"""ag402-claude: Ag402 adapter for Claude Code.

Provides a pre-request hook that intercepts HTTP 402 responses and
automatically handles x402 payment, enabling Claude Code to seamlessly
access paid APIs without manual payment steps.

Two integration modes:
  1. MCP mode (recommended): Use ag402-client-mcp as an MCP server — Claude
     Code calls fetch_with_autopay via MCP Tools.
  2. Hook mode: Register ag402-claude-hook as a Claude Code user hook that
     intercepts outbound HTTP requests and handles 402s transparently.
"""

__version__ = "0.1.9"

from ag402_claude.hook import ClaudeCodeHook

__all__ = ["__version__", "ClaudeCodeHook"]
