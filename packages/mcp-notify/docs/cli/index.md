---
title: CLI Reference
description: Command-line interface reference for MCP Notify
icon: material/console
---

# CLI Reference

The `mcp-notify-cli` command-line tool for interacting with MCP Notify.

## Installation

```bash
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest
```

## Global Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--api-url` | API endpoint URL | `http://localhost:8080` |
| `--api-key` | API key for authentication | - |
| `--output` | Output format: `table`, `json`, `yaml` | `table` |
| `--config` | Config file path | `~/.mcp-notify/config.yaml` |
| `--verbose` | Enable verbose output | `false` |

## Commands

<div class="grid cards" markdown>

-   :material-history:{ .lg .middle } __changes__

    ---

    View detected changes in the MCP Registry

    [:octicons-arrow-right-24: Documentation](changes.md)

-   :material-eye:{ .lg .middle } __watch__

    ---

    Monitor registry changes in real-time

    [:octicons-arrow-right-24: Documentation](watch.md)

-   :material-bell-plus:{ .lg .middle } __subscribe__

    ---

    Create notification subscriptions

    [:octicons-arrow-right-24: Documentation](subscribe.md)

-   :material-bell:{ .lg .middle } __subscriptions__

    ---

    Manage existing subscriptions

    [:octicons-arrow-right-24: Documentation](subscriptions.md)

-   :material-server:{ .lg .middle } __servers__

    ---

    List and search MCP servers

    [:octicons-arrow-right-24: Documentation](servers.md)

-   :material-camera:{ .lg .middle } __snapshot__

    ---

    Create and compare registry snapshots

    [:octicons-arrow-right-24: Documentation](snapshot.md)

-   :material-cog:{ .lg .middle } __config__

    ---

    Manage CLI configuration

    [:octicons-arrow-right-24: Documentation](config.md)

</div>

## Quick Examples

```bash
# View recent changes
mcp-notify-cli changes --since 24h

# Watch in real-time
mcp-notify-cli watch --interval 1m

# Create a Discord subscription
mcp-notify-cli subscribe discord \
  --webhook-url "https://discord.com/api/webhooks/..." \
  --name "My Alerts"

# List your subscriptions
mcp-notify-cli subscriptions list

# Search for servers
mcp-notify-cli servers search "database"

# Output as JSON
mcp-notify-cli changes --output json
```

## Configuration File

Create `~/.mcp-notify/config.yaml`:

```yaml
api_url: "http://localhost:8080"
api_key: "mcp_xxxxxxxxxxxx"
output: table

watch:
  interval: 5m
  sound: true

changes:
  limit: 50
  since: 24h
```

## Shell Completion

Generate shell completion scripts:

=== "Bash"

    ```bash
    mcp-notify-cli completion bash > /etc/bash_completion.d/mcp-notify-cli
    ```

=== "Zsh"

    ```bash
    mcp-notify-cli completion zsh > "${fpath[1]}/_mcp-notify-cli"
    ```

=== "Fish"

    ```bash
    mcp-notify-cli completion fish > ~/.config/fish/completions/mcp-notify-cli.fish
    ```

=== "PowerShell"

    ```powershell
    mcp-notify-cli completion powershell > mcp-notify-cli.ps1
    ```
