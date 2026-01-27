---
title: Getting Started
description: Get started with MCP Notify in minutes
icon: material/rocket-launch
---

# Getting Started

Welcome to MCP Notify! This section will help you get up and running with real-time MCP Registry notifications.

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } __Installation__

    ---

    Install the CLI tool, run the server, or deploy to the cloud

    [:octicons-arrow-right-24: Install now](installation.md)

-   :material-clock-fast:{ .lg .middle } __Quick Start__

    ---

    Get your first notification in under 5 minutes

    [:octicons-arrow-right-24: Quick start](quickstart.md)

-   :material-bell-ring:{ .lg .middle } __First Subscription__

    ---

    Create your first subscription and configure filters

    [:octicons-arrow-right-24: Create subscription](first-subscription.md)

-   :material-cog:{ .lg .middle } __Configuration__

    ---

    Configure the server, CLI, and notification channels

    [:octicons-arrow-right-24: Configuration](configuration.md)

</div>

## What is MCP Notify?

MCP Notify is a monitoring service that tracks changes in the [official MCP Registry](https://registry.modelcontextprotocol.io). It provides:

- **Real-time monitoring** of the MCP Registry
- **Intelligent diff detection** to identify what changed
- **Multi-channel notifications** (Discord, Slack, Email, Telegram, Teams, Webhooks, RSS)
- **Flexible filtering** by namespace, keywords, and change types
- **Multiple interfaces**: Web dashboard, CLI, REST API, and MCP Server

## Choose Your Path

=== ":material-console: CLI User"

    Perfect for developers who prefer the command line:
    
    ```bash
    go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest
    mcp-notify-cli watch
    ```

=== ":material-api: API Integration"

    Build custom integrations with the REST API:
    
    ```bash
    curl http://localhost:8080/api/v1/changes?limit=10
    ```

=== ":material-robot: AI Assistant"

    Add MCP Registry awareness to Claude or other AI assistants:
    
    ```json
    {
      "mcpServers": {
        "mcp-notify": {
          "command": "mcp-notify-mcp"
        }
      }
    }
    ```

=== ":material-docker: Self-Hosted"

    Run your own instance with Docker:
    
    ```bash
    docker compose up -d
    ```

## Next Steps

1. [Install](installation.md) the CLI or deploy the server
2. [Create your first subscription](first-subscription.md)
3. Explore [notification channels](../channels/index.md)
4. Check out the [API reference](../api/index.md)
