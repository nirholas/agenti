---
title: Claude Desktop Setup
description: Configure MCP Notify with Claude Desktop
icon: material/robot
---

# Claude Desktop Setup

Add MCP Registry awareness to Claude Desktop in 2 minutes.

## Prerequisites

- [Claude Desktop](https://claude.ai/download) installed
- Go 1.24+ installed

## Installation

### 1. Install the MCP Server

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-mcp@latest
```

Verify it's installed:

```bash
which mcp-notify-mcp
# Should output: /Users/you/go/bin/mcp-notify-mcp
```

### 2. Configure Claude Desktop

Open your Claude Desktop configuration file:

=== ":material-apple: macOS"

    ```bash
    open ~/Library/Application\ Support/Claude/claude_desktop_config.json
    ```

=== ":material-microsoft-windows: Windows"

    ```
    %APPDATA%\Claude\claude_desktop_config.json
    ```

=== ":material-linux: Linux"

    ```bash
    ~/.config/Claude/claude_desktop_config.json
    ```

Add the MCP server configuration:

```json
{
  "mcpServers": {
    "mcp-notify": {
      "command": "/full/path/to/mcp-notify-mcp"
    }
  }
}
```

!!! tip "Use Full Path"
    Replace `/full/path/to/mcp-notify-mcp` with the actual path from `which mcp-notify-mcp`.

### 3. Restart Claude Desktop

Quit and reopen Claude Desktop to load the new MCP server.

### 4. Verify It's Working

In Claude Desktop, look for the 🔌 icon in the toolbar. Click it to see connected MCP servers.

Try a query:

> "Search the MCP registry for database servers"

## Available Tools

Once connected, Claude can use these tools:

### search_servers

Search for MCP servers by keyword.

```
You: Find MCP servers for working with databases
Claude: [Uses search_servers with query "database"]
```

### get_server

Get detailed information about a specific server.

```
You: Tell me about the filesystem MCP server
Claude: [Uses get_server with name "filesystem"]
```

### list_servers

List all servers in the registry.

```
You: How many MCP servers are available?
Claude: [Uses list_servers, then summarizes]
```

### get_stats

Get registry statistics.

```
You: Show me MCP registry statistics
Claude: [Uses get_stats]
```

## Example Session

Here's a sample conversation with Claude using the MCP Registry:

---

**You:** I need an MCP server for working with Slack. What's available?

**Claude:** Let me search the MCP registry for Slack-related servers.

I found 2 servers related to Slack:

1. **slack** (v1.0.0)
   - Official Slack integration for sending and reading messages
   - Repository: github.com/modelcontextprotocol/servers
   
2. **slack-advanced** (v0.2.0)
   - Advanced Slack features including threads and reactions
   - Repository: github.com/community/slack-advanced

Would you like more details about either of these?

---

**You:** Tell me more about the official slack server

**Claude:** Here are the details for the official Slack MCP server:

| Field | Value |
|-------|-------|
| **Name** | slack |
| **Version** | 1.0.0 |
| **Description** | Official Slack integration for sending and reading messages, managing channels, and more |
| **Repository** | [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) |
| **License** | MIT |
| **Author** | Anthropic |

**Capabilities:**
- Send messages to channels
- Read channel history
- List channels and users
- Upload files

Would you like help setting this up?

---

## Troubleshooting

??? question "Claude doesn't show the MCP server?"

    1. Check the config file path is correct
    2. Verify the command path is absolute
    3. Restart Claude Desktop completely
    4. Check Claude Desktop logs for errors

??? question "Getting permission errors?"

    Ensure the binary is executable:
    
    ```bash
    chmod +x $(which mcp-notify-mcp)
    ```

??? question "Slow responses?"

    The MCP server queries the live registry. First requests may be slower. Subsequent queries use caching.
