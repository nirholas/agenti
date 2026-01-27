# Installation

Set up the llm.energy MCP server for AI assistants.

---

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) allows AI assistants to interact with external tools and data sources.

---

## Quick Setup

=== "npx (Recommended)"

    No installation required:

    ```json
    {
      "mcpServers": {
        "llm-energy": {
          "command": "npx",
          "args": ["-y", "@llm-energy/mcp-server"]
        }
      }
    }
    ```

=== "Global Install"

    ```bash
    npm install -g @llm-energy/mcp-server
    ```

    ```json
    {
      "mcpServers": {
        "llm-energy": {
          "command": "llm-energy-mcp"
        }
      }
    }
    ```

---

## Configuration

=== "Claude Desktop"

    Add to your Claude Desktop config:

    | OS | Path |
    |----|------|
    | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
    | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

=== "VS Code / Cursor"

    Add to workspace settings or MCP configuration:

    ```json
    {
      "llm-energy": {
        "command": "npx",
        "args": ["-y", "@llm-energy/mcp-server"]
      }
    }
    ```

---

## Verify Installation

After configuration, restart your AI client. Ask:

> "What tools does llm-energy provide?"

The assistant should list the available extraction tools.
