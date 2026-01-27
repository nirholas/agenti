---
title: MCP Server
description: MCP server integration for AI assistants
icon: material/robot
---

# MCP Server

MCP Notify includes a native MCP server that allows AI assistants like Claude to query the registry directly.

## Overview

The `mcp-notify-mcp` server exposes registry data as MCP tools:

| Tool | Description |
|------|-------------|
| `search_servers` | Search for MCP servers by name or description |
| `get_server` | Get detailed information about a specific server |
| `list_servers` | List all servers in the registry |
| `get_stats` | Get registry statistics |

## Installation

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-mcp@latest
```

## Setup

<div class="grid cards" markdown>

-   :material-apple:{ .lg .middle } __Claude Desktop__

    ---

    Add to Claude Desktop for registry-aware conversations

    [:octicons-arrow-right-24: Setup Guide](claude-desktop.md)

-   :material-cog:{ .lg .middle } __Tool Reference__

    ---

    Complete reference for all MCP tools

    [:octicons-arrow-right-24: Tools Reference](tools.md)

</div>

## Quick Start

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "mcp-notify": {
      "command": "mcp-notify-mcp"
    }
  }
}
```

Restart Claude Desktop to load the server.

### Test the Connection

In Claude Desktop, try:

> "What MCP servers are available for database operations?"

Claude will use the `search_servers` tool to query the registry.

## Example Conversations

### Search for Servers

> **You:** Find me MCP servers related to file systems

> **Claude:** I'll search the MCP registry for file system related servers.
>
> I found 5 servers related to file systems:
> 
> 1. **filesystem** - Basic file system operations
> 2. **secure-fs** - Secure file system with sandboxing
> 3. **cloud-storage** - Multi-cloud storage integration
> ...

### Get Server Details

> **You:** Tell me more about the "filesystem" MCP server

> **Claude:** Here's the detailed information about the filesystem server:
>
> | Field | Value |
> |-------|-------|
> | Name | filesystem |
> | Version | 1.2.0 |
> | Description | Basic file system operations for reading and writing files |
> | Repository | github.com/modelcontextprotocol/servers |
> | License | MIT |

### Registry Statistics

> **You:** How many MCP servers are in the registry?

> **Claude:** Based on the current registry statistics:
>
> - **Total servers:** 127
> - **New this week:** 8
> - **Updated this week:** 23

## Why Use the MCP Server?

- **Natural language queries** - Ask about servers conversationally
- **Always up-to-date** - Queries the live registry
- **Context-aware** - Claude can make recommendations based on your needs
- **Tool discovery** - Find the right MCP server for your task
